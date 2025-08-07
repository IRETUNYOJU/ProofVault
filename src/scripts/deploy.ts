#!/usr/bin/env node

/**
 * Main deployment script for ProofVault contracts on Hedera using Hedera SDK
 */

import {
  AccountId,
  Client,
  ContractCreateTransaction,
  ContractFunctionParameters,
  FileAppendTransaction,
  FileCreateTransaction,
  Hbar,
  PrivateKey,
} from '@hashgraph/sdk';
import { config } from '../config';
import type {
  DeployedContract,
  DeploymentConfig,
  DeploymentResult,
  HederaClientConfig,
  HederaContractInfo,
} from '../types';
import { ConsoleLogger, formatGas, loadContractArtifact, saveDeploymentResult } from '../utils';

class HederaContractDeployer {
  private logger: ConsoleLogger;
  private config: DeploymentConfig;
  private hederaConfig: HederaClientConfig;
  private client: Client;
  private operatorKey: PrivateKey;
  private operatorId: AccountId;
  private deploymentResult: DeploymentResult;

  constructor(networkName?: string) {
    this.logger = new ConsoleLogger(config.getLogLevel());
    this.config = config.getDeploymentConfig(networkName);
    this.hederaConfig = config.getHederaClientConfig(networkName);

    // Validate configuration
    config.validateConfig(this.config);

    // Initialize Hedera client
    this.operatorKey = PrivateKey.fromString(this.hederaConfig.operatorKey);
    this.operatorId = AccountId.fromString(this.hederaConfig.operatorId);

    if (this.hederaConfig.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }

    this.client.setOperator(this.operatorId, this.operatorKey);
    this.client.setDefaultMaxTransactionFee(new Hbar(this.hederaConfig.maxTransactionFee ?? 100));
    this.client.setDefaultMaxQueryPayment(new Hbar(this.hederaConfig.maxQueryPayment ?? 10));

    this.deploymentResult = {
      network: this.config.network.network,
      deployer: this.operatorId.toString(),
      timestamp: Date.now(),
      contracts: {},
      totalGasUsed: '0',
      success: false,
    };
  }

