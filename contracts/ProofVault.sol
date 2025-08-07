// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ProofVault
 * @dev Decentralized evidence management system for legal proceedings
 * @notice Stores and manages digital evidence with cryptographic integrity and access controls
 */
contract ProofVault is AccessControl, ReentrancyGuard, Pausable {
    // Role definitions
    bytes32 public constant EVIDENCE_ADMIN_ROLE = keccak256("EVIDENCE_ADMIN_ROLE");
    bytes32 public constant EVIDENCE_SUBMITTER_ROLE = keccak256("EVIDENCE_SUBMITTER_ROLE");
    bytes32 public constant LEGAL_AUTHORITY_ROLE = keccak256("LEGAL_AUTHORITY_ROLE");
    bytes32 public constant FORENSIC_EXPERT_ROLE = keccak256("FORENSIC_EXPERT_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // Evidence types
    enum EvidenceType {
        DOCUMENT,
        PHOTO,
        VIDEO,
        AUDIO,
        DIGITAL_FILE,
        PHYSICAL_DESCRIPTION,
        TESTIMONY,
        EXPERT_ANALYSIS,
        CHAIN_OF_CUSTODY,
        FORENSIC_REPORT
    }

    // Evidence status
    enum EvidenceStatus {
        SUBMITTED,
        UNDER_REVIEW,
        VERIFIED,
        CHALLENGED,
        ACCEPTED,
        REJECTED,
        SEALED,
        ARCHIVED
    }

    // Evidence classification levels
    enum ClassificationLevel {
        PUBLIC,
        RESTRICTED,
        CONFIDENTIAL,
        SECRET,
        TOP_SECRET
    }

    // Evidence integrity levels
    enum IntegrityLevel {
        BASIC,
        ENHANCED,
        CRYPTOGRAPHIC,
        BLOCKCHAIN_VERIFIED,
        MULTI_SIGNATURE_VERIFIED
    }

    struct EvidenceRecord {
        uint256 evidenceId;
        string title;
        string description;
        address submitter;
        uint256 submissionTimestamp;
        EvidenceType evidenceType;
        EvidenceStatus status;
        ClassificationLevel classification;
        string ipfsHash; // IPFS hash of the actual evidence file
        string metadataHash; // IPFS hash of metadata
        bytes32 cryptographicHash; // Hash of the evidence for integrity
        bool isEncrypted;
        bool isSealed;
        uint256 sealedUntil; // Timestamp until which evidence is sealed
        uint256 lastModified;
    }

    struct ChainOfCustody {
        uint256 evidenceId;
        address handler;
        uint256 timestamp;
        string action; // "SUBMITTED", "TRANSFERRED", "ANALYZED", "SEALED", etc.
        string location;
        string notes;
        bytes32 handlerSignature;
    }

    struct EvidenceMetadata {
        uint256 evidenceId;
        string originalFilename;
        uint256 fileSize;
        string mimeType;
        uint256 creationTimestamp;
        string deviceInfo; // Information about the device used to create evidence
        string geoLocation; // GPS coordinates if applicable
        string[] tags; // Searchable tags
        mapping(string => string) customFields; // Flexible metadata fields
    }

    struct AccessPermission {
        address user;
        uint256 evidenceId;
        uint256 grantedTimestamp;
        uint256 expiryTimestamp;
        address grantedBy;
        string accessLevel; // "READ", "WRITE", "ADMIN"
        bool isActive;
    }

    // State variables
    uint256 private _evidenceIdCounter;

    mapping(uint256 => EvidenceRecord) public evidenceRecords;
    mapping(uint256 => EvidenceMetadata) public evidenceMetadata;
    mapping(uint256 => ChainOfCustody[]) public chainOfCustody;
    mapping(uint256 => mapping(address => AccessPermission)) public accessPermissions;
    mapping(address => uint256[]) public userSubmittedEvidence;
    mapping(address => uint256[]) public userAccessibleEvidence;
    mapping(bytes32 => uint256) public hashToEvidenceId;
    mapping(EvidenceType => uint256[]) public evidenceByType;
    mapping(EvidenceStatus => uint256[]) public evidenceByStatus;

    // Evidence statistics
    mapping(EvidenceType => uint256) public evidenceTypeCount;
    mapping(EvidenceStatus => uint256) public evidenceStatusCount;
    mapping(address => uint256) public userSubmissionCount;

    // Events
    event EvidenceSubmitted(
        uint256 indexed evidenceId,
        address indexed submitter,
        EvidenceType evidenceType,
        string title,
        uint256 timestamp
    );

    event EvidenceStatusUpdated(
        uint256 indexed evidenceId,
        EvidenceStatus oldStatus,
        EvidenceStatus newStatus,
        address updatedBy,
        uint256 timestamp
    );

    event AccessGranted(
        uint256 indexed evidenceId,
        address indexed user,
        address indexed grantedBy,
        string accessLevel,
        uint256 timestamp
    );

    event AccessRevoked(
        uint256 indexed evidenceId,
        address indexed user,
        address indexed revokedBy,
        uint256 timestamp
    );

    event ChainOfCustodyUpdated(
        uint256 indexed evidenceId,
        address indexed handler,
        string action,
        uint256 timestamp
    );

    event EvidenceSealed(
        uint256 indexed evidenceId,
        address indexed sealedBy,
        uint256 sealedUntil,
        uint256 timestamp
    );

    event EvidenceIntegrityVerified(
        uint256 indexed evidenceId,
        address indexed verifier,
        bool isValid,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EVIDENCE_ADMIN_ROLE, msg.sender);
        _evidenceIdCounter = 0;
    }

    modifier validEvidenceId(uint256 evidenceId) {
        require(evidenceId > 0 && evidenceId <= _evidenceIdCounter, "Invalid evidence ID");
        _;
    }

    modifier hasEvidenceAccess(uint256 evidenceId) {
        require(
            _hasEvidenceAccess(msg.sender, evidenceId),
            "No access to evidence"
        );
        _;
    }

    modifier evidenceNotSealed(uint256 evidenceId) {
        require(
            !evidenceRecords[evidenceId].isSealed ||
            evidenceRecords[evidenceId].sealedUntil < block.timestamp ||
            hasRole(LEGAL_AUTHORITY_ROLE, msg.sender),
            "Evidence is sealed"
        );
        _;
    }

    /**
     * @dev Submit new evidence to the vault
     */
    function submitEvidence(
        string memory _title,
        string memory _description,
        EvidenceType _evidenceType,
        ClassificationLevel _classification,
        string memory _ipfsHash,
        string memory _metadataHash,
        bytes32 _cryptographicHash,
        bool _isEncrypted
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(_cryptographicHash != bytes32(0), "Cryptographic hash required");
        require(hashToEvidenceId[_cryptographicHash] == 0, "Evidence already exists");

        _evidenceIdCounter++;
        uint256 newEvidenceId = _evidenceIdCounter;

        evidenceRecords[newEvidenceId] = EvidenceRecord({
            evidenceId: newEvidenceId,
            title: _title,
            description: _description,
            submitter: msg.sender,
            submissionTimestamp: block.timestamp,
            evidenceType: _evidenceType,
            status: EvidenceStatus.SUBMITTED,
            classification: _classification,
            ipfsHash: _ipfsHash,
            metadataHash: _metadataHash,
            cryptographicHash: _cryptographicHash,
            isEncrypted: _isEncrypted,
            isSealed: false,
            sealedUntil: 0,
            lastModified: block.timestamp
        });

        // Update mappings and statistics
        hashToEvidenceId[_cryptographicHash] = newEvidenceId;
        userSubmittedEvidence[msg.sender].push(newEvidenceId);
        evidenceByType[_evidenceType].push(newEvidenceId);
        evidenceByStatus[EvidenceStatus.SUBMITTED].push(newEvidenceId);
        evidenceTypeCount[_evidenceType]++;
        evidenceStatusCount[EvidenceStatus.SUBMITTED]++;
        userSubmissionCount[msg.sender]++;

        // Grant submitter access
        _grantAccess(newEvidenceId, msg.sender, "ADMIN", 0);

        // Add initial chain of custody entry
        _addChainOfCustodyEntry(
            newEvidenceId,
            msg.sender,
            "SUBMITTED",
            "Digital Vault",
            "Evidence submitted to ProofVault",
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        emit EvidenceSubmitted(newEvidenceId, msg.sender, _evidenceType, _title, block.timestamp);
        return newEvidenceId;
    }

    /**
     * @dev Update evidence status
     */
    function updateEvidenceStatus(
        uint256 _evidenceId,
        EvidenceStatus _newStatus
    ) external validEvidenceId(_evidenceId) evidenceNotSealed(_evidenceId) {
        require(
            hasRole(EVIDENCE_ADMIN_ROLE, msg.sender) ||
            hasRole(LEGAL_AUTHORITY_ROLE, msg.sender) ||
            evidenceRecords[_evidenceId].submitter == msg.sender,
            "Not authorized to update status"
        );

        EvidenceStatus oldStatus = evidenceRecords[_evidenceId].status;
        evidenceRecords[_evidenceId].status = _newStatus;
        evidenceRecords[_evidenceId].lastModified = block.timestamp;

        // Update statistics
        evidenceStatusCount[oldStatus]--;
        evidenceStatusCount[_newStatus]++;

        // Update evidence by status mappings
        _removeFromStatusArray(oldStatus, _evidenceId);
        evidenceByStatus[_newStatus].push(_evidenceId);

        // Add chain of custody entry
        _addChainOfCustodyEntry(
            _evidenceId,
            msg.sender,
            "STATUS_UPDATED",
            "Digital Vault",
            string(abi.encodePacked("Status changed to: ", _statusToString(_newStatus))),
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        emit EvidenceStatusUpdated(_evidenceId, oldStatus, _newStatus, msg.sender, block.timestamp);
    }

    /**
     * @dev Grant access to evidence
     */
    function authorizeViewer(
        uint256 _evidenceId,
        address _viewer
    ) external validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) {
        require(_viewer != address(0), "Invalid viewer address");
        require(
            evidenceRecords[_evidenceId].submitter == msg.sender ||
            hasRole(EVIDENCE_ADMIN_ROLE, msg.sender) ||
            hasRole(LEGAL_AUTHORITY_ROLE, msg.sender),
            "Not authorized to grant access"
        );

        _grantAccess(_evidenceId, _viewer, "READ", 0);
        emit AccessGranted(_evidenceId, _viewer, msg.sender, "READ", block.timestamp);
    }

    /**
     * @dev Grant access with specific level and expiry
     */
    function grantAccess(
        uint256 _evidenceId,
        address _user,
        string memory _accessLevel,
        uint256 _expiryTimestamp
    ) external validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) {
        require(_user != address(0), "Invalid user address");
        require(
            evidenceRecords[_evidenceId].submitter == msg.sender ||
            hasRole(EVIDENCE_ADMIN_ROLE, msg.sender) ||
            hasRole(LEGAL_AUTHORITY_ROLE, msg.sender),
            "Not authorized to grant access"
        );

        _grantAccess(_evidenceId, _user, _accessLevel, _expiryTimestamp);
        emit AccessGranted(_evidenceId, _user, msg.sender, _accessLevel, block.timestamp);
    }

    /**
     * @dev Revoke access to evidence
     */
    function revokeAccess(
        uint256 _evidenceId,
        address _user
    ) external validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) {
        require(
            evidenceRecords[_evidenceId].submitter == msg.sender ||
            hasRole(EVIDENCE_ADMIN_ROLE, msg.sender) ||
            hasRole(LEGAL_AUTHORITY_ROLE, msg.sender),
            "Not authorized to revoke access"
        );

        accessPermissions[_evidenceId][_user].isActive = false;
        emit AccessRevoked(_evidenceId, _user, msg.sender, block.timestamp);
    }

    /**
     * @dev Seal evidence for a specific period
     */
    function sealEvidence(
        uint256 _evidenceId,
        uint256 _sealDuration
    ) external validEvidenceId(_evidenceId) onlyRole(LEGAL_AUTHORITY_ROLE) {
        require(_sealDuration > 0, "Invalid seal duration");

        evidenceRecords[_evidenceId].isSealed = true;
        evidenceRecords[_evidenceId].sealedUntil = block.timestamp + _sealDuration;
        evidenceRecords[_evidenceId].lastModified = block.timestamp;

        _addChainOfCustodyEntry(
            _evidenceId,
            msg.sender,
            "SEALED",
            "Digital Vault",
            "Evidence sealed by legal authority",
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        emit EvidenceSealed(_evidenceId, msg.sender, evidenceRecords[_evidenceId].sealedUntil, block.timestamp);
    }

    /**
     * @dev Verify evidence integrity
     */
    function verifyEvidenceIntegrity(
        uint256 _evidenceId,
        bytes32 _providedHash
    ) external validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) returns (bool) {
        bool isValid = evidenceRecords[_evidenceId].cryptographicHash == _providedHash;

        _addChainOfCustodyEntry(
            _evidenceId,
            msg.sender,
            "INTEGRITY_CHECK",
            "Digital Vault",
            isValid ? "Integrity verified" : "Integrity check failed",
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        emit EvidenceIntegrityVerified(_evidenceId, msg.sender, isValid, block.timestamp);
        return isValid;
    }

    // View functions
    /**
     * @dev Get evidence record (compatible with LegalCaseManager interface)
     */
    function getEvidenceRecord(uint256 _evidenceId) external view validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) returns (
        uint256, string memory, string memory, address, uint256,
        uint8, uint8, uint8, string memory, string memory, bytes32,
        bool, bool, uint256, uint256
    ) {
        EvidenceRecord memory evidence = evidenceRecords[_evidenceId];
        return (
            evidence.evidenceId,
            evidence.title,
            evidence.description,
            evidence.submitter,
            evidence.submissionTimestamp,
            uint8(evidence.evidenceType),
            uint8(evidence.status),
            uint8(evidence.classification),
            evidence.ipfsHash,
            evidence.metadataHash,
            evidence.cryptographicHash,
            evidence.isEncrypted,
            evidence.isSealed,
            evidence.sealedUntil,
            evidence.lastModified
        );
    }

    /**
     * @dev Get evidence metadata
     */
    function getEvidenceMetadata(uint256 _evidenceId) external view validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) returns (
        string memory originalFilename,
        uint256 fileSize,
        string memory mimeType,
        uint256 creationTimestamp,
        string memory deviceInfo,
        string memory geoLocation,
        string[] memory tags
    ) {
        EvidenceMetadata storage metadata = evidenceMetadata[_evidenceId];
        return (
            metadata.originalFilename,
            metadata.fileSize,
            metadata.mimeType,
            metadata.creationTimestamp,
            metadata.deviceInfo,
            metadata.geoLocation,
            metadata.tags
        );
    }

    /**
     * @dev Get chain of custody for evidence
     */
    function getChainOfCustody(uint256 _evidenceId) external view validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) returns (ChainOfCustody[] memory) {
        return chainOfCustody[_evidenceId];
    }

    /**
     * @dev Get user's submitted evidence
     */
    function getUserSubmittedEvidence(address _user) external view returns (uint256[] memory) {
        return userSubmittedEvidence[_user];
    }

    /**
     * @dev Get evidence by type
     */
    function getEvidenceByType(EvidenceType _evidenceType) external view returns (uint256[] memory) {
        return evidenceByType[_evidenceType];
    }

    /**
     * @dev Get evidence by status
     */
    function getEvidenceByStatus(EvidenceStatus _status) external view returns (uint256[] memory) {
        return evidenceByStatus[_status];
    }

    /**
     * @dev Get total evidence count
     */
    function getTotalEvidenceCount() external view returns (uint256) {
        return _evidenceIdCounter;
    }

    /**
     * @dev Check if user has access to evidence
     */
    function hasAccessToEvidence(address _user, uint256 _evidenceId) external view returns (bool) {
        return _hasEvidenceAccess(_user, _evidenceId);
    }

    // Internal functions
    /**
     * @dev Internal function to check evidence access
     */
    function _hasEvidenceAccess(address _user, uint256 _evidenceId) internal view returns (bool) {
        // Admin and legal authority always have access
        if (hasRole(EVIDENCE_ADMIN_ROLE, _user) || hasRole(LEGAL_AUTHORITY_ROLE, _user)) {
            return true;
        }

        // Submitter always has access
        if (evidenceRecords[_evidenceId].submitter == _user) {
            return true;
        }

        // Check explicit permissions
        AccessPermission memory permission = accessPermissions[_evidenceId][_user];
        return permission.isActive &&
               (permission.expiryTimestamp == 0 || permission.expiryTimestamp > block.timestamp);
    }

    /**
     * @dev Internal function to grant access
     */
    function _grantAccess(
        uint256 _evidenceId,
        address _user,
        string memory _accessLevel,
        uint256 _expiryTimestamp
    ) internal {
        accessPermissions[_evidenceId][_user] = AccessPermission({
            user: _user,
            evidenceId: _evidenceId,
            grantedTimestamp: block.timestamp,
            expiryTimestamp: _expiryTimestamp,
            grantedBy: msg.sender,
            accessLevel: _accessLevel,
            isActive: true
        });

        userAccessibleEvidence[_user].push(_evidenceId);
    }

    /**
     * @dev Internal function to add chain of custody entry
     */
    function _addChainOfCustodyEntry(
        uint256 _evidenceId,
        address _handler,
        string memory _action,
        string memory _location,
        string memory _notes,
        bytes32 _signature
    ) internal {
        chainOfCustody[_evidenceId].push(ChainOfCustody({
            evidenceId: _evidenceId,
            handler: _handler,
            timestamp: block.timestamp,
            action: _action,
            location: _location,
            notes: _notes,
            handlerSignature: _signature
        }));

        emit ChainOfCustodyUpdated(_evidenceId, _handler, _action, block.timestamp);
    }

    /**
     * @dev Internal function to remove evidence from status array
     */
    function _removeFromStatusArray(EvidenceStatus _status, uint256 _evidenceId) internal {
        uint256[] storage statusArray = evidenceByStatus[_status];
        for (uint i = 0; i < statusArray.length; i++) {
            if (statusArray[i] == _evidenceId) {
                statusArray[i] = statusArray[statusArray.length - 1];
                statusArray.pop();
                break;
            }
        }
    }

    /**
     * @dev Internal function to convert status enum to string
     */
    function _statusToString(EvidenceStatus _status) internal pure returns (string memory) {
        if (_status == EvidenceStatus.SUBMITTED) return "SUBMITTED";
        if (_status == EvidenceStatus.UNDER_REVIEW) return "UNDER_REVIEW";
        if (_status == EvidenceStatus.VERIFIED) return "VERIFIED";
        if (_status == EvidenceStatus.CHALLENGED) return "CHALLENGED";
        if (_status == EvidenceStatus.ACCEPTED) return "ACCEPTED";
        if (_status == EvidenceStatus.REJECTED) return "REJECTED";
        if (_status == EvidenceStatus.SEALED) return "SEALED";
        if (_status == EvidenceStatus.ARCHIVED) return "ARCHIVED";
        return "UNKNOWN";
    }

    // Admin functions
    /**
     * @dev Set evidence metadata
     */
    function setEvidenceMetadata(
        uint256 _evidenceId,
        string memory _originalFilename,
        uint256 _fileSize,
        string memory _mimeType,
        uint256 _creationTimestamp,
        string memory _deviceInfo,
        string memory _geoLocation,
        string[] memory _tags
    ) external validEvidenceId(_evidenceId) hasEvidenceAccess(_evidenceId) {
        require(
            evidenceRecords[_evidenceId].submitter == msg.sender ||
            hasRole(EVIDENCE_ADMIN_ROLE, msg.sender),
            "Not authorized to set metadata"
        );

        EvidenceMetadata storage metadata = evidenceMetadata[_evidenceId];
        metadata.evidenceId = _evidenceId;
        metadata.originalFilename = _originalFilename;
        metadata.fileSize = _fileSize;
        metadata.mimeType = _mimeType;
        metadata.creationTimestamp = _creationTimestamp;
        metadata.deviceInfo = _deviceInfo;
        metadata.geoLocation = _geoLocation;
        metadata.tags = _tags;
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(EVIDENCE_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyRole(EVIDENCE_ADMIN_ROLE) {
        _unpause();
    }

    // Role management functions
    function grantEvidenceSubmitterRole(address account) external onlyRole(EVIDENCE_ADMIN_ROLE) {
        _grantRole(EVIDENCE_SUBMITTER_ROLE, account);
    }

    function grantLegalAuthorityRole(address account) external onlyRole(EVIDENCE_ADMIN_ROLE) {
        _grantRole(LEGAL_AUTHORITY_ROLE, account);
    }

    function grantForensicExpertRole(address account) external onlyRole(EVIDENCE_ADMIN_ROLE) {
        _grantRole(FORENSIC_EXPERT_ROLE, account);
    }

    function grantAuditorRole(address account) external onlyRole(EVIDENCE_ADMIN_ROLE) {
        _grantRole(AUDITOR_ROLE, account);
    }
}