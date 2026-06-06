# Design Document

## Overview

Barkpad is a dog-themed meme launchpad built as reusable infrastructure on OPN Chain. It lets anyone create, fairly launch (via bonding curve), and grow meme tokens with built-in anti-rug protection, on-chain creator reputation, optional IOPn Digital Identity gating, and AI-assisted meme generation. Successful tokens "graduate" by migrating their accumulated reserve into a locked DEX liquidity pool.

This document describes the system architecture, smart contract design, off-chain services, data models, key flows, and how each component maps back to the requirements.

### Target Network (OPN Chain)

| Parameter | Value |
|---|---|
| Network name | OPN Testnet |
| Chain ID | 984 (0x3d8) |
| Native currency | OPN (18 decimals) |
| RPC URL | https://testnet-rpc.iopn.tech |
| Faucet | https://faucet.iopn.tech/ |
| Min gas price | 7 Gwei |
| Block time | ~1 second, instant finality (Tendermint BFT) |
| Solidity | up to 0.8.30, Pectra / EIP-7702 supported |
| EVM compatibility | Full (standard opcodes, Ethereum JSON-RPC) |

Because OPN Chain is fully EVM-compatible, Barkpad uses standard Ethereum tooling (Hardhat/Foundry, OpenZeppelin, ethers.js/wagmi) with no contract modifications.

## Architecture

### High-Level System Diagram

```
┌────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  Wallet connect (wagmi/RainbowKit) · Token create wizard ·   │
│  Trade UI · Leaderboard · Token detail · AI meme studio      │
└───────────────┬───────────────────────────┬─────────────────┘
                │ JSON-RPC (ethers/wagmi)    │ REST/GraphQL
                ▼                            ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│   OPN Chain (EVM L1)       │   │   Off-chain Services          │
│                            │   │                               │
│  TokenFactory              │   │  Indexer (events → DB)        │
│  BondingCurve (per token)  │   │  Metadata API (logo/desc)     │
│  MemeToken (ERC-20)        │   │  AI Meme Service (GPU)        │
│  LiquidityLocker           │   │  Identity Verifier proxy      │
│  ReputationRegistry        │   │  Leaderboard/stats cache      │
│  Treasury                  │   │                               │
│  IdentityGate (adapter)    │   └───────────────┬───────────────┘
│  Staking (optional)        │                   │
└───────────┬────────────────┘                   │
            │ events                              │
            └─────────────────────────────────────┘
                         indexed by
```

### Architectural Principles

- **On-chain is the source of truth.** All funds, reputation, locks, and fees live in contracts. Off-chain services only index/serve data and provide convenience (AI, metadata, leaderboards).
- **No reserves in EOAs.** Bonding curve reserves are held by the curve contract; creators never custody trade funds (Req 4.2).
- **Events-first.** Every state change emits an event so the indexer and external auditors can reconstruct full history (NFR Transparency).
- **Pluggable identity.** Identity gating is an adapter so the platform works whether or not the IOPn identity service is available (Req 5.5).
- **Factory pattern with minimal proxies.** Tokens and curves are deployed as EIP-1167 minimal clones to keep gas low and launches fast.

## Smart Contract Design

### Contract Inventory

| Contract | Responsibility | Key Requirements |
|---|---|---|
| `TokenFactory` | Deploy MemeToken + BondingCurve clones, charge creation fee, register token | 1, 9 |
| `MemeToken` | ERC-20 with mint permanently disabled after init | 1.5, 4.1 |
| `BondingCurve` | Buy/sell pricing, reserve custody, per-wallet cap, graduation trigger | 2, 4.2, 4.3 |
| `LiquidityLocker` | Lock LP tokens for a duration, prevent early withdrawal | 3.2, 3.3, 4.4 |
| `ReputationRegistry` | Track creator launches, graduations, flags, score | 6 |
| `Treasury` | Collect/hold fees, role-gated withdrawals | 9 |
| `IdentityGate` | Adapter verifying IOPn Digital Identity attestations | 5 |
| `Staking` (optional) | Per-token staking + reward accrual | 8.3, 8.4, 12 |
| `MemeStaking` + `StakingFactory` | Reward-per-token staking pools per token | 12 |
| `MemeAirdrop` + `AirdropFactory` | Merkle-based airdrop distribution | 13 |
| `SimpleAMM` / `SimpleAMMPair` | Graduation DEX + post-graduation swap | 3, 11 |

