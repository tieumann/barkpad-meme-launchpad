# Implementation Plan

## Overview

This plan builds Barkpad incrementally: contracts first (test-driven), then deployment to OPN testnet, then frontend, then off-chain services (indexer, AI). Each task references the requirements it implements. Tasks are ordered so every step builds on previously completed work.

## Tasks

- [x] 1. Scaffold the contracts workspace
  - Initialize a Hardhat + TypeScript project under `contracts/`
  - Add OpenZeppelin contracts, hardhat-toolbox, solidity-coverage, gas-reporter
  - Configure `hardhat.config.ts` with Solidity 0.8.x and an `opnTestnet` network (Chain ID 984, RPC `https://testnet-rpc.iopn.tech`)
  - Add `.env.example` for `PRIVATE_KEY` and RPC URL
  - _Requirements: 10.1_

- [x] 2. Implement MemeToken (ERC-20 with mint disabled)
  - [x] 2.1 Write `MemeToken.sol` with `initialize(name, symbol, totalSupply, curve)` minting full supply to the curve and permanently disabling mint
    - Store immutable `creator` and `metadataId`; expose `mintingDisabled()`
    - _Requirements: 1.1, 1.5, 4.1_
  - [x] 2.2 Write unit tests: full supply goes to curve, no mint path exists, no transfer pause, double-init reverts
    - _Requirements: 1.5, 4.1_

- [x] 3. Implement Treasury
  - [x] 3.1 Write `Treasury.sol` with `collect(kind)` payable, role-gated `withdraw`, bounded `setTradingFeeBps`/`setCreationFee`
    - Use OpenZeppelin AccessControl (`TREASURER_ROLE`, `FEE_ADMIN_ROLE`); enforce `tradingFeeBps <= 300`
    - Emit `FeeCollected` and `Withdrawn`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 3.2 Write unit tests: fee bounds enforced, only roles can withdraw/set, events emitted
    - _Requirements: 9.2, 9.4 (Property 3, Property 4)_

- [x] 4. Implement ReputationRegistry
  - [x] 4.1 Write `ReputationRegistry.sol` with `recordLaunch` (factory-only), `recordGraduation` (curve-only), `flag` (MODERATOR_ROLE), `reputationOf`
    - Score derived only from recorded events; weights as constants
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 4.2 Write unit tests: score increments on graduation, decrements on flag, access control on writers
    - _Requirements: 6.2, 6.3 (Property 9)_

- [x] 5. Implement LiquidityLocker
  - [x] 5.1 Write `LiquidityLocker.sol` with `lock`, `withdraw` (reverts before unlock), `getLock`
    - Emit `Locked` / `Withdrawn`; restrict `lock` to registered callers
    - _Requirements: 3.2, 3.3, 4.4_
  - [x] 5.2 Write unit tests: early withdraw reverts, post-unlock withdraw succeeds once, double-withdraw reverts
    - _Requirements: 3.3, 4.4 (Property 5)_

- [x] 6. Implement IdentityGate adapter
  - [x] 6.1 Write `IdentityGate.sol` with signature-based attestation verification, `isVerified`, `checkLaunch`, and `policy` (BLOCK/ALLOW unverified)
    - Recover signer from `(creator, expiry)` signature; compare to trusted verifier key
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  - [x] 6.2 Write unit tests: valid attestation passes, invalid/expired reverts under BLOCK policy, ALLOW policy degrades gracefully
    - _Requirements: 5.3, 5.5 (Property 8)_

