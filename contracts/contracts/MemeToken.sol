// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MemeToken
 * @notice Fixed-supply ERC-20 meme token used by Barkpad.
 *
 * Design goals (see spec Requirements 1.5, 4.1 and Correctness Property 2):
 *  - The entire supply is minted exactly once to the bonding curve at init.
 *  - Minting is permanently disabled afterwards; there is no `mint()` path.
 *  - There is no transfer pause / blacklist, preventing honeypot patterns.
 *
 * The contract is deployed as an EIP-1167 minimal clone by the TokenFactory,
 * so it uses an `initialize` function instead of a constructor.
 */
contract MemeToken is ERC20 {
    /// @notice The creator (launcher) of this token.
    address public creator;

    /// @notice IPFS CID reference for off-chain metadata (logo, description, socials).
    bytes32 public metadataId;

    /// @notice Always true once initialized. No additional supply can ever be minted.
    bool public mintingDisabled;

    bool private _initialized;

    // ERC20 base constructor requires name/symbol; clones bypass constructors,
    // so we pass placeholders here and set the real values in `initialize`.
    string private _name;
    string private _symbol;

    error AlreadyInitialized();
    error InvalidParams();

    constructor() ERC20("", "") {}

    /**
     * @notice Initialize the clone: set metadata and mint the full supply to the curve.
     * @param name_ Token name.
     * @param symbol_ Token symbol.
     * @param totalSupply_ Total fixed supply (in wei units, 18 decimals).
     * @param curve The bonding curve contract that receives the entire supply.
     * @param creator_ The address that launched this token.
     * @param metadataId_ IPFS CID reference for metadata.
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        address curve,
        address creator_,
        bytes32 metadataId_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (curve == address(0) || creator_ == address(0) || totalSupply_ == 0) {
            revert InvalidParams();
        }

        _initialized = true;
        _name = name_;
        _symbol = symbol_;
        creator = creator_;
        metadataId = metadataId_;

        // Mint the entire supply to the curve, then permanently disable minting.
        _mint(curve, totalSupply_);
        mintingDisabled = true;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }
}
