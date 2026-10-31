// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "../src/ArcadiaTournamentEscrow.sol";
interface Vm { function warp(uint256) external; function prank(address) external; function expectRevert() external; }
contract MockToken is IERC20 {
    mapping(address => uint256) public balanceOf;
    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
}
contract MockIdentity is IGoodIdentity {
    mapping(address => bool) public isWhitelisted;
    function verify(address account, bool status) external { isWhitelisted[account] = status; }
}
contract EscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockToken token; MockIdentity identity; ArcadiaTournamentEscrow escrow;
    address alice = address(0xA11CE); address bob = address(0xB0B);
    function setUp() public {
        token = new MockToken(); identity = new MockIdentity();
        escrow = new ArcadiaTournamentEscrow(token, identity, keccak256("founding-week"), block.timestamp + 1 days, 1000 ether);
        token.mint(address(this), 1000 ether); token.mint(bob, 1000 ether); identity.verify(alice, true);
    }
    function leaf(address account, uint256 amount) internal view returns (bytes32) { return keccak256(abi.encode(block.chainid, address(escrow), escrow.tournamentId(), account, amount)); }
    function testFundFinalizeClaimAndRejectReplay() public {
        escrow.fund(100 ether); vm.warp(escrow.endsAt()); escrow.finalize(leaf(alice, 80 ether), 80 ether);
        vm.prank(alice); escrow.claim(80 ether, new bytes32[](0));
        require(token.balanceOf(alice) == 80 ether && escrow.totalClaimed() == 80 ether, "exact payout");
        vm.expectRevert(); vm.prank(alice); escrow.claim(80 ether, new bytes32[](0));
    }
    function testRejectUnfundedPrematureAndForgedClaims() public {
        bytes32 proposed = leaf(alice, 1);
        vm.expectRevert(); escrow.finalize(proposed, 1);
        vm.warp(escrow.endsAt()); vm.expectRevert(); escrow.finalize(proposed, 1);
        escrow.fund(100 ether); escrow.finalize(leaf(alice, 80 ether), 80 ether);
        vm.expectRevert(); vm.prank(alice); escrow.claim(90 ether, new bytes32[](0));
        vm.expectRevert(); vm.prank(bob); escrow.claim(80 ether, new bytes32[](0));
    }
    function testIdentityRevocationAndReverification() public {
        escrow.fund(100 ether); vm.warp(escrow.endsAt()); escrow.finalize(leaf(alice, 80 ether), 80 ether);
        identity.verify(alice, false); vm.expectRevert(); vm.prank(alice); escrow.claim(80 ether, new bytes32[](0));
        identity.verify(alice, true); vm.prank(alice); escrow.claim(80 ether, new bytes32[](0));
    }
    function testCancellationRefundsSponsorsOnce() public {
        escrow.fund(100 ether); vm.prank(bob); escrow.fund(300 ether); escrow.cancel();
        escrow.refund(); vm.prank(bob); escrow.refund();
        require(token.balanceOf(address(this)) == 1000 ether && token.balanceOf(bob) == 1000 ether, "full refunds");
        vm.expectRevert(); escrow.refund();
    }
    function testExpiredUnclaimedFundsRefundProportionally() public {
        escrow.fund(100 ether); vm.prank(bob); escrow.fund(300 ether);
        vm.warp(escrow.endsAt()); escrow.finalize(leaf(alice, 80 ether), 80 ether);
        vm.prank(alice); escrow.claim(80 ether, new bytes32[](0));
        vm.warp(escrow.claimDeadline()); escrow.refund(); vm.prank(bob); escrow.refund();
        require(token.balanceOf(address(this)) == 980 ether && token.balanceOf(bob) == 940 ether, "proportional residual");
    }
    function testCapAndImmutableAllocation() public {
        vm.expectRevert(); escrow.fund(1001 ether);
        escrow.fund(100 ether); vm.warp(escrow.endsAt()); escrow.finalize(leaf(alice, 80 ether), 80 ether);
        bytes32 replacement = leaf(bob, 80 ether);
        vm.expectRevert(); escrow.finalize(replacement, 80 ether);
        vm.expectRevert(); escrow.cancel();
    }
}
