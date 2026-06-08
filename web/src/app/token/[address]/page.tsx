"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { tokenFactoryAbi, bondingCurveAbi, erc20Abi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { NetworkGuard } from "@/components/NetworkGuard";
import { TxStatus, CuteSpinner } from "@/components/TxButton";
import { CreatorBadge } from "@/components/CreatorBadge";

export default function TokenPage() {
  const params = useParams();
  const token = params.address as `0x${string}`;
  const { address: me } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.5");

  const { data: rec, isLoading } = useReadContract({
    address: ADDRESSES.TokenFactory as `0x${string}`,
    abi: tokenFactoryAbi,
    functionName: "records",
    args: [token],
  });

  const curve = rec ? (rec[1] as `0x${string}`) : undefined;
  const creator = rec ? (rec[2] as `0x${string}`) : undefined;
  const verified = rec ? (rec[5] as boolean) : false;

  const { data: meta } = useReadContracts({
    contracts: [
      { address: token, abi: erc20Abi, functionName: "name" },
      { address: token, abi: erc20Abi, functionName: "symbol" },
      ...(me ? [{ address: token, abi: erc20Abi, functionName: "balanceOf", args: [me] } as const] : []),
    ] as any,
  });

  const { data: curveData, refetch } = useReadContracts({
    contracts: curve
      ? [
          { address: curve, abi: bondingCurveAbi, functionName: "status" },
          { address: curve, abi: bondingCurveAbi, functionName: "reserve" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationCap" },
          { address: curve, abi: bondingCurveAbi, functionName: "supplySold" },
          { address: curve, abi: bondingCurveAbi, functionName: "pool" },
        ]
      : [],
    query: { enabled: !!curve },
  } as any);

  const name = meta?.[0]?.result as string | undefined;
  const symbol = meta?.[1]?.result as string | undefined;
  const myBal = (meta?.[2]?.result as bigint) ?? 0n;
  const status = curveData?.[0]?.result !== undefined ? Number(curveData[0].result) : 0;
  const reserve = (curveData?.[1]?.result as bigint) ?? 0n;
  const cap = (curveData?.[2]?.result as bigint) ?? 1n;
  const sold = (curveData?.[3]?.result as bigint) ?? 0n;
  const pool = curveData?.[4]?.result as `0x${string}` | undefined;
  const pct = cap > 0n ? Math.min(100, Number((reserve * 100n) / cap)) : 0;
  const emoji = useMemo(() => name?.match(/\p{Emoji}/u)?.[0] ?? "🐶", [name]);

  function buy() {
    if (!curve) return;
    writeContract(
      {
        address: curve,
        abi: bondingCurveAbi,
        functionName: "buy",
        value: parseEther(amount || "0"),
        args: [BigInt(0)],
      },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }

  function sell() {
    if (!curve) return;
    // Sell whole-token amount; approve then sell in two steps.
    const tokenAmt = parseEther(amount || "0");
    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [curve, tokenAmt],
    });
    // Note: user confirms approve then taps Sell again to execute the sell.
  }

  function sellExec() {
    if (!curve) return;
    writeContract(
      {
        address: curve,
        abi: bondingCurveAbi,
        functionName: "sell",
        args: [parseEther(amount || "0"), BigInt(0)],
      },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }

  function graduate() {
    if (!curve) return;
    writeContract(
      { address: curve, abi: bondingCurveAbi, functionName: "graduate", args: [] },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }

  if (isLoading) return <CuteSpinner label="Fetching doge" />;
  if (!rec || creator === "0x0000000000000000000000000000000000000000") {
    return <div className="card-cute p-10 text-center font-display font-bold">🐕 Token not found.</div>;
  }

  return (
    <div className="space-y-6">
      <NetworkGuard />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Token info */}
        <div className="card-cute p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-bark-ink bg-bark-honey text-5xl shadow-pop">
              <span className="animate-float">{emoji}</span>
            </div>
            <div>
              <h1 className="font-display text-3xl font-extrabold">{name}</h1>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="chip bg-bark-sun/30">${symbol}</span>
                {verified && <span className="chip bg-bark-sky/30">🪪 Verified creator</span>}
                <span className="chip">🔒 Mint disabled</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-1 flex justify-between font-display font-bold">
              <span>Graduation progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-5 w-full overflow-hidden rounded-full border-4 border-bark-ink/10 bg-white">
              <div
                className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-bark-sun to-bark-coral pr-2 text-xs font-bold text-white transition-all"
                style={{ width: `${Math.max(pct, 6)}%` }}
              >
                {pct >= 12 ? "🦴" : ""}
              </div>
            </div>
            <p className="mt-1 text-sm font-semibold text-bark-ink/60">
              {Number(formatEther(reserve)).toFixed(3)} / {formatEther(cap)} OPN raised
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label="Status" value={["🟢 Trading", "🟡 Graduating", "🎓 Graduated"][status]} />
            <Stat label="Tokens sold" value={`${Number(sold).toLocaleString()}`} />
            <Stat label="Your balance" value={`${Number(formatEther(myBal)).toFixed(0)} ${symbol ?? ""}`} />
            <Stat label="Curve" value={`${curve?.slice(0, 6)}…${curve?.slice(-4)}`} />
          </div>

          {status === 1 && (
            <button className="btn-bubble mt-5 w-full" onClick={graduate} disabled={isPending}>
              🎓 Finalize graduation (create locked pool)
            </button>
          )}
          {status === 2 && pool && (
            <div className="mt-5 rounded-2xl bg-bark-grape/20 p-4 font-semibold">
              🎉 Graduated! Liquidity is locked in pool{" "}
              <span className="break-all opacity-70">{pool}</span>
            </div>
          )}
        </div>

        {/* Trade box */}
        <div className="card-cute p-6">
          <div className="mb-4 flex rounded-full border-4 border-bark-ink/10 bg-white p-1">
            <button
              onClick={() => setTab("buy")}
              className={`flex-1 rounded-full py-2 font-display font-extrabold ${
                tab === "buy" ? "bg-bark-mint/60" : "text-bark-ink/60"
              }`}
            >
              💚 Buy
            </button>
            <button
              onClick={() => setTab("sell")}
              className={`flex-1 rounded-full py-2 font-display font-extrabold ${
                tab === "sell" ? "bg-bark-coral/40" : "text-bark-ink/60"
              }`}
            >
              ❤️ Sell
            </button>
          </div>

          <label className="mb-1 block font-display font-bold">
            {tab === "buy" ? "OPN to spend" : `${symbol ?? "tokens"} to sell`}
          </label>
          <input className="input-cute" value={amount} onChange={(e) => setAmount(e.target.value)} />

          {status !== 0 ? (
            <p className="mt-4 rounded-2xl bg-bark-peach/60 px-3 py-2 font-semibold">
              🐾 Curve trading is closed (token has graduated). Use the DEX pool to swap.
            </p>
          ) : tab === "buy" ? (
            <button className="btn-pop mt-4 w-full bg-bark-mint text-bark-ink" onClick={buy} disabled={isPending}>
              💚 Buy {symbol}
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <button className="btn-ghost w-full" onClick={sell} disabled={isPending}>
                1️⃣ Approve {symbol}
              </button>
              <button className="btn-coral w-full" onClick={sellExec} disabled={isPending}>
                2️⃣ Sell {symbol}
              </button>
            </div>
          )}

          <TxStatus hash={hash} error={error} />

          <p className="mt-4 text-center text-xs font-semibold text-bark-ink/50">
            Fair bonding-curve pricing · 1% trading fee · slippage-safe
          </p>
        </div>
      </div>

      {/* Creator reputation */}
      <CreatorBadge creator={creator} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-bark-peach/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-bark-ink/50">{label}</p>
      <p className="font-display text-lg font-extrabold">{value}</p>
    </div>
  );
}
