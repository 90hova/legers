import Link from "next/link";
import { currentUser } from "@/lib/auth";
export default async function Home() {
  const user = await currentUser();
  return <main className="shell">
    <header className="top"><div className="brand">LEDGERS<span>.</span></div>
      {user ? <Link className="btn primary" href="/dashboard">Open dashboard</Link> : <a className="btn primary" href="/api/auth/discord">Continue with Discord</a>}
    </header>
    <section className="hero"><div className="eyebrow">DISCORD BOT INFRASTRUCTURE</div><h1>Your bots.<br/>Your control room.</h1>
      <p>Deploy, monitor, and manage your Discord bots from one clean workspace. Upload a project or configure a bot directly. LEDGERS keeps the control panel online while dedicated workers run your bots.</p>
      <a className="btn primary" href={user ? "/dashboard" : "/api/auth/discord"}>{user ? "Go to dashboard" : "Get started with Discord"} →</a>
    </section>
    <section className="grid">
      {["Multiple bot runtimes","Live process controls","Private token handling"].map((x,i)=><div className="panel" key={x}><div className="eyebrow">0{i+1} / PLATFORM</div><h3>{x}</h3><p className="muted">Manage your bot fleet from a single dashboard with clear status and operational controls.</p></div>)}
    </section>
    <p className="muted" style={{fontSize:12,marginTop:50}}>LEDGERS is an independent project and is not affiliated with Discord or VaultCord.</p>
  </main>;
}
