// Client for the Barkpad indexer API (optional — UI degrades gracefully if down).

export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:4000";

export type LeaderboardItem = {
  token: string;
  curve: string;
  creator: string;
  name: string | null;
  symbol: string | null;
  identityVerified: boolean;
  status: number;
  reserve: string;
  graduationCap: string;
  pool: string | null;
  volumeOPN: string;
  tradeCount: number;
  progress: number;
};

export type Stats = { tokenCount: number; tradeCount: number; graduated: number };

async function safeGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INDEXER_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const getLeaderboard = (sort = "volume") =>
  safeGet<LeaderboardItem[]>(`/leaderboard?sort=${sort}`);
export const getStats = () => safeGet<Stats>("/stats");
