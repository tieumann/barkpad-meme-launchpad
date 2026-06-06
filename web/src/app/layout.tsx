import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Barkpad 🐶 — Meme Launchpad on OPN Chain",
  description:
    "Launch, trade, and grow cute meme tokens on OPN Chain. Fair bonding-curve launches, anti-rug locks, staking, airdrops, and quests.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">{children}</main>
          <footer className="border-t-4 border-bark-ink/10 bg-white/60 py-6 text-center font-display font-bold text-bark-ink/60">
            🐾 Barkpad · built on OPN Chain (testnet) · much wow, very launch
          </footer>
        </Providers>
      </body>
    </html>
  );
}
