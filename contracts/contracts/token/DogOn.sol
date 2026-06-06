// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DogOn
 * @notice The flagship project meme token for Barkpad on OPN Chain.
 *         Symbol: DOGON. Fixed total supply minted at deployment to the treasury
 *         wallet, which then funds presale / staking / airdrop allocations.
 *
 * Anti-rug properties:
 *  - Fixed supply: no mint function exists, so supply can never inflate.
 *  - Burnable: holders may voluntarily reduce supply.
 */
contract DogOn is ERC20, ERC20Burnable, Ownable {
    /// @notice Total fixed supply: 1,000,000,000 DOGON (18 decimals).
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    constructor(address treasury, address owner_) ERC20("DogOn", "DOGON") Ownable(owner_) {
        require(treasury != address(0), "zero treasury");
        _mint(treasury, MAX_SUPPLY);
    }
}
