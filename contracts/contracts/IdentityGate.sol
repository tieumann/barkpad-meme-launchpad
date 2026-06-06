// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title IdentityGate
 * @notice Adapter that verifies IOPn Digital Identity attestations for creators.
 *
 * Spec: Requirements 5.1-5.5, Correctness Property 8.
 *
 * MVP model: signature-based attestation. An authorized IOPn verifier signs
 * (creator, expiry, chainId, this) off-chain; creators submit the signature when
 * launching. The official on-chain attestation interface can be swapped in later
 * behind this same adapter.
 *
 * The `policy` controls graceful degradation when verification is unavailable:
 *   - BLOCK_UNVERIFIED: unverified creators cannot launch.
 *   - ALLOW_UNVERIFIED: launches are allowed; tokens are simply not marked verified.
 */
contract IdentityGate is Ownable {
    using ECDSA for bytes32;

    enum Policy {
        BLOCK_UNVERIFIED,
        ALLOW_UNVERIFIED
    }

    /// @notice Trusted IOPn verifier key that signs attestations.
    address public verifier;
    Policy public policy;

    /// @notice Cached verification status (e.g. after a successful on-chain check).
    mapping(address => bool) private _verified;

    event VerifierUpdated(address verifier);
    event PolicyUpdated(Policy policy);
    event Verified(address indexed account);

    error ZeroAddress();
    error AttestationExpired();
    error InvalidAttestation();
    error NotVerified();

    constructor(address admin, address verifier_, Policy policy_) Ownable(admin) {
        if (verifier_ == address(0)) revert ZeroAddress();
        verifier = verifier_;
        policy = policy_;
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier_ == address(0)) revert ZeroAddress();
        verifier = verifier_;
        emit VerifierUpdated(verifier_);
    }

    function setPolicy(Policy policy_) external onlyOwner {
        policy = policy_;
        emit PolicyUpdated(policy_);
    }

    /// @notice Build the message hash an authorized verifier must sign.
    function attestationHash(address account, uint64 expiry) public view returns (bytes32) {
        return keccak256(abi.encode(account, expiry, block.chainid, address(this)));
    }

    /**
     * @notice Submit a verifier-signed attestation to mark `account` verified.
     * @dev Anyone may relay a valid signature; the signer is what matters.
     */
    function submitAttestation(address account, uint64 expiry, bytes calldata signature) external {
        if (account == address(0)) revert ZeroAddress();
        if (expiry < block.timestamp) revert AttestationExpired();

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationHash(account, expiry));
        address signer = digest.recover(signature);
        if (signer != verifier) revert InvalidAttestation();

        _verified[account] = true;
        emit Verified(account);
    }

    function isVerified(address account) public view returns (bool) {
        return _verified[account];
    }

    /**
     * @notice Called by the factory at launch time.
     * @return verified Whether the creator is identity-verified.
     *
     * Under BLOCK_UNVERIFIED policy this reverts for unverified creators.
     * Under ALLOW_UNVERIFIED it returns false instead of reverting.
     */
    function checkLaunch(address creator) external view returns (bool verified) {
        verified = _verified[creator];
        if (!verified && policy == Policy.BLOCK_UNVERIFIED) revert NotVerified();
    }
}
