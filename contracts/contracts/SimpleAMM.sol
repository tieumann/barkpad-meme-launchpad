// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ILiquidityRouter} from "./interfaces/ILiquidityRouter.sol";

/**
 * @title SimpleAMMPair
 * @notice Minimal constant-product (x*y=k) pool for a single token / native OPN
 *         pair. LP shares are represented by this contract's own ERC-20.
 *
 *         This is a graduation-target fallback used when no official OPN Chain
 *         DEX router is available on testnet. It supports the operations needed
 *         for the Barkpad demo: provide liquidity, mint LP, and swap.
 */
contract SimpleAMMPair is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public reserveToken; // token reserve
    uint256 public reserveOPN; // native OPN reserve

    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    event LiquidityAdded(address indexed provider, uint256 opnAmount, uint256 tokenAmount, uint256 lp);
    event Swap(address indexed trader, bool opnIn, uint256 amountIn, uint256 amountOut);

    error InsufficientLiquidity();
    error InsufficientInput();
    error InsufficientOutput();

    constructor(address token_) ERC20("Barkpad LP", "BARK-LP") {
        token = IERC20(token_);
    }

    /// @notice Add liquidity. Caller must approve `tokenAmount` to this pair first.
    function addLiquidity(
        uint256 tokenAmount,
        address lpRecipient
    ) external payable nonReentrant returns (uint256 lp) {
        if (msg.value == 0 || tokenAmount == 0) revert InsufficientInput();

        token.safeTransferFrom(msg.sender, address(this), tokenAmount);

        uint256 supply = totalSupply();
        if (supply == 0) {
            lp = _sqrt(msg.value * tokenAmount);
            if (lp <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            lp -= MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // lock minimum liquidity
        } else {
            uint256 lpFromOpn = (msg.value * supply) / reserveOPN;
            uint256 lpFromToken = (tokenAmount * supply) / reserveToken;
            lp = lpFromOpn < lpFromToken ? lpFromOpn : lpFromToken;
        }
        if (lp == 0) revert InsufficientLiquidity();

        reserveOPN += msg.value;
        reserveToken += tokenAmount;
        _mint(lpRecipient, lp);

        emit LiquidityAdded(lpRecipient, msg.value, tokenAmount, lp);
    }

    /// @notice Swap native OPN for tokens (0.3% fee).
    function swapOPNForToken(uint256 minOut) external payable nonReentrant returns (uint256 out) {
        if (msg.value == 0) revert InsufficientInput();
        out = _getAmountOut(msg.value, reserveOPN, reserveToken);
        if (out < minOut || out == 0) revert InsufficientOutput();
        reserveOPN += msg.value;
        reserveToken -= out;
        token.safeTransfer(msg.sender, out);
        emit Swap(msg.sender, true, msg.value, out);
    }

    /// @notice Swap tokens for native OPN (0.3% fee). Caller must approve first.
    function swapTokenForOPN(uint256 amountIn, uint256 minOut) external nonReentrant returns (uint256 out) {
        if (amountIn == 0) revert InsufficientInput();
        out = _getAmountOut(amountIn, reserveToken, reserveOPN);
        if (out < minOut || out == 0) revert InsufficientOutput();
        token.safeTransferFrom(msg.sender, address(this), amountIn);
        reserveToken += amountIn;
        reserveOPN -= out;
        (bool ok, ) = payable(msg.sender).call{value: out}("");
        require(ok, "OPN transfer failed");
        emit Swap(msg.sender, false, amountIn, out);
    }

    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256) {
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInWithFee = amountIn * 997;
        return (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
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

/**
 * @title SimpleAMM
 * @notice Router/factory implementing ILiquidityRouter by deploying one
 *         SimpleAMMPair per token and forwarding liquidity to it.
 */
contract SimpleAMM is ILiquidityRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    mapping(address => address) public pairOf; // token => pair

    event PairCreated(address indexed token, address pair);

    function addLiquidityOPN(
        address token,
        uint256 tokenAmount,
        address lpRecipient
    ) external payable override nonReentrant returns (address pool, address lpToken, uint256 lpAmount) {
        address pair = pairOf[token];
        if (pair == address(0)) {
            pair = address(new SimpleAMMPair(token));
            pairOf[token] = pair;
            emit PairCreated(token, pair);
        }

        // Pull tokens from the caller (curve) and approve the pair.
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(token).forceApprove(pair, tokenAmount);

        lpAmount = SimpleAMMPair(pair).addLiquidity{value: msg.value}(tokenAmount, lpRecipient);
        return (pair, pair, lpAmount);
    }
}
