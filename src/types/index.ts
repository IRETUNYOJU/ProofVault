/**
 * Type definitions for ProofVault Hedera deployment system
 */

export interface NetworkConfig {
  network: 'testnet' | 'mainnet' | 'local';
  rpcUrl: string;
  operatorKey: string;
  operatorId?: string;
  chainId: number;
  gasPrice?: string;
  gasLimit?: number;
  timeout?: number;
}

export interface ContractConfig {
  name: string;
  constructorArgs?: unknown[];
  libraries?: Record<string, string>;
  verify?: boolean;
}

export interface DeploymentConfig {
  network: NetworkConfig;
  contracts: {
    identityAttestation: ContractConfig;
    proofVault: ContractConfig;
    legalCaseManager: ContractConfig;
  };
  verification?: {
    enabled: boolean;
    apiKey?: string;
    delay?: number;
  };
}

export interface DeployedContract {
  name: string;
  address: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  deploymentTimestamp: number;
  constructorArgs?: unknown[];
  verified?: boolean;
}

export interface DeploymentResult {
  network: string;
  deployer: string;
  timestamp: number;
  contracts: Record<string, DeployedContract>;
  totalGasUsed: string;
  success: boolean;
  error?: string;
}

export interface HederaClientConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet';
  maxTransactionFee?: number;
  maxQueryPayment?: number;
}

export interface ContractDeploymentOptions {
  gasLimit?: number;
  gasPrice?: string;
  value?: string;
  nonce?: number;
  timeout?: number;
  confirmations?: number;
}

export interface VerificationOptions {
  contractAddress: string;
  contractName: string;
  constructorArgs?: unknown[];
  libraries?: Record<string, string>;
  delay?: number;
  retries?: number;
}

// Hedera-specific types
export interface HederaContractInfo {
  contractId: string;
  evmAddress: string;
  adminKey?: string;
  memo?: string;
  autoRenewPeriod?: number;
  maxAutomaticTokenAssociations?: number;
}

// Evidence management types (for SDK)
export interface EvidenceSubmission {
  title: string;
  description: string;
  evidenceType: number;
  classification: number;
  ipfsHash: string;
  metadataHash: string;
  cryptographicHash: string;
  isEncrypted: boolean;
}

export interface EvidenceMetadata {
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  creationTimestamp: number;
  deviceInfo: string;
  geoLocation: string;
  tags: string[];
}

export interface CaseSubmission {
  caseNumber: string;
  caseTitle: string;
  caseType: number;
  priority: number;
  description: string;
  jurisdiction: string;
  courtLocation: string;
  isPublic: boolean;
}

export interface IdentityVerificationRequest {
  requestedLevel: number;
  professionalType: number;
  documentsHash: string;
  personalDetails: string;
}

// Error types
export class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

export class ContractVerificationError extends Error {
  constructor(
    message: string,
    public readonly contractAddress: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ContractVerificationError';
  }
}

export class HederaClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HederaClientError';
  }
}

// Utility types
export type NetworkName = 'testnet' | 'mainnet' | 'local';
export type ContractName = 'IdentityAttestation' | 'ProofVault' | 'LegalCaseManager';
export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'verifying'
  | 'verified';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}
