"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useReadContracts, useWriteContract } from "wagmi";
import { ammPairAbi, erc20Abi } from "@/lib/abis";
import { TxStatus } from "@/components/TxButton";

/**
 * Two-way swap on a graduated token's AMM pool:
 *   OPN -> meme token  (swapOPNForToken)
 *   meme token -> OPN  (swapTokenForOPN, needs approve first)
 *
 * Pricing is constant-product with a 0.3% fee, matching SimpleAMMPair.
 */
export function SwapBox({
  pool,
  token,
  symbol,
}: {
  pool: `0x${string}`;
  token: `0x${string}`;
  symbol: string;
}) {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [dir, setDir] = useState<"buy" | "sell">("buy"); // buy = OPN->token
  const [amount, setAmount] = useState("0.1");

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: pool, abi: ammPairAbi, functionName: "reserveOPN" },
      { address: pool, abi: ammPairAbi, functionName: "reserveToken" },
    ],
  });
  const reserveOPN = (data?.[0]?.result as bigint) ?? 0n;
  const reserveToken = (data?.[1]?.result as bigint) ?? 0n;

  // Constant-product quote with 0.3% fee.
  function quote(inWei: bigint, rIn: bigint, rOut: bigint): bigint {
    if (rIn === 0n || rOut === 0n || inWei === 0n) return 0n;
    const inWithFee = inWei * 997n;
    return (inWithFee * rOut) / (rIn * 1000n + inWithFee);
  }

  const amtWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();

  const out =
    dir === "buy" ? quote(amtWei, reserveOPN, reserveToken) : quote(amtWei, reserveToken, reserveOPN);

  function swap() {
    if (dir === "buy") {
      writeContract(
        { address: pool, abi: ammPairAbi, functionName: "swapOPNForToken", value: amtWei, args: [BigInt(0)] },
        { onSuccess: () => setTimeout(() => refetch(), 2500) }
      );
    } else {
      // Sell: approve token to the pool, then swap.
      writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [pool, amtWei] });
    }
  }

  function swapSellExec() {
    writeContract(
      { address: pool, abi: ammPairAbi, functionName: "swapTokenForOPN", args: [amtWei, BigInt(0)] },
      { onSuccess: () => setTimeout(() => refetch(), 2500) }
    );
  }

  return (
    <div className="card-cute p-6">
      <h3 className="font-display text-xl font-extrabold">🔄 Swap (DEX pool)</h3>
      <p className="mt-1 text-sm font-semibold text-bark-ink/60">
        This token graduated — trade it freely on its liquidity pool.
      </p>

      <div className="mt-4 flex rounded-full border-4 border-bark-ink/10 bg-white p-1">
        <button
          onClick={() => setDir("buy")}
          className={`flex-1 rounded-full py-2 font-display font-extrabold ${
            dir === "buy" ? "bg-bark-mint/60" : "text-bark-ink/60"
          }`}
        >
          OPN → {symbol}
        </button>
        <button
          onClick={() => setDir("sell")}
          className={`flex-1 rounded-full py-2 font-display font-extrabold ${
            dir === "sell" ? "bg-bark-coral/40" : "text-bark-ink/60"
          }`}
        >
          {symbol} → OPN
        </button>
      </div>

      <label className="mb-1 mt-4 block font-display font-bold">
        {dir === "buy" ? "OPN to spend" : `${symbol} to sell`}
      </label>
      <input className="input-cute" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <p className="mt-2 rounded-2xl bg-bark-honey/40 px-3 py-2 font-semibold">
        ≈ {Number(formatEther(out)).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
        {dir === "buy" ? symbol : "OPN"}
      </p>

      {dir === "buy" ? (
        <button className="btn-pop mt-3 w-full bg-bark-mint text-bark-ink" onClick={swap} disabled={isPending}>
          🔄 Swap to {symbol}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <button className="btn-ghost w-full" onClick={swap} disabled={isPending}>
            1️⃣ Approve {symbol}
          </button>
          <button className="btn-coral w-full" onClick={swapSellExec} disabled={isPending}>
            2️⃣ Swap to OPN
          </button>
        </div>
      )}

      <TxStatus hash={hash} error={error} />

      <p className="mt-3 text-center text-xs font-semibold text-bark-ink/50">
        Pool {pool.slice(0, 6)}…{pool.slice(-4)} · 0.3% fee · constant-product
      </p>
    </div>
  );
}
