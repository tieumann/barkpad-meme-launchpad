"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardItem } from "@/lib/indexer";
import { CuteSpinner, Empty } from "@/components/TxButton";

/**
 * Markets = tokens that have graduated and are now listed on the DEX (have a pool).
 * Every token launched on Barkpad auto-lists here once its curve graduates.
 */
export default function MarketsPage() {
  const [items, setItems] = useState<LeaderboardItem[] | null>(null);

  useEffect(() => {
    getLeaderboard("volume").then((d) =>
      setItems((d ?? []).filter((t) => t.status === 2 && t.pool))
    );
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold">📈 Markets</h1>
        <p className="mt-1 font-semibold text-bark-ink/70">
          Graduated tokens, auto-listed on the DEX. Swap OPN ↔ meme and add liquidity. 🐾
        </p>
      </div>

      {items === null ? (
        <CuteSpinner label="Loading markets" />
      ) : items.length === 0 ? (
        <Empty>No listed markets yet. Tokens appear here after they graduate! 🎓</Empty>
      ) : (
        <div className="card-cute overflow-hidden p-0">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 border-b-4 border-bark-ink/10 px-5 py-3 font-display text-sm font-extrabold uppercase tracking-wide text-bark-ink/50">
            <span>Token</span>
            <span className="text-right">Volume (OPN)</span>
            <span className="text-right">Trades</span>
            <span></span>
          </div>
          {items.map((t) => (
            <div
              key={t.token}
              className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2 border-b border-bark-ink/5 px-5 py-3 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{t.name?.match(/\p{Emoji}/u)?.[0] ?? "🐶"}</span>
                <div className="min-w-0">
                  <p className="truncate font-display font-extrabold">{t.name ?? "Token"}</p>
                  <span className="text-sm font-semibold text-bark-ink/50">${t.symbol}</span>
                </div>
              </div>
              <span className="text-right font-semibold">{Number(t.volumeOPN).toFixed(2)}</span>
              <span className="text-right font-semibold">{t.tradeCount}</span>
              <Link href={`/token/${t.token}`} className="btn-pop bg-bark-mint px-4 py-2 text-sm text-bark-ink">
                Swap
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="card-cute p-5 text-sm font-semibold text-bark-ink/60">
        🛈 Every token launched on Barkpad auto-lists here the moment its bonding curve graduates:
        liquidity migrates to a DEX pool and the LP tokens are locked. No manual listing needed.
      </div>
    </div>
  );
}
