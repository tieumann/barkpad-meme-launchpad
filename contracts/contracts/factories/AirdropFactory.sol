// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MemeAirdrop} from "../MemeAirdrop.sol";

/**
 * @title AirdropFactory
 * @notice Deploys a Merkle airdrop per campaign. The creator funds the returned
 *         contract with tokens after deployment (then recipients claim).
 *
 * Spec: Requirement 13.
 */
contract AirdropFactory {
    event AirdropCreated(
        address indexed creator,
        address indexed token,
        address airdrop,
        bytes32 merkleRoot,
        uint64 expiry
    );

    mapping(address => address[]) public airdropsByCreator;
    address[] public allAirdrops;

    function createAirdrop(
        address token,
        bytes32 merkleRoot,
        uint64 expiry
    ) external returns (address airdrop) {
        MemeAirdrop drop = new MemeAirdrop(token, merkleRoot, expiry, msg.sender);
        airdrop = address(drop);
        airdropsByCreator[msg.sender].push(airdrop);
        allAirdrops.push(airdrop);
        emit AirdropCreated(msg.sender, token, airdrop, merkleRoot, expiry);
    }

    function airdropCount() external view returns (uint256) {
        return allAirdrops.length;
    }
}
