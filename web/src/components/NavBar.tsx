"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  { href: "/", label: "Home", emoji: "🏠" },
  { href: "/launch", label: "Launch", emoji: "🚀" },
  { href: "/explore", label: "Explore", emoji: "🔭" },
  { href: "/markets", label: "Markets", emoji: "📈" },
  { href: "/presale", label: "Presale", emoji: "💎" },
  { href: "/stake", label: "Stake", emoji: "🥩" },
  { href: "/quests", label: "Quests", emoji: "🎯" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-4 border-bark-ink/10 bg-bark-cream/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="animate-wiggle text-3xl">🐶</span>
          <span className="font-display text-2xl font-extrabold tracking-tight text-bark-ink">
            Bark<span className="text-bark-coral">pad</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-2 font-display font-bold transition-colors ${
                  active ? "bg-bark-honey text-bark-ink" : "text-bark-ink/70 hover:bg-bark-peach"
                }`}
              >
                <span className="mr-1">{l.emoji}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-display font-bold ${
                active ? "bg-bark-honey text-bark-ink" : "text-bark-ink/70"
              }`}
            >
              {l.emoji} {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
