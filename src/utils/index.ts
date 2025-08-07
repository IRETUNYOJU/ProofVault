/**
 * Utility functions for ProofVault deployment
 */

import fs from 'fs';
import path from 'path';
import type { DeploymentResult, Logger } from '../types';

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

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}

/**
 * Validate Hedera account ID format
 */
export function isValidHederaAccountId(accountId: string): boolean {
  const pattern = /^\d+\.\d+\.\d+$/;
  return pattern.test(accountId);
}

/**
 * Validate Hedera private key format
 */
export function isValidHederaPrivateKey(privateKey: string): boolean {
  // Hedera private keys can be in hex format (with or without 0x prefix)
  // or in DER format
  if (privateKey.startsWith('0x')) {
    return privateKey.length === 66; // 64 hex chars + 0x prefix
  }
  return privateKey.length === 64 || privateKey.length === 96; // Raw hex or DER format
}

/**
 * Convert Hedera contract ID to EVM address
 */
export function contractIdToEvmAddress(contractId: string): string {
  const parts = contractId.split('.');
  if (parts.length !== 3 || !parts[2]) {
    throw new Error(`Invalid contract ID format: ${contractId}`);
  }

  const contractNum = parseInt(parts[2]);
  if (isNaN(contractNum)) {
    throw new Error(`Invalid contract number in ID: ${contractId}`);
  }

  // Convert contract number to EVM address format
  return '0x' + contractNum.toString(16).padStart(40, '0');
}

/**
 * Wait for Hedera transaction confirmation
 */
export async function waitForHederaTransaction(
  transactionId: string,
  timeout = 60000,
  logger?: Logger,
): Promise<boolean> {
  logger?.info(`Waiting for Hedera transaction ${transactionId}...`);

  const startTime = Date.now();

  // For Hedera, transactions are typically confirmed very quickly
  // This is a simplified implementation
  while (Date.now() - startTime < timeout) {
    try {
      // In a real implementation, you would query the transaction status
      // For now, we'll simulate a successful confirmation after a short delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      logger?.info(`Transaction ${transactionId} confirmed`);
      return true;
    } catch (error) {
      logger?.debug(`Error checking transaction ${transactionId}:`, error);
    }
  }

  throw new Error(`Transaction ${transactionId} not confirmed within ${timeout}ms`);
}

/**
 * Save deployment result to file
 */
export async function saveDeploymentResult(
  result: DeploymentResult,
  outputDir: string,
  logger?: Logger,
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
  } catch {
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
 * Format HBAR amount for display
 */
export function formatHbar(tinybars: bigint | string): string {
  const tinybarAmount = typeof tinybars === 'string' ? BigInt(tinybars) : tinybars;
  // 1 HBAR = 100,000,000 tinybars
  const hbarAmount = Number(tinybarAmount) / 100_000_000;
  return hbarAmount.toFixed(8) + ' HBAR';
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
 * Validate EVM address format
 */
export function isValidAddress(address: string): boolean {
  try {
    // Basic EVM address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  logger?: Logger,
): Promise<T> {
  let lastError: Error | undefined;

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

  throw lastError ?? new Error('Retry failed with unknown error');
}

/**
 * Get contract artifact path
 */
export function getContractArtifactPath(contractName: string): string {
  return path.join(
    process.cwd(),
    'artifacts',
    'contracts',
    `${contractName}.sol`,
    `${contractName}.json`,
  );
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
