// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MemeToken} from "./MemeToken.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {Treasury} from "./Treasury.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {LiquidityLocker} from "./LiquidityLocker.sol";
import {IdentityGate} from "./IdentityGate.sol";

/**
 * @title TokenFactory
 * @notice Orchestrates a Barkpad launch in one transaction: identity check,
 *         creation fee, clone token + curve, mint supply to curve, record launch.
 *
 * Spec: Requirements 1.1-1.6, 5.1, 5.2, 6.1, 9.1.
 * Uses EIP-1167 minimal clones for cheap, fast launches.
 */
contract TokenFactory is Ownable {
    // Implementation contracts cloned per launch.
    address public immutable memeTokenImpl;
    address public immutable bondingCurveImpl;

    // Shared infrastructure.
    Treasury public immutable treasury;
    ReputationRegistry public immutable reputation;
    LiquidityLocker public immutable locker;
    IdentityGate public identityGate;
    address public router;

    bool public identityGatingEnabled;

    // Default curve safety params (configurable by owner).
    uint64 public lockDuration = 30 days;

    // Validation bounds (Req 1.4).
    uint256 public constant MIN_SUPPLY = 1e18; // at least 1 whole token
    uint256 public constant MAX_NAME_LEN = 32;
    uint256 public constant MAX_SYMBOL_LEN = 10;

    struct CreateParams {
        string name;
        string symbol;
        uint256 totalSupply; // wei (18 decimals)
        bytes32 metadataId;
        uint256 basePrice;
        uint256 slope;
        uint256 graduationCap;
        uint16 tradingFeeBps;
        uint256 walletCap;
        uint64 earlyWindowEnd;
    }

    struct TokenRecord {
        address token;
        address curve;
        address creator;
        uint64 createdAt;
        bytes32 metadataId;
        bool identityVerified;
    }

    mapping(address => TokenRecord) public records; // token => record
    address[] public allTokens;

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        bytes32 metadataId,
        bool identityVerified
    );
    event IdentityGateUpdated(address gate, bool enabled);
    event RouterUpdated(address router);

    error InvalidName();
    error InvalidSymbol();
    error InvalidSupply();
    error InsufficientFee();
    error FeeTooHighParam();
    error ZeroAddress();

    constructor(
        address owner_,
        address memeTokenImpl_,
        address bondingCurveImpl_,
        address treasury_,
        address reputation_,
        address locker_,
        address identityGate_,
        address router_,
        bool identityGatingEnabled_
    ) Ownable(owner_) {
        if (
            memeTokenImpl_ == address(0) ||
            bondingCurveImpl_ == address(0) ||
            treasury_ == address(0) ||
            reputation_ == address(0) ||
            locker_ == address(0) ||
            router_ == address(0)
        ) revert ZeroAddress();

        memeTokenImpl = memeTokenImpl_;
        bondingCurveImpl = bondingCurveImpl_;
        treasury = Treasury(payable(treasury_));
        reputation = ReputationRegistry(reputation_);
        locker = LiquidityLocker(locker_);
        identityGate = IdentityGate(identityGate_);
        router = router_;
        identityGatingEnabled = identityGatingEnabled_;
    }

    function setIdentityGate(address gate, bool enabled) external onlyOwner {
        identityGate = IdentityGate(gate);
        identityGatingEnabled = enabled;
        emit IdentityGateUpdated(gate, enabled);
    }

    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert ZeroAddress();
        router = router_;
        emit RouterUpdated(router_);
    }

    function setLockDuration(uint64 lockDuration_) external onlyOwner {
        lockDuration = lockDuration_;
    }

    function createToken(CreateParams calldata p) external payable returns (address token, address curve) {
        _validate(p);

        // Identity gating (Req 5.1, 5.2).
        bool verified = false;
        if (identityGatingEnabled && address(identityGate) != address(0)) {
            verified = identityGate.checkLaunch(msg.sender); // reverts if BLOCK policy + unverified
        }

        // Creation fee (Req 1.3, 9.1).
        uint256 fee = treasury.creationFee();
        if (msg.value < fee) revert InsufficientFee();
        if (fee > 0) treasury.collect{value: fee}(keccak256("creation"));

        // Clone token + curve (Req 1.1).
        token = Clones.clone(memeTokenImpl);
        curve = Clones.clone(bondingCurveImpl);

        // Mint full supply to the curve, disable mint (Req 1.5).
        MemeToken(token).initialize(p.name, p.symbol, p.totalSupply, curve, msg.sender, p.metadataId);

        // Initialize curve.
        BondingCurve(payable(curve)).initialize(
            token,
            msg.sender,
            address(treasury),
            address(reputation),
            address(locker),
            router,
            p.totalSupply,
            p.basePrice,
            p.slope,
            p.graduationCap,
            p.tradingFeeBps,
            p.earlyWindowEnd,
            p.walletCap,
            lockDuration
        );

        // Grant the new curve the roles it needs (Req 6.2, 3.2).
        reputation.grantRole(reputation.CURVE_ROLE(), curve);
        locker.grantRole(locker.LOCKER_ROLE(), curve);

        // Record launch (Req 1.2, 6.1).
        reputation.recordLaunch(msg.sender, token);

        records[token] = TokenRecord({
            token: token,
            curve: curve,
            creator: msg.sender,
            createdAt: uint64(block.timestamp),
            metadataId: p.metadataId,
            identityVerified: verified
        });
        allTokens.push(token);

        // Refund any overpaid fee.
        uint256 refund = msg.value - fee;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }

        emit TokenCreated(token, curve, msg.sender, p.metadataId, verified);
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function _validate(CreateParams calldata p) internal pure {
        bytes memory nameBytes = bytes(p.name);
        bytes memory symBytes = bytes(p.symbol);
        if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_LEN) revert InvalidName();
        if (symBytes.length == 0 || symBytes.length > MAX_SYMBOL_LEN) revert InvalidSymbol();
        if (p.totalSupply < MIN_SUPPLY || p.totalSupply % 1e18 != 0) revert InvalidSupply();
        if (p.tradingFeeBps > 300) revert FeeTooHighParam();
    }
}
