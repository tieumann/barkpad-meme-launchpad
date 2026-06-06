"use client";

import { useState } from "react";
import { parseEther, encodeBytes32String } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { NetworkGuard } from "@/components/NetworkGuard";
import { TxStatus } from "@/components/TxButton";
import { tokenFactoryAbi } from "@/lib/abis";
import { ADDRESSES, CREATION_FEE } from "@/lib/addresses";

const EMOJIS = ["🐶", "🐕", "🐩", "🦴", "🌭", "🚀", "🌙", "👑", "🔥", "💎"];

export default function LaunchPage() {
  const { isConnected, chainId } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000");
  const [emoji, setEmoji] = useState("🐶");
  const [desc, setDesc] = useState("");

  const canSubmit = isConnected && chainId === 984 && name.length > 0 && symbol.length > 0;

  function launch() {
    writeContract({
      address: ADDRESSES.TokenFactory as `0x${string}`,
      abi: tokenFactoryAbi,
      functionName: "createToken",
      value: BigInt(CREATION_FEE),
      args: [
        {
          name: `${emoji} ${name}`.slice(0, 32),
          symbol: symbol.toUpperCase().slice(0, 10),
          totalSupply: parseEther(supply || "1000000"),
          metadataId: encodeBytes32String(desc.slice(0, 31) || "meme"),
          basePrice: parseEther("0.0001"),
          slope: parseEther("0.0000001"),
          graduationCap: parseEther("5"),
          tradingFeeBps: 100,
          walletCap: parseEther("1000000"),
          earlyWindowEnd: BigInt(0),
        },
      ],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-extrabold">🚀 Launch your doge</h1>
        <p className="mt-1 font-semibold text-bark-ink/70">
          One click, fair launch. Minting is disabled and reserves stay in-contract. No rugs here. 🐾
        </p>
      </div>

      <NetworkGuard />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="card-cute space-y-4 p-6">
          <div>
            <label className="mb-1 block font-display font-bold">Token name</label>
            <input
              className="input-cute"
              placeholder="Doge Supreme"
              value={name}
              maxLength={28}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block font-display font-bold">Symbol</label>
            <input
              className="input-cute uppercase"
              placeholder="DOGES"
              value={symbol}
              maxLength={10}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block font-display font-bold">Total supply</label>
            <input
              className="input-cute"
              type="number"
              value={supply}
              onChange={(e) => setSupply(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block font-display font-bold">Pick a mascot</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`h-11 w-11 rounded-2xl border-4 text-2xl transition ${
                    emoji === e ? "border-bark-coral bg-bark-honey" : "border-bark-ink/10 bg-white hover:bg-bark-peach"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-display font-bold">Short tagline</label>
            <input
              className="input-cute"
              placeholder="to the moon, very wow"
              value={desc}
              maxLength={31}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <button className="btn-coral w-full text-lg" disabled={!canSubmit || isPending} onClick={launch}>
            {isPending ? "Launching… 🐕" : "🚀 Launch (fee 0.01 OPN)"}
          </button>
          <TxStatus hash={hash} error={error} />
        </div>

        {/* Live preview */}
        <div className="card-cute flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-bark-peach/40 to-white p-6">
          <span className="chip bg-white">Live preview</span>
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-bark-ink bg-bark-honey text-7xl shadow-pop">
            <span className="animate-float">{emoji}</span>
          </div>
          <h3 className="font-display text-2xl font-extrabold">
            {emoji} {name || "Your Doge"}
          </h3>
          <span className="chip bg-bark-sun/40 text-lg">${symbol.toUpperCase() || "DOGE"}</span>
          <p className="text-center font-semibold text-bark-ink/70">
            {desc || "to the moon, very wow"}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <span className="chip">🔒 Mint disabled</span>
            <span className="chip">📈 Bonding curve</span>
            <span className="chip">🦴 LP lock on grad</span>
          </div>
        </div>
      </div>
    </div>
  );
}
