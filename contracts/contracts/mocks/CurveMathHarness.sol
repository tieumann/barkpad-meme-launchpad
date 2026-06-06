// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CurveMath} from "../libraries/CurveMath.sol";

/// @notice Test-only wrapper exposing CurveMath pure functions.
contract CurveMathHarness {
    function costBetween(uint256 basePrice, uint256 slope, uint256 n0, uint256 n1) external pure returns (uint256) {
        return CurveMath.costBetween(basePrice, slope, n0, n1);
    }

    function tokensForOPN(
        uint256 basePrice,
        uint256 slope,
        uint256 n0,
        uint256 opnIn
    ) external pure returns (uint256 n1, uint256 cost) {
        return CurveMath.tokensForOPN(basePrice, slope, n0, opnIn);
    }
}
