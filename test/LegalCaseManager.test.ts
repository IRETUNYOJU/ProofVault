/**
 * Comprehensive tests for LegalCaseManager contract
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { TestAccounts, TestContracts } from './helpers/setup';
import {
  createSampleCaseData,
  createSampleEvidenceData,
  expectRevert,
  formatTestResult,
  getCurrentTimestamp,
  getGasUsed,
  setupTestEnvironment,
} from './helpers/setup';

describe('LegalCaseManager', () => {
  let contracts: TestContracts;
  let accounts: TestAccounts;

  beforeEach(async () => {
    const setup = await setupTestEnvironment();
    contracts = setup.contracts;
    accounts = setup.accounts;
  });

  describe('Deployment', () => {
    it('Should deploy with correct initial state', async () => {
      expect(await contracts.legalCaseManager.getTotalCases()).to.equal(0);

      // Check if deployer has admin role
      const adminRole = await contracts.legalCaseManager.DEFAULT_ADMIN_ROLE();
      expect(await contracts.legalCaseManager.hasRole(adminRole, accounts.deployer.address)).to.be
        .true;
    });

    it('Should have correct contract references', async () => {
      const proofVaultAddress = await contracts.legalCaseManager.proofVault();
      const identityAttestationAddress = await contracts.legalCaseManager.identityAttestation();

      expect(proofVaultAddress).to.equal(await contracts.proofVault.getAddress());
      expect(identityAttestationAddress).to.equal(await contracts.identityAttestation.getAddress());
    });

    it('Should have correct role constants', async () => {
      const caseAdminRole = await contracts.legalCaseManager.CASE_ADMIN_ROLE();
      const judgeRole = await contracts.legalCaseManager.JUDGE_ROLE();
      const lawyerRole = await contracts.legalCaseManager.LAWYER_ROLE();

      expect(caseAdminRole).to.not.equal(ethers.ZeroHash);
      expect(judgeRole).to.not.equal(ethers.ZeroHash);
      expect(lawyerRole).to.not.equal(ethers.ZeroHash);
    });
  });

  describe('Case Creation', () => {
    it('Should create a case successfully', async () => {
      const caseData = createSampleCaseData();

      const tx = await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );

      const gasUsed = await getGasUsed(tx);
      console.log(`      ${formatTestResult('Case creation', gasUsed)}`);

      // Check if case was created
      expect(await contracts.legalCaseManager.getTotalCases()).to.equal(1);

      // Verify case details
      const caseRecord = await contracts.legalCaseManager.getCaseDetails(1);
      expect(caseRecord[1]).to.equal(caseData.caseNumber); // caseNumber
      expect(caseRecord[2]).to.equal(caseData.caseTitle); // caseTitle
      expect(caseRecord[3]).to.equal(accounts.user1.address); // creator
    });

    it('Should emit CaseCreated event', async () => {
      const caseData = createSampleCaseData();

      await expect(
        contracts.legalCaseManager
          .connect(accounts.user1)
          .createCase(
            caseData.caseNumber,
            caseData.caseTitle,
            caseData.caseType,
            caseData.priority,
            caseData.description,
            caseData.jurisdiction,
            caseData.courtLocation,
            caseData.isPublic,
          ),
      )
        .to.emit(contracts.legalCaseManager, 'CaseCreated')
        .withArgs(
          1,
          caseData.caseNumber,
          accounts.user1.address,
          (await getCurrentTimestamp()) + 1,
        );
    });

    it('Should reject case with duplicate case number', async () => {
      const caseData = createSampleCaseData();

      // Create first case
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );

      // Try to create case with same number
      await expectRevert(
        contracts.legalCaseManager
          .connect(accounts.user2)
          .createCase(
            caseData.caseNumber,
            'Different Title',
            caseData.caseType,
            caseData.priority,
            caseData.description,
            caseData.jurisdiction,
            caseData.courtLocation,
            caseData.isPublic,
          ),
        'Case number already exists',
      );
    });

    it('Should reject case with empty title', async () => {
      const caseData = createSampleCaseData();
      caseData.caseTitle = '';

      await expectRevert(
        contracts.legalCaseManager
          .connect(accounts.user1)
          .createCase(
            caseData.caseNumber,
            caseData.caseTitle,
            caseData.caseType,
            caseData.priority,
            caseData.description,
            caseData.jurisdiction,
            caseData.courtLocation,
            caseData.isPublic,
          ),
        'Case title required',
      );
    });
  });

  describe('Case Status Management', () => {
    let caseId: number;

    beforeEach(async () => {
      const caseData = createSampleCaseData();
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );
      caseId = 1;
    });

    it('Should allow case creator to update status', async () => {
      const newStatus = 1; // IN_PROGRESS

      await contracts.legalCaseManager.connect(accounts.user1).updateCaseStatus(caseId, newStatus);

      const caseRecord = await contracts.legalCaseManager.getCaseDetails(caseId);
      expect(caseRecord[5]).to.equal(newStatus); // status
    });

    it('Should allow admin to update status', async () => {
      const newStatus = 2; // UNDER_REVIEW

      await contracts.legalCaseManager.connect(accounts.admin).updateCaseStatus(caseId, newStatus);

      const caseRecord = await contracts.legalCaseManager.getCaseDetails(caseId);
      expect(caseRecord[5]).to.equal(newStatus); // status
    });

    it('Should emit CaseStatusUpdated event', async () => {
      const newStatus = 1; // IN_PROGRESS

      await expect(
        contracts.legalCaseManager.connect(accounts.user1).updateCaseStatus(caseId, newStatus),
      )
        .to.emit(contracts.legalCaseManager, 'CaseStatusUpdated')
        .withArgs(caseId, 0, newStatus, accounts.user1.address, (await getCurrentTimestamp()) + 1); // 0 = OPEN
    });

    it('Should deny unauthorized users from updating status', async () => {
      const newStatus = 1; // IN_PROGRESS

      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user2).updateCaseStatus(caseId, newStatus),
        'Not authorized to update case status',
      );
    });
  });

  describe('Evidence Association', () => {
    let caseId: number;
    let evidenceId: number;

    beforeEach(async () => {
      // Create a case
      const caseData = createSampleCaseData();
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );
      caseId = 1;

      // Create evidence
      const evidenceData = createSampleEvidenceData();
      await contracts.proofVault
        .connect(accounts.user1)
        .submitEvidence(
          evidenceData.title,
          evidenceData.description,
          evidenceData.evidenceType,
          evidenceData.classification,
          evidenceData.ipfsHash,
          evidenceData.metadataHash,
          evidenceData.cryptographicHash,
          evidenceData.isEncrypted,
        );
      evidenceId = 1;
    });

    it('Should associate evidence with case', async () => {
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .associateEvidence(caseId, evidenceId);

      const caseEvidence = await contracts.legalCaseManager.getCaseEvidence(caseId);
      expect(caseEvidence).to.include(BigInt(evidenceId));
    });

    it('Should emit EvidenceAssociated event', async () => {
      await expect(
        contracts.legalCaseManager.connect(accounts.user1).associateEvidence(caseId, evidenceId),
      )
        .to.emit(contracts.legalCaseManager, 'EvidenceAssociated')
        .withArgs(caseId, evidenceId, accounts.user1.address, (await getCurrentTimestamp()) + 1);
    });

    it('Should deny unauthorized users from associating evidence', async () => {
      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user2).associateEvidence(caseId, evidenceId),
        'Not authorized to associate evidence',
      );
    });

    it('Should prevent duplicate evidence association', async () => {
      // Associate evidence first time
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .associateEvidence(caseId, evidenceId);

      // Try to associate same evidence again
      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user1).associateEvidence(caseId, evidenceId),
        'Evidence already associated with case',
      );
    });
  });

  describe('Participant Management', () => {
    let caseId: number;

    beforeEach(async () => {
      const caseData = createSampleCaseData();
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );
      caseId = 1;
    });

    it('Should add participant to case', async () => {
      const participantRole = 1; // DEFENDANT

      await contracts.legalCaseManager
        .connect(accounts.user1)
        .addParticipant(caseId, accounts.user2.address, participantRole);

      const participants = await contracts.legalCaseManager.getCaseParticipants(caseId);
      expect(participants).to.include(accounts.user2.address);
    });

    it('Should emit ParticipantAdded event', async () => {
      const participantRole = 1; // DEFENDANT

      await expect(
        contracts.legalCaseManager
          .connect(accounts.user1)
          .addParticipant(caseId, accounts.user2.address, participantRole),
      )
        .to.emit(contracts.legalCaseManager, 'ParticipantAdded')
        .withArgs(
          caseId,
          accounts.user2.address,
          participantRole,
          accounts.user1.address,
          (await getCurrentTimestamp()) + 1,
        );
    });

    it('Should deny unauthorized users from adding participants', async () => {
      const participantRole = 1; // DEFENDANT

      await expectRevert(
        contracts.legalCaseManager
          .connect(accounts.user2)
          .addParticipant(caseId, accounts.forensicExpert.address, participantRole),
        'Not authorized to add participants',
      );
    });
  });

  describe('Court Orders', () => {
    let caseId: number;

    beforeEach(async () => {
      const caseData = createSampleCaseData();
      await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );
      caseId = 1;
    });

    it('Should allow judge to issue court order', async () => {
      const orderType = 1; // INJUNCTION
      const orderDescription = 'Test court order';

      await contracts.legalCaseManager
        .connect(accounts.legalAuthority)
        .issueCourtOrder(caseId, orderType, orderDescription);

      const orders = await contracts.legalCaseManager.getCaseOrders(caseId);
      expect(orders.length).to.equal(1);
    });

    it('Should emit CourtOrderIssued event', async () => {
      const orderType = 1; // INJUNCTION
      const orderDescription = 'Test court order';

      await expect(
        contracts.legalCaseManager
          .connect(accounts.legalAuthority)
          .issueCourtOrder(caseId, orderType, orderDescription),
      )
        .to.emit(contracts.legalCaseManager, 'CourtOrderIssued')
        .withArgs(caseId, 1, accounts.legalAuthority.address, (await getCurrentTimestamp()) + 1); // orderId = 1
    });

    it('Should deny non-judges from issuing orders', async () => {
      const orderType = 1; // INJUNCTION
      const orderDescription = 'Test court order';

      await expectRevert(
        contracts.legalCaseManager
          .connect(accounts.user1)
          .issueCourtOrder(caseId, orderType, orderDescription),
        `AccessControl: account ${accounts.user1.address.toLowerCase()} is missing role`,
      );
    });
  });

  describe('Case Access Control', () => {
    let caseId: number;

    beforeEach(async () => {
      const caseData = createSampleCaseData();
      caseData.isPublic = false; // Private case

      await contracts.legalCaseManager
        .connect(accounts.user1)
        .createCase(
          caseData.caseNumber,
          caseData.caseTitle,
          caseData.caseType,
          caseData.priority,
          caseData.description,
          caseData.jurisdiction,
          caseData.courtLocation,
          caseData.isPublic,
        );
      caseId = 1;
    });

    it('Should allow case creator to access private case', async () => {
      const caseRecord = await contracts.legalCaseManager
        .connect(accounts.user1)
        .getCaseDetails(caseId);
      expect(caseRecord[0]).to.equal(caseId); // caseId
    });

    it('Should allow admin to access private case', async () => {
      const caseRecord = await contracts.legalCaseManager
        .connect(accounts.admin)
        .getCaseDetails(caseId);
      expect(caseRecord[0]).to.equal(caseId); // caseId
    });

    it('Should deny unauthorized access to private case', async () => {
      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user2).getCaseDetails(caseId),
        'No access to case',
      );
    });

    it('Should allow access after adding as participant', async () => {
      // Add user2 as participant
      await contracts.legalCaseManager.connect(accounts.user1).addParticipant(
        caseId,
        accounts.user2.address,
        1, // DEFENDANT
      );

      // Now user2 should be able to access the case
      const caseRecord = await contracts.legalCaseManager
        .connect(accounts.user2)
        .getCaseDetails(caseId);
      expect(caseRecord[0]).to.equal(caseId);
    });
  });
});
