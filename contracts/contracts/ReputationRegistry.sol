// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationRegistry
 * @notice On-chain, event-derived creator reputation for Barkpad.
 *
 * Spec: Requirements 6.1-6.5, Correctness Property 9.
 * Score is a pure function of recorded launch/graduation/flag events; it cannot
 * be set directly. Writers are restricted by role:
 *   - FACTORY_ROLE  -> recordLaunch
 *   - CURVE_ROLE    -> recordGraduation
 *   - MODERATOR_ROLE-> flag
 */
contract ReputationRegistry is AccessControl {
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    bytes32 public constant CURVE_ROLE = keccak256("CURVE_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    /// @notice Score weight added when a token graduates.
    int64 public constant W_GRAD = 10;
    /// @notice Score weight subtracted when a creator is flagged.
    int64 public constant W_FLAG = 25;

    struct Reputation {
        uint32 launches;
        uint32 graduations;
        uint32 flags;
        int64 score;
    }

    mapping(address => Reputation) private _reputation;

    event LaunchRecorded(address indexed creator, address indexed token);
    event GraduationRecorded(address indexed creator, address indexed token);
    event Flagged(address indexed creator, address indexed token, string reason);

    error ZeroAddress();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MODERATOR_ROLE, admin);
    }

    function recordLaunch(address creator, address token) external onlyRole(FACTORY_ROLE) {
        if (creator == address(0)) revert ZeroAddress();
        _reputation[creator].launches += 1;
        emit LaunchRecorded(creator, token);
    }

    function recordGraduation(address creator, address token) external onlyRole(CURVE_ROLE) {
        if (creator == address(0)) revert ZeroAddress();
        Reputation storage r = _reputation[creator];
        r.graduations += 1;
        r.score += W_GRAD;
        emit GraduationRecorded(creator, token);
    }

    function flag(address creator, address token, string calldata reason) external onlyRole(MODERATOR_ROLE) {
        if (creator == address(0)) revert ZeroAddress();
        Reputation storage r = _reputation[creator];
        r.flags += 1;
        r.score -= W_FLAG;
        emit Flagged(creator, token, reason);
    }

    function reputationOf(address creator) external view returns (Reputation memory) {
        return _reputation[creator];
    }
}
