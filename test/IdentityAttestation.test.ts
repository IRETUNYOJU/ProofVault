/**
 * Comprehensive tests for IdentityAttestation contract
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { 
  setupTestEnvironment, 
  createSampleIdentityRequest,
  expectRevert,
  getGasUsed,
  formatTestResult,
  getCurrentTimestamp
} from './helpers/setup';
import type { TestContracts, TestAccounts } from './helpers/setup';

describe('IdentityAttestation', function () {
  let contracts: TestContracts;
  let accounts: TestAccounts;

  beforeEach(async function () {
    const setup = await setupTestEnvironment();
    contracts = setup.contracts;
    accounts = setup.accounts;
  });

  describe('Deployment', function () {
    it('Should deploy with correct initial state', async function () {
      // Check if deployer has admin role
      const adminRole = await contracts.identityAttestation.DEFAULT_ADMIN_ROLE();
      expect(await contracts.identityAttestation.hasRole(adminRole, accounts.deployer.address)).to.be.true;
    });

    it('Should have correct role constants', async function () {
      const verifierRole = await contracts.identityAttestation.VERIFIER_ROLE();
      const adminRole = await contracts.identityAttestation.IDENTITY_ADMIN_ROLE();
      
      expect(verifierRole).to.not.equal(ethers.ZeroHash);
      expect(adminRole).to.not.equal(ethers.ZeroHash);
    });

    it('Should have default verification fees set', async function () {
      // Check that verification fees are set for different levels
      const basicFee = await contracts.identityAttestation.verificationFees(0); // BASIC
      const professionalFee = await contracts.identityAttestation.verificationFees(2); // PROFESSIONAL
      
      expect(basicFee).to.be.greaterThan(0);
      expect(professionalFee).to.be.greaterThan(basicFee);
    });
  });

  describe('Verification Fee Management', function () {
    it('Should allow admin to set verification fees', async function () {
      const newFee = ethers.parseEther('0.1');
      const verificationLevel = 1; // ENHANCED
      
      await contracts.identityAttestation.connect(accounts.deployer).setVerificationFee(verificationLevel, newFee);
      
      const updatedFee = await contracts.identityAttestation.verificationFees(verificationLevel);
      expect(updatedFee).to.equal(newFee);
    });

    it('Should emit VerificationFeeUpdated event', async function () {
      const newFee = ethers.parseEther('0.1');
      const verificationLevel = 1; // ENHANCED
      
      await expect(
        contracts.identityAttestation.connect(accounts.deployer).setVerificationFee(verificationLevel, newFee)
      ).to.emit(contracts.identityAttestation, 'VerificationFeeUpdated')
       .withArgs(verificationLevel, newFee);
    });

    it('Should deny non-admin from setting fees', async function () {
      const newFee = ethers.parseEther('0.1');
      const verificationLevel = 1; // ENHANCED
      
      await expectRevert(
        contracts.identityAttestation.connect(accounts.user1).setVerificationFee(verificationLevel, newFee),
        `AccessControl: account ${accounts.user1.address.toLowerCase()} is missing role`
      );
    });
  });

  describe('Identity Verification Request', function () {
    it('Should submit verification request with correct fee', async function () {
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      const tx = await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        requestData.requestedLevel,
        requestData.professionalType,
        requestData.documentsHash,
        requestData.personalDetails,
        { value: requiredFee }
      );

      const gasUsed = await getGasUsed(tx);
      console.log(`      ${formatTestResult('Verification request', gasUsed)}`);

      // Check if request was created
      const requestId = 1;
      const request = await contracts.identityAttestation.verificationRequests(requestId);
      expect(request.applicant).to.equal(accounts.user1.address);
      expect(request.requestedLevel).to.equal(requestData.requestedLevel);
    });

    it('Should emit VerificationRequested event', async function () {
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      await expect(
        contracts.identityAttestation.connect(accounts.user1).requestVerification(
          requestData.requestedLevel,
          requestData.professionalType,
          requestData.documentsHash,
          requestData.personalDetails,
          { value: requiredFee }
        )
      ).to.emit(contracts.identityAttestation, 'VerificationRequested')
       .withArgs(1, accounts.user1.address, requestData.requestedLevel, await getCurrentTimestamp() + 1);
    });

    it('Should reject request with insufficient fee', async function () {
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      const insufficientFee = requiredFee - BigInt(1);
      
      await expectRevert(
        contracts.identityAttestation.connect(accounts.user1).requestVerification(
          requestData.requestedLevel,
          requestData.professionalType,
          requestData.documentsHash,
          requestData.personalDetails,
          { value: insufficientFee }
        ),
        'Insufficient verification fee'
      );
    });

    it('Should reject request with empty documents hash', async function () {
      const requestData = createSampleIdentityRequest();
      requestData.documentsHash = ethers.ZeroHash;
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      await expectRevert(
        contracts.identityAttestation.connect(accounts.user1).requestVerification(
          requestData.requestedLevel,
          requestData.professionalType,
          requestData.documentsHash,
          requestData.personalDetails,
          { value: requiredFee }
        ),
        'Documents hash required'
      );
    });
  });

  describe('Verification Processing', function () {
    let requestId: number;

    beforeEach(async function () {
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        requestData.requestedLevel,
        requestData.professionalType,
        requestData.documentsHash,
        requestData.personalDetails,
        { value: requiredFee }
      );
      requestId = 1;
    });

    it('Should allow verifier to approve request', async function () {
      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        requestId,
        true, // approved
        'Verification successful'
      );

      const request = await contracts.identityAttestation.verificationRequests(requestId);
      expect(request.isProcessed).to.be.true;
      expect(request.isApproved).to.be.true;
    });

    it('Should create identity record when approved', async function () {
      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        requestId,
        true, // approved
        'Verification successful'
      );

      // Check if identity was created
      const hasIdentity = await contracts.identityAttestation.hasVerifiedIdentity(accounts.user1.address);
      expect(hasIdentity).to.be.true;

      const identityLevel = await contracts.identityAttestation.getVerificationLevel(accounts.user1.address);
      expect(identityLevel).to.equal(2); // PROFESSIONAL
    });

    it('Should emit VerificationProcessed event when approved', async function () {
      await expect(
        contracts.identityAttestation.connect(accounts.admin).processVerification(
          requestId,
          true, // approved
          'Verification successful'
        )
      ).to.emit(contracts.identityAttestation, 'VerificationProcessed')
       .withArgs(requestId, true, accounts.admin.address, await getCurrentTimestamp() + 1);
    });

    it('Should emit IdentityVerified event when approved', async function () {
      await expect(
        contracts.identityAttestation.connect(accounts.admin).processVerification(
          requestId,
          true, // approved
          'Verification successful'
        )
      ).to.emit(contracts.identityAttestation, 'IdentityVerified')
       .withArgs(1, accounts.user1.address, 2, await getCurrentTimestamp() + 1); // identityId = 1, level = PROFESSIONAL
    });

    it('Should allow verifier to reject request', async function () {
      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        requestId,
        false, // rejected
        'Insufficient documentation'
      );

      const request = await contracts.identityAttestation.verificationRequests(requestId);
      expect(request.isProcessed).to.be.true;
      expect(request.isApproved).to.be.false;

      // Should not create identity record
      const hasIdentity = await contracts.identityAttestation.hasVerifiedIdentity(accounts.user1.address);
      expect(hasIdentity).to.be.false;
    });

    it('Should deny non-verifier from processing requests', async function () {
      await expectRevert(
        contracts.identityAttestation.connect(accounts.user2).processVerification(
          requestId,
          true,
          'Unauthorized processing'
        ),
        `AccessControl: account ${accounts.user2.address.toLowerCase()} is missing role`
      );
    });

    it('Should prevent processing already processed request', async function () {
      // Process request first time
      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        requestId,
        true,
        'First processing'
      );

      // Try to process again
      await expectRevert(
        contracts.identityAttestation.connect(accounts.admin).processVerification(
          requestId,
          false,
          'Second processing'
        ),
        'Request already processed'
      );
    });
  });

  describe('Identity Management', function () {
    let identityId: number;

    beforeEach(async function () {
      // Create and approve a verification request
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        requestData.requestedLevel,
        requestData.professionalType,
        requestData.documentsHash,
        requestData.personalDetails,
        { value: requiredFee }
      );

      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        1, // requestId
        true, // approved
        'Verification successful'
      );
      identityId = 1;
    });

    it('Should allow admin to revoke identity', async function () {
      await contracts.identityAttestation.connect(accounts.deployer).revokeIdentity(
        identityId,
        'Identity compromised'
      );

      const identity = await contracts.identityAttestation.identityRecords(identityId);
      expect(identity.isRevoked).to.be.true;

      // Should no longer have verified identity
      const hasIdentity = await contracts.identityAttestation.hasVerifiedIdentity(accounts.user1.address);
      expect(hasIdentity).to.be.false;
    });

    it('Should emit IdentityRevoked event', async function () {
      await expect(
        contracts.identityAttestation.connect(accounts.deployer).revokeIdentity(
          identityId,
          'Identity compromised'
        )
      ).to.emit(contracts.identityAttestation, 'IdentityRevoked')
       .withArgs(identityId, accounts.deployer.address, await getCurrentTimestamp() + 1);
    });

    it('Should deny non-admin from revoking identity', async function () {
      await expectRevert(
        contracts.identityAttestation.connect(accounts.user1).revokeIdentity(
          identityId,
          'Unauthorized revocation'
        ),
        `AccessControl: account ${accounts.user1.address.toLowerCase()} is missing role`
      );
    });

    it('Should allow admin to update identity level', async function () {
      const newLevel = 3; // EXPERT
      
      await contracts.identityAttestation.connect(accounts.deployer).updateIdentityLevel(
        identityId,
        newLevel
      );

      const updatedLevel = await contracts.identityAttestation.getVerificationLevel(accounts.user1.address);
      expect(updatedLevel).to.equal(newLevel);
    });

    it('Should emit IdentityLevelUpdated event', async function () {
      const newLevel = 3; // EXPERT
      
      await expect(
        contracts.identityAttestation.connect(accounts.deployer).updateIdentityLevel(
          identityId,
          newLevel
        )
      ).to.emit(contracts.identityAttestation, 'IdentityLevelUpdated')
       .withArgs(identityId, 2, newLevel, accounts.deployer.address, await getCurrentTimestamp() + 1); // old level = PROFESSIONAL
    });
  });

  describe('Identity Queries', function () {
    beforeEach(async function () {
      // Create and approve a verification request
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        requestData.requestedLevel,
        requestData.professionalType,
        requestData.documentsHash,
        requestData.personalDetails,
        { value: requiredFee }
      );

      await contracts.identityAttestation.connect(accounts.admin).processVerification(
        1, // requestId
        true, // approved
        'Verification successful'
      );
    });

    it('Should correctly identify verified users', async function () {
      const hasIdentity = await contracts.identityAttestation.hasVerifiedIdentity(accounts.user1.address);
      expect(hasIdentity).to.be.true;

      const noIdentity = await contracts.identityAttestation.hasVerifiedIdentity(accounts.user2.address);
      expect(noIdentity).to.be.false;
    });

    it('Should return correct verification level', async function () {
      const level = await contracts.identityAttestation.getVerificationLevel(accounts.user1.address);
      expect(level).to.equal(2); // PROFESSIONAL
    });

    it('Should return zero level for unverified users', async function () {
      const level = await contracts.identityAttestation.getVerificationLevel(accounts.user2.address);
      expect(level).to.equal(0);
    });

    it('Should correctly identify professional types', async function () {
      const professionalType = await contracts.identityAttestation.getProfessionalType(accounts.user1.address);
      expect(professionalType).to.equal(1); // LAWYER
    });
  });

  describe('Fee Withdrawal', function () {
    beforeEach(async function () {
      // Submit a verification request to generate fees
      const requestData = createSampleIdentityRequest();
      const requiredFee = await contracts.identityAttestation.verificationFees(requestData.requestedLevel);
      
      await contracts.identityAttestation.connect(accounts.user1).requestVerification(
        requestData.requestedLevel,
        requestData.professionalType,
        requestData.documentsHash,
        requestData.personalDetails,
        { value: requiredFee }
      );
    });

    it('Should allow admin to withdraw fees', async function () {
      const contractBalance = await ethers.provider.getBalance(await contracts.identityAttestation.getAddress());
      expect(contractBalance).to.be.greaterThan(0);

      const adminBalanceBefore = await ethers.provider.getBalance(accounts.deployer.address);
      
      await contracts.identityAttestation.connect(accounts.deployer).withdrawFees();
      
      const adminBalanceAfter = await ethers.provider.getBalance(accounts.deployer.address);
      expect(adminBalanceAfter).to.be.greaterThan(adminBalanceBefore);

      const contractBalanceAfter = await ethers.provider.getBalance(await contracts.identityAttestation.getAddress());
      expect(contractBalanceAfter).to.equal(0);
    });

    it('Should deny non-admin from withdrawing fees', async function () {
      await expectRevert(
        contracts.identityAttestation.connect(accounts.user1).withdrawFees(),
        `AccessControl: account ${accounts.user1.address.toLowerCase()} is missing role`
      );
    });
  });
});
