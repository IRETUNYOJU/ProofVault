/**
 * Integration tests for ProofVault system
 * Tests the interaction between all contracts
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { 
  setupTestEnvironment, 
  createSampleCaseData,
  createSampleEvidenceData,
  createSampleIdentityRequest,
  expectRevert,
  getGasUsed,
  formatTestResult,
  getCurrentTimestamp
} from './helpers/setup';
import type { TestContracts, TestAccounts } from './helpers/setup';

describe('ProofVault Integration Tests', function () {
  let contracts: TestContracts;
  let accounts: TestAccounts;

  beforeEach(async function () {
    const setup = await setupTestEnvironment();
    contracts = setup.contracts;
    accounts = setup.accounts;
  });

  describe('Complete Legal Case Workflow', function () {
    it('Should handle complete case lifecycle with evidence and identity verification', async function () {
      console.log('      🏗️  Setting up complete legal case workflow...');

      // Step 1: User requests identity verification
      console.log('      📋 Step 1: Identity verification request');
      const identityRequest = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(identityRequest.requestedLevel);
      
      const identityTx = await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        identityRequest.requestedLevel,
        identityRequest.professionalType,
        identityRequest.documentsHash,
        identityRequest.personalDetails,
        { value: requiredFee }
      );
      
      const identityGas = await getGasUsed(identityTx);
      console.log(`        ${formatTestResult('Identity request', identityGas)}`);

      // Step 2: Admin approves identity verification
      console.log('      ✅ Step 2: Identity verification approval');
      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        1, // requestId
        true, // approved
        'Identity verified successfully'
      );

      // Verify identity was created
      const hasIdentity = await contracts.identityAttestation.hasVerifiedIdentity(accounts.user1.address);
      expect(hasIdentity).to.be.true;

      // Step 3: Verified user submits evidence
      console.log('      📄 Step 3: Evidence submission');
      const evidenceData = createSampleEvidenceData();
      
      const evidenceTx = await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );

      const evidenceGas = await getGasUsed(evidenceTx);
      console.log(`        ${formatTestResult('Evidence submission', evidenceGas)}`);

      // Step 4: User creates legal case
      console.log('      ⚖️  Step 4: Legal case creation');
      const caseData = createSampleCaseData();
      
      const caseTx = await contracts.legalCaseManager.connect(accounts.user1).createCase(
        caseData.caseNumber,
        caseData.caseTitle,
        caseData.caseType,
        caseData.priority,
        caseData.description,
        caseData.jurisdiction,
        caseData.courtLocation,
        caseData.isPublic
      );

      const caseGas = await getGasUsed(caseTx);
      console.log(`        ${formatTestResult('Case creation', caseGas)}`);

      // Step 5: Associate evidence with case
      console.log('      🔗 Step 5: Evidence association');
      await contracts.legalCaseManager.connect(accounts.user1).associateEvidence(1, 1); // caseId=1, evidenceId=1

      // Step 6: Add participants to case
      console.log('      👥 Step 6: Adding case participants');
      await contracts.legalCaseManager.connect(accounts.user1).addParticipant(
        1, // caseId
        accounts.user2.address,
        1 // DEFENDANT role
      );

      // Step 7: Legal authority issues court order
      console.log('      📜 Step 7: Court order issuance');
      await contracts.legalCaseManager.connect(accounts.legalAuthority).issueCourtOrder(
        1, // caseId
        1, // INJUNCTION
        'Temporary restraining order issued'
      );

      // Step 8: Update case status
      console.log('      📊 Step 8: Case status update');
      await contracts.legalCaseManager.connect(accounts.user1).updateCaseStatus(1, 1); // IN_PROGRESS

      // Step 9: Verify evidence integrity
      console.log('      🔍 Step 9: Evidence integrity verification');
      const isValid = await contracts.proofVault.connect(accounts.user1).verifyEvidenceIntegrity(
        1, // evidenceId
        evidenceData.cryptographicHash
      );
      expect(isValid).to.be.true;

      // Final verification: Check all data is correctly stored and accessible
      console.log('      ✅ Final verification');
      
      // Verify case details
      const caseDetails = await contracts.legalCaseManager.connect(accounts.user1).getCaseDetails(1);
      expect(caseDetails[1]).to.equal(caseData.caseNumber); // caseNumber
      expect(caseDetails[5]).to.equal(1); // status = IN_PROGRESS

      // Verify evidence details
      const evidenceDetails = await contracts.proofVault.connect(accounts.user1).getEvidenceRecord(1);
      expect(evidenceDetails[1]).to.equal(evidenceData.title); // title
      expect(evidenceDetails[6]).to.equal(0); // status = SUBMITTED

      // Verify case evidence association
      const caseEvidence = await contracts.legalCaseManager.getCaseEvidence(1);
      expect(caseEvidence).to.include(BigInt(1)); // evidenceId = 1

      // Verify case participants
      const participants = await contracts.legalCaseManager.getCaseParticipants(1);
      expect(participants).to.include(accounts.user2.address);

      // Verify court orders
      const orders = await contracts.legalCaseManager.getCaseOrders(1);
      expect(orders.length).to.equal(1);

      console.log('      🎉 Complete workflow test passed!');
    });

    it('Should enforce access controls across all contracts', async function () {
      console.log('      🔒 Testing cross-contract access controls...');

      // Create identity, evidence, and case
      const identityRequest = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(identityRequest.requestedLevel);
      
      await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        identityRequest.requestedLevel,
        identityRequest.professionalType,
        identityRequest.documentsHash,
        identityRequest.personalDetails,
        { value: requiredFee }
      );

      await contracts.identityAttestation.connect(accounts.admin).processVerification(1, true, 'Approved');

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

      const caseData = createSampleCaseData();
      caseData.isPublic = false; // Private case
      
      await contracts.legalCaseManager.connect(accounts.user1).createCase(
        caseData.caseNumber,
        caseData.caseTitle,
        caseData.caseType,
        caseData.priority,
        caseData.description,
        caseData.jurisdiction,
        caseData.courtLocation,
        caseData.isPublic
      );

      // Test: Unauthorized user cannot access private case
      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user2).getCaseDetails(1),
        'No access to case'
      );

      // Test: Unauthorized user cannot access evidence
      await expectRevert(
        contracts.proofVault.connect(accounts.user2).getEvidenceRecord(1),
        'No access to evidence'
      );

      // Test: Unauthorized user cannot associate evidence
      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user2).associateEvidence(1, 1),
        'Not authorized to associate evidence'
      );

      // Test: Non-judge cannot issue court orders
      await expectRevert(
        contracts.legalCaseManager.connect(accounts.user1).issueCourtOrder(1, 1, 'Unauthorized order'),
        `AccessControl: account ${accounts.user1.address.toLowerCase()} is missing role`
      );

      console.log('      ✅ Access control tests passed!');
    });

    it('Should handle evidence sealing and unsealing workflow', async function () {
      console.log('      🔒 Testing evidence sealing workflow...');

      // Setup: Create evidence
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

      // Test: Legal authority can seal evidence
      const sealDuration = 86400; // 1 day
      await contracts.proofVault.connect(accounts.legalAuthority).sealEvidence(1, sealDuration);

      // Verify evidence is sealed
      const evidenceRecord = await contracts.proofVault.connect(accounts.legalAuthority).getEvidenceRecord(1);
      expect(evidenceRecord[12]).to.be.true; // isSealed

      // Test: Regular users cannot access sealed evidence
      await expectRevert(
        contracts.proofVault.connect(accounts.user1).updateEvidenceStatus(1, 2),
        'Evidence is sealed'
      );

      // Test: Legal authority can still access sealed evidence
      const sealedRecord = await contracts.proofVault.connect(accounts.legalAuthority).getEvidenceRecord(1);
      expect(sealedRecord[0]).to.equal(1); // evidenceId

      console.log('      ✅ Evidence sealing tests passed!');
    });

    it('Should calculate gas costs for typical operations', async function () {
      console.log('      ⛽ Calculating gas costs for typical operations...');

      let totalGas = BigInt(0);

      // Identity verification request
      const identityRequest = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(identityRequest.requestedLevel);
      
      const identityTx = await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        identityRequest.requestedLevel,
        identityRequest.professionalType,
        identityRequest.documentsHash,
        identityRequest.personalDetails,
        { value: requiredFee }
      );
      const identityGas = await getGasUsed(identityTx);
      totalGas += identityGas;

      // Identity verification processing
      const processingTx = await contracts.identityAttestation.connect(accounts.admin).processVerification(1, true, 'Approved');
      const processingGas = await getGasUsed(processingTx);
      totalGas += processingGas;

      // Evidence submission
      const evidenceData = createSampleEvidenceData();
      const evidenceTx = await contracts.proofVault.connect(accounts.user1).submitEvidence(
        evidenceData.title,
        evidenceData.description,
        evidenceData.evidenceType,
        evidenceData.classification,
        evidenceData.ipfsHash,
        evidenceData.metadataHash,
        evidenceData.cryptographicHash,
        evidenceData.isEncrypted
      );
      const evidenceGas = await getGasUsed(evidenceTx);
      totalGas += evidenceGas;

      // Case creation
      const caseData = createSampleCaseData();
      const caseTx = await contracts.legalCaseManager.connect(accounts.user1).createCase(
        caseData.caseNumber,
        caseData.caseTitle,
        caseData.caseType,
        caseData.priority,
        caseData.description,
        caseData.jurisdiction,
        caseData.courtLocation,
        caseData.isPublic
      );
      const caseGas = await getGasUsed(caseTx);
      totalGas += caseGas;

      // Evidence association
      const associationTx = await contracts.legalCaseManager.connect(accounts.user1).associateEvidence(1, 1);
      const associationGas = await getGasUsed(associationTx);
      totalGas += associationGas;

      console.log('      📊 Gas Usage Summary:');
      console.log(`        Identity Request: ${identityGas.toLocaleString()} gas`);
      console.log(`        Identity Processing: ${processingGas.toLocaleString()} gas`);
      console.log(`        Evidence Submission: ${evidenceGas.toLocaleString()} gas`);
      console.log(`        Case Creation: ${caseGas.toLocaleString()} gas`);
      console.log(`        Evidence Association: ${associationGas.toLocaleString()} gas`);
      console.log(`        Total Gas: ${totalGas.toLocaleString()} gas`);

      // Verify gas usage is reasonable (less than 2M gas total)
      expect(totalGas).to.be.lessThan(BigInt(2000000));
    });
  });
});
