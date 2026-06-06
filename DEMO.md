# Barkpad — Demo Script (2–3 min)

A tight, judge-ready walkthrough proving Barkpad is live infrastructure on OPN Chain, not a mockup.

## Pre-flight (do before recording)

- [ ] MetaMask installed, OPN Testnet added (Chain ID **984**, RPC `https://testnet-rpc.iopn.tech`).
- [ ] Wallet funded from the faucet: https://faucet.iopn.tech/
- [ ] Run the web app: `cd web && npm run dev` → http://localhost:3000
- [ ] Have `deployments/opnTestnet.json` open to show live addresses if asked.

## Script

**[0:00] Hook (15s)**
> "This is Barkpad — a meme launchpad on OPN Chain. Everything you'll see is live on testnet, deployed and verified with our own wallet. Not a mockup."

Show the landing page. Point at the feature grid: fair launch, anti-rug, swap, staking, airdrops, quests.

**[0:15] Connect (15s)**
- Click **Connect Wallet** → MetaMask → confirm.
- The NetworkGuard confirms "Connected to OPN Testnet". Mention the faucet chip.

**[0:30] Launch a token (40s)**
- Go to **Launch**. Type a name (e.g. "Moon Pupper"), symbol "MPUP", pick a mascot emoji, a tagline.
- Show the **live preview** updating, and the safety chips (mint disabled, bonding curve, LP lock).
- Click **Launch (fee 0.01 OPN)** → confirm in MetaMask.
- Show the tx-status toast turning into "Done!".
> "One transaction clones an ERC-20 plus a bonding curve, mints the full supply to the curve, and disables minting forever."

**[1:10] Trade + graduate (40s)**
- Go to **Explore** → open the token you just made.
- Show the **graduation progress bar**. Buy a bit of OPN worth.
- (If pushing to graduation) buy until it flips to Graduating, then click **Finalize graduation**.
> "When it hits the cap, liquidity migrates to a DEX pool and the LP tokens are time-locked. That's structural anti-rug."
- Scroll to the **Creator Reputation** card — show launches/graduations on-chain.

**[1:50] Ecosystem features (40s)**
- **Presale**: show the DOGON presale progress bar, contribute 0.5 OPN.
- **Quests**: show points (follow/Discord/X/referral) and the airdrop claim.
- **Stake**: show creating a pool and staking.
> "Presale, staking, airdrops, and a quest-based growth engine — all on-chain, all live."

**[2:30] Close (20s)**
> "12 contracts, 72 passing tests, six features verified end-to-end on OPN testnet. Barkpad scales OPN Chain activity: every launch, trade, stake, and airdrop is new on-chain volume. With the Builder's Programme, we take this to mainnet."

## Backup: prove it from the CLI (if asked)

```bash
cd contracts
npx hardhat run scripts/check-all.ts --network opnTestnet
```
This exercises every deployed contract with the real wallet and prints PASS for all six features with tx hashes.

## Talking points / likely questions

- **"Is it really deployed?"** → Yes; show `deployments/opnTestnet.json` + run `check-all.ts`.
- **"How is it anti-rug?"** → Mint disabled post-launch, reserves in-contract, LP time-locked, fees hard-capped, invariant-tested.
- **"Why OPN Chain?"** → Sub-second finality + ~7 Gwei = instant, cheap trading; consumes IOPn Identity + AI narrative; every action adds OPN volume.
- **"What needs the programme?"** → Mainnet + audit, AI meme studio on subsidized GPU, identity verifier wired to the official IOPn attestation interface, indexer/analytics at scale.