- [x] 7. Implement BondingCurve
  - [x] 7.1 Write the curve math library (linear curve cost integral, buy/sell quoting) with 1e18 fixed-point and safe `mulDiv`
    - Pure functions `quoteBuy`/`quoteSell`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 7.2 Write `BondingCurve.sol`: `buy`/`sell` with slippage `minOut`, trading fee to Treasury, per-wallet cap in early window, reserve custody, reentrancy guards
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 4.2, 4.3_
  - [x] 7.3 Implement `_graduate`, `retryGraduation`, and `graduating` recovery state (sell still allowed on failure)
    - Inject DEX router address; call `addLiquidity`; send LP to LiquidityLocker; bump reputation; emit `Graduated`
    - _Requirements: 2.6, 3.1, 3.4, 3.5, 6.2_
  - [x] 7.4 Write unit + invariant tests: reserve solvency, supply conservation, cap enforcement, slippage, fee routing, graduation success and failure recovery
    - _Requirements: 2.2-2.6, 3.1, 3.5, 4.2, 4.3 (Properties 1, 2, 3, 6, 7, 10, 11)_

- [x] 8. Implement SimpleAMM fallback (graduation target)
  - [x] 8.1 Write a minimal constant-product `SimpleAMM.sol` pool + `addLiquidity` returning LP tokens, used when no external DEX is available on testnet
    - _Requirements: 3.1, 3.5_
  - [x] 8.2 Write unit tests for add-liquidity and LP minting
    - _Requirements: 3.1_

- [x] 9. Implement TokenFactory (orchestrator)
  - [x] 9.1 Write `TokenFactory.sol` using EIP-1167 minimal clones for MemeToken and BondingCurve
    - Validate inputs (name/symbol length, supply bounds); identity check; collect creation fee; deploy + initialize; record launch; store `TokenRecord`; emit `TokenCreated`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 5.1, 5.2, 6.1, 9.1_
  - [x] 9.2 Write integration tests: end-to-end create → buy → sell → graduate; invalid params revert; identity gating on/off
    - _Requirements: 1.1-1.6, 2.x, 3.x, 5.x (Properties 1-11)_

- [ ] 10. Deploy + verify on OPN testnet
  - [x] 10.1 Write deployment scripts (deploy Treasury, ReputationRegistry, LiquidityLocker, IdentityGate, SimpleAMM, implementation contracts, TokenFactory, StakingFactory, AirdropFactory; wire roles/addresses)
    - Output a `deployments/opnTestnet.json` with all addresses
    - Includes `scripts/check-wallet.ts` to confirm the user's wallet + balance before deploying with their own key
    - _Requirements: 10.1_
  - [ ] 10.2 Run a smoke script against testnet: create a token, buy, sell, force graduation; confirm events
    - _Requirements: 2.x, 3.x_

- [x] 21. Implement Swap (post-graduation DEX)
  - SimpleAMMPair exposes `swapOPNForToken` / `swapTokenForOPN` with constant-product pricing, 0.3% fee, and slippage `minOut`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 22. Implement Meme Staking
  - [x] 22.1 Write `MemeStaking.sol` (Synthetix-style reward-per-token accumulator): stake/unstake/claim/exit, `notifyRewardAmount` capped to funded balance
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [x] 22.2 Write `StakingFactory.sol` to deploy per-token pools owned by the creator
    - _Requirements: 12.1_
  - [x] 22.3 Write unit tests: proportional accrual, fair split, no draining, unstake settlement
    - _Requirements: 12.4, 12.5, 12.6_

- [x] 23. Implement Airdrop
  - [x] 23.1 Write `MemeAirdrop.sol` (Merkle claim, claim-once via BitMap, post-expiry sweep)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  - [x] 23.2 Write `AirdropFactory.sol` to deploy per-campaign airdrops
    - _Requirements: 13.1_
  - [x] 23.3 Write unit tests: valid claim once, invalid/tampered proof rejected, expiry + sweep
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

- [x] 24. Implement Project Token + Presale (DogOn)
  - [x] 24.1 Write `DogOn.sol` (DOGON) fixed-supply burnable ERC-20, supply minted to treasury
    - _Requirements: 14_
  - [x] 24.2 Write `Presale.sol` (fixed-rate sale, soft/hard cap, per-wallet cap, finalize/cancel, claim/refund, withdraw proceeds, sweep unsold)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  - [x] 24.3 Write unit tests: buy, caps, finalize+claim, refund, proceeds withdrawal
    - _Requirements: 14.1-14.6_

