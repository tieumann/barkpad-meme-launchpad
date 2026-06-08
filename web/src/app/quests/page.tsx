"use client";

import { formatEther } from "viem";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { questAbi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { NetworkGuard } from "@/components/NetworkGuard";
import { TxStatus } from "@/components/TxButton";

const QUESTS = [
  { emoji: "🐦", title: "Follow us on X", points: 1, action: "FOLLOW", cta: "Follow @Barkpad" },
  { emoji: "💬", title: "Join our Discord", points: 1, action: "DISCORD", cta: "Join Discord" },
  { emoji: "✍️", title: "Write a post about Barkpad on X", points: 2, action: "X_POST", cta: "Post on X" },
  { emoji: "🤝", title: "Refer a friend", points: 3, action: "REFERRAL", cta: "Get referral link" },
];

export default function QuestsPage() {
  const { address: me } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const quest = ADDRESSES.QuestRewards as `0x${string}`;

  const { data } = useReadContracts({
    contracts: [
      { address: quest, abi: questAbi, functionName: "conversionOpen" },
      ...(me
        ? [
            { address: quest, abi: questAbi, functionName: "pointsOf", args: [me] } as const,
            { address: quest, abi: questAbi, functionName: "claimable", args: [me] } as const,
            { address: quest, abi: questAbi, functionName: "claimed", args: [me] } as const,
          ]
        : []),
    ] as any,
  });

  const conversionOpen = (data?.[0]?.result as boolean) ?? false;
  const points = (data?.[1]?.result as bigint) ?? 0n;
  const claimable = (data?.[2]?.result as bigint) ?? 0n;
  const claimed = (data?.[3]?.result as boolean) ?? false;

  function claim() {
    writeContract({ address: quest, abi: questAbi, functionName: "claim", args: [] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold">🎯 Quests & Airdrop</h1>
        <p className="mt-1 font-semibold text-bark-ink/70">
          Earn points for spreading the word, then claim $DOGON. Much community, very reward. 🐾
        </p>
      </div>

      <NetworkGuard />

      {/* Points summary */}
      <div className="card-cute flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-bark-honey/40 to-bark-peach/40 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-bark-ink bg-white text-4xl shadow-pop">
            ⭐
          </div>
          <div>
            <p className="font-display text-sm font-bold uppercase text-bark-ink/50">Your points</p>
            <p className="font-display text-4xl font-extrabold">{points.toString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-bark-ink/60">
            {conversionOpen
              ? claimed
                ? "🎉 Already claimed"
                : `Claimable: ${Number(formatEther(claimable)).toLocaleString()} DOGON`
              : "Conversion opens after the campaign"}
          </p>
          <button
            className="btn-bubble mt-2"
            onClick={claim}
            disabled={!conversionOpen || claimed || claimable === 0n || isPending}
          >
            🎁 Claim DOGON
          </button>
        </div>
      </div>
      <TxStatus hash={hash} error={error} />

      {/* Quest list */}
      <div className="grid gap-5 sm:grid-cols-2">
        {QUESTS.map((q) => (
          <div key={q.action} className="card-cute flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-bark-ink/10 bg-bark-peach/50 text-3xl">
                {q.emoji}
              </div>
              <div>
                <h3 className="font-display text-lg font-extrabold">{q.title}</h3>
                <span className="chip bg-bark-sun/30">+{q.points} points</span>
              </div>
            </div>
            <button className="btn-ghost whitespace-nowrap">{q.cta}</button>
          </div>
        ))}
      </div>

      <div className="card-cute p-5 text-sm font-semibold text-bark-ink/60">
        🛈 Social actions are verified by the Barkpad backend (off-chain), which then credits your points
        on-chain. Points convert to $DOGON from a funded reward pool when the campaign ends.
      </div>
    </div>
  );
}
