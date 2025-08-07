// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IdentityAttestation
 * @dev Decentralized identity verification system for evidence submitters and witnesses
 * @notice Allows trusted entities to verify identities while maintaining privacy options
 */
contract IdentityAttestation is AccessControl, ReentrancyGuard {

    // Role definitions
    bytes32 public constant IDENTITY_ADMIN_ROLE = keccak256("IDENTITY_ADMIN_ROLE");
    bytes32 public constant VERIFICATION_AUTHORITY_ROLE = keccak256("VERIFICATION_AUTHORITY_ROLE");
    bytes32 public constant LEGAL_ENTITY_ROLE = keccak256("LEGAL_ENTITY_ROLE");
    bytes32 public constant GOVERNMENT_OFFICIAL_ROLE = keccak256("GOVERNMENT_OFFICIAL_ROLE");
    bytes32 public constant NGO_REPRESENTATIVE_ROLE = keccak256("NGO_REPRESENTATIVE_ROLE");

    // Identity verification levels
    enum VerificationLevel {
        UNVERIFIED,
        BASIC_KYC,
        ENHANCED_KYC,
        GOVERNMENT_VERIFIED,
        LEGAL_PROFESSIONAL,
        EXPERT_WITNESS,
        WHISTLEBLOWER_PROTECTED
    }

    // Professional credentials
    enum ProfessionalType {
        LAWYER,
        JOURNALIST,
        HUMAN_RIGHTS_ACTIVIST,
        FORENSIC_EXPERT,
        MEDICAL_PROFESSIONAL,
        LAW_ENFORCEMENT,
        JUDGE,
        GOVERNMENT_OFFICIAL,
        NGO_WORKER,
        ACADEMIC_RESEARCHER
    }

    // Identity verification status
    enum VerificationStatus {
        PENDING,
        VERIFIED,
        REJECTED,
        SUSPENDED,
        REVOKED,
        UNDER_REVIEW
    }

    struct IdentityRecord {
        address userAddress;
        uint256 identityId;
        bytes32 encryptedIdentityHash; // Encrypted PII hash
        VerificationLevel verificationLevel;
        ProfessionalType professionalType;
        VerificationStatus status;
        address verifiedBy;
        uint256 verificationTimestamp;
        uint256 expiryTimestamp;
        string credentialHash; // IPFS hash of encrypted credentials
        string biometricHash; // Optional biometric verification
        bool isAnonymousWitness;
        uint256 reputationScore;
        uint256 attestationCount;
    }

    struct VerificationRequest {
        uint256 requestId;
        address requester;
        VerificationLevel requestedLevel;
        ProfessionalType professionalType;
        string documentsHash; // IPFS hash of submitted documents
        string personalDetails; // Encrypted personal information
        uint256 requestTimestamp;
        VerificationStatus status;
        address assignedVerifier;
        string rejectionReason;
    }

    struct ReputationMetrics {
        uint256 successfulAttestations;
        uint256 disputedAttestations;
        uint256 evidenceSubmissions;
        uint256 expertAnalyses;
        uint256 communityEndorsements;
        uint256 lastActivityTimestamp;
    }

    struct BiometricAttestation {
        address user;
        bytes32 biometricHash;
        uint256 timestamp;
        address verifier;
        bool isActive;
    }

    // State variables
    uint256 private _identityIdCounter;
    uint256 private _requestIdCounter;

    mapping(address => IdentityRecord) public identityRecords;
    mapping(uint256 => VerificationRequest) public verificationRequests;
    mapping(address => ReputationMetrics) public reputationData;
    mapping(bytes32 => address) public biometricToAddress;
    mapping(address => BiometricAttestation[]) public biometricAttestations;
    mapping(address => mapping(address => bool)) public trustedByEntity;
    mapping(VerificationLevel => uint256) public verificationFees;
    mapping(address => bool) public isBlacklisted;
    mapping(address => uint256[]) public userRequests;

    // Verification statistics
    mapping(VerificationLevel => uint256) public verificationCounts;
    mapping(ProfessionalType => uint256) public professionalCounts;

    // Events
    event IdentityVerificationRequested(
        uint256 indexed requestId,
        address indexed requester,
        VerificationLevel requestedLevel,
        ProfessionalType professionalType,
        uint256 timestamp
    );

    event IdentityVerified(
        uint256 indexed identityId,
        address indexed user,
        VerificationLevel level,
        address indexed verifier,
        uint256 timestamp
    );

    event IdentityRevoked(
        address indexed user,
        address indexed revokedBy,
        string reason,
        uint256 timestamp
    );

    event ReputationUpdated(
        address indexed user,
        uint256 newReputationScore,
        string reason,
        uint256 timestamp
    );

    event BiometricAttestationAdded(
        address indexed user,
        bytes32 biometricHash,
        address indexed verifier,
        uint256 timestamp
    );

    event TrustRelationshipEstablished(
        address indexed trustor,
        address indexed trustee,
        uint256 timestamp
    );

    event WhistleblowerProtectionGranted(
        address indexed whistleblower,
        address indexed grantor,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(IDENTITY_ADMIN_ROLE, msg.sender);
        
        // Set default verification fees (in wei)
        verificationFees[VerificationLevel.BASIC_KYC] = 0.01 ether;
        verificationFees[VerificationLevel.ENHANCED_KYC] = 0.05 ether;
        verificationFees[VerificationLevel.GOVERNMENT_VERIFIED] = 0;
        verificationFees[VerificationLevel.LEGAL_PROFESSIONAL] = 0.1 ether;
        verificationFees[VerificationLevel.EXPERT_WITNESS] = 0.2 ether;
        verificationFees[VerificationLevel.WHISTLEBLOWER_PROTECTED] = 0;
    }

    modifier notBlacklisted(address user) {
        require(!isBlacklisted[user], "Address is blacklisted");
        _;
    }

    modifier validIdentity(address user) {
        require(identityRecords[user].status == VerificationStatus.VERIFIED, "Identity not verified");
        _;
    }

    /**
     * @dev Request identity verification
     */
    function requestIdentityVerification(
        VerificationLevel _requestedLevel,
        ProfessionalType _professionalType,
        string memory _documentsHash,
        string memory _personalDetails
    ) external payable nonReentrant notBlacklisted(msg.sender) {
        require(
            identityRecords[msg.sender].status != VerificationStatus.VERIFIED ||
            identityRecords[msg.sender].verificationLevel < _requestedLevel,
            "Already verified at requested level or higher"
        );
        
        require(msg.value >= verificationFees[_requestedLevel], "Insufficient verification fee");

        _requestIdCounter++;
        uint256 newRequestId = _requestIdCounter;

        verificationRequests[newRequestId] = VerificationRequest({
            requestId: newRequestId,
            requester: msg.sender,
            requestedLevel: _requestedLevel,
            professionalType: _professionalType,
            documentsHash: _documentsHash,
            personalDetails: _personalDetails,
            requestTimestamp: block.timestamp,
            status: VerificationStatus.PENDING,
            assignedVerifier: address(0),
            rejectionReason: ""
        });

        userRequests[msg.sender].push(newRequestId);

        emit IdentityVerificationRequested(
            newRequestId,
            msg.sender,
            _requestedLevel,
            _professionalType,
            block.timestamp
        );
    }

    /**
     * @dev Verify identity request
     */
    function verifyIdentityRequest(
        uint256 _requestId,
        bool _approved,
        string memory _credentialHash,
        string memory _rejectionReason
    ) external onlyRole(VERIFICATION_AUTHORITY_ROLE) nonReentrant {
        VerificationRequest storage request = verificationRequests[_requestId];
        require(request.status == VerificationStatus.PENDING, "Request not pending");
        require(request.assignedVerifier == address(0) || request.assignedVerifier == msg.sender, "Not assigned verifier");

        request.assignedVerifier = msg.sender;

        if (_approved) {
            _identityIdCounter++;
            uint256 newIdentityId = _identityIdCounter;

            // Create or update identity record
            identityRecords[request.requester] = IdentityRecord({
                userAddress: request.requester,
                identityId: newIdentityId,
                encryptedIdentityHash: keccak256(abi.encodePacked(request.personalDetails, block.timestamp)),
                verificationLevel: request.requestedLevel,
                professionalType: request.professionalType,
                status: VerificationStatus.VERIFIED,
                verifiedBy: msg.sender,
                verificationTimestamp: block.timestamp,
                expiryTimestamp: block.timestamp + 365 days, // 1 year validity
                credentialHash: _credentialHash,
                biometricHash: "",
                isAnonymousWitness: request.requestedLevel == VerificationLevel.WHISTLEBLOWER_PROTECTED,
                reputationScore: 100, // Starting reputation score
                attestationCount: 0
            });

            request.status = VerificationStatus.VERIFIED;
            verificationCounts[request.requestedLevel]++;
            professionalCounts[request.professionalType]++;

            emit IdentityVerified(newIdentityId, request.requester, request.requestedLevel, msg.sender, block.timestamp);
        } else {
            request.status = VerificationStatus.REJECTED;
            request.rejectionReason = _rejectionReason;
        }
    }

    /**
     * @dev Add biometric attestation
     */
    function addBiometricAttestation(
        address _user,
        bytes32 _biometricHash
    ) external onlyRole(VERIFICATION_AUTHORITY_ROLE) validIdentity(_user) nonReentrant {
        require(biometricToAddress[_biometricHash] == address(0), "Biometric already registered");

        BiometricAttestation memory attestation = BiometricAttestation({
            user: _user,
            biometricHash: _biometricHash,
            timestamp: block.timestamp,
            verifier: msg.sender,
            isActive: true
        });

        biometricAttestations[_user].push(attestation);
        biometricToAddress[_biometricHash] = _user;

        emit BiometricAttestationAdded(_user, _biometricHash, msg.sender, block.timestamp);
    }

    /**
     * @dev Grant whistleblower protection
     */
    function grantWhistleblowerProtection(
        address _whistleblower,
        string memory _protectionDetails
    ) external onlyRole(GOVERNMENT_OFFICIAL_ROLE) nonReentrant {
        require(identityRecords[_whistleblower].userAddress != address(0), "User not registered");

        identityRecords[_whistleblower].verificationLevel = VerificationLevel.WHISTLEBLOWER_PROTECTED;
        identityRecords[_whistleblower].isAnonymousWitness = true;
        identityRecords[_whistleblower].expiryTimestamp = block.timestamp + 1095 days; // 3 years protection

        emit WhistleblowerProtectionGranted(_whistleblower, msg.sender, block.timestamp);
    }

    /**
     * @dev Update reputation score
     */
    function updateReputation(
        address _user,
        int256 _scoreChange,
        string memory _reason
    ) external onlyRole(IDENTITY_ADMIN_ROLE) validIdentity(_user) {
        ReputationMetrics storage reputation = reputationData[_user];
        IdentityRecord storage identity = identityRecords[_user];

        if (_scoreChange > 0) {
            identity.reputationScore += uint256(_scoreChange);
        } else {
            uint256 decrease = uint256(-_scoreChange);
            if (identity.reputationScore > decrease) {
                identity.reputationScore -= decrease;
            } else {
                identity.reputationScore = 0;
            }
        }

        reputation.lastActivityTimestamp = block.timestamp;
        emit ReputationUpdated(_user, identity.reputationScore, _reason, block.timestamp);
    }

    /**
     * @dev Establish trust relationship
     */
    function establishTrust(address _trustee) external validIdentity(msg.sender) validIdentity(_trustee) {
        trustedByEntity[msg.sender][_trustee] = true;
        emit TrustRelationshipEstablished(msg.sender, _trustee, block.timestamp);
    }

    /**
     * @dev Revoke identity verification
     */
    function revokeIdentity(
        address _user,
        string memory _reason
    ) external onlyRole(IDENTITY_ADMIN_ROLE) {
        require(identityRecords[_user].status == VerificationStatus.VERIFIED, "Identity not verified");
        
        identityRecords[_user].status = VerificationStatus.REVOKED;
        
        emit IdentityRevoked(_user, msg.sender, _reason, block.timestamp);
    }

    /**
     * @dev Blacklist address
     */
    function blacklistAddress(address _user, bool _blacklisted) external onlyRole(IDENTITY_ADMIN_ROLE) {
        isBlacklisted[_user] = _blacklisted;
        if (_blacklisted && identityRecords[_user].status == VerificationStatus.VERIFIED) {
            identityRecords[_user].status = VerificationStatus.SUSPENDED;
        }
    }

    /**
     * @dev Get identity verification level
     */
    function getVerificationLevel(address _user) external view returns (uint8) {
        return uint8(identityRecords[_user].verificationLevel);
    }

    /**
     * @dev Check if user is verified
     */
    function isVerified(address _user) external view returns (bool) {
        return identityRecords[_user].status == VerificationStatus.VERIFIED;
    }

    /**
     * @dev Get reputation score
     */
    function getReputationScore(address _user) external view returns (uint256) {
        return identityRecords[_user].reputationScore;
    }

    /**
     * @dev Verify biometric
     */
    function verifyBiometric(bytes32 _biometricHash) external view returns (address) {
        return biometricToAddress[_biometricHash];
    }

    /**
     * @dev Get user requests
     */
    function getUserRequests(address _user) external view returns (uint256[] memory) {
        return userRequests[_user];
    }

    /**
     * @dev Update verification fees
     */
    function updateVerificationFee(VerificationLevel _level, uint256 _fee) external onlyRole(IDENTITY_ADMIN_ROLE) {
        verificationFees[_level] = _fee;
    }

    // Role management functions
    function grantVerificationAuthorityRole(address account) external onlyRole(IDENTITY_ADMIN_ROLE) {
        _grantRole(VERIFICATION_AUTHORITY_ROLE, account);
    }

    function grantLegalEntityRole(address account) external onlyRole(IDENTITY_ADMIN_ROLE) {
        _grantRole(LEGAL_ENTITY_ROLE, account);
    }

    function grantGovernmentOfficialRole(address account) external onlyRole(IDENTITY_ADMIN_ROLE) {
        _grantRole(GOVERNMENT_OFFICIAL_ROLE, account);
    }

    function grantNGORepresentativeRole(address account) external onlyRole(IDENTITY_ADMIN_ROLE) {
        _grantRole(NGO_REPRESENTATIVE_ROLE, account);
    }
}
