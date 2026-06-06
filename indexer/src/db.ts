import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    curve TEXT NOT NULL,
    creator TEXT NOT NULL,
    name TEXT,
    symbol TEXT,
    identity_verified INTEGER DEFAULT 0,
    created_at INTEGER,
    status INTEGER DEFAULT 0,
    reserve TEXT DEFAULT '0',
    graduation_cap TEXT DEFAULT '0',
    pool TEXT
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx TEXT,
    log_index INTEGER,
    curve TEXT NOT NULL,
    trader TEXT NOT NULL,
    is_buy INTEGER NOT NULL,
    opn_amount TEXT NOT NULL,
    token_amount TEXT NOT NULL,
    fee TEXT NOT NULL,
    block INTEGER,
    UNIQUE(tx, log_index)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

export function getCursor(defaultBlock: bigint): bigint {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'last_block'").get() as
    | { value: string }
    | undefined;
  return row ? BigInt(row.value) : defaultBlock;
}

export function setCursor(block: bigint) {
  db.prepare("INSERT INTO meta(key, value) VALUES('last_block', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(
    block.toString(),
    block.toString()
  );
}

export const upsertToken = db.prepare(`
  INSERT INTO tokens (token, curve, creator, identity_verified, created_at)
  VALUES (@token, @curve, @creator, @identity_verified, @created_at)
  ON CONFLICT(token) DO UPDATE SET curve = @curve, creator = @creator
`);

export const setTokenMeta = db.prepare(`UPDATE tokens SET name = ?, symbol = ? WHERE token = ?`);

export const setTokenStats = db.prepare(`
  UPDATE tokens SET status = ?, reserve = ?, graduation_cap = ?, pool = ? WHERE curve = ?
`);

export const insertTrade = db.prepare(`
  INSERT OR IGNORE INTO trades (tx, log_index, curve, trader, is_buy, opn_amount, token_amount, fee, block)
  VALUES (@tx, @log_index, @curve, @trader, @is_buy, @opn_amount, @token_amount, @fee, @block)
`);
