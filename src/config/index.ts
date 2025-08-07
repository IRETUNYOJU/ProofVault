/**
 * Configuration management for ProofVault deployment
 */

import dotenv from 'dotenv';
import type { DeploymentConfig, HederaClientConfig, NetworkConfig } from '../types';

dotenv.config();

/**
 * Get environment variable with validation
 */
function getEnvVar(name: string, required = true, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (required && !value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value || '';
}

/**
 * Get network configuration based on environment
 */
export function getNetworkConfig(networkName?: string): NetworkConfig {
  const network = (networkName || process.env['NETWORK'] || 'testnet') as 'testnet' | 'mainnet' | 'local';

  switch (network) {
    case 'testnet':
      return {
        network: 'testnet',
        rpcUrl: getEnvVar('RPC_URL', true, 'https://testnet.hashio.io/api'),
        operatorKey: getEnvVar('OPERATOR_KEY'),
        operatorId: getEnvVar('OPERATOR_ID', false),
        chainId: 296,
        gasPrice: 'auto',
        timeout: 60000,
      };

    case 'mainnet':
      return {
        network: 'mainnet',
        rpcUrl: getEnvVar('MAINNET_RPC_URL', true, 'https://mainnet.hashio.io/api'),
        operatorKey: getEnvVar('MAINNET_OPERATOR_KEY'),
        operatorId: getEnvVar('MAINNET_OPERATOR_ID', false),
        chainId: 295,
        gasPrice: 'auto',
        timeout: 60000,
      };

    case 'local':
      return {
        network: 'local',
        rpcUrl: getEnvVar('LOCAL_RPC_URL', true, 'http://localhost:8545'),
        operatorKey: getEnvVar('LOCAL_OPERATOR_KEY', true, '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
        operatorId: getEnvVar('LOCAL_OPERATOR_ID', false),
        chainId: 31337,
        gasPrice: 'auto',
        timeout: 30000,
      };

    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

/**
 * Get Hedera client configuration
 */
export function getHederaClientConfig(networkName?: string): HederaClientConfig {
  const network = (networkName || process.env['NETWORK'] || 'testnet') as 'testnet' | 'mainnet';
  
  if (network === 'testnet') {
    return {
      operatorId: getEnvVar('OPERATOR_ID', true, '0.0.123456'),
      operatorKey: getEnvVar('OPERATOR_KEY'),
      network: 'testnet',
      maxTransactionFee: 100_000_000, // 1 HBAR
      maxQueryPayment: 10_000_000,    // 0.1 HBAR
    };
  } else {
    return {
      operatorId: getEnvVar('MAINNET_OPERATOR_ID'),
      operatorKey: getEnvVar('MAINNET_OPERATOR_KEY'),
      network: 'mainnet',
      maxTransactionFee: 100_000_000, // 1 HBAR
      maxQueryPayment: 10_000_000,    // 0.1 HBAR
    };
  }
}

/**
 * Get complete deployment configuration
 */
export function getDeploymentConfig(networkName?: string): DeploymentConfig {
  const networkConfig = getNetworkConfig(networkName);

  return {
    network: networkConfig,
    contracts: {
      identityAttestation: {
        name: 'IdentityAttestation',
        constructorArgs: [],
        verify: true,
      },
      proofVault: {
        name: 'ProofVault',
        constructorArgs: [],
        verify: true,
      },
      legalCaseManager: {
        name: 'LegalCaseManager',
        constructorArgs: [], // Will be populated with deployed contract addresses
        verify: true,
      },
    },
    verification: {
      enabled: getEnvVar('VERIFY_CONTRACTS', false, 'true') === 'true',
      apiKey: getEnvVar('ETHERSCAN_API_KEY', false),
      delay: parseInt(getEnvVar('VERIFICATION_DELAY', false, '30000'), 10),
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: DeploymentConfig): void {
  // Validate network configuration
  if (!config.network.rpcUrl) {
    throw new Error('RPC URL is required');
  }

  if (!config.network.operatorKey) {
    throw new Error('Operator key is required');
  }

  if (config.network.operatorKey.length !== 66 && !config.network.operatorKey.startsWith('0x')) {
    throw new Error('Invalid operator key format');
  }

  // Validate contract configuration
  const contractNames = Object.keys(config.contracts);
  if (contractNames.length === 0) {
    throw new Error('At least one contract must be configured for deployment');
  }

  // Validate verification configuration
  if (config.verification?.enabled && !config.verification.apiKey && config.network.network !== 'local') {
    console.warn('Contract verification is enabled but no API key provided');
  }
}

/**
 * Get gas configuration
 */
export function getGasConfig(networkName?: string): { gasPrice?: string; gasLimit?: number } {
  return {
    gasPrice: getEnvVar('GAS_PRICE', false, 'auto'),
    gasLimit: parseInt(getEnvVar('GAS_LIMIT', false, '8000000'), 10),
  };
}

/**
 * Get deployment output directory
 */
export function getDeploymentOutputDir(): string {
  return getEnvVar('DEPLOYMENT_OUTPUT_DIR', false, './deployments');
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return getEnvVar('CI', false, 'false') === 'true';
}

/**
 * Get log level
 */
export function getLogLevel(): string {
  return getEnvVar('LOG_LEVEL', false, 'info');
}

/**
 * Export all configuration getters
 */
export const config = {
  getNetworkConfig,
  getHederaClientConfig,
  getDeploymentConfig,
  validateConfig,
  getGasConfig,
  getDeploymentOutputDir,
  isCI,
  getLogLevel,
};
