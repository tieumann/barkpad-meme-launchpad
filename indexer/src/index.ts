import express from "express";
import cors from "cors";
import { createPublicClient, http, parseAbiItem, formatEther } from "viem";
import { opnTestnet, ADDRESSES, PORT, POLL_INTERVAL_MS } from "./config.js";
import { tokenFactoryAbi, bondingCurveAbi, erc20Abi } from "./abis.js";
import {
  db,
  getCursor,
  setCursor,
  upsertToken,
  setTokenMeta,
  setTokenStats,
  insertTrade,
} from "./db.js";

const client = createPublicClient({ chain: opnTestnet, transport: http() });

const tokenCreatedEvent = parseAbiItem(
  "event TokenCreated(address indexed token, address indexed curve, address indexed creator, bytes32 metadataId, bool identityVerified)"
);
const tradeEvent = parseAbiItem(
  "event Trade(address indexed trader, bool isBuy, uint256 opnAmount, uint256 tokenAmount, uint256 fee)"
);
const graduatedEvent = parseAbiItem(
  "event Graduated(address indexed token, address pool, uint256 lpAmount, uint64 unlockTime)"
);

const CHUNK = 5000n;

async function fetchTokenMeta(token: `0x${string}`) {
  try {
    const [name, symbol] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    ]);
    setTokenMeta.run(name as string, symbol as string, token);
  } catch {
    /* token may not expose metadata yet */
  }
}

async function refreshCurveStats(curve: `0x${string}`) {
  try {
    const [status, reserve, cap] = await Promise.all([
      client.readContract({ address: curve, abi: bondingCurveAbi, functionName: "status" }),
      client.readContract({ address: curve, abi: bondingCurveAbi, functionName: "reserve" }),
      client.readContract({ address: curve, abi: bondingCurveAbi, functionName: "graduationCap" }),
    ]);
    setTokenStats.run(Number(status), (reserve as bigint).toString(), (cap as bigint).toString(), null, curve);
  } catch {
    /* ignore transient rpc errors */
  }
}

async function indexRange(from: bigint, to: bigint) {
  // TokenCreated from the factory.
  const created = await client.getLogs({
    address: ADDRESSES.TokenFactory as `0x${string}`,
    event: tokenCreatedEvent,
    fromBlock: from,
    toBlock: to,
  });
  for (const log of created) {
    const { token, curve, creator, identityVerified } = log.args as any;
    upsertToken.run({
      token,
      curve,
      creator,
      identity_verified: identityVerified ? 1 : 0,
      created_at: Number(log.blockNumber),
    });
    await fetchTokenMeta(token);
    await refreshCurveStats(curve);
  }

  // Trade events across all curves (filter by event signature, any address).
  const trades = await client.getLogs({ event: tradeEvent, fromBlock: from, toBlock: to });
  for (const log of trades) {
    const a = log.args as any;
    insertTrade.run({
      tx: log.transactionHash,
      log_index: log.logIndex,
      curve: log.address,
      trader: a.trader,
      is_buy: a.isBuy ? 1 : 0,
      opn_amount: (a.opnAmount as bigint).toString(),
      token_amount: (a.tokenAmount as bigint).toString(),
      fee: (a.fee as bigint).toString(),
      block: Number(log.blockNumber),
    });
    await refreshCurveStats(log.address as `0x${string}`);
  }

  // Graduations -> record pool address.
  const grads = await client.getLogs({ event: graduatedEvent, fromBlock: from, toBlock: to });
  for (const log of grads) {
    const a = log.args as any;
    db.prepare("UPDATE tokens SET pool = ?, status = 2 WHERE token = ?").run(a.pool, a.token);
  }
}

async function loop() {
  try {
    const head = await client.getBlockNumber();
    let cursor = getCursor(head > 50000n ? head - 50000n : 0n);
    while (cursor < head) {
      const to = cursor + CHUNK > head ? head : cursor + CHUNK;
      await indexRange(cursor + 1n, to);
      setCursor(to);
      cursor = to;
    }
  } catch (e) {
    console.error("index loop error:", (e as Error).message);
  } finally {
    setTimeout(loop, POLL_INTERVAL_MS);
  }
}

// --- API ---
const app = express();
app.use(cors());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/leaderboard", (req, res) => {
  const sort = String(req.query.sort ?? "volume");
  const rows = db
    .prepare(
      `SELECT t.*,
        COALESCE((SELECT SUM(CAST(opn_amount AS REAL)) FROM trades tr WHERE tr.curve = t.curve COLLATE NOCASE), 0) AS volume,
        (SELECT COUNT(*) FROM trades tr WHERE tr.curve = t.curve COLLATE NOCASE) AS trade_count
       FROM tokens t`
    )
    .all() as any[];

  const enriched = rows.map((r) => ({
    token: r.token,
    curve: r.curve,
    creator: r.creator,
    name: r.name,
    symbol: r.symbol,
    identityVerified: !!r.identity_verified,
    status: r.status,
    reserve: r.reserve,
    graduationCap: r.graduation_cap,
    pool: r.pool,
    volumeOPN: formatEther(BigInt(Math.round(r.volume))),
    tradeCount: r.trade_count,
    progress:
      BigInt(r.graduation_cap || "1") > 0n
        ? Math.min(100, Number((BigInt(r.reserve || "0") * 100n) / BigInt(r.graduation_cap || "1")))
        : 0,
  }));

  enriched.sort((a, b) => {
    if (sort === "recent") return 0; // already insertion order-ish
    if (sort === "progress") return b.progress - a.progress;
    return Number(b.volumeOPN) - Number(a.volumeOPN);
  });

  res.json(enriched);
});

app.get("/token/:addr", (req, res) => {
  const t = db.prepare("SELECT * FROM tokens WHERE token = ? COLLATE NOCASE").get(req.params.addr) as any;
  if (!t) return res.status(404).json({ error: "not found" });
  const trades = db
    .prepare("SELECT * FROM trades WHERE curve = ? ORDER BY block DESC LIMIT 50")
    .all(t.curve);
  res.json({ token: t, trades });
});

app.get("/stats", (_req, res) => {
  const tokenCount = (db.prepare("SELECT COUNT(*) c FROM tokens").get() as any).c;
  const tradeCount = (db.prepare("SELECT COUNT(*) c FROM trades").get() as any).c;
  const graduated = (db.prepare("SELECT COUNT(*) c FROM tokens WHERE status = 2").get() as any).c;
  res.json({ tokenCount, tradeCount, graduated });
});

app.listen(PORT, () => {
  console.log(`Barkpad indexer API on http://localhost:${PORT}`);
  console.log(`Watching TokenFactory ${ADDRESSES.TokenFactory}`);
  loop();
});
