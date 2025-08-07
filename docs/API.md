# ProofVault API Reference

This document provides comprehensive API documentation for all ProofVault smart contracts deployed on Hedera blockchain.

## Table of Contents

- [ProofVault Contract](#proofvault-contract)
- [LegalCaseManager Contract](#legalcasemanager-contract)
- [IdentityAttestation Contract](#identityattestation-contract)
- [Common Types](#common-types)
- [Error Codes](#error-codes)
- [Usage Examples](#usage-examples)

## ProofVault Contract

The core evidence management contract providing secure storage and access control for legal evidence.

### Core Functions

#### `submitEvidence`
Submits new evidence to the vault.

```solidity
function submitEvidence(
    string memory _title,
    string memory _description,
    EvidenceType _evidenceType,
    ClassificationLevel _classification,
    string memory _ipfsHash,
    string memory _metadataHash,
    bytes32 _cryptographicHash,
    bool _isEncrypted
) external returns (uint256)
```

**Parameters:**
- `_title`: Evidence title (required)
- `_description`: Detailed description
- `_evidenceType`: Type of evidence (0-9, see EvidenceType enum)
- `_classification`: Security classification (0-4, see ClassificationLevel enum)
- `_ipfsHash`: IPFS hash of evidence file (required)
- `_metadataHash`: IPFS hash of metadata
- `_cryptographicHash`: Hash for integrity verification (required)
- `_isEncrypted`: Whether evidence is encrypted

**Returns:** Evidence ID (uint256)

**Events:** `EvidenceSubmitted(uint256 evidenceId, address submitter, EvidenceType evidenceType, string title, uint256 timestamp)`

#### `getEvidenceRecord`
Retrieves evidence details (requires access permission).

```solidity
function getEvidenceRecord(uint256 _evidenceId) external view returns (
    uint256, string memory, string memory, address, uint256,
    uint8, uint8, uint8, string memory, string memory, bytes32,
    bool, bool, uint256, uint256
)
```

**Returns:** Complete evidence record tuple

#### `authorizeViewer`
Grants read access to evidence.

```solidity
function authorizeViewer(uint256 _evidenceId, address _viewer) external
```

**Access:** Evidence submitter, admin, or legal authority

#### `updateEvidenceStatus`
Updates evidence status.

```solidity
function updateEvidenceStatus(uint256 _evidenceId, EvidenceStatus _newStatus) external
```

**Access:** Evidence submitter, admin, or legal authority

#### `sealEvidence`
Seals evidence for specified duration.

```solidity
function sealEvidence(uint256 _evidenceId, uint256 _sealDuration) external
```

**Access:** Legal authority only

#### `verifyEvidenceIntegrity`
Verifies evidence integrity using cryptographic hash.

```solidity
function verifyEvidenceIntegrity(uint256 _evidenceId, bytes32 _providedHash) external returns (bool)
```

### View Functions

#### `getTotalEvidenceCount`
```solidity
function getTotalEvidenceCount() external view returns (uint256)
```

#### `hasAccessToEvidence`
```solidity
function hasAccessToEvidence(address _user, uint256 _evidenceId) external view returns (bool)
```

#### `getEvidenceByType`
```solidity
function getEvidenceByType(EvidenceType _evidenceType) external view returns (uint256[] memory)
```

#### `getEvidenceByStatus`
```solidity
function getEvidenceByStatus(EvidenceStatus _status) external view returns (uint256[] memory)
```

### Enums

#### EvidenceType
```solidity
enum EvidenceType {
    DOCUMENT,           // 0
    PHOTO,             // 1
    VIDEO,             // 2
    AUDIO,             // 3
    DIGITAL_FILE,      // 4
    PHYSICAL_DESCRIPTION, // 5
    TESTIMONY,         // 6
    EXPERT_ANALYSIS,   // 7
    CHAIN_OF_CUSTODY,  // 8
    FORENSIC_REPORT    // 9
}
```

#### EvidenceStatus
```solidity
enum EvidenceStatus {
    SUBMITTED,         // 0
    UNDER_REVIEW,      // 1
    VERIFIED,          // 2
    CHALLENGED,        // 3
    ACCEPTED,          // 4
    REJECTED,          // 5
    SEALED,            // 6
    ARCHIVED           // 7
}
```

#### ClassificationLevel
```solidity
enum ClassificationLevel {
    PUBLIC,            // 0
    RESTRICTED,        // 1
    CONFIDENTIAL,      // 2
    SECRET,            // 3
    TOP_SECRET         // 4
}
```

## LegalCaseManager Contract

Comprehensive legal case management with participant tracking and court orders.

### Core Functions

#### `createCase`
Creates a new legal case.

```solidity
function createCase(
    string memory _caseNumber,
    string memory _caseTitle,
    CaseType _caseType,
    Priority _priority,
    string memory _description,
    string memory _jurisdiction,
    string memory _courtLocation,
    bool _isPublic
) external returns (uint256)
```

#### `associateEvidence`
Associates evidence with a case.

```solidity
function associateEvidence(uint256 _caseId, uint256 _evidenceId) external
```

#### `addParticipant`
Adds participant to case.

```solidity
function addParticipant(uint256 _caseId, address _participant, ParticipantRole _role) external
```

#### `issueCourtOrder`
Issues court order (judges only).

```solidity
function issueCourtOrder(uint256 _caseId, OrderType _orderType, string memory _description) external
```

#### `updateCaseStatus`
Updates case status.

```solidity
function updateCaseStatus(uint256 _caseId, CaseStatus _newStatus) external
```

### View Functions

#### `getCaseDetails`
```solidity
function getCaseDetails(uint256 _caseId) external view returns (...)
```

#### `getCaseEvidence`
```solidity
function getCaseEvidence(uint256 _caseId) external view returns (uint256[] memory)
```

#### `getCaseParticipants`
```solidity
function getCaseParticipants(uint256 _caseId) external view returns (address[] memory)
```

#### `getCaseOrders`
```solidity
function getCaseOrders(uint256 _caseId) external view returns (CourtOrder[] memory)
```

## IdentityAttestation Contract

Professional identity verification and management system.

### Core Functions

#### `requestVerification`
Submits identity verification request.

```solidity
function requestVerification(
    VerificationLevel _requestedLevel,
    ProfessionalType _professionalType,
    bytes32 _documentsHash,
    string memory _personalDetails
) external payable returns (uint256)
```

**Requires:** Payment of verification fee

#### `processVerification`
Processes verification request (verifiers only).

```solidity
function processVerification(
    uint256 _requestId,
    bool _approved,
    string memory _notes
) external
```

#### `revokeIdentity`
Revokes verified identity (admin only).

```solidity
function revokeIdentity(uint256 _identityId, string memory _reason) external
```

### View Functions

#### `hasVerifiedIdentity`
```solidity
function hasVerifiedIdentity(address _user) external view returns (bool)
```

#### `getVerificationLevel`
```solidity
function getVerificationLevel(address _user) external view returns (VerificationLevel)
```

#### `getProfessionalType`
```solidity
function getProfessionalType(address _user) external view returns (ProfessionalType)
```

## Common Types

### Access Control Roles

```solidity
// ProofVault roles
bytes32 public constant EVIDENCE_ADMIN_ROLE = keccak256("EVIDENCE_ADMIN_ROLE");
bytes32 public constant LEGAL_AUTHORITY_ROLE = keccak256("LEGAL_AUTHORITY_ROLE");
bytes32 public constant FORENSIC_EXPERT_ROLE = keccak256("FORENSIC_EXPERT_ROLE");

// LegalCaseManager roles
bytes32 public constant CASE_ADMIN_ROLE = keccak256("CASE_ADMIN_ROLE");
bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");
bytes32 public constant LAWYER_ROLE = keccak256("LAWYER_ROLE");

// IdentityAttestation roles
bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
bytes32 public constant IDENTITY_ADMIN_ROLE = keccak256("IDENTITY_ADMIN_ROLE");
```

## Error Codes

### Common Errors
- `"Invalid evidence ID"` - Evidence ID doesn't exist
- `"No access to evidence"` - User lacks permission
- `"Evidence already exists"` - Duplicate cryptographic hash
- `"Title required"` - Empty evidence title
- `"IPFS hash required"` - Missing IPFS hash

### Access Control Errors
- `"AccessControl: account {address} is missing role {role}"` - Insufficient permissions
- `"Not authorized to update status"` - Cannot modify evidence status
- `"Evidence is sealed"` - Cannot access sealed evidence

## Usage Examples

### TypeScript Integration

```typescript
import { ethers } from 'ethers';
import { ProofVault__factory } from './typechain-types';

// Connect to contract
const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
const wallet = new ethers.Wallet(privateKey, provider);
const proofVault = ProofVault__factory.connect(contractAddress, wallet);

// Submit evidence
const tx = await proofVault.submitEvidence(
    'Evidence Title',
    'Evidence Description',
    0, // DOCUMENT
    1, // RESTRICTED
    'QmHash123...',
    'QmMetaHash456...',
    ethers.keccak256(ethers.toUtf8Bytes('evidence content')),
    false // not encrypted
);

const receipt = await tx.wait();
console.log('Evidence submitted:', receipt.transactionHash);
```

### JavaScript SDK Usage

```javascript
const { ProofVaultSDK } = require('./dist');

const sdk = new ProofVaultSDK({
    network: 'testnet',
    operatorKey: process.env.OPERATOR_KEY,
    operatorId: process.env.OPERATOR_ID
});

await sdk.initialize();

// Submit evidence
const evidenceId = await sdk.submitEvidence({
    title: 'Legal Document',
    description: 'Contract evidence',
    evidenceType: 0,
    classification: 1,
    ipfsHash: 'QmHash123...',
    metadataHash: 'QmMetaHash456...',
    cryptographicHash: '0x123...',
    isEncrypted: false
});
```

---

For more examples and detailed usage, see the [test files](../test/) in the repository.
