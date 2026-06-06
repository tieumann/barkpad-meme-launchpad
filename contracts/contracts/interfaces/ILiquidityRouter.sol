// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ILiquidityRouter
 * @notice Minimal router interface the BondingCurve uses at graduation.
 *
 * The curve sends native OPN (msg.value) plus an ERC-20 token amount and
 * receives LP tokens at `lpRecipient`. This abstracts the DEX so an official
 * OPN Chain router can be swapped in for the SimpleAMM fallback.
 */
interface ILiquidityRouter {
    /**
     * @param token The ERC-20 token to pair with native OPN.
     * @param tokenAmount Amount of `token` provided (must be approved to the router).
     * @param lpRecipient Address that receives the minted LP tokens.
     * @return pool The pool/pair address.
     * @return lpToken The LP token address.
     * @return lpAmount The amount of LP tokens minted.
     */
    function addLiquidityOPN(
        address token,
        uint256 tokenAmount,
        address lpRecipient
    ) external payable returns (address pool, address lpToken, uint256 lpAmount);
}
