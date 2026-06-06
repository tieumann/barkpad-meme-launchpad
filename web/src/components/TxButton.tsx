"use client";

import { ReactNode } from "react";
import { useWaitForTransactionReceipt } from "wagmi";

/**
 * A button that reflects write-transaction lifecycle and surfaces a block
 * explorer-less status (OPN explorer is coming soon, so we show the hash).
 */
export function TxStatus({ hash, error }: { hash?: `0x${string}`; error?: Error | null }) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (error) {
    const msg = (error as any)?.shortMessage ?? error.message;
    return <p className="mt-3 rounded-2xl bg-bark-peach/70 px-3 py-2 text-sm font-semibold">🐾 {msg}</p>;
  }
  if (hash && isLoading) {
    return (
      <p className="mt-3 rounded-2xl bg-bark-honey/60 px-3 py-2 text-sm font-semibold">
        ⏳ Sending it… <span className="break-all opacity-70">{hash}</span>
      </p>
    );
  }
  if (hash && isSuccess) {
    return (
      <p className="mt-3 rounded-2xl bg-bark-mint/40 px-3 py-2 text-sm font-semibold">
        🎉 Done! tx <span className="break-all opacity-70">{hash}</span>
      </p>
    );
  }
  return null;
}

export function CuteSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 font-display font-bold text-bark-ink/60">
      <span className="animate-float text-2xl">🦴</span>
      {label}…
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card-cute flex flex-col items-center gap-2 p-10 text-center">
      <span className="text-4xl">🐶</span>
      <p className="font-display font-bold text-bark-ink/70">{children}</p>
    </div>
  );
}
