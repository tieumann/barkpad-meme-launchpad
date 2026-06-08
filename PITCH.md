# Barkpad — Builder's Programme Pitch

**Tagline:** The cutest, safest meme launchpad on OPN Chain — meme infrastructure, not just a coin.

**One-liner:** Barkpad lets anyone create, fair-launch, and grow a meme token in seconds on OPN Chain, with built-in anti-rug protection, on-chain creator reputation, IOPn Digital Identity gating, swap, staking, airdrops, presale, and a quest-based growth engine.

---

## 1. The Problem

Meme coins drive enormous on-chain activity, but the space is plagued by:
- **Rug pulls & honeypots** — creators mint infinite supply, pull liquidity, or block selling.
- **Unfair launches** — snipers and whales dump on retail.
- **Zero accountability** — no track record follows a serial scammer.
- **Fragmented tooling** — launch, liquidity, staking, airdrops, and community growth are scattered across many risky tools.

This keeps real users and capital away, and it wastes the throughput a fast L1 like OPN Chain is built for.

## 2. The Solution

Barkpad is **reusable infrastructure** that turns "launch a meme" into a safe, one-click, end-to-end flow:

| Pillar | What it does | Why it matters |
|---|---|---|
| **Fair Launch** | Linear bonding curve, per-wallet caps in the early window | No snipers, deterministic pricing |
| **Anti-Rug** | Mint permanently disabled, reserves held in-contract, LP auto-locked on graduation | Structural safety, not promises |
| **Graduation** | At a target cap, liquidity migrates to a DEX pool and LP is time-locked | Smooth path from curve to free market |
| **Swap** | Post-graduation constant-product AMM | Continuous trading |
| **Creator Reputation** | On-chain, event-derived score (launches, graduations, flags) | Serial scammers get exposed |
| **IOPn Identity** | Optional identity-gated launches via attestation adapter | Bots/scammers deterred; ecosystem-native |
| **Staking** | Reward-per-token pools per token | Holder retention |
| **Airdrop** | Merkle distribution | Community bootstrapping |
| **Presale** | Fixed-price sale with soft/hard caps and refunds | Fair fundraising |
| **Quests** | Points for follow/Discord/X-post/referral → token airdrop | Viral, measurable growth |

## 3. Why OPN Chain

- **EVM-compatible (Chain 984):** ships today with standard Solidity + tooling.
- **Sub-second finality, ~7 Gwei:** trading and curve interactions feel instant and stay cheap — exactly what a high-frequency meme launchpad needs.
- **Ecosystem fit:** Barkpad consumes IOPn's flagship primitives — **Digital Identity** (creator verification) and the **Agentic AI** narrative (AI meme generation on subsidized GPU) — so it strengthens the OPN ecosystem rather than just sitting on it.
- **Scales what gets built:** every token launched, traded, staked, and airdropped through Barkpad is new on-chain volume for OPN Chain.

## 4. What's Already Shipped (not a demo)

Everything below is **deployed and live-verified on OPN testnet with our own wallet**:

- **12 smart contracts**, 72/72 automated tests passing (unit + integration + invariant).
- **All contracts source-verified** on the OPN testnet Blockscout explorer (https://testnet.iopn.tech).
- **End-to-end verified on-chain:** create → buy → sell → graduate (LP locked) → swap → stake → airdrop → quest claim → presale buy. All passing.
- **Web app** (Next.js + wagmi + RainbowKit): launch wizard, explore, token trade page, presale, staking, quests — cute meme UX.
- **Flagship token:** DogOn ($DOGON), fixed-supply burnable, funding presale + staking + quest rewards.

### Live addresses (OPN Testnet, Chain 984)

| Contract | Address |
|---|---|
| TokenFactory | `0x4773a2C6ba5BDEf290cC8C2a32581bd758B92d8E` |
| Treasury | `0x041BaC779D3385Da285B75F4423534cf760581ee` |
| ReputationRegistry | `0x243D594f487F7BEF1CcD556c9Ee3236606d8789b` |
| LiquidityLocker | `0x3a11e9B4361D7D7781418C3aB3c470C861936B8f` |
| IdentityGate | `0xA9b137Be7DAce8666AED652946419efbE932B90F` |
| SimpleAMM | `0x979a1fEBF5B85Ec8D22AF015cE03568307CCfEdD` |
| StakingFactory | `0xd04115002cD232d2273Cc5d55c06880D3A6affB8` |
| AirdropFactory | `0xbEF3B28a65E3A38e3B759ffEA8Ca2DA62e30443E` |
| DogOn (DOGON) | `0xe30711D1D9fbdF478E746A13281E209b15a46A3C` |
| Presale | `0xd37778ED6EF9D3cF8D03F5711636Baa240175CA9` |
| QuestRewards | `0x5408e25Dc84879F31A011d989cB172483a1BaC5b` |

## 5. Security & Safety Properties

Enforced in code and covered by invariant tests:

1. **Supply conservation** — total supply never inflates; mint is disabled after launch.
2. **Reserve solvency** — the curve always holds enough OPN to honor sells.
3. **No reserves in EOAs** — creators never custody trade funds.
4. **Fee bounds** — trading fee hard-capped at 3%; creation fee bounded.
5. **Lock integrity** — graduation LP can't be withdrawn before unlock.
6. **No fund loss on graduation failure** — sells stay enabled; graduation is retryable.
7. **Reputation is event-derived** — cannot be faked.
8. **Per-wallet cap** — anti-whale during the early window.
9. **Staking can't be drained** — payouts capped at the funded pool.
10. **Airdrop claim-once** — Merkle proof + bitmap.

## 6. Business Model

- **Protocol fees:** small token-creation fee + 1% trading fee routed to a role-gated Treasury.
- **Revenue scales with usage:** more launches and trades = more fees, aligning protocol success with ecosystem activity.
- **Premium growth tooling:** quest campaigns, featured listings, and identity-verified badges as future paid tiers.

## 7. Traction Plan (with IOPn support)

- **GTM:** launch quest campaigns to seed the first wave of meme communities; partner with OPN ecosystem projects for co-marketing.
- **Compute:** use subsidized GPU for the AI meme generator (logo + art + copy) to lower the barrier for non-technical creators.
- **Institutional:** position Barkpad's identity-gated, reputation-scored launches as the "compliant-friendly" meme venue for the RAK Innovation City ecosystem.

## 8. Roadmap

- **Now:** contracts live + verified on testnet, full web app, flagship token.
- **Next (with the programme):** indexer + analytics, AI meme studio backend, identity verifier service wired to the official IOPn attestation interface, mainnet deployment + security audit.
- **Later:** DAO governance for the treasury, cross-chain via IBC when OPN enables it, mobile app.

## 9. The Ask

Barkpad is exactly what the Builder's Programme is looking for: a high-conviction team shipping real infrastructure that scales OPN Chain activity. With monetary support, GPU compute, GTM, and institutional access, we move Barkpad from a verified testnet system to live mainnet infrastructure powering the OPN meme economy.

**🐾 Built on OPN Chain. Much safe. Very launch.**