- [x] 25. Implement Quest Points Airdrop campaign
  - [x] 25.1 Write `QuestRewards.sol` (operator-awarded points per configured action, anti double-count, funded conversion, claim-once)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  - [x] 25.2 Write unit tests: award weights, double-count guard, access control, batch, conversion + claim, underfunded guard
    - _Requirements: 15.1-15.5_

- [x] 26. Deploy DogOn suite + live verification on OPN testnet
  - [x] 26.1 `scripts/deploy.ts` deploys/wires the full launchpad stack; `scripts/deploy-dogon.ts` deploys DogOn + Presale + QuestRewards and funds them
    - _Requirements: 10.1, 14, 15_
  - [x] 26.2 `scripts/verify-live.ts` exercises every deployed contract with the real wallet (create/buy/sell/graduate, swap, quest award/convert/claim, presale buy) — all passing on-chain
    - Fixed graduation gas issue by splitting `graduate()` out of `buy()` (EVM 63/64 gas rule)
    - _Requirements: 2.x, 3.x, 11, 12, 13, 14, 15_

> Note on contract verification (Etherscan-style source verification): OPN testnet's public block explorer + Hardhat verify plugin are listed as "coming soon" in IOPn docs. Source verification will be wired via `hardhat-verify` once the explorer API is live. Functional verification is done via `verify-live.ts`.

- [x] 11. Scaffold frontend
  - [x] 11.1 Initialize Next.js + TypeScript under `web/`; add wagmi, viem, RainbowKit; configure OPN Chain (id 984, RPC, currency OPN)
    - Implement wallet connect and wrong-network prompt (add/switch to OPN Chain) via `NetworkGuard`
    - _Requirements: 10.1, 10.2_
  - [x] 11.2 Minimal ABIs + shared addresses config (`src/lib/abis.ts`, `src/lib/addresses.ts`)
    - _Requirements: 10.1_

- [x] 12. Build token creation wizard (frontend)
  - Form with live preview, mascot picker; calls `createToken` with creation fee; shows tx status
  - _Requirements: 1.1, 1.3, 1.4, 1.6, 10.3, 10.4_

- [x] 13. Build token detail + trade UI (frontend)
  - Curve progress, safety chips, buy/sell, finalize graduation, post-grad pool display
  - _Requirements: 2.2, 2.3, 4.5, 5.4, 8.2, 10.3, 10.4_

- [x] 14. Build discovery + leaderboard (frontend)
  - `/explore` grid reading tokens from the factory with graduation progress bars
  - _Requirements: 8.1_

- [x] 27. Build Presale + Quests pages (frontend)
  - `/presale`: contribute/claim DOGON with progress; `/quests`: points + airdrop claim
  - _Requirements: 14, 15_

- [x] 28. Build Staking page (frontend)
  - `/stake`: create pool via StakingFactory, approve/stake/unstake/claim, live pool stats
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 29. Creator reputation UI
  - `CreatorBadge` component showing on-chain launches/graduations/flags + trust tier; shown on token detail
  - _Requirements: 6.4, 4.5_

- [x] 30. Builder's Programme pitch document
  - `PITCH.md`: problem, solution, OPN fit, shipped status + live addresses, security properties, business model, roadmap, ask
  - _Requirements: all_

- [x] 15. Implement the indexer
  - [x] 15.1 Node + viem service polling `TokenCreated`, `Trade`, `Graduated`; persist to SQLite with a block cursor
    - _Requirements: 8.1, 8.2, 9.3_
  - [x] 15.2 Expose `/leaderboard`, `/token/:addr`, `/stats` endpoints; wired into the web app (StatsBar + top-by-volume strip)
    - _Requirements: 6.4, 8.1, 8.2_

- [ ] 16. Implement Metadata API + IPFS pinning
  - `POST /metadata` and `GET /metadata/:id`; pin logos to IPFS and store CID on-chain reference
  - _Requirements: 1.6_

