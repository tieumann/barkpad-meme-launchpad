// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title QuestRewards
 * @notice Points-to-airdrop campaign for promoting a meme project.
 *
 * Spec: Requirement 15 (Quest points airdrop).
 *
 * Social actions (follow, join Discord, post on X, ...) are verified off-chain
 * by the project's backend, which holds OPERATOR_ROLE and awards points on-chain.
 * Each action type has a configurable point weight, e.g.:
 *   FOLLOW = 1, DISCORD = 1, X_POST = 2, REFERRAL = 3
 *
 * After the campaign, points convert to tokens at `tokensPerPoint`, claimable
 * from the funded reward pool. A user can only be awarded once per (actionId)
 * to prevent double counting.
 */
contract QuestRewards is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable rewardToken;

    /// @notice Point weight per action id (set by admin). e.g. keccak("FOLLOW") => 1
    mapping(bytes32 => uint64) public actionPoints;

    /// @notice Total points accrued by a user.
    mapping(address => uint256) public pointsOf;

    /// @notice Whether a user has been credited for a specific action (anti double-count).
    mapping(address => mapping(bytes32 => bool)) public completed;

    uint256 public totalPoints;
    uint256 public tokensPerPoint; // reward token wei per point (set at conversion)
    bool public conversionOpen;

    mapping(address => bool) public claimed;

    event ActionConfigured(bytes32 indexed actionId, uint64 points);
    event PointsAwarded(address indexed user, bytes32 indexed actionId, uint64 points, uint256 newTotal);
    event ConversionOpened(uint256 tokensPerPoint);
    event Claimed(address indexed user, uint256 points, uint256 tokens);

    error ActionNotConfigured();
    error AlreadyCompleted();
    error ConversionNotOpen();
    error ConversionAlreadyOpen();
    error NothingToClaim();
    error ZeroAddress();

    constructor(address rewardToken_, address admin) {
        if (rewardToken_ == address(0) || admin == address(0)) revert ZeroAddress();
        rewardToken = IERC20(rewardToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // --- Admin config ---

    /// @notice Configure the point weight for an action id (e.g. "FOLLOW", "X_POST").
    function configureAction(bytes32 actionId, uint64 points) external onlyRole(DEFAULT_ADMIN_ROLE) {
        actionPoints[actionId] = points;
        emit ActionConfigured(actionId, points);
    }

    function configureActions(bytes32[] calldata ids, uint64[] calldata points)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(ids.length == points.length, "length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            actionPoints[ids[i]] = points[i];
            emit ActionConfigured(ids[i], points[i]);
        }
    }

    // --- Operator awards points (backend verified social actions) ---

    function awardAction(address user, bytes32 actionId) public onlyRole(OPERATOR_ROLE) {
        uint64 pts = actionPoints[actionId];
        if (pts == 0) revert ActionNotConfigured();
        if (completed[user][actionId]) revert AlreadyCompleted();

        completed[user][actionId] = true;
        pointsOf[user] += pts;
        totalPoints += pts;
        emit PointsAwarded(user, actionId, pts, pointsOf[user]);
    }

    /// @notice Batch award (gas-efficient backend sync).
    function awardBatch(address[] calldata users, bytes32[] calldata actionIds)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(users.length == actionIds.length, "length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            awardAction(users[i], actionIds[i]);
        }
    }

    // --- Conversion + claim ---

    /**
     * @notice Open conversion at a fixed tokens-per-point rate. The contract must
     *         already hold enough reward tokens (>= totalPoints * tokensPerPoint).
     */
    function openConversion(uint256 tokensPerPoint_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (conversionOpen) revert ConversionAlreadyOpen();
        uint256 required = totalPoints * tokensPerPoint_;
        require(rewardToken.balanceOf(address(this)) >= required, "underfunded");
        tokensPerPoint = tokensPerPoint_;
        conversionOpen = true;
        emit ConversionOpened(tokensPerPoint_);
    }

    function claimable(address user) public view returns (uint256) {
        if (!conversionOpen || claimed[user]) return 0;
        return pointsOf[user] * tokensPerPoint;
    }

    function claim() external nonReentrant {
        if (!conversionOpen) revert ConversionNotOpen();
        if (claimed[msg.sender]) revert NothingToClaim();
        uint256 pts = pointsOf[msg.sender];
        if (pts == 0) revert NothingToClaim();

        claimed[msg.sender] = true;
        uint256 amount = pts * tokensPerPoint;
        rewardToken.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, pts, amount);
    }
}
