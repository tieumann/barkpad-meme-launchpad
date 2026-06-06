// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

/**
 * @title MemeAirdrop
 * @notice Merkle-based airdrop for a single meme token.
 *
 * Spec: Requirement 13.
 *  - A creator funds the contract with tokens and sets a Merkle root.
 *  - Leaves are keccak256(abi.encodePacked(index, account, amount)).
 *  - Each index can be claimed exactly once (BitMap).
 *  - After expiry, the creator can reclaim unclaimed tokens.
 *
 * Total claimed can never exceed the funded balance because transfers draw
 * from the contract's actual token balance.
 */
contract MemeAirdrop is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using BitMaps for BitMaps.BitMap;

    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    uint64 public immutable expiry;

    uint256 public totalClaimed;
    BitMaps.BitMap private _claimed;

    event Claimed(uint256 indexed index, address indexed account, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    error AlreadyClaimed();
    error InvalidProof();
    error NotExpired();
    error Expired();

    constructor(
        address token_,
        bytes32 merkleRoot_,
        uint64 expiry_,
        address owner_
    ) Ownable(owner_) {
        token = IERC20(token_);
        merkleRoot = merkleRoot_;
        expiry = expiry_;
    }

    function isClaimed(uint256 index) public view returns (bool) {
        return _claimed.get(index);
    }

    /**
     * @notice Claim an allocation with a Merkle proof.
     * @param index Leaf index (unique per recipient).
     * @param account Recipient address.
     * @param amount Allocation amount.
     * @param proof Merkle proof for the leaf.
     */
    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (block.timestamp > expiry) revert Expired();
        if (_claimed.get(index)) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert InvalidProof();

        _claimed.set(index);
        totalClaimed += amount;
        token.safeTransfer(account, amount);

        emit Claimed(index, account, amount);
    }

    /// @notice After expiry, the owner reclaims unclaimed tokens (Req 13.5).
    function sweep(address to) external onlyOwner nonReentrant {
        if (block.timestamp <= expiry) revert NotExpired();
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.safeTransfer(to, balance);
            emit Swept(to, balance);
        }
    }
}
