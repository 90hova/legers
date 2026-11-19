import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import BotManager from "./ui";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/");
  const bots = await db.bot.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } });
  return <main className="shell">
    <header className="top"><a className="brand" href="/">LEDGERS<span>.</span></a><div className="row"><span className="muted">{user.username}</span><form action="/api/auth/logout" method="post"><button className="btn">Log out</button></form></div></header>
    <section className="hero"><div className="eyebrow">CONTROL CENTER / OVERVIEW</div><h1>Bot dashboard</h1><p>Manage your deployments, inspect logs, and keep your services healthy.</p></section>
    <BotManager initialBots={bots.map(b=>({id:b.id,name:b.name,runtime:b.runtime,status:b.status,createdAt:b.createdAt.toISOString()}))}/>
  </main>;
}
