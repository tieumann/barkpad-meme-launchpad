"use client";

import { useEffect, useState } from "react";
import { getStats, type Stats } from "@/lib/indexer";

/**
 * Shows live ecosystem stats from the indexer. Hidden if the indexer is offline,
 * so the landing page never looks broken.
 */
export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  if (!stats) return null;

  const items = [
    { label: "Tokens launched", value: stats.tokenCount, emoji: "🐶" },
    { label: "Trades", value: stats.tradeCount, emoji: "🔄" },
    { label: "Graduated", value: stats.graduated, emoji: "🎓" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((i) => (
        <div key={i.label} className="card-cute flex flex-col items-center p-4 text-center">
          <span className="text-2xl">{i.emoji}</span>
          <span className="font-display text-3xl font-extrabold">{i.value}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-bark-ink/50">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
