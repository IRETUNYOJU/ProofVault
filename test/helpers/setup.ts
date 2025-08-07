/**
 * Test setup and helper functions for ProofVault Hedera tests
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { 
  Client, 
  PrivateKey, 
  AccountId, 
  ContractCreateTransaction,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar
} from '@hashgraph/sdk';
import type { 
  IdentityAttestation,
  ProofVault,
  LegalCaseManager
} from '../../typechain-types';

export interface TestContracts {
  identityAttestation: IdentityAttestation;
  proofVault: ProofVault;
  legalCaseManager: LegalCaseManager;
}

export interface TestAccounts {
  deployer: any;
  admin: any;
  user1: any;
  user2: any;
  legalAuthority: any;
  forensicExpert: any;
}

export interface HederaTestSetup {
  client: Client;
  operatorKey: PrivateKey;
  operatorId: AccountId;
  contracts: TestContracts;
  accounts: TestAccounts;
}

/**
 * Deploy all contracts for testing
 */
export async function deployTestContracts(): Promise<TestContracts> {
  // Get signers
  const [deployer] = await ethers.getSigners();

  // Deploy IdentityAttestation
  const IdentityAttestationFactory = await ethers.getContractFactory('IdentityAttestation');
  const identityAttestation = await IdentityAttestationFactory.deploy();
  await identityAttestation.waitForDeployment();

  // Deploy ProofVault
  const ProofVaultFactory = await ethers.getContractFactory('ProofVault');
  const proofVault = await ProofVaultFactory.deploy();
  await proofVault.waitForDeployment();

  // Deploy LegalCaseManager
  const LegalCaseManagerFactory = await ethers.getContractFactory('LegalCaseManager');
  const legalCaseManager = await LegalCaseManagerFactory.deploy(
    await proofVault.getAddress(),
    await identityAttestation.getAddress()
  );
  await legalCaseManager.waitForDeployment();

  return {
    identityAttestation: identityAttestation as IdentityAttestation,
    proofVault: proofVault as ProofVault,
    legalCaseManager: legalCaseManager as LegalCaseManager,
  };
}

/**
 * Setup test accounts with roles
 */
export async function setupTestAccounts(contracts: TestContracts): Promise<TestAccounts> {
  const signers = await ethers.getSigners();
  const [deployer, admin, user1, user2, legalAuthority, forensicExpert] = signers;

  // Grant roles in IdentityAttestation
  await contracts.identityAttestation.grantRole(
    await contracts.identityAttestation.VERIFIER_ROLE(),
    admin.address
  );

  await contracts.identityAttestation.grantRole(
    await contracts.identityAttestation.VERIFIER_ROLE(),
    legalAuthority.address
  );

  // Grant roles in ProofVault
  await contracts.proofVault.grantRole(
    await contracts.proofVault.EVIDENCE_ADMIN_ROLE(),
    admin.address
  );

  await contracts.proofVault.grantRole(
    await contracts.proofVault.LEGAL_AUTHORITY_ROLE(),
    legalAuthority.address
  );

  await contracts.proofVault.grantRole(
    await contracts.proofVault.FORENSIC_EXPERT_ROLE(),
    forensicExpert.address
  );

  // Grant roles in LegalCaseManager
  await contracts.legalCaseManager.grantRole(
    await contracts.legalCaseManager.CASE_ADMIN_ROLE(),
    admin.address
  );

  await contracts.legalCaseManager.grantRole(
    await contracts.legalCaseManager.JUDGE_ROLE(),
    legalAuthority.address
  );

  return {
    deployer,
    admin,
    user1,
    user2,
    legalAuthority,
    forensicExpert,
  };
}

/**
 * Setup complete test environment
 */
export async function setupTestEnvironment(): Promise<{ contracts: TestContracts; accounts: TestAccounts }> {
  const contracts = await deployTestContracts();
  const accounts = await setupTestAccounts(contracts);

  return { contracts, accounts };
}

/**
 * Create sample evidence data for testing
 */
export function createSampleEvidenceData() {
  return {
    title: 'Test Evidence Document',
    description: 'A sample evidence document for testing purposes',
    evidenceType: 0, // DOCUMENT
    classification: 1, // RESTRICTED
    ipfsHash: 'QmTestHash123456789',
    metadataHash: 'QmMetadataHash123456789',
    cryptographicHash: ethers.keccak256(ethers.toUtf8Bytes('test evidence content')),
    isEncrypted: false,
  };
}

/**
 * Create sample case data for testing
 */
export function createSampleCaseData() {
  return {
    caseNumber: 'CASE-2024-001',
    caseTitle: 'Test Legal Case',
    caseType: 0, // CIVIL
    priority: 1, // MEDIUM
    description: 'A sample legal case for testing purposes',
    jurisdiction: 'Test Jurisdiction',
    courtLocation: 'Test Court',
    isPublic: false,
  };
}

/**
 * Create sample identity verification request
 */
export function createSampleIdentityRequest() {
  return {
    requestedLevel: 2, // PROFESSIONAL
    professionalType: 1, // LAWYER
    documentsHash: ethers.keccak256(ethers.toUtf8Bytes('identity documents')),
    personalDetails: 'Test personal details',
  };
}

/**
 * Helper to advance time in tests
 */
export async function advanceTime(seconds: number): Promise<void> {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
}

/**
 * Helper to get current timestamp
 */
export async function getCurrentTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock('latest');
  return block?.timestamp || 0;
}

/**
 * Helper to expect revert with specific message
 */
export function expectRevert(promise: Promise<any>, message?: string) {
  if (message) {
    return expect(promise).to.be.revertedWith(message);
  }
  return expect(promise).to.be.reverted;
}

/**
 * Helper to calculate gas used
 */
export async function getGasUsed(tx: any): Promise<bigint> {
  const receipt = await tx.wait();
  return receipt.gasUsed;
}

/**
 * Helper to format test output
 */
export function formatTestResult(name: string, gasUsed?: bigint): string {
  if (gasUsed) {
    return `${name} - Gas used: ${gasUsed.toLocaleString()}`;
  }
  return name;
}
