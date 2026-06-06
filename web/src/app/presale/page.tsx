"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { presaleAbi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { NetworkGuard } from "@/components/NetworkGuard";
import { TxStatus } from "@/components/TxButton";

export default function PresalePage() {
  const { address: me } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [amount, setAmount] = useState("0.5");

  const presale = ADDRESSES.Presale as `0x${string}`;

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: presale, abi: presaleAbi, functionName: "isLive" },
      { address: presale, abi: presaleAbi, functionName: "totalRaised" },
      { address: presale, abi: presaleAbi, functionName: "hardCap" },
      { address: presale, abi: presaleAbi, functionName: "softCap" },
      { address: presale, abi: presaleAbi, functionName: "rate" },
      ...(me ? [{ address: presale, abi: presaleAbi, functionName: "contributed", args: [me] } as const] : []),
    ],
  });

  const live = (data?.[0]?.result as boolean) ?? false;
  const raised = (data?.[1]?.result as bigint) ?? 0n;
  const hard = (data?.[2]?.result as bigint) ?? 1n;
  const soft = (data?.[3]?.result as bigint) ?? 0n;
  const rate = (data?.[4]?.result as bigint) ?? 0n;
  const mine = (data?.[5]?.result as bigint) ?? 0n;
  const pct = hard > 0n ? Math.min(100, Number((raised * 100n) / hard)) : 0;
  const tokensOut = rate > 0n ? (parseEther(amount || "0") * rate) / parseEther("1") : 0n;

  function buy() {
    writeContract(
      { address: presale, abi: presaleAbi, functionName: "buy", value: parseEther(amount || "0") },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }
  function claim() {
    writeContract({ address: presale, abi: presaleAbi, functionName: "claim", args: [] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold">💎 DogOn Presale</h1>
        <p className="mt-1 font-semibold text-bark-ink/70">
          Get $DOGON early at a fixed price. Soft-cap protected — full refund if it doesn&apos;t fill. 🐶
        </p>
      </div>

      <NetworkGuard />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="card-cute relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-4 -top-4 text-8xl opacity-15">💎</div>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-bark-ink bg-bark-grape/40 text-5xl shadow-pop">
              🐕
            </div>
            <div>
              <h2 className="font-display text-3xl font-extrabold">DogOn</h2>
              <span className="chip bg-bark-grape/30 text-lg">$DOGON</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-1 flex justify-between font-display font-bold">
              <span>Raised</span>
              <span>{pct}%</span>
            </div>
            <div className="h-5 w-full overflow-hidden rounded-full border-4 border-bark-ink/10 bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-bark-grape to-bark-bubble transition-all"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <p className="mt-1 text-sm font-semibold text-bark-ink/60">
              {Number(formatEther(raised)).toFixed(2)} / {formatEther(hard)} OPN · soft cap {formatEther(soft)} OPN
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Mini label="Rate" value={`1 OPN = ${formatEther(rate)} DOGON`} />
            <Mini label="Status" value={live ? "🟢 Live" : "⏸️ Closed"} />
            <Mini label="You bought" value={`${formatEther(mine)} OPN`} />
            <Mini label="Network" value="OPN 984" />
          </div>
        </div>

        <div className="card-cute p-6">
          <h3 className="font-display text-xl font-extrabold">Join the presale</h3>
          <label className="mb-1 mt-4 block font-display font-bold">OPN to contribute</label>
          <input className="input-cute" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="mt-2 rounded-2xl bg-bark-honey/40 px-3 py-2 font-semibold">
            ≈ {Number(formatEther(tokensOut)).toLocaleString()} $DOGON
          </p>

          <button className="btn-bubble mt-4 w-full text-lg" onClick={buy} disabled={!live || isPending}>
            💎 Buy DOGON
          </button>
          <button className="btn-ghost mt-2 w-full" onClick={claim} disabled={isPending}>
            🎁 Claim (after finalize)
          </button>
          <TxStatus hash={hash} error={error} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-bark-peach/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-bark-ink/50">{label}</p>
      <p className="font-display font-extrabold">{value}</p>
    </div>
  );
}