### Contract Relationships

```
TokenFactory ──deploys──> MemeToken (clone)
     │         ──deploys──> BondingCurve (clone)
     │         ──checks───> IdentityGate
     │         ──writes───> ReputationRegistry
     │         ──fee──────> Treasury
BondingCurve ──fee────────> Treasury
BondingCurve ──on graduate─> DEX Router ──LP──> LiquidityLocker
BondingCurve ──on graduate─> ReputationRegistry (score++)
```

### MemeToken

Standard ERC-20 (OpenZeppelin base) initialized once by the factory.

- `initialize(name, symbol, totalSupply, curve)` — mints the full fixed supply to the bonding curve, then sets an internal `mintingDisabled = true`. No `mint()` is ever callable afterward (Req 1.5, 4.1).
- No owner privileges over balances. No pause that can freeze user transfers (avoid honeypot patterns).
- Stores immutable `creator` and a pointer to metadata id.

Rationale: fixed supply minted entirely to the curve guarantees the curve fully backs circulating supply and the creator cannot inflate or rug via minting.

### BondingCurve

Holds all OPN reserve and the unsold token supply. Implements a deterministic pricing function.

**Pricing model (linear curve for MVP):**

For a linear curve, price at supply sold `s` is `p(s) = basePrice + slope * s`. The cost to buy from `s0` to `s1` is the integral:

```
cost = basePrice * (s1 - s0) + slope/2 * (s1^2 - s0^2)
```

- `buy(minTokensOut)` — computes tokens for sent OPN using the inverse of the cost integral, enforces per-wallet cap during the early window, collects trading fee to Treasury, transfers tokens to buyer, updates `supplySold` (Req 2.2, 2.4, 2.5).
- `sell(tokenAmount, minOpnOut)` — computes OPN refund from the cost integral, collects fee, burns/returns tokens to curve inventory, sends OPN to seller (Req 2.3, 2.5).
- `graduationCap` — when reserve or implied market cap crosses threshold, `buy` flips the curve to `graduated` state and triggers `_graduate()` (Req 2.6).
- Reentrancy guard on all external state-changing functions; checks-effects-interactions ordering (NFR Security).

**Decimals/fixed-point note:** all curve math uses 1e18 fixed-point; computations are bounded and use `mulDiv`-style safe math to avoid overflow. Slippage protection via `minTokensOut`/`minOpnOut`.

### Graduation Flow (`_graduate`)

1. Stop curve trading (`graduated = true`).
2. Take accumulated OPN reserve + remaining token inventory.
3. Call the OPN Chain DEX router `addLiquidity` to create the pool (Req 3.1).
4. Send received LP tokens to `LiquidityLocker` with `unlockTime = now + lockDuration` (Req 3.2).
5. Notify `ReputationRegistry` to increment creator score (Req 6.2).
6. Emit `Graduated(token, pool, lpAmount, unlockTime)` (Req 3.4).

**Two-step graduation (gas safety).** When a `buy` pushes the reserve past
`graduationCap`, the curve only flips to a cheap `Graduating` state inside
`buy`; it does NOT create the pool in the same transaction. A separate
permissionless `graduate()` call then runs `_graduate()` with full gas. This
avoids the EVM 63/64 gas rule starving the gas-heavy inner DEX pool deployment
when a buyer's gas is auto-estimated (observed on OPN testnet). `sell` stays
enabled during `Graduating`, so funds are never stranded (Req 3.5).

Failure handling: if `addLiquidity` reverts, the curve stays in a `graduating` state where traders can still `sell` against the reserve, ensuring no funds are lost (Req 3.5). A guarded `retryGraduation()` allows re-attempt.

> Note: DEX availability on OPN testnet is a dependency. The `BondingCurve` references the router via an injected address. If no DEX is live yet, graduation can target a `SimpleAMM` fallback pool contract we deploy (documented as a risk in the spec).

### LiquidityLocker

- `lock(token, lpToken, amount, unlockTime, beneficiary)` — records a lock; only callable by registered curves/factory.
- `withdraw(lockId)` — reverts if `block.timestamp < unlockTime` (Req 3.3, 4.4); transfers LP to beneficiary after unlock.
- View functions expose lock status for the safety indicators (Req 4.5).

### ReputationRegistry

On-chain, event-derived reputation. Score is computed from verifiable events only (Req 6.5).

