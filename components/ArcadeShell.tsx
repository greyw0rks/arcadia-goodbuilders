import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { ArcadeIcon, type ArcadeIconName } from "./ArcadeIcon";

const destinations: { href: string; label: string; icon: ArcadeIconName }[] = [
  { href: "/", label: "Home", icon: "home" }, { href: "/app", label: "Play", icon: "play" },
  { href: "/tournaments", label: "Tournaments", icon: "trophy" }, { href: "/leaderboard", label: "Rankings", icon: "rank" },
  { href: "/rewards", label: "Rewards", icon: "reward" }, { href: "/profile", label: "Profile", icon: "profile" },
];
export function ArcadeShell({ active, children, wallet, playing = false, className = "" }: {
  active: string; children: React.ReactNode; wallet: React.ReactNode; playing?: boolean; className?: string;
}) {
  return <div className={`arcade-shell ${className}${playing ? " is-playing-trivia" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="arcade-sidebar">
      <Link href="/" className="wordmark" aria-label="Arcadia home"><BrandLogo /><img className="sidebar-mark" src="/brand/arcadia-mark-violet.svg" alt="" width="36" height="36" /></Link>
      <nav aria-label="Game navigation">{destinations.map(item => <Link key={item.href} href={item.href} aria-label={item.label} aria-current={active === item.href ? "page" : undefined}><ArcadeIcon name={item.icon} /><span>{item.label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><img src="/brand/arcadia-mark-violet.svg" alt="" width="34" height="34" /><p>A little play.<br />A good day.</p><a href="https://celo.arcadia.uno">Original Celo arcade ↗</a></div>
    </aside>
    <div className="arcade-workspace">
      <header className="app-header arcade-topbar"><Link className="mobile-wordmark" href="/" aria-label="Arcadia home"><img src="/brand/arcadia-mark-violet.svg" alt="" width="36" height="36" /></Link><span className="topbar-greeting">Make today a good run.</span><div className="topbar-actions"><Link className="topbar-rewards" href="/rewards" aria-label="Rewards"><ArcadeIcon name="reward" size={18} /><span>Rewards</span></Link>{wallet}</div></header>
      <main id="main-content" className="arcade-content">{children}</main>
      <footer className="arcade-footer"><span>Made for curious minds.</span><Link href="/tournaments#xp-rules">How XP works</Link><span>Daily reset · 00:00 UTC</span></footer>
    </div>
    <nav className="arcade-bottom-nav" aria-label="Mobile navigation">{destinations.filter(item => item.href !== "/rewards").map(item => <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}><ArcadeIcon name={item.icon} size={21} /><span>{item.label}</span></Link>)}</nav>
  </div>;
}
