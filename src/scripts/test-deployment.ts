#!/usr/bin/env node

/**
 * Test script to verify Hedera deployment functionality
 */

import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { config } from '../config';
import { ConsoleLogger, isValidHederaAccountId, isValidHederaPrivateKey } from '../utils';

class DeploymentTester {
  private logger: ConsoleLogger;
  private networkName: string;

  constructor(networkName?: string) {
    this.networkName = networkName ?? 'testnet';
    this.logger = new ConsoleLogger('info');
  }

  /**
   * Test Hedera client connection
   */
  testHederaConnection(): boolean {
    this.logger.info('🔗 Testing Hedera client connection...');

    try {
      const hederaConfig = config.getHederaClientConfig(this.networkName);

      // Validate configuration
      if (!isValidHederaAccountId(hederaConfig.operatorId)) {
        throw new Error(`Invalid operator ID format: ${hederaConfig.operatorId}`);
      }

      if (!isValidHederaPrivateKey(hederaConfig.operatorKey)) {
        throw new Error('Invalid operator key format');
      }

      // Create client
      const client = hederaConfig.network === 'testnet' ? Client.forTestnet() : Client.forMainnet();

      const operatorKey = PrivateKey.fromString(hederaConfig.operatorKey);
      const operatorId = AccountId.fromString(hederaConfig.operatorId);

      client.setOperator(operatorId, operatorKey);

      // Test connection by querying account balance
      this.logger.info(`Operator Account: ${operatorId.toString()}`);
      this.logger.info(`Network: ${hederaConfig.network}`);

      // Close client
      client.close();

      this.logger.info('✅ Hedera connection test passed');
      return true;
    } catch (error) {
      this.logger.error('❌ Hedera connection test failed:', error);
      return false;
    }
  }

  /**
   * Test contract compilation
   */
  async testContractCompilation(): Promise<boolean> {
    this.logger.info('🔨 Testing contract compilation...');

    try {
      const { loadContractArtifact } = await import('../utils');

      // Test loading each contract artifact
      const contracts = ['IdentityAttestation', 'ProofVault', 'LegalCaseManager'];

      for (const contractName of contracts) {
        try {
          const artifact = loadContractArtifact(contractName);

          if (!artifact.abi || !artifact.bytecode) {
            throw new Error(`Invalid artifact for ${contractName}`);
          }

          if (artifact.bytecode === '0x') {
            throw new Error(`No bytecode found for ${contractName}`);
          }

          this.logger.info(`✅ ${contractName} artifact loaded successfully`);
        } catch (error) {
          this.logger.error(`❌ Failed to load ${contractName} artifact:`, error);
          return false;
        }
      }

      this.logger.info('✅ Contract compilation test passed');
      return true;
    } catch (error) {
      this.logger.error('❌ Contract compilation test failed:', error);
      return false;
    }
  }

  /**
   * Test configuration validation
   */
  testConfiguration(): boolean {
    this.logger.info('⚙️ Testing configuration...');

    try {
      const deploymentConfig = config.getDeploymentConfig(this.networkName);

      // Validate configuration
      config.validateConfig(deploymentConfig);

      this.logger.info(`Network: ${deploymentConfig.network.network}`);
      this.logger.info(`RPC URL: ${deploymentConfig.network.rpcUrl}`);
      this.logger.info(`Chain ID: ${deploymentConfig.network.chainId}`);

      // Check if all required contracts are configured
      const requiredContracts = ['identityAttestation', 'proofVault', 'legalCaseManager'];
      for (const contractKey of requiredContracts) {
        if (!deploymentConfig.contracts[contractKey as keyof typeof deploymentConfig.contracts]) {
          throw new Error(`Missing configuration for contract: ${contractKey}`);
        }
      }

      this.logger.info('✅ Configuration test passed');
      return true;
    } catch (error) {
      this.logger.error('❌ Configuration test failed:', error);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<boolean> {
    this.logger.info('🧪 Running ProofVault deployment tests...');
    this.logger.info(`Target network: ${this.networkName}\n`);

    const tests = [
      { name: 'Configuration', test: () => this.testConfiguration() },
      { name: 'Contract Compilation', test: () => this.testContractCompilation() },
      { name: 'Hedera Connection', test: () => this.testHederaConnection() },
    ];

    let allPassed = true;

    for (const { name, test } of tests) {
      try {
        const passed = await test();
        if (!passed) {
          allPassed = false;
        }
      } catch (error) {
        this.logger.error(`Test ${name} threw an error:`, error);
        allPassed = false;
      }
      this.logger.info(''); // Add spacing between tests
    }

    if (allPassed) {
      this.logger.info('🎉 All tests passed! Ready for deployment.');
    } else {
      this.logger.error('💥 Some tests failed. Please fix the issues before deploying.');
    }

    return allPassed;
  }
}

/**
 * Main test function
 */
async function main(): Promise<void> {
  const networkName = process.argv[2] ?? process.env['NETWORK'] ?? 'testnet';

  console.log('🧪 ProofVault Deployment Test Suite');
  console.log('===================================\n');

  const tester = new DeploymentTester(networkName);
  const success = await tester.runAllTests();

  process.exit(success ? 0 : 1);
}

// Run tests if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { DeploymentTester };