State per creator: `launches`, `graduations`, `flags`, `score`.

- `recordLaunch(creator, token)` — factory-only (Req 6.1).
- `recordGraduation(creator, token)` — curve-only, `score += W_GRAD` (Req 6.2).
- `flag(creator, token, reason)` — role-gated (e.g., governance/moderator), `score -= W_FLAG` (Req 6.3).
- Score formula (MVP): `score = graduations * W_GRAD - flags * W_FLAG`, clamped at a floor. Weights are constants set at deploy.

### Treasury

- Receives creation fees and trading fees (Req 9.1).
- `withdraw(to, amount)` restricted to `TREASURER_ROLE` via OpenZeppelin AccessControl (Req 9.2).
- `setFee(...)` restricted to `FEE_ADMIN_ROLE` within hard-coded bounds (e.g., trading fee ≤ 3%) so fees cannot be set abusively (Req 9.4).
- Emits `FeeCollected` / `Withdrawn` events (Req 9.3).

### IdentityGate (Adapter)

Abstracts IOPn Digital Identity verification so the rest of the system is identity-agnostic.

- `isVerified(address) view returns (bool)` — checks an attestation. Implementation options:
  - On-chain registry lookup if IOPn exposes an on-chain attestation contract.
  - Signature-based attestation: an authorized IOPn verifier signs `(creator, expiry)`; `IdentityGate` recovers the signer and checks against a trusted key.
- `policy` enum: `BLOCK_UNVERIFIED` or `ALLOW_UNVERIFIED` for graceful degradation when the service is unavailable (Req 5.5).
- `TokenFactory` calls `IdentityGate.checkLaunch(creator)`; if gating enabled and unverified → revert (Req 5.1, 5.3). Verified launches are tagged `identityVerified = true` on the token record (Req 5.2).

> The exact IOPn attestation interface is an integration unknown. The adapter isolates this risk; we ship a signature-based default and swap in the official interface when available.

### TokenFactory (Orchestrator)

`createToken(params)` performs, in one transaction:

1. Validate inputs (name/symbol length, supply bounds) → revert on invalid (Req 1.4).
2. `IdentityGate.checkLaunch(msg.sender)` if gating enabled (Req 5.1).
3. Collect creation fee → `Treasury` (Req 1.3).
4. Clone `MemeToken`, `initialize` with full supply minted to a freshly cloned `BondingCurve` (Req 1.1, 1.5).
5. Initialize `BondingCurve` with curve params, fee config, graduation cap.
6. `ReputationRegistry.recordLaunch(creator, token)` (Req 1.2, 6.1).
7. Store token record (creator, token, curve, timestamp, metadataId, identityVerified) (Req 1.2, 1.6).
8. Emit `TokenCreated(...)`.

## Components and Interfaces

This section defines the public interfaces of the core contracts and services. Solidity signatures are illustrative for the MVP and may be refined during implementation.

### TokenFactory

```solidity
interface ITokenFactory {
    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        bytes32 metadataId,
        bool identityVerified
    );

    struct CreateParams {
        string  name;
        string  symbol;
        uint256 totalSupply;
        bytes32 metadataId;     // IPFS CID reference
        uint256 basePrice;
        uint256 slope;
        uint256 graduationCap;
        uint16  tradingFeeBps;
        uint256 walletCap;
        uint64  earlyWindowEnd;
    }

    function createToken(CreateParams calldata p) external payable returns (address token, address curve);
    function creationFee() external view returns (uint256);
    function getTokenRecord(address token) external view returns (TokenRecord memory);
}
```

### MemeToken

```solidity
interface IMemeToken /* is IERC20 */ {
    function initialize(string calldata name, string calldata symbol, uint256 totalSupply, address curve) external;
    function creator() external view returns (address);
    function mintingDisabled() external view returns (bool); // always true after init
}
```

### BondingCurve

```solidity
interface IBondingCurve {
    event Trade(address indexed trader, bool isBuy, uint256 opnAmount, uint256 tokenAmount, uint256 price, uint256 fee);
    event Graduated(address indexed token, address pool, uint256 lpAmount, uint64 unlockTime);

    function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut);
    function sell(uint256 tokenAmount, uint256 minOpnOut) external returns (uint256 opnOut);
    function quoteBuy(uint256 opnIn) external view returns (uint256 tokensOut);
    function quoteSell(uint256 tokenAmount) external view returns (uint256 opnOut);
    function state() external view returns (CurveState memory);
    function retryGraduation() external; // recovery path if graduation failed
}
```

