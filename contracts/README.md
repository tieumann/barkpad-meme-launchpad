# Barkpad Contracts (OPN Chain)

Smart contracts for **Barkpad**, a dog-themed meme launchpad on OPN Chain.
Built with Hardhat + OpenZeppelin, fully EVM-compatible (Chain ID 984).

## Contracts

| Contract | Purpose |
|---|---|
| `MemeToken` | Fixed-supply ERC-20; mint permanently disabled after launch (anti-rug) |
| `BondingCurve` | Linear bonding-curve buy/sell, per-wallet cap, graduation to DEX |
| `TokenFactory` | One-tx launch: clone token + curve, fee, identity check, record |
| `Treasury` | Collects creation + trading fees; role-gated, bounded fees |
| `ReputationRegistry` | On-chain, event-derived creator reputation |
| `LiquidityLocker` | Time-locks graduation LP tokens |
| `IdentityGate` | IOPn Digital Identity attestation adapter (signature-based) |
| `SimpleAMM` / `SimpleAMMPair` | Graduation DEX + post-graduation **swap** |
| `MemeStaking` + `StakingFactory` | **Staking** with reward-per-token accrual |
| `MemeAirdrop` + `AirdropFactory` | Merkle **airdrop** distribution |
| `DogOn` | Flagship project token (DOGON), fixed supply, burnable |
| `Presale` | Fixed-price presale with soft/hard caps, refunds, vesting unlock |
| `QuestRewards` | Points-to-airdrop promo campaign (follow/Discord/X post...) |

## Deployed on OPN Testnet (Chain ID 984)

Deployed and live-verified with wallet `0x6440...95C8`. See `deployments/opnTestnet.json`.

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

Run live verification of all deployed contracts:

```bash
npx hardhat run scripts/verify-live.ts --network opnTestnet
```

### Source verification (Blockscout)

All 13 contracts are **source-verified** on the OPN testnet explorer at
https://testnet.iopn.tech (see `../VERIFIED_CONTRACTS.md` for direct links).

```bash
npx hardhat verify --network opnTestnet <address> [args...]
```

## Setup

```bash
npm install
npm run compile
npm test
```

## Deploying with YOUR wallet (OPN testnet)

The deploy uses the private key from a local `.env` file. **Never share this key
and never commit `.env`** (it is already git-ignored).

1. Get test OPN from the faucet: https://faucet.iopn.tech/
2. Create `contracts/.env` (copy from `.env.example`):

   ```
   PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
   OPN_RPC_URL=https://testnet-rpc.iopn.tech
   ```

3. Sanity-check your wallet is connected and funded:

   ```bash
   npx hardhat run scripts/check-wallet.ts --network opnTestnet
   ```

4. Deploy the full stack:

   ```bash
   npm run deploy:testnet
   ```

   Addresses are written to `deployments/opnTestnet.json`.

### Network details

| Field | Value |
|---|---|
| Network | OPN Testnet |
| Chain ID | 984 (0x3d8) |
| RPC | https://testnet-rpc.iopn.tech |
| Currency | OPN (18 decimals) |
| Faucet | https://faucet.iopn.tech/ |

## Security notes

- Reserves are held by contracts, never EOAs.
- Trading/creation fees are hard-capped in `Treasury` (trading <= 3%).
- Graduation LP is time-locked; early withdrawal reverts.
- Staking rewards can never exceed the funded pool.
- Airdrops use Merkle proofs with claim-once enforcement.
