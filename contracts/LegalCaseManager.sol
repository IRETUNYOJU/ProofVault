// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

interface IProofVault {
    function getEvidenceRecord(uint256 evidenceId) external view returns (
        uint256, string memory, string memory, address, uint256, 
        uint8, uint8, uint8, string memory, string memory, bytes32, 
        bool, bool, uint256, uint256
    );
    function authorizeViewer(uint256 evidenceId, address viewer) external;
}

interface IIdentityAttestation {
    function isVerified(address user) external view returns (bool);
    function getVerificationLevel(address user) external view returns (uint8);
    function getReputationScore(address user) external view returns (uint256);
}

/**
 * @title LegalCaseManager
 * @dev Manages legal cases, links evidence, and coordinates between parties
 * @notice Integrates with ProofVault for evidence management and identity verification
 */
contract LegalCaseManager is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant CASE_ADMIN_ROLE = keccak256("CASE_ADMIN_ROLE");
    bytes32 public constant LEGAL_COUNSEL_ROLE = keccak256("LEGAL_COUNSEL_ROLE");
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");
    bytes32 public constant COURT_CLERK_ROLE = keccak256("COURT_CLERK_ROLE");
    bytes32 public constant PROSECUTOR_ROLE = keccak256("PROSECUTOR_ROLE");
    bytes32 public constant PUBLIC_DEFENDER_ROLE = keccak256("PUBLIC_DEFENDER_ROLE");

    // Case types
    enum CaseType {
        CRIMINAL,
        CIVIL,
        HUMAN_RIGHTS,
        LAND_DISPUTE,
        CORRUPTION,
        POLICE_MISCONDUCT,
        COMMERCIAL,
        FAMILY,
        CONSTITUTIONAL,
        ADMINISTRATIVE
    }

    // Case status
    enum CaseStatus {
        FILED,
        UNDER_INVESTIGATION,
        DISCOVERY,
        TRIAL_PREPARATION,
        IN_TRIAL,
        JUDGMENT_PENDING,
        CLOSED,
        APPEALED,
        DISMISSED,
        SETTLED
    }

    // Case priority
    enum CasePriority {
        LOW,
        NORMAL,
        HIGH,
        URGENT,
        EMERGENCY
    }

    // Party roles in case
    enum PartyRole {
        PLAINTIFF,
        DEFENDANT,
        WITNESS,
        EXPERT_WITNESS,
        LEGAL_COUNSEL,
        PROSECUTOR,
        VICTIM,
        WHISTLEBLOWER
    }

    struct LegalCase {
        uint256 caseId;
        string caseNumber;
        string caseTitle;
        CaseType caseType;
        CaseStatus status;
        CasePriority priority;
        address filedBy;
        uint256 filingTimestamp;
        uint256 lastUpdatedTimestamp;
        string description;
        string jurisdiction;
        address assignedJudge;
        uint256 expectedTrialDate;
        string courtLocation;
        bool isPublic;
        bool isActive;
        uint256 evidenceCount;
        uint256 totalStakeAmount;
    }

    struct CaseParty {
        address partyAddress;
        PartyRole role;
        string partyName; // Encrypted if privacy required
        string contactInfo; // Encrypted contact information
        address legalRepresentative;
        uint256 joinedTimestamp;
        bool isActive;
        bool isAnonymous;
    }

    struct CaseEvidence {
        uint256 evidenceId; // Reference to ProofVault evidence
        uint256 caseId;
        address submittedBy;
        uint256 submissionTimestamp;
        string evidenceType; // "DOCUMENTARY", "TESTIMONIAL", "PHYSICAL", "DIGITAL"
        string relevance; // How this evidence relates to the case
        bool isAccepted;
        bool isChallenged;
        address challengedBy;
        string challengeReason;
        uint256 evidenceWeight; // Importance score 1-100
    }

    struct CaseTimeline {
        uint256 timestamp;
        string eventType;
        string description;
        address triggeredBy;
        string additionalData;
    }

    struct CourtOrder {
        uint256 orderId;
        uint256 caseId;
        address issuedBy; // Judge
        string orderType; // "INJUNCTION", "DISCOVERY", "EVIDENCE_SEAL", etc.
        string orderDetails;
        uint256 issuedTimestamp;
        uint256 effectiveDate;
        uint256 expiryDate;
        bool isActive;
        string complianceStatus;
    }

    struct CaseSettlement {
        uint256 caseId;
        address[] parties;
        uint256 settlementAmount;
        string terms; // IPFS hash of settlement terms
        uint256 agreedTimestamp;
        bool isExecuted;
        address mediator;
        string settlementType; // "MONETARY", "NON_MONETARY", "MIXED"
    }

    // Contract interfaces
    IProofVault public proofVault;
    IIdentityAttestation public identityAttestation;

    // State variables
    Counters.Counter private _caseIdCounter;
    Counters.Counter private _orderIdCounter;

    mapping(uint256 => LegalCase) public legalCases;
    mapping(uint256 => CaseParty[]) public caseParties;
    mapping(uint256 => CaseEvidence[]) public caseEvidenceList;
    mapping(uint256 => CaseTimeline[]) public caseTimelines;
    mapping(uint256 => CourtOrder[]) public caseOrders;
    mapping(uint256 => CaseSettlement) public caseSettlements;
    
    mapping(address => uint256[]) public userCases;
    mapping(string => uint256) public caseNumberToId;
    mapping(CaseType => uint256[]) public casesByType;
    mapping(address => uint256[]) public judgeAssignedCases;
    mapping(uint256 => mapping(address => bool)) public hasAccessToCase;
    mapping(uint256 => mapping(uint256 => bool)) public linkedEvidence; // caseId => evidenceId => isLinked

    // Case statistics
    mapping(CaseType => uint256) public caseTypeCount;
    mapping(CaseStatus => uint256) public caseStatusCount;
    mapping(address => uint256) public judgeActiveCount;

    // Emergency stop
    bool public emergencyStopped = false;

    // Events
    event CaseFiled(
        uint256 indexed caseId,
        string caseNumber,
        CaseType caseType,
        address indexed filedBy,
        uint256 timestamp
    );

    event CaseStatusUpdated(
        uint256 indexed caseId,
        CaseStatus oldStatus,
        CaseStatus newStatus,
        address updatedBy,
        uint256 timestamp
    );

    event PartyAddedToCase(
        uint256 indexed caseId,
        address indexed party,
        PartyRole role,
        address addedBy,
        uint256 timestamp
    );

    event EvidenceLinkedToCase(
        uint256 indexed caseId,
        uint256 indexed evidenceId,
        address linkedBy,
        string evidenceType,
        uint256 timestamp
    );

    event CourtOrderIssued(
        uint256 indexed orderId,
        uint256 indexed caseId,
        address indexed issuedBy,
        string orderType,
        uint256 timestamp
    );

    event CaseSettled(
        uint256 indexed caseId,
        uint256 settlementAmount,
        address mediator,
        uint256 timestamp
    );

    event JudgeAssigned(
        uint256 indexed caseId,
        address indexed judge,
        address assignedBy,
        uint256 timestamp
    );

    event EvidenceChallenged(
        uint256 indexed caseId,
        uint256 indexed evidenceId,
        address challengedBy,
        string reason,
        uint256 timestamp
    );

    constructor(address _proofVault, address _identityAttestation) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CASE_ADMIN_ROLE, msg.sender);
        proofVault = IProofVault(_proofVault);
        identityAttestation = IIdentityAttestation(_identityAttestation);
    }

    modifier verifiedUser(address user) {
        require(identityAttestation.isVerified(user), "User not verified");
        _;
    }

    modifier validCaseId(uint256 caseId) {
        require(caseId > 0 && caseId <= _caseIdCounter.current(), "Invalid case ID");
        _;
    }

    modifier caseAccess(uint256 caseId) {
        require(
            legalCases[caseId].isPublic ||
            hasAccessToCase[caseId][msg.sender] ||
            legalCases[caseId].filedBy == msg.sender ||
            legalCases[caseId].assignedJudge == msg.sender ||
            hasRole(CASE_ADMIN_ROLE, msg.sender),
            "No access to case"
        );
        _;
    }

    modifier emergencyStopCheck() {
        require(!emergencyStopped, "Contract is emergency stopped");
        _;
    }

    /**
     * @dev File a new legal case
     */
    function fileCase(
        string memory _caseNumber,
        string memory _caseTitle,
        CaseType _caseType,
        CasePriority _priority,
        string memory _description,
        string memory _jurisdiction,
        string memory _courtLocation,
        bool _isPublic
    ) external verifiedUser(msg.sender) nonReentrant emergencyStopCheck returns (uint256) {
        require(caseNumberToId[_caseNumber] == 0, "Case number already exists");
        require(bytes(_caseTitle).length > 0, "Case title required");

        _caseIdCounter.increment();
        uint256 newCaseId = _caseIdCounter.current();

        legalCases[newCaseId] = LegalCase({
            caseId: newCaseId,
            caseNumber: _caseNumber,
            caseTitle: _caseTitle,
            caseType: _caseType,
            status: CaseStatus.FILED,
            priority: _priority,
            filedBy: msg.sender,
            filingTimestamp: block.timestamp,
            lastUpdatedTimestamp: block.timestamp,
            description: _description,
            jurisdiction: _jurisdiction,
            assignedJudge: address(0),
            expectedTrialDate: 0,
            courtLocation: _courtLocation,
            isPublic: _isPublic,
            isActive: true,
            evidenceCount: 0,
            totalStakeAmount: 0
        });

        caseNumberToId[_caseNumber] = newCaseId;
        userCases[msg.sender].push(newCaseId);
        casesByType[_caseType].push(newCaseId);
        hasAccessToCase[newCaseId][msg.sender] = true;

        caseTypeCount[_caseType]++;
        caseStatusCount[CaseStatus.FILED]++;

        // Add initial timeline entry
        _addTimelineEntry(newCaseId, "CASE_FILED", _caseTitle, msg.sender, _description);

        emit CaseFiled(newCaseId, _caseNumber, _caseType, msg.sender, block.timestamp);
        return newCaseId;
    }

    /**
     * @dev Add party to case
     */
    function addPartyToCase(
        uint256 _caseId,
        address _partyAddress,
        PartyRole _role,
        string memory _partyName,
        string memory _contactInfo,
        bool _isAnonymous
    ) external validCaseId(_caseId) caseAccess(_caseId) verifiedUser(msg.sender) {
        require(_partyAddress != address(0), "Invalid party address");
        
        if (!_isAnonymous) {
            require(identityAttestation.isVerified(_partyAddress), "Party not verified");
        }

        CaseParty memory newParty = CaseParty({
            partyAddress: _partyAddress,
            role: _role,
            partyName: _partyName,
            contactInfo: _contactInfo,
            legalRepresentative: address(0),
            joinedTimestamp: block.timestamp,
            isActive: true,
            isAnonymous: _isAnonymous
        });

        caseParties[_caseId].push(newParty);
        userCases[_partyAddress].push(_caseId);
        hasAccessToCase[_caseId][_partyAddress] = true;

        _addTimelineEntry(_caseId, "PARTY_ADDED", "Party added to case", msg.sender, _partyName);
        emit PartyAddedToCase(_caseId, _partyAddress, _role, msg.sender, block.timestamp);
    }

    /**
     * @dev Link evidence from ProofVault to case
     */
    function linkEvidenceToCase(
        uint256 _caseId,
        uint256 _evidenceId,
        string memory _evidenceType,
        string memory _relevance,
        uint256 _evidenceWeight
    ) external validCaseId(_caseId) caseAccess(_caseId) verifiedUser(msg.sender) {
        require(!linkedEvidence[_caseId][_evidenceId], "Evidence already linked");
        require(_evidenceWeight > 0 && _evidenceWeight <= 100, "Invalid evidence weight");

        // Verify evidence exists in ProofVault
        (uint256 evidenceId, , , , , , , , , , , , , , , ) = proofVault.getEvidenceRecord(_evidenceId);
        require(evidenceId == _evidenceId, "Evidence not found in ProofVault");

        CaseEvidence memory newEvidence = CaseEvidence({
            evidenceId: _evidenceId,
            caseId: _caseId,
            submittedBy: msg.sender,
            submissionTimestamp: block.timestamp,
            evidenceType: _evidenceType,
            relevance: _relevance,
            isAccepted: false,
            isChallenged: false,
            challengedBy: address(0),
            challengeReason: "",
            evidenceWeight: _evidenceWeight
        });

        caseEvidenceList[_caseId].push(newEvidence);
        linkedEvidence[_caseId][_evidenceId] = true;
        legalCases[_caseId].evidenceCount++;
        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;

        // Grant case parties access to evidence
        _grantEvidenceAccessToParties(_caseId, _evidenceId);

        _addTimelineEntry(_caseId, "EVIDENCE_LINKED", "Evidence linked to case", msg.sender, _evidenceType);
        emit EvidenceLinkedToCase(_caseId, _evidenceId, msg.sender, _evidenceType, block.timestamp);
    }

    /**
     * @dev Update case status
     */
    function updateCaseStatus(
        uint256 _caseId,
        CaseStatus _newStatus
    ) external validCaseId(_caseId) {
        require(
            hasRole(JUDGE_ROLE, msg.sender) ||
            hasRole(COURT_CLERK_ROLE, msg.sender) ||
            legalCases[_caseId].assignedJudge == msg.sender ||
            hasRole(CASE_ADMIN_ROLE, msg.sender),
            "Not authorized to update case status"
        );

        CaseStatus oldStatus = legalCases[_caseId].status;
        legalCases[_caseId].status = _newStatus;
        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;

        // Update statistics
        caseStatusCount[oldStatus]--;
        caseStatusCount[_newStatus]++;

        _addTimelineEntry(_caseId, "STATUS_UPDATED", "Case status updated", msg.sender, "");
        emit CaseStatusUpdated(_caseId, oldStatus, _newStatus, msg.sender, block.timestamp);
    }

    /**
     * @dev Assign judge to case
     */
    function assignJudge(
        uint256 _caseId,
        address _judgeAddress
    ) external validCaseId(_caseId) onlyRole(CASE_ADMIN_ROLE) verifiedUser(_judgeAddress) {
        require(hasRole(JUDGE_ROLE, _judgeAddress), "Address does not have judge role");
        require(legalCases[_caseId].assignedJudge == address(0), "Judge already assigned");

        legalCases[_caseId].assignedJudge = _judgeAddress;
        judgeAssignedCases[_judgeAddress].push(_caseId);
        judgeActiveCount[_judgeAddress]++;
        hasAccessToCase[_caseId][_judgeAddress] = true;
        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;

        _addTimelineEntry(_caseId, "JUDGE_ASSIGNED", "Judge assigned to case", msg.sender, "");
        emit JudgeAssigned(_caseId, _judgeAddress, msg.sender, block.timestamp);
    }

    /**
     * @dev Issue court order
     */
    function issueCourtOrder(
        uint256 _caseId,
        string memory _orderType,
        string memory _orderDetails,
        uint256 _effectiveDate,
        uint256 _expiryDate
    ) external validCaseId(_caseId) {
        require(
            hasRole(JUDGE_ROLE, msg.sender) ||
            legalCases[_caseId].assignedJudge == msg.sender,
            "Only judge can issue court orders"
        );

        _orderIdCounter.increment();
        uint256 newOrderId = _orderIdCounter.current();

        CourtOrder memory newOrder = CourtOrder({
            orderId: newOrderId,
            caseId: _caseId,
            issuedBy: msg.sender,
            orderType: _orderType,
            orderDetails: _orderDetails,
            issuedTimestamp: block.timestamp,
            effectiveDate: _effectiveDate,
            expiryDate: _expiryDate,
            isActive: true,
            complianceStatus: "PENDING"
        });

        caseOrders[_caseId].push(newOrder);
        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;

        _addTimelineEntry(_caseId, "COURT_ORDER_ISSUED", _orderType, msg.sender, _orderDetails);
        emit CourtOrderIssued(newOrderId, _caseId, msg.sender, _orderType, block.timestamp);
    }

    /**
     * @dev Challenge evidence
     */
    function challengeEvidence(
        uint256 _caseId,
        uint256 _evidenceId,
        string memory _challengeReason
    ) external validCaseId(_caseId) caseAccess(_caseId) verifiedUser(msg.sender) {
        require(linkedEvidence[_caseId][_evidenceId], "Evidence not linked to case");

        // Find and update evidence
        CaseEvidence[] storage evidenceList = caseEvidenceList[_caseId];
        for (uint i = 0; i < evidenceList.length; i++) {
            if (evidenceList[i].evidenceId == _evidenceId) {
                require(!evidenceList[i].isChallenged, "Evidence already challenged");
                evidenceList[i].isChallenged = true;
                evidenceList[i].challengedBy = msg.sender;
                evidenceList[i].challengeReason = _challengeReason;
                break;
            }
        }

        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;
        _addTimelineEntry(_caseId, "EVIDENCE_CHALLENGED", "Evidence challenged", msg.sender, _challengeReason);
        emit EvidenceChallenged(_caseId, _evidenceId, msg.sender, _challengeReason, block.timestamp);
    }

    /**
     * @dev Accept evidence (by judge)
     */
    function acceptEvidence(
        uint256 _caseId,
        uint256 _evidenceId
    ) external validCaseId(_caseId) {
        require(
            hasRole(JUDGE_ROLE, msg.sender) ||
            legalCases[_caseId].assignedJudge == msg.sender,
            "Only judge can accept evidence"
        );
        require(linkedEvidence[_caseId][_evidenceId], "Evidence not linked to case");

        // Find and update evidence
        CaseEvidence[] storage evidenceList = caseEvidenceList[_caseId];
        for (uint i = 0; i < evidenceList.length; i++) {
            if (evidenceList[i].evidenceId == _evidenceId) {
                evidenceList[i].isAccepted = true;
                break;
            }
        }

        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;
        _addTimelineEntry(_caseId, "EVIDENCE_ACCEPTED", "Evidence accepted by judge", msg.sender, "");
    }

    /**
     * @dev Settle case
     */
    function settleCase(
        uint256 _caseId,
        address[] memory _parties,
        uint256 _settlementAmount,
        string memory _terms,
        string memory _settlementType
    ) external validCaseId(_caseId) caseAccess(_caseId) nonReentrant {
        require(legalCases[_caseId].status != CaseStatus.CLOSED, "Case already closed");
        require(_parties.length > 0, "No parties specified");

        CaseSettlement memory settlement = CaseSettlement({
            caseId: _caseId,
            parties: _parties,
            settlementAmount: _settlementAmount,
            terms: _terms,
            agreedTimestamp: block.timestamp,
            isExecuted: false,
            mediator: msg.sender,
            settlementType: _settlementType
        });

        caseSettlements[_caseId] = settlement;
        legalCases[_caseId].status = CaseStatus.SETTLED;
        legalCases[_caseId].lastUpdatedTimestamp = block.timestamp;

        // Update statistics
        caseStatusCount[CaseStatus.SETTLED]++;

        _addTimelineEntry(_caseId, "CASE_SETTLED", "Case settled", msg.sender, _settlementType);
        emit CaseSettled(_caseId, _settlementAmount, msg.sender, block.timestamp);
    }

    // View functions
    /**
     * @dev Get case details
     */
    function getCaseDetails(uint256 _caseId) external view validCaseId(_caseId) caseAccess(_caseId) returns (LegalCase memory) {
        return legalCases[_caseId];
    }

    /**
     * @dev Get case parties
     */
    function getCaseParties(uint256 _caseId) external view validCaseId(_caseId) caseAccess(_caseId) returns (CaseParty[] memory) {
        return caseParties[_caseId];
    }

    /**
     * @dev Get case evidence
     */
    function getCaseEvidence(uint256 _caseId) external view validCaseId(_caseId) caseAccess(_caseId) returns (CaseEvidence[] memory) {
        return caseEvidenceList[_caseId];
    }

    /**
     * @dev Get case timeline
     */
    function getCaseTimeline(uint256 _caseId) external view validCaseId(_caseId) caseAccess(_caseId) returns (CaseTimeline[] memory) {
        return caseTimelines[_caseId];
    }

    /**
     * @dev Get court orders for case
     */
    function getCaseOrders(uint256 _caseId) external view validCaseId(_caseId) caseAccess(_caseId) returns (CourtOrder[] memory) {
        return caseOrders[_caseId];
    }

    /**
     * @dev Get user's cases
     */
    function getUserCases(address _user) external view returns (uint256[] memory) {
        return userCases[_user];
    }

    /**
     * @dev Get cases by type
     */
    function getCasesByType(CaseType _caseType) external view returns (uint256[] memory) {
        return casesByType[_caseType];
    }

    /**
     * @dev Get judge's assigned cases
     */
    function getJudgeAssignedCases(address _judge) external view returns (uint256[] memory) {
        return judgeAssignedCases[_judge];
    }

    /**
     * @dev Get total number of cases
     */
    function getTotalCases() external view returns (uint256) {
        return _caseIdCounter.current();
    }

    // Internal functions
    /**
     * @dev Add timeline entry
     */
    function _addTimelineEntry(
        uint256 _caseId,
        string memory _eventType,
        string memory _description,
        address _triggeredBy,
        string memory _additionalData
    ) internal {
        CaseTimeline memory timelineEntry = CaseTimeline({
            timestamp: block.timestamp,
            eventType: _eventType,
            description: _description,
            triggeredBy: _triggeredBy,
            additionalData: _additionalData
        });

        caseTimelines[_caseId].push(timelineEntry);
    }

    /**
     * @dev Grant evidence access to case parties
     */
    function _grantEvidenceAccessToParties(uint256 _caseId, uint256 _evidenceId) internal {
        CaseParty[] memory parties = caseParties[_caseId];
        for (uint i = 0; i < parties.length; i++) {
            if (parties[i].isActive) {
                proofVault.authorizeViewer(_evidenceId, parties[i].partyAddress);
                if (parties[i].legalRepresentative != address(0)) {
                    proofVault.authorizeViewer(_evidenceId, parties[i].legalRepresentative);
                }
            }
        }
        
        // Grant access to assigned judge
        if (legalCases[_caseId].assignedJudge != address(0)) {
            proofVault.authorizeViewer(_evidenceId, legalCases[_caseId].assignedJudge);
        }
    }

    // Admin functions
    /**
     * @dev Update ProofVault contract address
     */
    function updateProofVault(address _newProofVault) external onlyRole(CASE_ADMIN_ROLE) {
        proofVault = IProofVault(_newProofVault);
    }

    /**
     * @dev Update Identity Attestation contract address
     */
    function updateIdentityAttestation(address _newIdentityAttestation) external onlyRole(CASE_ADMIN_ROLE) {
        identityAttestation = IIdentityAttestation(_newIdentityAttestation);
    }

    /**
     * @dev Emergency pause case (admin only)
     */
    function pauseCase(uint256 _caseId) external validCaseId(_caseId) onlyRole(CASE_ADMIN_ROLE) {
        legalCases[_caseId].isActive = false;
        _addTimelineEntry(_caseId, "CASE_PAUSED", "Case paused by admin", msg.sender, "");
    }

    /**
     * @dev Resume paused case
     */
    function resumeCase(uint256 _caseId) external validCaseId(_caseId) onlyRole(CASE_ADMIN_ROLE) {
        legalCases[_caseId].isActive = true;
        _addTimelineEntry(_caseId, "CASE_RESUMED", "Case resumed by admin", msg.sender, "");
    }

    /**
     * @dev Emergency stop (circuit breaker)
     */
    function emergencyStop() external onlyRole(CASE_ADMIN_ROLE) {
        emergencyStopped = true;
    }

    function emergencyResume() external onlyRole(CASE_ADMIN_ROLE) {
        emergencyStopped = false;
    }

    /**
     * @dev Get case statistics
     */
    function getCaseStatistics() external view returns (
        uint256 totalCases,
        uint256 activeCases,
        uint256 closedCases,
        uint256 settledCases,
        uint256 pendingCases
    ) {
        totalCases = _caseIdCounter.current();
        activeCases = caseStatusCount[CaseStatus.FILED] +
                      caseStatusCount[CaseStatus.UNDER_INVESTIGATION] +
                      caseStatusCount[CaseStatus.DISCOVERY] +
                      caseStatusCount[CaseStatus.TRIAL_PREPARATION] +
                      caseStatusCount[CaseStatus.IN_TRIAL];
        closedCases = caseStatusCount[CaseStatus.CLOSED];
        settledCases = caseStatusCount[CaseStatus.SETTLED];
        pendingCases = caseStatusCount[CaseStatus.JUDGMENT_PENDING];
    }

    // Role management functions
    function grantLegalCounselRole(address account) external onlyRole(CASE_ADMIN_ROLE) {
        _grantRole(LEGAL_COUNSEL_ROLE, account);
    }

    function grantJudgeRole(address account) external onlyRole(CASE_ADMIN_ROLE) {
        _grantRole(JUDGE_ROLE, account);
    }

    function grantCourtClerkRole(address account) external onlyRole(CASE_ADMIN_ROLE) {
        _grantRole(COURT_CLERK_ROLE, account);
    }

    function grantProsecutorRole(address account) external onlyRole(CASE_ADMIN_ROLE) {
        _grantRole(PROSECUTOR_ROLE, account);
    }

    function grantPublicDefenderRole(address account) external onlyRole(CASE_ADMIN_ROLE) {
        _grantRole(PUBLIC_DEFENDER_ROLE, account);
    }
}
