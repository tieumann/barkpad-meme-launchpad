# Barkpad — Builder's Programme Submission Checklist

## Core deliverables

- [x] Smart contracts written (12 contracts)
- [x] Automated tests passing (72/72)
- [x] Deployed to OPN testnet (Chain 984) with our own wallet
- [x] All features verified live on-chain (`scripts/check-all.ts` → 6/6 PASS)
- [x] Web app (Next.js) with all feature pages
- [x] Flagship token DogOn ($DOGON) live + funded
- [x] Pitch document (`PITCH.md`)
- [x] Demo script (`DEMO.md`)
- [x] On-chain indexer + real leaderboard
- [x] All 13 contracts source-verified on the OPN testnet explorer

## Before you hit "submit"

- [ ] Record the 2–3 min demo video (follow `DEMO.md`)
- [ ] Claim your Builder's Pass at https://builders.iopn.tech/
- [ ] Push code to a public repo (contracts + web + indexer)
- [ ] Paste live contract addresses into the application form
- [ ] Include the pitch + a link to the demo video

## Repo layout

```
contracts/   Hardhat project: Solidity contracts, tests, deploy + verify scripts
web/         Next.js frontend (wagmi + RainbowKit, meme-cute UI)
indexer/     Node + viem event indexer with a leaderboard API
.kiro/specs/ requirements.md, design.md, tasks.md (full spec)
PITCH.md     Builder's Programme pitch
DEMO.md      Demo walkthrough script
```

## Live addresses (OPN Testnet, Chain 984)

See `contracts/deployments/opnTestnet.json`. Key ones:
- TokenFactory: `0x4773a2C6ba5BDEf290cC8C2a32581bd758B92d8E`
- DogOn: `0xe30711D1D9fbdF478E746A13281E209b15a46A3C`
- Presale: `0xd37778ED6EF9D3cF8D03F5711636Baa240175CA9`
- QuestRewards: `0x5408e25Dc84879F31A011d989cB172483a1BaC5b`

## Honest status notes (be ready to discuss)

- IOPn Identity uses a signature-based attestation adapter; the official on-chain
  attestation interface gets wired in once available.
- AI meme generation is in the pitch/roadmap (uses subsidized GPU) — not yet built.
- **Not yet audited / not on mainnet** — planned with programme support.
- All 13 contracts are **source-verified** on the OPN testnet Blockscout explorer
  (https://testnet.iopn.tech) — see `VERIFIED_CONTRACTS.md`.
