"use client";

import { useReadContract } from "wagmi";
import { reputationAbi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";

/**
 * Shows a creator's on-chain reputation: launches, graduations, flags, and a
 * derived trust tier. Reputation comes only from verifiable on-chain events.
 */
export function CreatorBadge({ creator, compact = false }: { creator?: `0x${string}`; compact?: boolean }) {
  const { data } = useReadContract({
    address: ADDRESSES.ReputationRegistry as `0x${string}`,
    abi: reputationAbi,
    functionName: "reputationOf",
    args: creator ? [creator] : undefined,
    query: { enabled: !!creator },
  });

  const rep = data as
    | { launches: number; graduations: number; flags: number; score: bigint }
    | undefined;

  const launches = Number(rep?.launches ?? 0);
  const graduations = Number(rep?.graduations ?? 0);
  const flags = Number(rep?.flags ?? 0);
  const score = rep ? Number(rep.score) : 0;

  const tier = getTier(score, graduations, flags);

  if (compact) {
    return (
      <span className={`chip ${tier.chip}`} title={`Reputation score: ${score}`}>
        {tier.emoji} {tier.label}
      </span>
    );
  }

  return (
    <div className="card-cute p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-extrabold">🐕 Creator reputation</h3>
        <span className={`chip ${tier.chip}`}>
          {tier.emoji} {tier.label}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-bark-ink/60">
        Derived only from on-chain events. Trust the chain, not the promises. 🐾
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Metric label="Score" value={score} />
        <Metric label="Launches" value={launches} />
        <Metric label="Graduated" value={graduations} />
        <Metric label="Flags" value={flags} danger={flags > 0} />
      </div>
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${danger ? "bg-bark-coral/20" : "bg-bark-peach/40"}`}>
      <p className="font-display text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-bark-ink/50">{label}</p>
    </div>
  );
}

function getTier(score: number, graduations: number, flags: number) {
  if (flags > 0) return { label: "Flagged", emoji: "🚩", chip: "bg-bark-coral/30" };
  if (graduations >= 3 || score >= 30) return { label: "Top Dog", emoji: "👑", chip: "bg-bark-sun/40" };
  if (graduations >= 1 || score >= 10) return { label: "Good Boy", emoji: "🦴", chip: "bg-bark-mint/40" };
  return { label: "New Pup", emoji: "🐶", chip: "bg-bark-sky/30" };
}
