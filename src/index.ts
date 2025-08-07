/**
 * ProofVault - Hedera Blockchain Legal Evidence Management System
 *
 * This is the main entry point for the ProofVault system.
 * It provides a comprehensive solution for managing legal evidence
 * on the Hedera blockchain network.
 */

export * from './config';
export * from './types';
export * from './utils';

import type { NetworkConfig } from './types';

// Re-export important contract types when they're generated
export type { IdentityAttestation, LegalCaseManager, ProofVault } from '../typechain-types';

/**
 * Main ProofVault class for interacting with the system
 */
export class ProofVaultSDK {
  private readonly networkConfig: NetworkConfig;

  constructor(networkConfig: NetworkConfig) {
    this.networkConfig = networkConfig;
  }

  /**
   * Initialize the ProofVault SDK
   */
  public initialize(): void {
    // Implementation will be added as we build the system
    console.log('ProofVault SDK initialized for network:', this.networkConfig.network);
  }
}

export default ProofVaultSDK;
