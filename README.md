# Barkpad 🐶 — Meme Launchpad on OPN Chain

The cutest, safest meme launchpad on OPN Chain. Meme **infrastructure**, not just a coin:
fair bonding-curve launches, anti-rug locks, swap, staking, airdrops, presale, on-chain
creator reputation, IOPn Identity gating, and a quest-based growth engine.

Built for the **IOPn Builder's Programme**.

## Monorepo layout

```
contracts/    Hardhat: 12 Solidity contracts, 72 tests, deploy + verify scripts
web/          Next.js frontend (wagmi + RainbowKit), meme-cute UI
indexer/      Node + viem event indexer with a leaderboard API (SQLite)
.kiro/specs/  Full spec: requirements.md, design.md, tasks.md
PITCH.md      Builder's Programme pitch
DEMO.md       2–3 min demo walkthrough
SUBMISSION_CHECKLIST.md  What to do before submitting
```

## Quick start

```bash
# 1. Contracts (test + deploy)
cd contracts && npm install && npm test
#    deploy with your own wallet (see contracts/README.md for .env)
npm run deploy:testnet

# 2. Indexer (leaderboard API on :4000)
cd ../indexer && npm install && npm run start

# 3. Web app (on :3000)
cd ../web && npm install && npm run dev
```

## Status

- ✅ 12 contracts, **72/72 tests passing**
- ✅ Deployed + **live-verified on OPN testnet** (`contracts/scripts/check-all.ts` → 6/6 PASS)
- ✅ Web app with 7 feature pages (launch, explore, trade, presale, stake, quests)
- ✅ Event indexer + real leaderboard
- ✅ Flagship token DogOn ($DOGON) live + funded

See `PITCH.md` for the full pitch and `contracts/deployments/opnTestnet.json` for live addresses.

## Network

| Field | Value |
|---|---|
| Network | OPN Testnet |
| Chain ID | 984 (0x3d8) |
| RPC | https://testnet-rpc.iopn.tech |
| Faucet | https://faucet.iopn.tech/ |

🐾 Built on OPN Chain. Much safe. Very launch.
