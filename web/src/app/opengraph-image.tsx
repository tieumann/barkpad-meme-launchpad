import { ImageResponse } from "next/og";

// Dynamic Open Graph image for Barkpad. Rendered server-side, so social
// crawlers and preview bots get a real thumbnail without running client JS.
export const runtime = "edge";
export const alt = "Barkpad — Meme Launchpad on OPN Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FFF7ED 0%, #FFE4CC 45%, #FFD79A 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 180, marginBottom: 8 }}>🐶</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#3B2F2F" }}>Bark</div>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#FF8C69" }}>pad</div>
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, color: "#3B2F2F", opacity: 0.8, marginTop: 8 }}>
          The cutest, safest meme launchpad on OPN Chain
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
          {["Fair Launch", "Anti-Rug", "Swap", "Stake", "Airdrop"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#3B2F2F",
                background: "white",
                border: "4px solid rgba(59,47,47,0.12)",
                borderRadius: 999,
                padding: "8px 22px",
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 28, fontSize: 26, fontWeight: 700, color: "#3B2F2F", opacity: 0.6 }}>
          🦴 much safe · very launch · OPN Chain testnet
        </div>
      </div>
    ),
    { ...size }
  );
}
