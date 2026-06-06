// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CurveMath} from "./libraries/CurveMath.sol";
import {ILiquidityRouter} from "./interfaces/ILiquidityRouter.sol";
import {Treasury} from "./Treasury.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {LiquidityLocker} from "./LiquidityLocker.sol";

/**
 * @title BondingCurve
 * @notice Holds a meme token's full supply and prices buy/sell on a linear curve
 *         denominated in native OPN. On reaching the graduation cap it migrates
 *         the reserve into a DEX pool and locks the LP tokens.
 *
 * Spec: Requirements 2.x, 3.x, 4.2, 4.3; Correctness Properties 1, 2, 3, 6, 7, 10, 11.
 *
 * Deployed as an EIP-1167 clone by the TokenFactory; uses `initialize`.
 */
contract BondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CurveMath for uint256;

    uint256 private constant ONE = 1e18;

    enum Status {
        Trading,
        Graduating,
        Graduated
    }

    // --- Immutable-ish config (set once in initialize) ---
    IERC20 public token;
    address public creator;
    Treasury public treasury;
    ReputationRegistry public reputation;
    LiquidityLocker public locker;
    ILiquidityRouter public router;

    uint256 public basePrice; // OPN wei per whole token at n=0
    uint256 public slope; // OPN wei added per whole token sold
    uint256 public graduationCap; // reserve (OPN wei) that triggers graduation
    uint16 public tradingFeeBps; // fee on buy/sell, <= 300
    uint64 public earlyWindowEnd; // timestamp until which walletCap applies
    uint256 public walletCap; // max whole tokens per wallet during early window
    uint64 public lockDuration; // LP lock duration at graduation

    // --- State ---
    Status public status;
    uint256 public supplySold; // whole tokens sold
    uint256 public reserve; // OPN wei held to back sells
    uint256 public totalWholeSupply; // total whole tokens (supply / 1e18)
    mapping(address => uint256) public purchasedEarly; // whole tokens bought in early window

    address public pool;
    address public lpToken;
    uint256 public lockId;

    bool private _initialized;

    event Trade(address indexed trader, bool isBuy, uint256 opnAmount, uint256 tokenAmount, uint256 fee);
    event Graduated(address indexed token, address pool, uint256 lpAmount, uint64 unlockTime);
    event GraduationFailed(string reason);

    error AlreadyInitialized();
    error NotTrading();
    error ZeroAmount();
    error SlippageExceeded();
    error WalletCapExceeded();
    error InsufficientReserve();
    error NotGraduating();
    error SoldOut();

    function initialize(
        address token_,
        address creator_,
        address treasury_,
        address reputation_,
        address locker_,
        address router_,
        uint256 totalSupplyWei,
        uint256 basePrice_,
        uint256 slope_,
        uint256 graduationCap_,
        uint16 tradingFeeBps_,
        uint64 earlyWindowEnd_,
        uint256 walletCap_,
        uint64 lockDuration_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        token = IERC20(token_);
        creator = creator_;
        treasury = Treasury(payable(treasury_));
        reputation = ReputationRegistry(reputation_);
        locker = LiquidityLocker(locker_);
        router = ILiquidityRouter(router_);

        basePrice = basePrice_;
        slope = slope_;
        graduationCap = graduationCap_;
        tradingFeeBps = tradingFeeBps_;
        earlyWindowEnd = earlyWindowEnd_;
        walletCap = walletCap_;
        lockDuration = lockDuration_;

        totalWholeSupply = totalSupplyWei / ONE;
        status = Status.Trading;
    }

    // --- Views ---

    /// @notice Quote whole-token output for a gross OPN input (fee deducted first).
    function quoteBuy(uint256 opnIn) public view returns (uint256 tokensOut, uint256 fee, uint256 spent) {
        fee = (opnIn * tradingFeeBps) / 10_000;
        uint256 net = opnIn - fee;
        (uint256 n1, uint256 cost) = CurveMath.tokensForOPN(basePrice, slope, supplySold, net);
        uint256 available = totalWholeSupply - supplySold;
        uint256 wholeOut = n1 - supplySold;
        if (wholeOut > available) {
            wholeOut = available;
            cost = CurveMath.costBetween(basePrice, slope, supplySold, supplySold + wholeOut);
        }
        tokensOut = wholeOut * ONE;
        spent = cost;
    }

    /// @notice Quote OPN output for selling `tokenAmount` (must be whole-token multiples).
    function quoteSell(uint256 tokenAmount) public view returns (uint256 opnOut, uint256 fee) {
        uint256 wholeIn = tokenAmount / ONE;
        if (wholeIn == 0) return (0, 0);
        uint256 n0 = supplySold - wholeIn;
        uint256 gross = CurveMath.costBetween(basePrice, slope, n0, supplySold);
        fee = (gross * tradingFeeBps) / 10_000;
        opnOut = gross - fee;
    }

    // --- Trading ---

    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (status != Status.Trading) revert NotTrading();
        if (msg.value == 0) revert ZeroAmount();

        (uint256 out, uint256 fee, uint256 spent) = quoteBuy(msg.value);
        if (out == 0) revert SoldOut();
        if (out < minTokensOut) revert SlippageExceeded();

        uint256 wholeOut = out / ONE;

        // Per-wallet cap during the early window (Req 2.4, 4.3 / Property 10).
        if (block.timestamp <= earlyWindowEnd) {
            uint256 newTotal = purchasedEarly[msg.sender] + wholeOut;
            if (newTotal > walletCap) revert WalletCapExceeded();
            purchasedEarly[msg.sender] = newTotal;
        }

        // Effects.
        supplySold += wholeOut;
        reserve += spent;

        // Refund any unspent OPN (curve rounding) and route the fee.
        uint256 refund = msg.value - spent - fee;

        // Interactions.
        if (fee > 0) treasury.collect{value: fee}(keccak256("trade"));
        token.safeTransfer(msg.sender, out);
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }

        emit Trade(msg.sender, true, spent, out, fee);
        tokensOut = out;

        // Graduation trigger (Req 2.6): flip to Graduating (cheap). The heavy
        // pool-creation work is done by a separate `graduate()` call so that the
        // buyer's auto-estimated gas can't starve the inner DEX deployment
        // (EVM 63/64 rule). Anyone can finalize once flipped.
        if (reserve >= graduationCap) {
            status = Status.Graduating;
        }
    }

    /// @notice Finalize graduation once the curve has flipped to Graduating.
    /// Permissionless: anyone may call to complete the migration.
    function graduate() external nonReentrant {
        if (status != Status.Graduating) revert NotGraduating();
        _graduate();
    }

    function sell(uint256 tokenAmount, uint256 minOpnOut) external nonReentrant returns (uint256 opnOut) {
        if (status != Status.Trading && status != Status.Graduating) revert NotTrading();
        uint256 wholeIn = tokenAmount / ONE;
        if (wholeIn == 0) revert ZeroAmount();

        (uint256 out, uint256 fee) = quoteSell(wholeIn * ONE);
        if (out < minOpnOut) revert SlippageExceeded();
        if (out + fee > reserve) revert InsufficientReserve();

        // Effects.
        supplySold -= wholeIn;
        reserve -= (out + fee);

        // Interactions: pull tokens back, route fee, pay seller.
        token.safeTransferFrom(msg.sender, address(this), wholeIn * ONE);
        if (fee > 0) treasury.collect{value: fee}(keccak256("trade"));
        (bool ok, ) = payable(msg.sender).call{value: out}("");
        require(ok, "payout failed");

        emit Trade(msg.sender, false, out, wholeIn * ONE, fee);
        opnOut = out;
    }

    // --- Graduation ---

    function _graduate() internal {
        status = Status.Graduating;
        uint256 liquidityOPN = reserve;
        uint256 tokenInventory = token.balanceOf(address(this));

        token.forceApprove(address(router), tokenInventory);

        try
            router.addLiquidityOPN{value: liquidityOPN}(address(token), tokenInventory, address(this))
        returns (address pool_, address lpToken_, uint256 lpAmount) {
            reserve = 0;
            pool = pool_;
            lpToken = lpToken_;
            status = Status.Graduated;

            uint64 unlockTime = uint64(block.timestamp) + lockDuration;
            IERC20(lpToken_).forceApprove(address(locker), lpAmount);
            lockId = locker.lock(lpToken_, lpAmount, unlockTime, creator);

            reputation.recordGraduation(creator, address(token));
            emit Graduated(address(token), pool_, lpAmount, unlockTime);
        } catch Error(string memory reason) {
            // Stay in Graduating; sells remain enabled so no funds are stranded (Req 3.5 / Property 6).
            token.forceApprove(address(router), 0);
            emit GraduationFailed(reason);
        } catch {
            token.forceApprove(address(router), 0);
            emit GraduationFailed("unknown");
        }
    }

    /// @notice Retry graduation if a previous attempt failed (Req 3.5).
    function retryGraduation() external nonReentrant {
        if (status != Status.Graduating) revert NotGraduating();
        _graduate();
    }

    /// @notice Allow the curve to receive OPN (e.g., refunds from the router).
    receive() external payable {}
}
