// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @notice Collects Barkpad protocol fees (creation + trading) and gates withdrawals.
 *
 * Spec: Requirements 9.1-9.4, Correctness Properties 3 & 4.
 *  - Fees are received via `collect` and held by this contract.
 *  - Withdrawals are restricted to TREASURER_ROLE.
 *  - Fee parameters are adjustable only by FEE_ADMIN_ROLE, within hard bounds:
 *      tradingFeeBps <= MAX_TRADING_FEE_BPS (3%)
 *      creationFee   <= MAX_CREATION_FEE
 */
contract Treasury is AccessControl, ReentrancyGuard {
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");

    /// @notice Hard upper bound on trading fee: 300 bps = 3%.
    uint16 public constant MAX_TRADING_FEE_BPS = 300;
    /// @notice Hard upper bound on the token creation fee.
    uint256 public constant MAX_CREATION_FEE = 100 ether;

    uint16 public tradingFeeBps;
    uint256 public creationFee;

    event FeeCollected(address indexed from, uint256 amount, bytes32 indexed kind);
    event Withdrawn(address indexed to, uint256 amount);
    event TradingFeeUpdated(uint16 bps);
    event CreationFeeUpdated(uint256 fee);

    error FeeTooHigh();
    error NothingToWithdraw();
    error TransferFailed();
    error ZeroAddress();

    constructor(address admin, uint16 tradingFeeBps_, uint256 creationFee_) {
        if (admin == address(0)) revert ZeroAddress();
        if (tradingFeeBps_ > MAX_TRADING_FEE_BPS || creationFee_ > MAX_CREATION_FEE) {
            revert FeeTooHigh();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
        _grantRole(FEE_ADMIN_ROLE, admin);
        tradingFeeBps = tradingFeeBps_;
        creationFee = creationFee_;
    }

    /// @notice Receive a fee payment tagged with a kind (e.g. "creation", "trade").
    function collect(bytes32 kind) external payable {
        emit FeeCollected(msg.sender, msg.value, kind);
    }

    /// @notice Plain receive also counts as an untagged fee deposit.
    receive() external payable {
        emit FeeCollected(msg.sender, msg.value, bytes32(0));
    }

    /// @notice Withdraw collected fees. Restricted to TREASURER_ROLE.
    function withdraw(address to, uint256 amount) external nonReentrant onlyRole(TREASURER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > address(this).balance) revert NothingToWithdraw();
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function setTradingFeeBps(uint16 bps) external onlyRole(FEE_ADMIN_ROLE) {
        if (bps > MAX_TRADING_FEE_BPS) revert FeeTooHigh();
        tradingFeeBps = bps;
        emit TradingFeeUpdated(bps);
    }

    function setCreationFee(uint256 fee) external onlyRole(FEE_ADMIN_ROLE) {
        if (fee > MAX_CREATION_FEE) revert FeeTooHigh();
        creationFee = fee;
        emit CreationFeeUpdated(fee);
    }
}