### LiquidityLocker

```solidity
interface ILiquidityLocker {
    event Locked(uint256 indexed lockId, address lpToken, address beneficiary, uint256 amount, uint64 unlockTime);
    event Withdrawn(uint256 indexed lockId, uint256 amount);

    function lock(address lpToken, uint256 amount, uint64 unlockTime, address beneficiary) external returns (uint256 lockId);
    function withdraw(uint256 lockId) external; // reverts if block.timestamp < unlockTime
    function getLock(uint256 lockId) external view returns (Lock memory);
}
```

### ReputationRegistry

```solidity
interface IReputationRegistry {
    event LaunchRecorded(address indexed creator, address indexed token);
    event GraduationRecorded(address indexed creator, address indexed token);
    event Flagged(address indexed creator, address indexed token, string reason);

    function recordLaunch(address creator, address token) external;       // factory-only
    function recordGraduation(address creator, address token) external;   // curve-only
    function flag(address creator, address token, string calldata reason) external; // MODERATOR_ROLE
    function reputationOf(address creator) external view returns (Reputation memory);
}
```

### Treasury

```solidity
interface ITreasury {
    event FeeCollected(address indexed from, uint256 amount, bytes32 kind);
    event Withdrawn(address indexed to, uint256 amount);

    function collect(bytes32 kind) external payable;          // receives fees
    function withdraw(address to, uint256 amount) external;   // TREASURER_ROLE
    function setTradingFeeBps(uint16 bps) external;           // FEE_ADMIN_ROLE, bounded <= 300
    function setCreationFee(uint256 fee) external;            // FEE_ADMIN_ROLE
}
```

### IdentityGate

```solidity
interface IIdentityGate {
    enum Policy { BLOCK_UNVERIFIED, ALLOW_UNVERIFIED }

    function isVerified(address account) external view returns (bool);
    function checkLaunch(address creator) external view returns (bool verified); // reverts if gating on and unverified
    function policy() external view returns (Policy);
}
```

### Off-Chain Service Interfaces

```
AI Meme Service
  POST /generate            { prompt } -> { logos: [cid], descriptions: [string] } | { fallback: true }

Metadata API
  POST /metadata            { logoCid, description, socials } -> { metadataId }
  GET  /metadata/:id        -> { logoCid, description, socials }

Identity Verifier Proxy
  POST /attest              { creator } -> { signature, expiry }  (signature-based model)

Indexer / Stats API
  GET  /leaderboard?sort=volume|marketcap|recent -> [ tokenStats ]
  GET  /token/:addr         -> { record, stats, trades, holders, safety }
  GET  /creator/:addr       -> { reputation, launches }
```

## Correctness Properties

These are invariants the implementation and tests must uphold (verified via invariant/property tests where noted).

### Property 1: Reserve solvency
At any time before graduation, the OPN reserve held by a `BondingCurve` is sufficient to honor selling back all circulating (sold) supply at the current curve. No sequence of buys/sells can leave the curve unable to pay a valid sell.
**Validates: Requirements 2.2, 2.3, 4.2**

### Property 2: Supply conservation
`circulatingSupply + curveInventory == totalSupply` at all times; total supply never increases after init.
**Validates: Requirements 1.5, 4.1**

### Property 3: Fee accounting
The cumulative fees emitted via `FeeCollected` equal the net OPN increase of the Treasury attributable to fees. No fee is silently lost or double-counted.
**Validates: Requirements 9.1, 9.3**

### Property 4: Fee bounds
`tradingFeeBps <= 300` (3%) and `creationFee` within configured max at all times, regardless of admin actions.
**Validates: Requirements 9.4**

### Property 5: Lock integrity
A locked LP position cannot be withdrawn while `block.timestamp < unlockTime`; after unlock it can be withdrawn exactly once.
**Validates: Requirements 3.3, 4.4**

### Property 6: Graduation atomicity / no fund loss
Graduation either completes (pool created, LP locked, reputation bumped) or leaves the curve in a state where traders can still recover funds via `sell`. User funds are never stranded.
**Validates: Requirements 3.5**

### Property 7: No reserve in EOAs
All trade reserves are held by the curve contract; the creator address never receives reserve funds.
**Validates: Requirements 4.2**

