"use client";
import { useCallback, useEffect, useState } from "react";
type Bot={id:string;name:string;runtime:string;status:string;createdAt:string};
export default function BotManager({initialBots}:{initialBots:Bot[]}) {
 const [bots,setBots]=useState(initialBots),[name,setName]=useState(""),[runtime,setRuntime]=useState("node"),[token,setToken]=useState(""),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[logs,setLogs]=useState<Record<string,string>>({});
 const refresh=useCallback(async()=>{const r=await fetch("/api/bots");if(r.ok){const d=await r.json();setBots(d.bots)}},[]);
 useEffect(()=>{const t=setInterval(refresh,7000);return()=>clearInterval(t)},[refresh]);
 async function addBot(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");try{
  let r:Response;
  if(file){const fd=new FormData();fd.set("name",name);fd.set("runtime",runtime);fd.set("file",file);r=await fetch("/api/bots/upload",{method:"POST",body:fd});}
  else {r=await fetch("/api/bots",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,runtime,token})});}
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not create bot");setName("");setToken("");setFile(null);setMessage("Bot added.");await refresh();
 }catch(e){setMessage(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}}
 async function act(id:string,action:string){setBusy(true);try{const r=await fetch(`/api/bots/${id}/${action}`,{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Action failed");await refresh()}catch(e){setMessage(e instanceof Error?e.message:"Action failed")}finally{setBusy(false)}}
 async function showLogs(id:string){const r=await fetch(`/api/bots/${id}/logs`);const d=await r.json();setLogs(p=>({...p,[id]:d.logs||d.error||"No logs"}))}
 async function remove(id:string){if(!confirm("Delete this bot and its runtime container?"))return;const r=await fetch(`/api/bots/${id}`,{method:"DELETE"});if(r.ok)refresh();else setMessage("Delete failed")}
 return <>
  <section className="grid"><div className="panel"><div className="muted">TOTAL BOTS</div><div className="stat">{bots.length}</div></div><div className="panel"><div className="muted">ONLINE</div><div className="stat">{bots.filter(b=>b.status==="running").length}</div></div><div className="panel"><div className="muted">RUNTIMES</div><div className="stat">{new Set(bots.map(b=>b.runtime)).size}</div></div></section>
  <section className="section panel"><h2>Deploy a bot</h2><p className="muted">Choose ZIP upload or configure a bot token. ZIP files must contain the entry point at their root.</p>
   <form onSubmit={addBot}>
    <div className="grid"><div className="field"><label>BOT NAME</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder="My Discord bot"/></div><div className="field"><label>RUNTIME</label><select value={runtime} onChange={e=>setRuntime(e.target.value)}><option value="node">Node.js</option><option value="python">Python</option></select></div></div>
    <div className="field"><label>BOT TOKEN (optional for ZIP upload)</label><input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste token only if your bot reads LEDGERS_BOT_TOKEN"/></div>
    <div className="field"><label>PROJECT ZIP (optional)</label><input type="file" accept=".zip,application/zip" onChange={e=>setFile(e.target.files?.[0]||null)}/></div>
    <div className="notice">Never hardcode a token into uploaded source. If supplied here, LEDGERS injects it as an environment variable named <code>LEDGERS_BOT_TOKEN</code>.</div>
    <div style={{marginTop:14}}><button className="btn primary" disabled={busy}>{busy?"Working…":"Add bot"}</button></div>
   </form>{message&&<p className="muted">{message}</p>}
  </section>
  <section className="section"><div className="row"><h2>Your bots</h2><span className="muted">{bots.length} deployment(s)</span></div>
   {!bots.length?<div className="panel empty">No bots yet. Add your first deployment above.</div>:<div className="grid">{bots.map(bot=><article className="panel" key={bot.id}>
    <div className="row"><div className="bot"><div className="orb">{bot.name.slice(0,1).toUpperCase()}</div><div><b>{bot.name}</b><div className="muted" style={{fontSize:12}}>{bot.runtime.toUpperCase()}</div></div></div><span className={`pill ${bot.status==="running"?"online":""}`}>{bot.status}</span></div>
    <div className="actions" style={{marginTop:18}}><button className="btn primary" disabled={busy} onClick={()=>act(bot.id,"start")}>Start</button><button className="btn" disabled={busy} onClick={()=>act(bot.id,"stop")}>Stop</button><button className="btn" disabled={busy} onClick={()=>act(bot.id,"restart")}>Restart</button><button className="btn" onClick={()=>showLogs(bot.id)}>Logs</button><button className="btn danger" onClick={()=>remove(bot.id)}>Delete</button></div>
    {logs[bot.id]!==undefined&&<div className="logs" style={{marginTop:12}}>{logs[bot.id]}</div>}
   </article>)}</div>}
  </section>
 </>;
}
