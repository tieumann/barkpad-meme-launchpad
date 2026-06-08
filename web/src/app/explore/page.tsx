"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { tokenFactoryAbi, erc20Abi, bondingCurveAbi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { CuteSpinner, Empty } from "@/components/TxButton";
import { formatEther } from "viem";
import { getLeaderboard, type LeaderboardItem } from "@/lib/indexer";

const STATUS_LABEL: Record<number, { t: string; c: string }> = {
  0: { t: "🟢 Trading", c: "bg-bark-mint/40" },
  1: { t: "🟡 Graduating", c: "bg-bark-honey/60" },
  2: { t: "🎓 Graduated", c: "bg-bark-grape/30" },
};

export default function ExplorePage() {
  const { data: count, isLoading } = useReadContract({
    address: ADDRESSES.TokenFactory as `0x${string}`,
    abi: tokenFactoryAbi,
    functionName: "tokenCount",
  });

  const n = count ? Number(count) : 0;
  // Read the most recent up to 24 tokens.
  const indices = Array.from({ length: Math.min(n, 24) }, (_, i) => n - 1 - i).filter((i) => i >= 0);

  const { data: tokenAddrs } = useReadContracts({
    contracts: indices.map((i) => ({
      address: ADDRESSES.TokenFactory as `0x${string}`,
      abi: tokenFactoryAbi,
      functionName: "allTokens",
      args: [BigInt(i)],
    })),
    query: { enabled: indices.length > 0 },
  });

  const addrs = (tokenAddrs ?? [])
    .map((r) => (r.status === "success" ? (r.result as unknown as `0x${string}`) : null))
    .filter(Boolean) as `0x${string}`[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold">🔭 Explore the pack</h1>
          <p className="mt-1 font-semibold text-bark-ink/70">{n} doge tokens launched so far.</p>
        </div>
        <Link href="/launch" className="btn-coral">
          🚀 Launch yours
        </Link>
      </div>

      {isLoading ? (
        <CuteSpinner label="Sniffing tokens" />
      ) : addrs.length === 0 ? (
        <Empty>No tokens yet. Be the first to launch a doge! 🐶</Empty>
      ) : (
        <>
          <LeaderboardStrip />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {addrs.map((a) => (
              <TokenCard key={a} token={a} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Top-by-volume strip powered by the indexer (hidden if indexer is offline). */
function LeaderboardStrip() {
  const [items, setItems] = useState<LeaderboardItem[] | null>(null);

  useEffect(() => {
    getLeaderboard("volume").then((d) => setItems(d?.slice(0, 3) ?? null));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="card-cute p-5">
      <h2 className="mb-3 font-display text-xl font-extrabold">🔥 Top by volume</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((t, i) => (
          <Link
            key={t.token}
            href={`/token/${t.token}`}
            className="flex items-center gap-3 rounded-2xl bg-bark-peach/40 p-3 transition hover:bg-bark-honey/50"
          >
            <span className="font-display text-2xl font-extrabold text-bark-ink/40">#{i + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-display font-extrabold">{t.name ?? "Token"}</p>
              <p className="text-sm font-semibold text-bark-ink/60">
                {Number(t.volumeOPN).toFixed(2)} OPN · {t.tradeCount} trades
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TokenCard({ token }: { token: `0x${string}` }) {
  const { data: rec } = useReadContract({
    address: ADDRESSES.TokenFactory as `0x${string}`,
    abi: tokenFactoryAbi,
    functionName: "records",
    args: [token],
  });

  const { data: meta } = useReadContracts({
    contracts: [
      { address: token, abi: erc20Abi, functionName: "name" },
      { address: token, abi: erc20Abi, functionName: "symbol" },
    ],
  });

  const curve = rec ? (rec[1] as `0x${string}`) : undefined;
  const verified = rec ? (rec[5] as boolean) : false;

  const { data: curveData } = useReadContracts({
    contracts: curve
      ? [
          { address: curve, abi: bondingCurveAbi, functionName: "status" },
          { address: curve, abi: bondingCurveAbi, functionName: "reserve" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationCap" },
        ]
      : [],
    query: { enabled: !!curve },
  } as any);

  const name = meta?.[0]?.result as string | undefined;
  const symbol = meta?.[1]?.result as string | undefined;
  const status = curveData?.[0]?.result !== undefined ? Number(curveData[0].result) : 0;
  const reserve = (curveData?.[1]?.result as bigint) ?? 0n;
  const cap = (curveData?.[2]?.result as bigint) ?? 1n;
  const pct = cap > 0n ? Math.min(100, Number((reserve * 100n) / cap)) : 0;
  const label = STATUS_LABEL[status] ?? STATUS_LABEL[0];

  return (
    <Link href={`/token/${token}`} className="card-cute group p-5 transition-transform hover:-translate-y-1">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-bark-ink bg-bark-honey text-3xl">
          {(name && name.match(/\p{Emoji}/u)?.[0]) ?? "🐶"}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-extrabold">{name ?? "Loading…"}</h3>
          <span className="chip bg-bark-sun/30">${symbol ?? "…"}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`chip ${label.c}`}>{label.t}</span>
        {verified && <span className="chip bg-bark-sky/30">🪪 Verified</span>}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-sm font-semibold text-bark-ink/60">
          <span>Graduation</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border-2 border-bark-ink/10 bg-white">
          <div className="h-full rounded-full bg-bark-coral transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs font-semibold text-bark-ink/50">
          {formatEther(reserve)} / {formatEther(cap)} OPN
        </p>
      </div>
    </Link>
  );
}
