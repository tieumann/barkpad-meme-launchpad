// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title CurveMath
 * @notice Pure math for a linear bonding curve priced in native OPN.
 *
 * Supply sold (`n`) is measured in WHOLE tokens (not wei) to keep the squared
 * terms within uint256 bounds. Price for one whole token at supply `n` is:
 *
 *     price(n) = basePrice + slope * n            [OPN wei per whole token]
 *
 * The cost to buy whole tokens from n0 to n1 is the discrete integral:
 *
 *     cost(n0, n1) = basePrice*(n1-n0) + slope*(n1^2 - n0^2)/2
 *
 * Spec: Requirements 2.1-2.3, Correctness Property 1 & 11.
 */
library CurveMath {
    error InvalidRange();

    /// @notice Cost in OPN wei to move supply sold from n0 to n1 (n1 >= n0).
    function costBetween(
        uint256 basePrice,
        uint256 slope,
        uint256 n0,
        uint256 n1
    ) internal pure returns (uint256) {
        if (n1 < n0) revert InvalidRange();
        uint256 dn = n1 - n0;
        uint256 linear = basePrice * dn;
        // slope * (n1^2 - n0^2) / 2 == slope * (n1+n0) * (n1-n0) / 2
        uint256 quad = (slope * (n1 + n0) * dn) / 2;
        return linear + quad;
    }

    /**
     * @notice Maximum whole tokens purchasable with `opnIn` starting at supply n0.
     * @return n1 New supply-sold level (whole tokens).
     * @return cost Actual OPN wei consumed (<= opnIn).
     */
    function tokensForOPN(
        uint256 basePrice,
        uint256 slope,
        uint256 n0,
        uint256 opnIn
    ) internal pure returns (uint256 n1, uint256 cost) {
        if (opnIn == 0) return (n0, 0);

        if (slope == 0) {
            // Constant price.
            require(basePrice > 0, "bad params");
            uint256 dn = opnIn / basePrice;
            n1 = n0 + dn;
            cost = costBetween(basePrice, slope, n0, n1);
            return (n1, cost);
        }

        // Solve A*n1^2 + B*n1 - C = 0 for the largest integer n1.
        //   A = slope
        //   B = 2*basePrice
        //   C = slope*n0^2 + 2*basePrice*n0 + 2*opnIn
        uint256 A = slope;
        uint256 B = 2 * basePrice;
        uint256 C = slope * n0 * n0 + 2 * basePrice * n0 + 2 * opnIn;

        uint256 disc = B * B + 4 * A * C;
        uint256 root = sqrt(disc);
        // n1 = floor((-B + root) / (2A))
        if (root <= B) {
            n1 = n0;
        } else {
            n1 = (root - B) / (2 * A);
        }
        if (n1 < n0) n1 = n0;

        // Guard against floating rounding: ensure cost <= opnIn, otherwise step back.
        cost = costBetween(basePrice, slope, n0, n1);
        while (cost > opnIn && n1 > n0) {
            n1 -= 1;
            cost = costBetween(basePrice, slope, n0, n1);
        }
    }

    /// @notice Babylonian integer square root.
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
