// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MemeStaking} from "../MemeStaking.sol";

/**
 * @title StakingFactory
 * @notice Deploys a MemeStaking pool per (stakingToken, rewardToken) on demand.
 *         Ownership of the new pool is given to the caller (creator) so they can
 *         fund and configure rewards.
 *
 * Spec: Requirement 12 (deployment surface for community staking).
 */
contract StakingFactory {
    event StakingCreated(
        address indexed creator,
        address indexed stakingToken,
        address indexed rewardToken,
        address pool
    );

    mapping(address => address[]) public poolsByCreator;
    address[] public allPools;

    function createStaking(address stakingToken, address rewardToken) external returns (address pool) {
        MemeStaking staking = new MemeStaking(stakingToken, rewardToken, msg.sender);
        pool = address(staking);
        poolsByCreator[msg.sender].push(pool);
        allPools.push(pool);
        emit StakingCreated(msg.sender, stakingToken, rewardToken, pool);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }
}
