"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { opnTestnet, FAUCET_URL } from "@/lib/chain";

/**
 * Shows a friendly banner prompting the user to switch to OPN Chain when on the
 * wrong network, plus a faucet link. Render near the top of action pages.
 */
export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="card-cute mb-6 flex items-center gap-3 p-4">
        <span className="text-2xl">👋</span>
        <p className="font-semibold">Connect your wallet to start barking on-chain.</p>
      </div>
    );
  }

  if (chainId !== opnTestnet.id) {
    return (
      <div className="card-cute mb-6 flex flex-wrap items-center justify-between gap-3 border-bark-coral/40 bg-bark-peach/70 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🙈</span>
          <p className="font-bold">You&apos;re on the wrong network. Switch to OPN Testnet (984).</p>
        </div>
        <button className="btn-coral" onClick={() => switchChain({ chainId: opnTestnet.id })} disabled={isPending}>
          {isPending ? "Switching…" : "Switch network"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-bark-mint/50 bg-bark-mint/20 px-4 py-2">
      <span className="font-semibold">✅ Connected to OPN Testnet</span>
      <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="chip hover:bg-bark-honey">
        🚰 Get test OPN
      </a>
    </div>
  );
}
