"use client";

import { useState } from "react";
import { formatEther, parseEther, isAddress } from "viem";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { stakingAbi, stakingFactoryAbi, erc20Abi } from "@/lib/abis";
import { ADDRESSES } from "@/lib/addresses";
import { NetworkGuard } from "@/components/NetworkGuard";
import { TxStatus } from "@/components/TxButton";

export default function StakePage() {
  const { address: me } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const [pool, setPool] = useState("");
  const [stakeToken, setStakeToken] = useState(ADDRESSES.DogOn);
  const [amount, setAmount] = useState("100");

  const poolValid = isAddress(pool);

  const { data, refetch } = useReadContracts({
    contracts: poolValid
      ? [
          { address: pool as `0x${string}`, abi: stakingAbi, functionName: "totalStaked" },
          { address: pool as `0x${string}`, abi: stakingAbi, functionName: "stakingToken" },
          ...(me
            ? [
                { address: pool as `0x${string}`, abi: stakingAbi, functionName: "balanceOf", args: [me] } as const,
                { address: pool as `0x${string}`, abi: stakingAbi, functionName: "earned", args: [me] } as const,
              ]
            : []),
        ]
      : [],
    query: { enabled: poolValid },
  });

  const totalStaked = (data?.[0]?.result as bigint) ?? 0n;
  const myStake = (data?.[2]?.result as bigint) ?? 0n;
  const earned = (data?.[3]?.result as bigint) ?? 0n;

  function createPool() {
    if (!isAddress(stakeToken)) return;
    writeContract(
      {
        address: ADDRESSES.StakingFactory as `0x${string}`,
        abi: stakingFactoryAbi,
        functionName: "createStaking",
        args: [stakeToken as `0x${string}`, stakeToken as `0x${string}`],
      },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }
  function approve() {
    if (!poolValid) return;
    writeContract({
      address: stakeToken as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [pool as `0x${string}`, parseEther(amount || "0")],
    });
  }
  function stake() {
    if (!poolValid) return;
    writeContract(
      { address: pool as `0x${string}`, abi: stakingAbi, functionName: "stake", args: [parseEther(amount || "0")] },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }
  function unstake() {
    if (!poolValid) return;
    writeContract(
      { address: pool as `0x${string}`, abi: stakingAbi, functionName: "unstake", args: [parseEther(amount || "0")] },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }
  function claim() {
    if (!poolValid) return;
    writeContract(
      { address: pool as `0x${string}`, abi: stakingAbi, functionName: "claim", args: [] },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold">🥩 Staking</h1>
        <p className="mt-1 font-semibold text-bark-ink/70">
          Stake your favorite doge and earn rewards over time. Reward-per-token, no draining. 🐾
        </p>
      </div>

      <NetworkGuard />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create / select pool */}
        <div className="card-cute space-y-4 p-6">
          <h3 className="font-display text-xl font-extrabold">🏗️ Create a staking pool</h3>
          <div>
            <label className="mb-1 block font-display font-bold">Token to stake (& reward)</label>
            <input className="input-cute" value={stakeToken} onChange={(e) => setStakeToken(e.target.value)} />
            <p className="mt-1 text-xs font-semibold text-bark-ink/50">Defaults to $DOGON. Paste any meme token.</p>
          </div>
          <button className="btn-pop w-full bg-bark-grape text-white" onClick={createPool} disabled={isPending}>
            🏗️ Create pool
          </button>
          <p className="text-xs font-semibold text-bark-ink/50">
            After creating, copy the new pool address from the tx and paste it on the right to stake.
          </p>
        </div>

        {/* Stake panel */}
        <div className="card-cute space-y-4 p-6">
          <h3 className="font-display text-xl font-extrabold">🥩 Stake</h3>
          <div>
            <label className="mb-1 block font-display font-bold">Pool address</label>
            <input
              className="input-cute"
              placeholder="0x… staking pool"
              value={pool}
              onChange={(e) => setPool(e.target.value)}
            />
          </div>

          {poolValid && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label="Total staked" value={`${Number(formatEther(totalStaked)).toFixed(0)}`} />
              <Mini label="Your stake" value={`${Number(formatEther(myStake)).toFixed(0)}`} />
              <Mini label="Earned" value={`${Number(formatEther(earned)).toFixed(2)}`} />
            </div>
          )}

          <div>
            <label className="mb-1 block font-display font-bold">Amount</label>
            <input className="input-cute" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={approve} disabled={!poolValid || isPending}>
              1️⃣ Approve
            </button>
            <button className="btn-pop bg-bark-mint text-bark-ink" onClick={stake} disabled={!poolValid || isPending}>
              2️⃣ Stake
            </button>
            <button className="btn-ghost" onClick={unstake} disabled={!poolValid || isPending}>
              Unstake
            </button>
            <button className="btn-bubble" onClick={claim} disabled={!poolValid || isPending}>
              🎁 Claim rewards
            </button>
          </div>

          <TxStatus hash={hash} error={error} />
        </div>
      </div>

      <div className="card-cute p-5 text-sm font-semibold text-bark-ink/60">
        🛈 Rewards accrue per second proportional to your share of the pool, paid from a funded reward pool.
        The contract caps rewards at the funded amount, so a pool can never pay out more than it holds.
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-bark-peach/40 p-3">
      <p className="font-display text-lg font-extrabold">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-bark-ink/50">{label}</p>
    </div>
  );
}
