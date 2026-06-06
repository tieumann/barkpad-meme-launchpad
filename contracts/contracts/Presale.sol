// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Presale
 * @notice Fixed-price presale of a project token (e.g. DOGON) for native OPN.
 *
 * Spec: Requirement 14 (Presale).
 *  - Buyers send OPN during the sale window and receive tokens at a fixed rate.
 *  - Per-wallet and global hard caps protect fairness.
 *  - A soft cap enables refunds: if not reached by the end, buyers reclaim OPN.
 *  - Tokens are claimable only after a successful finalize (optional vesting cliff).
 *  - The owner withdraws raised OPN only after a successful sale.
 *
 * The sale must be funded with enough tokens to cover hardCap * rate before start.
 */
contract Presale is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public immutable rate; // tokens (wei) per 1 OPN (wei) -> tokensOut = opnIn * rate / 1e18
    uint64 public immutable startTime;
    uint64 public immutable endTime;
    uint256 public immutable softCap; // OPN
    uint256 public immutable hardCap; // OPN
    uint256 public immutable maxPerWallet; // OPN
    uint64 public claimUnlockTime; // tokens claimable at/after this time once finalized

    uint256 public totalRaised;
    bool public finalized;
    bool public cancelled;

    mapping(address => uint256) public contributed; // OPN per buyer
    mapping(address => bool) public claimed;

    event Bought(address indexed buyer, uint256 opnIn, uint256 tokensAllocated);
    event Claimed(address indexed buyer, uint256 tokens);
    event Refunded(address indexed buyer, uint256 opn);
    event Finalized(uint256 totalRaised);
    event Cancelled();

    error NotLive();
    error SaleEnded();
    error SaleNotEnded();
    error ZeroAmount();
    error HardCapExceeded();
    error WalletCapExceeded();
    error NotFinalized();
    error AlreadyFinalized();
    error SoftCapNotMet();
    error SoftCapMet();
    error NothingToClaim();
    error TooEarlyToClaim();
    error TransferFailed();

    constructor(
        address token_,
        uint256 rate_,
        uint64 startTime_,
        uint64 endTime_,
        uint256 softCap_,
        uint256 hardCap_,
        uint256 maxPerWallet_,
        uint64 claimUnlockTime_,
        address owner_
    ) Ownable(owner_) {
        require(token_ != address(0), "zero token");
        require(endTime_ > startTime_, "bad window");
        require(hardCap_ >= softCap_ && hardCap_ > 0, "bad caps");
        require(rate_ > 0, "bad rate");
        token = IERC20(token_);
        rate = rate_;
        startTime = startTime_;
        endTime = endTime_;
        softCap = softCap_;
        hardCap = hardCap_;
        maxPerWallet = maxPerWallet_;
        claimUnlockTime = claimUnlockTime_;
    }

    // --- Views ---

    function tokensFor(uint256 opnIn) public view returns (uint256) {
        return (opnIn * rate) / 1e18;
    }

    function isLive() public view returns (bool) {
        return !cancelled && block.timestamp >= startTime && block.timestamp <= endTime && totalRaised < hardCap;
    }

    // --- Buy ---

    function buy() external payable nonReentrant {
        if (cancelled) revert NotLive();
        if (block.timestamp < startTime) revert NotLive();
        if (block.timestamp > endTime) revert SaleEnded();
        if (msg.value == 0) revert ZeroAmount();

        uint256 newTotal = totalRaised + msg.value;
        if (newTotal > hardCap) revert HardCapExceeded();

        uint256 newContrib = contributed[msg.sender] + msg.value;
        if (maxPerWallet > 0 && newContrib > maxPerWallet) revert WalletCapExceeded();

        contributed[msg.sender] = newContrib;
        totalRaised = newTotal;

        emit Bought(msg.sender, msg.value, tokensFor(msg.value));
    }

    // --- Finalize / Cancel (owner) ---

    /// @notice Finalize a successful sale (soft cap met). Enables token claims.
    function finalize() external onlyOwner {
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp <= endTime && totalRaised < hardCap) revert SaleNotEnded();
        if (totalRaised < softCap) revert SoftCapNotMet();
        finalized = true;
        emit Finalized(totalRaised);
    }

    /// @notice Cancel the sale (e.g. soft cap missed) so buyers can refund.
    function cancel() external onlyOwner {
        if (finalized) revert AlreadyFinalized();
        cancelled = true;
        emit Cancelled();
    }

    // --- Claim / Refund (buyers) ---

    /// @notice Claim purchased tokens after a successful finalize and unlock time.
    function claim() external nonReentrant {
        if (!finalized) revert NotFinalized();
        if (block.timestamp < claimUnlockTime) revert TooEarlyToClaim();
        uint256 contrib = contributed[msg.sender];
        if (contrib == 0 || claimed[msg.sender]) revert NothingToClaim();

        claimed[msg.sender] = true;
        uint256 amount = tokensFor(contrib);
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Refund OPN if the sale was cancelled or soft cap not met after end.
    function refund() external nonReentrant {
        bool failed = cancelled || (block.timestamp > endTime && totalRaised < softCap);
        if (!failed) revert SoftCapMet();
        uint256 contrib = contributed[msg.sender];
        if (contrib == 0) revert NothingToClaim();

        contributed[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: contrib}("");
        if (!ok) revert TransferFailed();
        emit Refunded(msg.sender, contrib);
    }

    /// @notice Owner withdraws raised OPN after a successful finalize.
    function withdrawProceeds(address to) external onlyOwner nonReentrant {
        if (!finalized) revert NotFinalized();
        if (to == address(0)) revert TransferFailed();
        (bool ok, ) = payable(to).call{value: address(this).balance}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Owner reclaims unsold tokens after finalize.
    function sweepUnsold(address to) external onlyOwner nonReentrant {
        if (!finalized) revert NotFinalized();
        uint256 sold = tokensFor(totalRaised);
        uint256 balance = token.balanceOf(address(this));
        uint256 unsold = balance > sold ? balance - sold : 0;
        if (unsold > 0) token.safeTransfer(to, unsold);
    }
}
