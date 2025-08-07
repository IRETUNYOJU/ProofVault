/**
 * Utility functions for ProofVault deployment
 */

import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import type { 
  DeploymentResult, 
  DeployedContract, 
  Logger, 
  NetworkConfig,
  ContractDeploymentOptions 
} from '../types';

/**
 * Simple console logger implementation
 */
export class ConsoleLogger implements Logger {
  private logLevel: string;

  constructor(logLevel = 'info') {
    this.logLevel = logLevel;
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}

/**
 * Create ethers provider from network config
 */
export function createProvider(networkConfig: NetworkConfig): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  
  // Set timeout if specified
  if (networkConfig.timeout) {
    // Note: ethers v6 doesn't have a direct timeout setting on provider
    // This would need to be handled at the request level
  }

  return provider;
}

/**
 * Create ethers wallet from network config
 */
export function createWallet(networkConfig: NetworkConfig, provider: ethers.JsonRpcProvider): ethers.Wallet {
  if (!networkConfig.operatorKey) {
    throw new Error('Operator key is required');
  }

  // Ensure the key has 0x prefix
  const privateKey = networkConfig.operatorKey.startsWith('0x') 
    ? networkConfig.operatorKey 
    : `0x${networkConfig.operatorKey}`;

  return new ethers.Wallet(privateKey, provider);
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  confirmations = 1,
  timeout = 60000,
  logger?: Logger
): Promise<ethers.TransactionReceipt> {
  logger?.info(`Waiting for transaction ${txHash} with ${confirmations} confirmations...`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) {
        const currentBlock = await provider.getBlockNumber();
        const confirmationCount = currentBlock - receipt.blockNumber + 1;
        
        if (confirmationCount >= confirmations) {
          logger?.info(`Transaction ${txHash} confirmed with ${confirmationCount} confirmations`);
          return receipt;
        }
        
        logger?.debug(`Transaction ${txHash} has ${confirmationCount}/${confirmations} confirmations`);
      }
    } catch (error) {
      logger?.debug(`Error checking transaction ${txHash}:`, error);
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Transaction ${txHash} not confirmed within ${timeout}ms`);
}

/**
 * Estimate gas for contract deployment
 */
export async function estimateDeploymentGas(
  wallet: ethers.Wallet,
  contractFactory: ethers.ContractFactory,
  constructorArgs: any[] = [],
  logger?: Logger
): Promise<bigint> {
  try {
    logger?.debug('Estimating gas for contract deployment...');
    
    const deploymentData = contractFactory.interface.encodeDeploy(constructorArgs);
    const bytecode = contractFactory.bytecode + deploymentData.slice(2);
    
    const gasEstimate = await wallet.estimateGas({
      data: bytecode,
    });
    
    logger?.debug(`Estimated gas: ${gasEstimate.toString()}`);
    return gasEstimate;
  } catch (error) {
    logger?.warn('Gas estimation failed, using default gas limit');
    return BigInt(8000000); // Default gas limit
  }
}

/**
 * Save deployment result to file
 */
export async function saveDeploymentResult(
  result: DeploymentResult,
  outputDir: string,
  logger?: Logger
): Promise<void> {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `deployment-${result.network}-${Date.now()}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    logger?.info(`Deployment result saved to ${filepath}`);

    // Also save as latest deployment for the network
    const latestFilepath = path.join(outputDir, `latest-${result.network}.json`);
    fs.writeFileSync(latestFilepath, JSON.stringify(result, null, 2));
    logger?.info(`Latest deployment saved to ${latestFilepath}`);
  } catch (error) {
    logger?.error('Failed to save deployment result:', error);
    throw error;
  }
}

/**
 * Load latest deployment result
 */
export function loadLatestDeployment(network: string, outputDir: string): DeploymentResult | null {
  try {
    const filepath = path.join(outputDir, `latest-${network}.json`);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content) as DeploymentResult;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Format gas amount for display
 */
export function formatGas(gas: bigint | string): string {
  const gasAmount = typeof gas === 'string' ? BigInt(gas) : gas;
  return gasAmount.toLocaleString();
}

/**
 * Format ether amount for display
 */
export function formatEther(wei: bigint | string): string {
  const weiAmount = typeof wei === 'string' ? BigInt(wei) : wei;
  return ethers.formatEther(weiAmount);
}

/**
 * Calculate total gas used from deployment result
 */
export function calculateTotalGasUsed(result: DeploymentResult): bigint {
  let total = BigInt(0);
  for (const contract of Object.values(result.contracts)) {
    total += BigInt(contract.gasUsed);
  }
  return total;
}

/**
 * Validate contract address
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  logger?: Logger
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger?.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Get contract artifact path
 */
export function getContractArtifactPath(contractName: string): string {
  return path.join(process.cwd(), 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
}

/**
 * Load contract artifact
 */
export function loadContractArtifact(contractName: string): any {
  const artifactPath = getContractArtifactPath(contractName);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found: ${artifactPath}`);
  }
  
  const content = fs.readFileSync(artifactPath, 'utf8');
  return JSON.parse(content);
}
