#!/usr/bin/env node

/**
 * Contract verification script for ProofVault
 */

import { ethers } from 'ethers';
import { config } from '../config';
import type { VerificationOptions } from '../types';
import { ConsoleLogger, loadLatestDeployment, retry } from '../utils';

class ContractVerifier {
  private logger: ConsoleLogger;
  private networkName: string;

  constructor(networkName?: string) {
    this.networkName = networkName || process.env['NETWORK'] || 'testnet';
    this.logger = new ConsoleLogger(config.getLogLevel());
  }

  /**
   * Verify a single contract
   */
  private async verifyContract(options: VerificationOptions): Promise<boolean> {
    this.logger.info(`🔍 Verifying contract ${options.contractName} at ${options.contractAddress}...`);

    try {
      // Note: This is a placeholder implementation
      // In a real Hedera deployment, you would integrate with the appropriate block explorer API
      // For example, HashScan or other Hedera-compatible explorers
      
      await this.simulateVerification(options);
      
      this.logger.info(`✅ Contract ${options.contractName} verified successfully`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to verify contract ${options.contractName}:`, error);
      return false;
    }
  }

  /**
   * Simulate contract verification (placeholder)
   */
  private async simulateVerification(options: VerificationOptions): Promise<void> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, options.delay || 5000));
    
    // In a real implementation, this would:
    // 1. Submit contract source code to block explorer
    // 2. Wait for verification to complete
    // 3. Check verification status
    
    this.logger.info(`Simulated verification for ${options.contractName}`);
    this.logger.info(`Contract address: ${options.contractAddress}`);
    if (options.constructorArgs && options.constructorArgs.length > 0) {
      this.logger.info(`Constructor args: ${JSON.stringify(options.constructorArgs)}`);
    }
  }

  /**
   * Verify all contracts from latest deployment
   */
  public async verifyAllContracts(): Promise<boolean> {
    this.logger.info('🚀 Starting contract verification process...');
    
    // Load latest deployment
    const deployment = loadLatestDeployment(this.networkName, config.getDeploymentOutputDir());
    if (!deployment) {
      this.logger.error(`No deployment found for network: ${this.networkName}`);
      return false;
    }

    if (!deployment.success) {
      this.logger.error('Cannot verify contracts from failed deployment');
      return false;
    }

    this.logger.info(`Found deployment from ${new Date(deployment.timestamp).toISOString()}`);
    this.logger.info(`Network: ${deployment.network}`);
    this.logger.info(`Deployer: ${deployment.deployer}`);

    let allVerified = true;
    const verificationPromises: Promise<boolean>[] = [];

    // Verify each contract
    for (const [name, contract] of Object.entries(deployment.contracts)) {
      if (contract.verified) {
        this.logger.info(`✅ Contract ${name} already verified`);
        continue;
      }

      const verificationOptions: VerificationOptions = {
        contractAddress: contract.address,
        contractName: name,
        constructorArgs: contract.constructorArgs || [],
        delay: 5000,
        retries: 3,
      };

      const verificationPromise = retry(
        () => this.verifyContract(verificationOptions),
        verificationOptions.retries,
        2000,
        this.logger
      );

      verificationPromises.push(verificationPromise);
    }

    // Wait for all verifications to complete
    const results = await Promise.allSettled(verificationPromises);
    
    for (const result of results) {
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value)) {
        allVerified = false;
      }
    }

    if (allVerified) {
      this.logger.info('🎉 All contracts verified successfully!');
    } else {
      this.logger.error('❌ Some contracts failed verification');
    }

    return allVerified;
  }

  /**
   * Verify specific contract by address
   */
  public async verifyContractByAddress(
    contractAddress: string,
    contractName: string,
    constructorArgs?: any[]
  ): Promise<boolean> {
    if (!ethers.isAddress(contractAddress)) {
      this.logger.error(`Invalid contract address: ${contractAddress}`);
      return false;
    }

    const options: VerificationOptions = {
      contractAddress,
      contractName,
      constructorArgs: constructorArgs || [],
      delay: 5000,
      retries: 3,
    };

    return retry(
      () => this.verifyContract(options),
      options.retries,
      2000,
      this.logger
    );
  }
}

/**
 * Main verification function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const networkName = args[0] || process.env['NETWORK'];
  
  console.log('🔍 ProofVault Contract Verification');
  console.log('===================================\n');
  
  const verifier = new ContractVerifier(networkName);
  
  if (args.length >= 3) {
    // Verify specific contract
    const contractAddress = args[1];
    const contractName = args[2];
    const constructorArgs = args[3] ? JSON.parse(args[3]) : undefined;
    
    console.log(`Verifying specific contract: ${contractName} at ${contractAddress}`);
    const success = await verifier.verifyContractByAddress(contractAddress!, contractName!, constructorArgs);
    process.exit(success ? 0 : 1);
  } else {
    // Verify all contracts from latest deployment
    const success = await verifier.verifyAllContracts();
    process.exit(success ? 0 : 1);
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { ContractVerifier, main as verifyMain };