- [ ] 17. Implement AI Meme Service
  - [ ] 17.1 FastAPI service `POST /generate` (prompt → candidate logos + descriptions) backed by an image model, with queue + rate limiter
    - _Requirements: 7.1, 7.3_
  - [ ] 17.2 Integrate into the creation wizard: accept generated assets (pin to IPFS) or fall back to manual upload on failure
    - _Requirements: 7.2, 7.4_

- [ ] 18. Implement Identity Verifier Proxy
  - Service that requests a signed attestation from the IOPn identity flow and returns `{signature, expiry}` for on-chain submission; never custodies keys
  - Wire optional identity gating into the creation wizard
  - _Requirements: 5.1, 5.5_

- [ ] 19. Optional: per-token Staking
  - [ ] 19.1 Write `Staking.sol` with stake/unstake and reward accrual; unit tests
    - _Requirements: 8.3, 8.4_
  - [ ] 19.2 Add staking UI to token detail
    - _Requirements: 8.3, 8.4_

- [ ] 20. End-to-end verification + demo prep
  - Run full flow on testnet (create with AI assets + identity → trade → graduate → locked LP → reputation updated → leaderboard reflects activity)
  - Document network config, addresses, and a demo script for the Builder's Programme submission
  - _Requirements: all_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "dependsOn": [] },
    { "wave": 2, "tasks": ["2", "3", "4", "5", "6", "8"], "dependsOn": ["1"] },
    { "wave": 3, "tasks": ["7"], "dependsOn": ["2", "3", "5"] },
    { "wave": 4, "tasks": ["9"], "dependsOn": ["2", "3", "4", "6", "7"] },
    { "wave": 5, "tasks": ["10"], "dependsOn": ["8", "9"] },
    { "wave": 6, "tasks": ["11", "15", "16", "17", "18", "19"], "dependsOn": ["10"] },
    { "wave": 7, "tasks": ["12", "13", "14"], "dependsOn": ["11", "15", "16", "17", "18"] },
    { "wave": 8, "tasks": ["20"], "dependsOn": ["12", "13", "14", "19"] }
  ]
}
```

Visual overview:

```
1 (scaffold)
├── 2 MemeToken
├── 3 Treasury
├── 4 ReputationRegistry
├── 5 LiquidityLocker
├── 6 IdentityGate
├── 7 BondingCurve ───── depends on 2, 3, 5
├── 8 SimpleAMM
└── 9 TokenFactory ───── depends on 2, 3, 4, 6, 7
        └── 10 Deploy/verify on testnet ── depends on 8, 9
                ├── 11 Frontend scaffold
                │     ├── 12 Creation wizard ── also depends on 16, 17, 18
                │     ├── 13 Token detail + trade
                │     └── 14 Discovery/leaderboard ── depends on 15
                ├── 15 Indexer
                ├── 16 Metadata API + IPFS
                ├── 17 AI Meme Service
                ├── 18 Identity Verifier Proxy
                └── 19 Staking (optional)
                        └── 20 E2E verification + demo prep ── depends on all
```

Key paths:
- Core contract chain: 1 → 2/3/5 → 7 → 9 → 10
- Frontend usable after: 10 → 11 → 12/13
- Full demo after: 10 + 15/16/17/18 → 20

## Notes

- Contracts are built test-driven; every contract task includes unit tests, and BondingCurve/TokenFactory add invariant/integration tests mapped to the design's Correctness Properties.
- Tasks 16, 17, 18, 19 are independent services and can be parallelized once the contracts are deployed (task 10).
- Task 8 (SimpleAMM) is a fallback for graduation; if an official OPN Chain DEX router becomes available, task 7.3 wires that address instead and task 8 can be skipped.
- Identity gating (task 6/18) ships with a signature-based default; swap in the official IOPn attestation interface when confirmed.
- Only the spec documents have been written so far. Implementation (the repo) starts at task 1 once you approve this plan.
