import Link from "next/link";
import { StatsBar } from "@/components/StatsBar";

const features = [
  { emoji: "🚀", title: "Fair Launch", desc: "Bonding-curve pricing. No presale snipers, no whale dumps.", href: "/launch" },
  { emoji: "🔒", title: "Anti-Rug", desc: "Mint disabled, reserves in-contract, LP auto-locked on graduation.", href: "/explore" },
  { emoji: "🔄", title: "Swap", desc: "Graduated tokens get an instant AMM pool to keep trading.", href: "/explore" },
  { emoji: "🥩", title: "Staking", desc: "Stake your fav doge coin and earn rewards over time.", href: "/explore" },
  { emoji: "🎁", title: "Airdrops", desc: "Merkle airdrops to bootstrap a loyal community.", href: "/quests" },
  { emoji: "🎯", title: "Quests", desc: "Follow, join Discord, post on X → earn points → claim tokens.", href: "/quests" },
];

const badges = ["EVM · Chain 984", "10,000+ TPS", "Sub-second finality", "IOPn Identity ready"];

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="card-cute relative overflow-hidden p-8 md:p-12">
        <div className="pointer-events-none absolute -right-6 -top-6 text-[120px] opacity-20">🐶</div>
        <div className="pointer-events-none absolute bottom-2 right-10 animate-float text-5xl">🦴</div>
        <div className="relative max-w-2xl">
          <span className="chip bg-bark-honey/70">🐾 Meme infrastructure, not just a coin</span>
          <h1 className="mt-4 font-display text-5xl font-extrabold leading-tight text-bark-ink md:text-6xl">
            Launch your <span className="text-bark-coral">doge</span> in{" "}
            <span className="text-bark-bubble">seconds</span>.
          </h1>
          <p className="mt-4 text-lg font-semibold text-bark-ink/70">
            Barkpad is the cutest, safest meme launchpad on OPN Chain. Create a token with one click,
            fair-launch it on a bonding curve, and graduate to a locked DEX pool. Much safe. Very wow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/launch" className="btn-coral text-lg">
              🚀 Launch a token
            </Link>
            <Link href="/explore" className="btn-ghost text-lg">
              🔭 Explore tokens
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b} className="chip">
                ✨ {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Live stats from the indexer */}
      <StatsBar />

      {/* Feature grid */}
      <section>
        <h2 className="mb-5 font-display text-3xl font-extrabold">Everything a meme needs 🐕</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="card-cute group p-6 transition-transform hover:-translate-y-1"
            >
              <div className="mb-3 text-4xl transition-transform group-hover:animate-wiggle">{f.emoji}</div>
              <h3 className="font-display text-xl font-extrabold">{f.title}</h3>
              <p className="mt-1 font-semibold text-bark-ink/70">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="card-cute p-8">
        <h2 className="mb-6 font-display text-3xl font-extrabold">How it works 🦴</h2>
        <div className="grid gap-6 md:grid-cols-4">
          {[
            { n: "1", t: "Create", d: "Name your doge, set the curve, pay a tiny fee." },
            { n: "2", t: "Trade", d: "Anyone buys/sells on the bonding curve. Fair pricing." },
            { n: "3", t: "Graduate", d: "Hit the cap → liquidity migrates to a locked DEX pool." },
            { n: "4", t: "Grow", d: "Stake, airdrop, and run quests to grow the pack." },
          ].map((s) => (
            <div key={s.n} className="relative rounded-blob bg-bark-peach/50 p-5">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-bark-ink bg-white font-display text-lg font-extrabold">
                {s.n}
              </div>
              <h3 className="font-display text-lg font-extrabold">{s.t}</h3>
              <p className="font-semibold text-bark-ink/70">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
