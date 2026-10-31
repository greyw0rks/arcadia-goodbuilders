// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}
interface IGoodIdentity { function isWhitelisted(address) external view returns (bool); }

/// @notice One funded tournament, one immutable allocation root, claims to verified identity wallets.
/// @dev No entry fees. Sponsors can reclaim proportionally after cancellation or the claim deadline.
contract ArcadiaTournamentEscrow {
    IERC20 public immutable token;
    IGoodIdentity public immutable identity;
    address public immutable manager;
    bytes32 public immutable tournamentId;
    uint256 public immutable endsAt;
    uint256 public immutable claimDeadline;
    uint256 public immutable poolCap;
    uint256 public totalFunded;
    uint256 public totalAllocated;
    uint256 public totalClaimed;
    bytes32 public merkleRoot;
    bool public cancelled;
    bool public refundsOpened;
    uint256 public refundPool;
    uint256 private entered;
    mapping(address => uint256) public contributions;
    mapping(address => bool) public claimed;
    mapping(address => bool) public refunded;
    event Funded(address indexed sponsor, uint256 amount);
    event Finalized(bytes32 indexed root, uint256 totalAllocated);
    event Claimed(address indexed account, uint256 amount);
    event Refunded(address indexed sponsor, uint256 amount);
    event Cancelled();

    modifier nonReentrant() { require(entered == 0, "reentrant"); entered = 1; _; entered = 0; }
    constructor(IERC20 token_, IGoodIdentity identity_, bytes32 tournamentId_, uint256 endsAt_, uint256 cap_) {
        require(address(token_).code.length > 0 && address(identity_).code.length > 0, "contracts required");
        require(endsAt_ > block.timestamp && cap_ > 0, "invalid rules");
        token = token_; identity = identity_; manager = msg.sender; tournamentId = tournamentId_;
        endsAt = endsAt_; claimDeadline = endsAt_ + 30 days; poolCap = cap_;
    }
    function fund(uint256 amount) external nonReentrant {
        require(!cancelled && merkleRoot == bytes32(0) && block.timestamp < claimDeadline, "funding closed");
        require(amount > 0, "zero deposit");
        uint256 beforeBalance = token.balanceOf(address(this));
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        uint256 received = token.balanceOf(address(this)) - beforeBalance;
        require(received > 0 && totalFunded + received <= poolCap, "pool cap");
        totalFunded += received; contributions[msg.sender] += received;
        emit Funded(msg.sender, received);
    }
    function finalize(bytes32 root, uint256 allocation) external {
        require(msg.sender == manager, "manager only");
        require(!cancelled && merkleRoot == bytes32(0), "already settled");
        require(block.timestamp >= endsAt && block.timestamp < claimDeadline, "outside settlement window");
        require(root != bytes32(0) && allocation > 0 && allocation <= totalFunded && allocation <= token.balanceOf(address(this)), "unfunded allocation");
        merkleRoot = root; totalAllocated = allocation;
        emit Finalized(root, allocation);
    }
    function claim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        require(!cancelled && merkleRoot != bytes32(0) && block.timestamp < claimDeadline, "claims closed");
        require(!claimed[msg.sender] && amount > 0, "already claimed or zero");
        require(identity.isWhitelisted(msg.sender), "identity not verified");
        bytes32 hash = keccak256(abi.encode(block.chainid, address(this), tournamentId, msg.sender, amount));
        for (uint256 i; i < proof.length; i++) {
            hash = hash < proof[i] ? keccak256(abi.encodePacked(hash, proof[i])) : keccak256(abi.encodePacked(proof[i], hash));
        }
        require(hash == merkleRoot && totalClaimed + amount <= totalAllocated, "invalid allocation");
        claimed[msg.sender] = true; totalClaimed += amount;
        uint256 beforeBalance = token.balanceOf(msg.sender);
        require(token.transfer(msg.sender, amount), "transfer failed");
        require(token.balanceOf(msg.sender) - beforeBalance == amount, "unexpected token fee");
        emit Claimed(msg.sender, amount);
    }
    function cancel() external {
        require(msg.sender == manager && merkleRoot == bytes32(0), "cannot cancel");
        cancelled = true; emit Cancelled();
    }
    function refund() external nonReentrant {
        require(cancelled || block.timestamp >= claimDeadline, "refunds not open");
        require(!refunded[msg.sender] && contributions[msg.sender] > 0, "no refund");
        if (!refundsOpened) { refundsOpened = true; refundPool = token.balanceOf(address(this)); }
        refunded[msg.sender] = true;
        uint256 amount = refundPool * contributions[msg.sender] / totalFunded;
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Refunded(msg.sender, amount);
    }
}