### Property 8: Identity gating soundness
When gating policy is `BLOCK_UNVERIFIED`, no token can be created by an unverified creator; tokens tagged `identityVerified == true` were created by a verified creator.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 9: Reputation is event-derived
A creator's `score` is a pure function of their on-chain launch/graduation/flag events; it cannot be set directly.
**Validates: Requirements 6.5**

### Property 10: Per-wallet cap
During the early window (`block.timestamp <= earlyWindowEnd`), no wallet's cumulative purchase exceeds `walletCap`.
**Validates: Requirements 2.4, 4.3**

### Property 11: Slippage safety
A `buy`/`sell` never returns less than the caller-specified `minOut`.
**Validates: Requirements 2.2, 2.3**

## Off-Chain Services

### Indexer
Subscribes to contract events (`TokenCreated`, buy/sell `Trade`, `Graduated`, `FeeCollected`, reputation events) and writes them to a relational DB. Powers leaderboards, charts, holder counts, and safety indicators with low on-chain read load (NFR Performance, Req 8.1, 8.2).

### Metadata API
Stores and serves token metadata (logo URI, description, socials). On-chain we store only a metadata id / IPFS hash to keep gas low; the API resolves it (Req 1.6). Recommended: pin logos to IPFS, store the CID on-chain.

### AI Meme Service
Stateless service exposing `POST /generate` (prompt → candidate logos + descriptions). Backed by an image model running on subsidized GPU compute. Includes a queue + rate limiter (Req 7.3) and returns a fallback signal so the wizard lets the user upload manually if generation fails (Req 7.4). Accepted assets are pinned to IPFS and the CID attached to metadata (Req 7.2).

### Identity Verifier Proxy
Bridges the frontend to IOPn's identity service and, in the signature-based model, requests a signed attestation that the frontend submits on-chain. Never custodies user keys.

## Data Models

### On-Chain (Solidity structs)

```solidity
struct TokenRecord {
    address token;
    address curve;
    address creator;
    uint64  createdAt;
    bytes32 metadataId;     // IPFS CID reference
    bool    identityVerified;
}

struct CurveState {
    uint256 supplySold;     // tokens sold (1e18)
    uint256 reserve;        // OPN held (1e18)
    uint256 basePrice;
    uint256 slope;
    uint256 graduationCap;
    uint16  tradingFeeBps;
    uint64  earlyWindowEnd;
    uint256 walletCap;      // per-wallet cap during early window
    bool    graduated;
}

struct Lock {
    address lpToken;
    address beneficiary;
    uint256 amount;
    uint64  unlockTime;
    bool    withdrawn;
}

struct Reputation {
    uint32 launches;
    uint32 graduations;
    uint32 flags;
    int64  score;
}
```

### Off-Chain (Indexer DB, simplified)

```
tokens(token_addr PK, curve_addr, creator, symbol, name, metadata_cid,
       identity_verified, created_at, graduated, pool_addr)
trades(id PK, token_addr FK, trader, side, opn_amount, token_amount,
       price, fee, block, ts)
holders(token_addr, holder, balance)   -- materialized from transfers
creators(addr PK, launches, graduations, flags, score)
stats(token_addr PK, volume_24h, market_cap, holder_count, last_price)
```

## Key User Flows

### Flow A: Create + Launch a Token
1. Creator connects wallet (wagmi), frontend ensures Chain ID 984 (Req 10.1, 10.2).
2. (Optional) Creator uses AI Meme Studio → picks logo/description → pinned to IPFS.
3. (If gating on) Creator obtains identity attestation via verifier proxy.
4. Frontend calls `TokenFactory.createToken(...)` with creation fee.
5. On confirmation, indexer picks up `TokenCreated`; token appears on leaderboard.

### Flow B: Trade on the Curve
1. Trader opens token detail (chart, curve progress, safety indicators) (Req 8.2, 4.5).
2. `buy`/`sell` with slippage protection; gas estimate + status shown (Req 10.3).
3. On confirm/fail, toast with block explorer link (Req 10.4).

### Flow C: Graduation
1. A buy pushes reserve past `graduationCap`.
2. `_graduate` creates DEX pool, locks LP, bumps creator reputation.
3. UI switches token from "curve" mode to "DEX" mode and shows locked-liquidity badge.

## Error Handling

