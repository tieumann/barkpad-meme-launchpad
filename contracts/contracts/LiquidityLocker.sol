// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LiquidityLocker
 * @notice Time-locks LP tokens produced at graduation to prevent rug pulls.
 *
 * Spec: Requirements 3.2, 3.3, 4.4, Correctness Property 5.
 *  - Only LOCKER_ROLE (bonding curves / factory) may create locks.
 *  - A lock cannot be withdrawn before `unlockTime`.
 *  - After unlock, it can be withdrawn exactly once by the beneficiary.
 *
 * The caller must transfer / approve the LP tokens to this contract; `lock`
 * pulls them in via transferFrom.
 */
contract LiquidityLocker is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");

    struct Lock {
        address lpToken;
        address beneficiary;
        uint256 amount;
        uint64 unlockTime;
        bool withdrawn;
    }

    Lock[] private _locks;

    event Locked(
        uint256 indexed lockId,
        address indexed lpToken,
        address indexed beneficiary,
        uint256 amount,
        uint64 unlockTime
    );
    event Withdrawn(uint256 indexed lockId, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidUnlockTime();
    error StillLocked();
    error AlreadyWithdrawn();
    error NotBeneficiary();
    error InvalidLockId();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function lock(
        address lpToken,
        uint256 amount,
        uint64 unlockTime,
        address beneficiary
    ) external nonReentrant onlyRole(LOCKER_ROLE) returns (uint256 lockId) {
        if (lpToken == address(0) || beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (unlockTime <= block.timestamp) revert InvalidUnlockTime();

        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        lockId = _locks.length;
        _locks.push(
            Lock({
                lpToken: lpToken,
                beneficiary: beneficiary,
                amount: amount,
                unlockTime: unlockTime,
                withdrawn: false
            })
        );

        emit Locked(lockId, lpToken, beneficiary, amount, unlockTime);
    }

    function withdraw(uint256 lockId) external nonReentrant {
        if (lockId >= _locks.length) revert InvalidLockId();
        Lock storage l = _locks[lockId];
        if (msg.sender != l.beneficiary) revert NotBeneficiary();
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < l.unlockTime) revert StillLocked();

        l.withdrawn = true;
        IERC20(l.lpToken).safeTransfer(l.beneficiary, l.amount);
        emit Withdrawn(lockId, l.amount);
    }

    function getLock(uint256 lockId) external view returns (Lock memory) {
        if (lockId >= _locks.length) revert InvalidLockId();
        return _locks[lockId];
    }

    function lockCount() external view returns (uint256) {
        return _locks.length;
    }
}