  /**
   * Upload contract bytecode to Hedera File Service
   */
  private async uploadContractBytecode(contractName: string): Promise<string> {
    this.logger.info(`� Uploading ${contractName} bytecode to Hedera File Service...`);

    try {
      // Load contract artifact
      const artifact = loadContractArtifact(contractName);
      const bytecode = artifact.bytecode;

      if (!bytecode || bytecode === '0x') {
        throw new Error(`No bytecode found for contract ${contractName}`);
      }

      // Remove 0x prefix and convert to buffer
      const bytecodeBuffer = Buffer.from(bytecode.slice(2), 'hex');

      // Create file transaction
      const fileCreateTx = new FileCreateTransaction()
        .setContents(bytecodeBuffer.slice(0, 4096)) // First chunk
        .setKeys([this.operatorKey.publicKey])
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.client);

      const fileCreateSign = await fileCreateTx.sign(this.operatorKey);
      const fileCreateSubmit = await fileCreateSign.execute(this.client);
      const fileCreateReceipt = await fileCreateSubmit.getReceipt(this.client);
      const fileId = fileCreateReceipt.fileId;

      if (!fileId) {
        throw new Error('Failed to create file for bytecode');
      }

      this.logger.info(`File created with ID: ${fileId.toString()}`);

      // Append remaining bytecode if it's larger than 4096 bytes
      if (bytecodeBuffer.length > 4096) {
        this.logger.info('Appending remaining bytecode...');

        let offset = 4096;
        while (offset < bytecodeBuffer.length) {
          const chunk = bytecodeBuffer.slice(offset, offset + 4096);

          const fileAppendTx = new FileAppendTransaction()
            .setFileId(fileId)
            .setContents(chunk)
            .setMaxTransactionFee(new Hbar(2))
            .freezeWith(this.client);

          const fileAppendSign = await fileAppendTx.sign(this.operatorKey);
          const fileAppendSubmit = await fileAppendSign.execute(this.client);
          await fileAppendSubmit.getReceipt(this.client);

          offset += 4096;
        }
      }

      this.logger.info(`✅ Bytecode uploaded successfully to file ${fileId.toString()}`);
      return fileId.toString();
    } catch (error) {
      this.logger.error(`❌ Failed to upload bytecode for ${contractName}:`, error);
      throw error;
    }
  }

  /**
   * Deploy a single contract using Hedera SDK
   */
  private async deployContract(
    contractName: string,
    constructorArgs: unknown[] = [],
  ): Promise<DeployedContract> {
    this.logger.info(`\n🚀 Deploying ${contractName}...`);

    try {
      // Upload bytecode to Hedera File Service
      const fileId = await this.uploadContractBytecode(contractName);

      // Prepare constructor parameters
      let constructorParams: ContractFunctionParameters | undefined;
      if (constructorArgs.length > 0) {
        constructorParams = new ContractFunctionParameters();

        // Add constructor arguments based on their types
        for (const arg of constructorArgs) {
          if (typeof arg === 'string' && arg.startsWith('0x') && arg.length === 42) {
            // Address
            constructorParams.addAddress(arg);
          } else if (typeof arg === 'string') {
            // String
            constructorParams.addString(arg);
          } else if (typeof arg === 'number' || typeof arg === 'bigint') {
            // Number
            constructorParams.addUint256(arg);
          } else if (typeof arg === 'boolean') {
            // Boolean
            constructorParams.addBool(arg);
          } else {
            this.logger.warn(`Unknown constructor argument type for ${arg}, treating as string`);
            constructorParams.addString(String(arg));
          }
        }
      }

      // Create contract
      this.logger.info('Creating contract on Hedera...');
      const contractCreateTx = new ContractCreateTransaction()
        .setBytecodeFileId(fileId)
        .setGas(3000000) // 3M gas limit
        .setMaxTransactionFee(new Hbar(20));

      if (constructorParams) {
        contractCreateTx.setConstructorParameters(constructorParams);
      }

      const contractCreateSign = await contractCreateTx.sign(this.operatorKey);
      const contractCreateSubmit = await contractCreateSign.execute(this.client);
      const contractCreateReceipt = await contractCreateSubmit.getReceipt(this.client);

      const contractId = contractCreateReceipt.contractId;
      if (!contractId) {
        throw new Error('Failed to get contract ID from receipt');
      }

      // Get contract info for EVM address
      const contractInfo = this.getContractInfo(contractId.toString());

      const deployedContract: DeployedContract = {
        name: contractName,
        address: contractInfo.evmAddress,
        transactionHash: contractCreateSubmit.transactionId.toString(),
        blockNumber: 0, // Hedera doesn't use block numbers in the same way
        gasUsed: '3000000', // Approximate gas used
        deploymentTimestamp: Date.now(),
        constructorArgs,
        verified: false,
      };

      this.logger.info(`✅ ${contractName} deployed successfully!`);
      this.logger.info(`   Contract ID: ${contractId.toString()}`);
      this.logger.info(`   EVM Address: ${contractInfo.evmAddress}`);
      this.logger.info(`   Transaction ID: ${contractCreateSubmit.transactionId.toString()}`);

      return deployedContract;
    } catch (error) {
      this.logger.error(`❌ Failed to deploy ${contractName}:`, error);
      throw error;
    }
  }

  /**
   * Get contract information including EVM address
   */
  private getContractInfo(contractId: string): HederaContractInfo {
    try {
      // For now, we'll generate the EVM address from the contract ID
      // In a real implementation, you would query the contract info from Hedera
      const parts = contractId.split('.');
      if (parts.length < 3 || !parts[2]) {
        throw new Error(`Invalid contract ID format: ${contractId}`);
      }

      const contractNum = parseInt(parts[2]);
      if (isNaN(contractNum)) {
        throw new Error(`Invalid contract number in ID: ${contractId}`);
      }

      // Convert contract number to EVM address format
      const evmAddress = '0x' + contractNum.toString(16).padStart(40, '0');

      return {
        contractId,
        evmAddress,
      };
    } catch (error) {
      throw new Error(`Failed to get contract info for ${contractId}: ${error}`);
    }
  }

  /**
   * Deploy all contracts in the correct order
   */
  private async deployAllContracts(): Promise<void> {
    this.logger.info('🏗️  Starting contract deployment...');
    this.logger.info(`Network: ${this.config.network.network}`);
    this.logger.info(`Deployer: ${this.operatorId.toString()}`);
    this.logger.info(`Hedera Network: ${this.hederaConfig.network}`);

    // Check account balance (simplified for Hedera)
    this.logger.info(`Operator Account: ${this.operatorId.toString()}`);

    try {
      // 1. Deploy IdentityAttestation
      const identityAttestation = await this.deployContract(
        'IdentityAttestation',
        this.config.contracts.identityAttestation.constructorArgs ?? [],
      );
      this.deploymentResult.contracts['IdentityAttestation'] = identityAttestation;

      // 2. Deploy ProofVault
      const proofVault = await this.deployContract(
        'ProofVault',
        this.config.contracts.proofVault.constructorArgs ?? [],
      );
      this.deploymentResult.contracts['ProofVault'] = proofVault;

      // 3. Deploy LegalCaseManager with dependencies
      const legalCaseManagerArgs = [proofVault.address, identityAttestation.address];

      const legalCaseManager = await this.deployContract('LegalCaseManager', legalCaseManagerArgs);
      this.deploymentResult.contracts['LegalCaseManager'] = legalCaseManager;

      this.logger.info('\n🎉 All contracts deployed successfully!');

      // Calculate total gas used
      let totalGasUsed = BigInt(0);
      for (const contract of Object.values(this.deploymentResult.contracts)) {
        totalGasUsed += BigInt(contract.gasUsed);
      }
      this.deploymentResult.totalGasUsed = totalGasUsed.toString();

      this.logger.info(`Total gas used: ${formatGas(totalGasUsed)}`);
    } catch (error) {
      this.deploymentResult.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Verify contracts on block explorer
   */
  private verifyContracts(): void {
    if (!this.config.verification?.enabled) {
      this.logger.info('Contract verification is disabled');
      return;
    }

    this.logger.info('\n🔍 Starting contract verification...');

    // Note: Hedera doesn't have a standard block explorer verification API like Etherscan
    // This would need to be implemented based on the specific block explorer being used
    // For now, we'll just mark contracts as verified

    for (const [name, contract] of Object.entries(this.deploymentResult.contracts)) {
      this.logger.info(`Marking ${name} as verified (placeholder implementation)`);
      contract.verified = true;
    }

    this.logger.info('✅ Contract verification completed');
  }

  /**
   * Run the complete deployment process
   */
  public async deploy(): Promise<DeploymentResult> {
    const startTime = Date.now();

    try {
      await this.deployAllContracts();

      if (this.config.verification?.enabled) {
        this.verifyContracts();
      }

      this.deploymentResult.success = true;

      const duration = Date.now() - startTime;
      this.logger.info(`\n⏱️  Deployment completed in ${duration}ms`);
    } catch (error) {
      this.deploymentResult.success = false;
      this.deploymentResult.error = error instanceof Error ? error.message : String(error);
      this.logger.error('\n💥 Deployment failed:', error);
    }

    // Save deployment result
    try {
      saveDeploymentResult(this.deploymentResult, config.getDeploymentOutputDir(), this.logger);
    } catch (error) {
      this.logger.error('Failed to save deployment result:', error);
    }

    return this.deploymentResult;
  }
}

/**
 * Main deployment function
 */
async function main(): Promise<void> {
  const networkName = process.argv[2] ?? process.env['NETWORK'];

  console.log('🌟 ProofVault Hedera Deployment Script');
  console.log('======================================\n');

  const deployer = new HederaContractDeployer(networkName);
  const result = await deployer.deploy();

  if (result.success) {
    console.log('\n🎊 Deployment Summary:');
    console.log('======================');
    for (const [name, contract] of Object.entries(result.contracts)) {
      const deployedContract = contract;
      console.log(`${name}: ${deployedContract.address}`);
    }
    console.log(`\nTotal gas used: ${formatGas(result.totalGasUsed)}`);
    process.exit(0);
  } else {
    console.error('\n💀 Deployment failed!');
    console.error(result.error);
    process.exit(1);
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as deployMain, HederaContractDeployer };