| Scenario | Handling |
|---|---|
| Invalid token params | Revert with custom error; frontend shows validation message (Req 1.4) |
| Slippage exceeded | Revert via `minOut`; frontend suggests retry with new quote |
| Per-wallet cap hit | Revert with `CapExceeded`; UI explains early-window limit (Req 2.4) |
| Identity unverified + gating on | Revert `NotVerified`; UI links to verification (Req 5.3) |
| Graduation DEX failure | Curve enters `graduating`; sells still allowed; `retryGraduation()` (Req 3.5) |
| Early LP withdrawal attempt | Revert `Locked`; UI shows unlock countdown (Req 4.4) |
| Wrong network | Frontend prompts add/switch to OPN Chain (Req 10.2) |
| AI service down/rate-limited | Queue or fallback to manual upload (Req 7.3, 7.4) |
| Indexer lag | UI shows "pending indexing"; on-chain remains source of truth |

## Security Considerations

- **Reentrancy:** `nonReentrant` on all buy/sell/graduate/withdraw; strict checks-effects-interactions.
- **Access control:** OpenZeppelin `AccessControl` roles (`FEE_ADMIN`, `TREASURER`, `MODERATOR`); factory/curve-only modifiers for registry writes.
- **No mint after launch / no transfer pause:** prevents inflation and honeypots (Req 4.1).
- **Reserve custody in contract:** never in EOAs (Req 4.2).
- **Fee bounds:** hard caps in code so admin cannot set predatory fees (Req 9.4).
- **Integer safety:** Solidity 0.8.x checked math + `mulDiv` for curve integrals.
- **Locked LP:** time-locked, withdrawal-guarded (Req 3.3, 4.4).
- **External calls:** DEX router and identity verifier are injected, validated addresses; treat all external return data defensively.
- **Audit-readiness:** minimal, well-scoped contracts using audited libraries; full unit + invariant tests.

## Testing Strategy

- **Unit tests** (Hardhat/Foundry) for each contract: factory creation, curve buy/sell math, cap enforcement, fee routing, graduation, lock, reputation, identity gating.
- **Invariant/property tests:** curve reserve always backs circulating supply; sum of fees routed equals Treasury balance delta; locked LP never withdrawable before unlock.
- **Fork/integration tests** against OPN testnet RPC for end-to-end create→trade→graduate.
- **Frontend tests:** wallet connect, network switch, trade quote rendering.
- **Gas reporting** to confirm launches stay cheap (leveraging minimal proxies).

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Contracts | Solidity 0.8.x + OpenZeppelin | OPN supports up to 0.8.30; audited primitives |
| Contract tooling | Hardhat (or Foundry) | Standard EVM dev/test/deploy |
| Frontend | Next.js + TypeScript | SSR + good DX |
| Wallet/Web3 | wagmi + viem + RainbowKit | Standard OPN-compatible JSON-RPC |
| Indexer | Node.js + viem event subscriptions + Postgres | Reliable event indexing |
| AI service | Python (FastAPI) + image model on GPU | Uses subsidized GPU compute |
| Storage | IPFS (logos/metadata) | Decentralized, cheap on-chain pointer |

## Requirements Traceability

| Requirement | Components |
|---|---|
| 1 Token Factory | TokenFactory, MemeToken, Metadata API |
| 2 Bonding Curve | BondingCurve |
| 3 Graduation | BondingCurve, LiquidityLocker, DEX Router |
| 4 Anti-Rug | MemeToken, BondingCurve, LiquidityLocker |
| 5 Identity | IdentityGate, Verifier Proxy, TokenFactory |
| 6 Reputation | ReputationRegistry |
| 7 AI Meme | AI Meme Service, Metadata API |
| 8 Discovery/Community | Indexer, Frontend, Staking |
| 9 Treasury | Treasury, fee logic in Factory/Curve |
| 10 Wallet/Network | Frontend (wagmi/RainbowKit) |

## Open Questions / Risks

1. **DEX availability on OPN testnet** — if no router is live, we ship a `SimpleAMM` fallback for graduation. Needs confirmation.
2. **IOPn Digital Identity interface** — exact attestation API unknown; adapter isolates this, signature-based default used until confirmed.
3. **Faucet limits** — testnet OPN supply for demo trading; may need to request additional test funds for live demo.
4. **Indexer hosting** — for the demo, a single indexer instance; production would need redundancy.
