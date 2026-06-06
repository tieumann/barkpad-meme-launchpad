# Barkpad Indexer 🦴

Lightweight event indexer + leaderboard API for Barkpad on OPN Chain.

- **Stack:** Node + viem (event polling) + better-sqlite3 + Express.
- Reads deployed addresses from `../contracts/deployments/opnTestnet.json`.
- Indexes `TokenCreated`, `Trade`, and `Graduated` events; refreshes curve stats.

## Run

```bash
npm install
npm run dev      # starts indexing + API on http://localhost:4000
```

## API

| Endpoint | Description |
|---|---|
| `GET /leaderboard?sort=volume\|progress\|recent` | Tokens with volume, trade count, graduation progress |
| `GET /token/:addr` | A token's record + recent trades |
| `GET /stats` | Totals: tokens, trades, graduations |
| `GET /health` | Liveness |

The indexer backfills the last ~50k blocks on first run, then polls every few seconds.
SQLite keeps a cursor so restarts resume where they left off.
