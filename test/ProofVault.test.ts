/**
 * Comprehensive tests for ProofVault contract
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { TestAccounts, TestContracts } from './helpers/setup';
import {
    createSampleEvidenceData,
    expectRevert,
    formatTestResult,
    getCurrentTimestamp,
    getGasUsed,
    setupTestEnvironment
} from './helpers/setup';

describe('ProofVault', function () {
  let contracts: TestContracts;
  let accounts: TestAccounts;

  beforeEach(async function () {
    const setup = await setupTestEnvironment();
    contracts = setup.contracts;
    accounts = setup.accounts;
  });

  describe('Deployment', function () {
    it('Should deploy with correct initial state', async function () {
      expect(await contracts.proofVault.getTotalEvidenceCount()).to.equal(0);
      
      // Check if deployer has admin role
      const adminRole = await contracts.proofVault.DEFAULT_ADMIN_ROLE();
      expect(await contracts.proofVault.hasRole(adminRole, accounts.deployer.address)).to.be.true;
    });

    it('Should have correct role constants', async function () {
      const evidenceAdminRole = await contracts.proofVault.EVIDENCE_ADMIN_ROLE();
      const legalAuthorityRole = await contracts.proofVault.LEGAL_AUTHORITY_ROLE();
      const forensicExpertRole = await contracts.proofVault.FORENSIC_EXPERT_ROLE();
      
      expect(evidenceAdminRole).to.not.equal(ethers.ZeroHash);
      expect(legalAuthorityRole).to.not.equal(ethers.ZeroHash);
      expect(forensicExpertRole).to.not.equal(ethers.ZeroHash);
    });
  });

  describe('Evidence Submission', function () {
    it('Should submit evidence successfully', async function () {
      const evidenceData = createSampleEvidenceData();
      
      const tx = await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );

      const gasUsed = await getGasUsed(tx);
      console.log(`      ${formatTestResult('Evidence submission', gasUsed)}`);

      // Check if evidence was created
      expect(await contracts.proofVault.getTotalEvidenceCount()).to.equal(1);

      // Verify evidence details
      const evidenceRecord = await contracts.proofVault.connect(accounts.user1).getEvidenceRecord(1);
      expect(evidenceRecord[1]).to.equal(evidenceData.title); // title
      expect(evidenceRecord[2]).to.equal(evidenceData.description); // description
      expect(evidenceRecord[3]).to.equal(accounts.user1.address); // submitter
      expect(evidenceRecord[5]).to.equal(evidenceData.evidenceType); // evidenceType
    });

    it('Should emit EvidenceSubmitted event', async function () {
      const evidenceData = createSampleEvidenceData();
      
      await expect(
        contracts.proofVault.connect(accounts.user1).submitEvidence(
          evidenceData.title,
          evidenceData.description,
          evidenceData.evidenceType,
          evidenceData.classification,
          evidenceData.ipfsHash,
          evidenceData.metadataHash,
          evidenceData.cryptographicHash,
          evidenceData.isEncrypted
        )
      ).to.emit(contracts.proofVault, 'EvidenceSubmitted')
       .withArgs(1, accounts.user1.address, evidenceData.evidenceType, evidenceData.title, await getCurrentTimestamp() + 1);
    });

    it('Should reject evidence with empty title', async function () {
      const evidenceData = createSampleEvidenceData();
      evidenceData.title = '';
      
      await expectRevert(
        contracts.proofVault.connect(accounts.user1).submitEvidence(
          evidenceData.title,
          evidenceData.description,
          evidenceData.evidenceType,
          evidenceData.classification,
          evidenceData.ipfsHash,
          evidenceData.metadataHash,
          evidenceData.cryptographicHash,
          evidenceData.isEncrypted
        ),
        'Title required'
      );
    });

    it('Should reject evidence with empty IPFS hash', async function () {
      const evidenceData = createSampleEvidenceData();
      evidenceData.ipfsHash = '';
      
      await expectRevert(
        contracts.proofVault.connect(accounts.user1).submitEvidence(
          evidenceData.title,
          evidenceData.description,
          evidenceData.evidenceType,
          evidenceData.classification,
          evidenceData.ipfsHash,
          evidenceData.metadataHash,
          evidenceData.cryptographicHash,
          evidenceData.isEncrypted
        ),
        'IPFS hash required'
      );
    });

    it('Should reject duplicate evidence', async function () {
      const evidenceData = createSampleEvidenceData();
      
      // Submit evidence first time
      await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );

      // Try to submit same evidence again
      await expectRevert(
        contracts.proofVault.connect(accounts.user2).submitEvidence(
          evidenceData.title,
          evidenceData.description,
          evidenceData.evidenceType,
          evidenceData.classification,
          evidenceData.ipfsHash,
          evidenceData.metadataHash,
          evidenceData.cryptographicHash,
          evidenceData.isEncrypted
        ),
        'Evidence already exists'
      );
    });
  });

  describe('Evidence Access Control', function () {
    let evidenceId: number;

    beforeEach(async function () {
      const evidenceData = createSampleEvidenceData();
      await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );
      evidenceId = 1;
    });

    it('Should allow submitter to access evidence', async function () {
      const evidenceRecord = await contracts.proofVault.connect(accounts.user1).getEvidenceRecord(evidenceId);
      expect(evidenceRecord[3]).to.equal(accounts.user1.address); // submitter
    });

    it('Should allow admin to access evidence', async function () {
      const evidenceRecord = await contracts.proofVault.connect(accounts.admin).getEvidenceRecord(evidenceId);
      expect(evidenceRecord[0]).to.equal(evidenceId); // evidenceId
    });

    it('Should deny access to unauthorized users', async function () {
      await expectRevert(
        contracts.proofVault.connect(accounts.user2).getEvidenceRecord(evidenceId),
        'No access to evidence'
      );
    });

    it('Should allow submitter to authorize viewers', async function () {
      await contracts.proofVault.connect(accounts.user1).authorizeViewer(evidenceId, accounts.user2.address);
      
      // Now user2 should be able to access the evidence
      const evidenceRecord = await contracts.proofVault.connect(accounts.user2).getEvidenceRecord(evidenceId);
      expect(evidenceRecord[0]).to.equal(evidenceId);
    });

    it('Should emit AccessGranted event when authorizing viewer', async function () {
      await expect(
        contracts.proofVault.connect(accounts.user1).authorizeViewer(evidenceId, accounts.user2.address)
      ).to.emit(contracts.proofVault, 'AccessGranted')
       .withArgs(evidenceId, accounts.user2.address, accounts.user1.address, 'READ', await getCurrentTimestamp() + 1);
    });
  });

  describe('Evidence Status Management', function () {
    let evidenceId: number;

    beforeEach(async function () {
      const evidenceData = createSampleEvidenceData();
      await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );
      evidenceId = 1;
    });

    it('Should allow submitter to update evidence status', async function () {
      const newStatus = 2; // VERIFIED
      
      await contracts.proofVault.connect(accounts.user1).updateEvidenceStatus(evidenceId, newStatus);
      
      const evidenceRecord = await contracts.proofVault.connect(accounts.user1).getEvidenceRecord(evidenceId);
      expect(evidenceRecord[6]).to.equal(newStatus); // status
    });

    it('Should allow admin to update evidence status', async function () {
      const newStatus = 3; // CHALLENGED
      
      await contracts.proofVault.connect(accounts.admin).updateEvidenceStatus(evidenceId, newStatus);
      
      const evidenceRecord = await contracts.proofVault.connect(accounts.admin).getEvidenceRecord(evidenceId);
      expect(evidenceRecord[6]).to.equal(newStatus); // status
    });

    it('Should emit EvidenceStatusUpdated event', async function () {
      const newStatus = 2; // VERIFIED
      
      await expect(
        contracts.proofVault.connect(accounts.user1).updateEvidenceStatus(evidenceId, newStatus)
      ).to.emit(contracts.proofVault, 'EvidenceStatusUpdated')
       .withArgs(evidenceId, 0, newStatus, accounts.user1.address, await getCurrentTimestamp() + 1); // 0 = SUBMITTED
    });

    it('Should deny unauthorized users from updating status', async function () {
      const newStatus = 2; // VERIFIED
      
      await expectRevert(
        contracts.proofVault.connect(accounts.user2).updateEvidenceStatus(evidenceId, newStatus),
        'Not authorized to update status'
      );
    });
  });

  describe('Evidence Sealing', function () {
    let evidenceId: number;

    beforeEach(async function () {
      const evidenceData = createSampleEvidenceData();
      await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );
      evidenceId = 1;
    });

    it('Should allow legal authority to seal evidence', async function () {
      const sealDuration = 86400; // 1 day
      
      await contracts.proofVault.connect(accounts.legalAuthority).sealEvidence(evidenceId, sealDuration);
      
      const evidenceRecord = await contracts.proofVault.connect(accounts.legalAuthority).getEvidenceRecord(evidenceId);
      expect(evidenceRecord[12]).to.be.true; // isSealed
    });

    it('Should emit EvidenceSealed event', async function () {
      const sealDuration = 86400; // 1 day
      const currentTime = await getCurrentTimestamp();
      
      await expect(
        contracts.proofVault.connect(accounts.legalAuthority).sealEvidence(evidenceId, sealDuration)
      ).to.emit(contracts.proofVault, 'EvidenceSealed')
       .withArgs(evidenceId, accounts.legalAuthority.address, currentTime + sealDuration + 1, currentTime + 1);
    });

    it('Should deny non-legal authority from sealing evidence', async function () {
      const sealDuration = 86400; // 1 day
      
      await expectRevert(
        contracts.proofVault.connect(accounts.user1).sealEvidence(evidenceId, sealDuration),
        `AccessControl: account ${accounts.user1.address.toLowerCase()} is missing role`
      );
    });
  });

  describe('Evidence Integrity Verification', function () {
    let evidenceId: number;
    let cryptographicHash: string;

    beforeEach(async function () {
      const evidenceData = createSampleEvidenceData();
      cryptographicHash = evidenceData.cryptographicHash;
      
      await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );
      evidenceId = 1;
    });

    it('Should verify evidence integrity with correct hash', async function () {
      const isValid = await contracts.proofVault.connect(accounts.user1).verifyEvidenceIntegrity(evidenceId, cryptographicHash);
      expect(isValid).to.be.true;
    });

    it('Should fail verification with incorrect hash', async function () {
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes('wrong content'));
      const isValid = await contracts.proofVault.connect(accounts.user1).verifyEvidenceIntegrity(evidenceId, wrongHash);
      expect(isValid).to.be.false;
    });

    it('Should emit EvidenceIntegrityVerified event', async function () {
      await expect(
        contracts.proofVault.connect(accounts.user1).verifyEvidenceIntegrity(evidenceId, cryptographicHash)
      ).to.emit(contracts.proofVault, 'EvidenceIntegrityVerified')
       .withArgs(evidenceId, accounts.user1.address, true, await getCurrentTimestamp() + 1);
    });
  });
});
