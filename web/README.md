# Barkpad Web 🐶

Cute meme-themed frontend for the Barkpad launchpad on OPN Chain.

Built with **Next.js 14 (App Router) + wagmi + viem + RainbowKit + Tailwind**.

## Pages

| Route | What it does |
|---|---|
| `/` | Hero landing with feature overview |
| `/launch` | Token creation wizard with a live preview (calls `TokenFactory.createToken`) |
| `/explore` | Grid of launched tokens with graduation progress |
| `/token/[address]` | Token detail: buy/sell on the curve, finalize graduation, post-grad pool |
| `/presale` | DogOn ($DOGON) presale: contribute OPN, claim |
| `/stake` | Create staking pools, stake/unstake/claim rewards |
| `/quests` | Quest points + airdrop claim dashboard |

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Connect MetaMask, switch to **OPN Testnet (Chain ID 984)**, and grab test OPN
from the faucet (https://faucet.iopn.tech/). The on-screen NetworkGuard will
prompt you to switch networks if needed.

## Config

- Contract addresses live in `src/lib/addresses.ts` (mirrors
  `../contracts/deployments/opnTestnet.json`).
- Chain config is in `src/lib/chain.ts`.
- Optional `NEXT_PUBLIC_WC_PROJECT_ID` enables WalletConnect QR for mobile wallets;
  injected wallets (MetaMask) work without it.

## Theme

Pastel "meme cute" palette (honey/coral/bubble/grape), chunky rounded cards,
bouncy buttons, wiggly doge emojis. Defined in `tailwind.config.ts` and
`src/app/globals.css`.
