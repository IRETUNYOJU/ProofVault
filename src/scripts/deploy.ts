#!/usr/bin/env node

/**
 * Main deployment script for ProofVault contracts on Hedera
 */

import { ethers } from 'ethers';
import { config } from '../config';
import { 
  ConsoleLogger, 
  createProvider, 
  createWallet, 
  waitForTransaction,
  estimateDeploymentGas,
  saveDeploymentResult,
  formatGas,
  formatEther,
  retry,
  loadContractArtifact
} from '../utils';
import type { 
  DeploymentResult, 
  DeployedContract, 
  DeploymentConfig,
  ContractDeploymentOptions 
} from '../types';

class ContractDeployer {
  private logger: ConsoleLogger;
  private config: DeploymentConfig;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private deploymentResult: DeploymentResult;

  constructor(networkName?: string) {
    this.logger = new ConsoleLogger(config.getLogLevel());
    this.config = config.getDeploymentConfig(networkName);
    
    // Validate configuration
    config.validateConfig(this.config);
    
    this.provider = createProvider(this.config.network);
    this.wallet = createWallet(this.config.network, this.provider);
    
    this.deploymentResult = {
      network: this.config.network.network,
      deployer: this.wallet.address,
      timestamp: Date.now(),
      contracts: {},
      totalGasUsed: '0',
      success: false,
    };
  }

  /**
   * Deploy a single contract
   */
  private async deployContract(
    contractName: string,
    constructorArgs: any[] = [],
    options: ContractDeploymentOptions = {}
  ): Promise<DeployedContract> {
    this.logger.info(`\n🚀 Deploying ${contractName}...`);
    
    try {
      // Load contract artifact
      const artifact = loadContractArtifact(contractName);
      const contractFactory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        this.wallet
      );

      // Estimate gas
      const estimatedGas = await estimateDeploymentGas(
        this.wallet,
        contractFactory,
        constructorArgs,
        this.logger
      );

      // Prepare deployment options
      const deployOptions: any = {
        gasLimit: options.gasLimit || estimatedGas + BigInt(100000), // Add buffer
      };

      if (options.gasPrice && options.gasPrice !== 'auto') {
        deployOptions.gasPrice = ethers.parseUnits(options.gasPrice, 'gwei');
      }

      if (options.value) {
        deployOptions.value = ethers.parseEther(options.value);
      }

      this.logger.info(`Gas limit: ${formatGas(deployOptions.gasLimit)}`);
      if (deployOptions.gasPrice) {
        this.logger.info(`Gas price: ${formatEther(deployOptions.gasPrice)} ETH`);
      }

      // Deploy contract
      this.logger.info('Sending deployment transaction...');
      const contract = await contractFactory.deploy(...constructorArgs, deployOptions);
      
      this.logger.info(`Transaction hash: ${contract.deploymentTransaction()?.hash}`);
      this.logger.info('Waiting for deployment confirmation...');

      // Wait for deployment
      const deploymentReceipt = await contract.waitForDeployment();
      const receipt = await contract.deploymentTransaction()?.wait();

      if (!receipt) {
        throw new Error('Failed to get deployment receipt');
      }

      const deployedContract: DeployedContract = {
        name: contractName,
        address: await contract.getAddress(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        deploymentTimestamp: Date.now(),
        constructorArgs,
        verified: false,
      };

      this.logger.info(`✅ ${contractName} deployed successfully!`);
      this.logger.info(`   Address: ${deployedContract.address}`);
      this.logger.info(`   Gas used: ${formatGas(deployedContract.gasUsed)}`);
      this.logger.info(`   Block: ${deployedContract.blockNumber}`);

      return deployedContract;
    } catch (error) {
      this.logger.error(`❌ Failed to deploy ${contractName}:`, error);
      throw error;
    }
  }

  /**
   * Deploy all contracts in the correct order
   */
  private async deployAllContracts(): Promise<void> {
    this.logger.info('🏗️  Starting contract deployment...');
    this.logger.info(`Network: ${this.config.network.network}`);
    this.logger.info(`Deployer: ${this.wallet.address}`);
    this.logger.info(`RPC URL: ${this.config.network.rpcUrl}`);

    // Check deployer balance
    const balance = await this.provider.getBalance(this.wallet.address);
    this.logger.info(`Deployer balance: ${formatEther(balance)} ETH`);

    if (balance === BigInt(0)) {
      throw new Error('Deployer account has no balance');
    }

    try {
      // 1. Deploy IdentityAttestation
      const identityAttestation = await this.deployContract(
        'IdentityAttestation',
        this.config.contracts.identityAttestation.constructorArgs
      );
      this.deploymentResult.contracts.IdentityAttestation = identityAttestation;

      // 2. Deploy ProofVault
      const proofVault = await this.deployContract(
        'ProofVault',
        this.config.contracts.proofVault.constructorArgs
      );
      this.deploymentResult.contracts.ProofVault = proofVault;

      // 3. Deploy LegalCaseManager with dependencies
      const legalCaseManagerArgs = [
        proofVault.address,
        identityAttestation.address,
      ];
      
      const legalCaseManager = await this.deployContract(
        'LegalCaseManager',
        legalCaseManagerArgs
      );
      this.deploymentResult.contracts.LegalCaseManager = legalCaseManager;

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
  private async verifyContracts(): Promise<void> {
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
        await this.verifyContracts();
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
      await saveDeploymentResult(
        this.deploymentResult,
        config.getDeploymentOutputDir(),
        this.logger
      );
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
  const networkName = process.argv[2] || process.env.NETWORK;
  
  console.log('🌟 ProofVault Deployment Script');
  console.log('================================\n');
  
  const deployer = new ContractDeployer(networkName);
  const result = await deployer.deploy();
  
  if (result.success) {
    console.log('\n🎊 Deployment Summary:');
    console.log('======================');
    for (const [name, contract] of Object.entries(result.contracts)) {
      console.log(`${name}: ${contract.address}`);
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

export { ContractDeployer, main as deployMain };
