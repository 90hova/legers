import express from "express";
import Docker from "dockerode";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const app=express();
app.use(express.json({limit:"20mb"}));
const docker=new Docker({socketPath:"/var/run/docker.sock"});
const secret=process.env.WORKER_SHARED_SECRET||"";
const root=path.resolve(process.env.BOT_DATA_DIR||"/data/bots");
const maxMemory=Number(process.env.MAX_BOT_MEMORY_MB||256)*1024*1024;
const maxCpus=Number(process.env.MAX_BOT_CPUS||0.5);
const maxPids=Number(process.env.MAX_BOT_PIDS||128);
const containers=new Map();
if(secret.length<32) throw new Error("WORKER_SHARED_SECRET must be at least 32 characters");
await fs.mkdir(root,{recursive:true});

app.use((req,res,next)=>{
 if(req.path==="/health")return next();
 const supplied=req.header("x-ledgers-secret")||"";
 const a=Buffer.from(supplied),b=Buffer.from(secret);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:"Unauthorized"});
 next();
});
app.get("/health",(_req,res)=>res.json({ok:true,service:"ledgers-worker"}));

function validId(id){return typeof id==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)}
async function owned(id,ownerId){
 if(!validId(id)||typeof ownerId!=="string"||!ownerId)return null;
 const dir=path.join(root,id);
 try{const meta=JSON.parse(await fs.readFile(path.join(dir,"meta.json"),"utf8"));return meta.ownerId===ownerId?{dir,meta}:null}catch{return null}
}
function safeExtract(zipBuffer,dest){
 const zip=new AdmZip(zipBuffer),entries=zip.getEntries();
 if(entries.length>500)throw new Error("Archive contains too many files");
 for(const entry of entries){
  const name=entry.entryName.replace(/\\/g,"/");
  if(name.startsWith("/")||name.split("/").includes(".."))throw new Error("Unsafe archive path");
  if(entry.isDirectory)continue;
  const target=path.resolve(dest,name);
  if(!target.startsWith(dest+path.sep))throw new Error("Unsafe archive path");
  const data=entry.getData();if(data.length>15*1024*1024)throw new Error("Archive entry too large");
  // Avoid overwriting platform metadata or Docker-related files.
  if([".env","meta.json","Dockerfile","docker-compose.yml"].includes(path.basename(name)))throw new Error("Reserved filename in archive");
  return {target,data};
 }
}
async function extractAll(buffer,dest){
 const zip=new AdmZip(buffer),entries=zip.getEntries();
 if(entries.length>500)throw new Error("Archive contains too many files");
 for(const entry of entries){
  const name=entry.entryName.replace(/\\/g,"/");
  if(name.startsWith("/")||name.split("/").includes(".."))throw new Error("Unsafe archive path");
  if(entry.isDirectory)continue;
  const target=path.resolve(dest,name);
  if(!target.startsWith(dest+path.sep))throw new Error("Unsafe archive path");
  const data=entry.getData();if(data.length>15*1024*1024)throw new Error("Archive entry too large");
  if([".env","meta.json","Dockerfile","docker-compose.yml"].includes(path.basename(name)))throw new Error("Reserved filename in archive");
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data,{mode:0o600});
 }
}

app.post("/bots/create",async(req,res)=>{
 const {botId,ownerId,name,runtime}=req.body||{};
 if(!validId(botId)||!ownerId||!["node","python"].includes(runtime))return res.status(400).json({error:"Invalid bot configuration"});
 const dir=path.join(root,botId),appDir=path.join(dir,"app");
 try{
  await fs.mkdir(appDir,{recursive:true});
  if(runtime==="node"){
   await fs.writeFile(path.join(appDir,"index.js"),'const { Client, GatewayIntentBits } = require("discord.js");\nconst client = new Client({ intents: [GatewayIntentBits.Guilds] });\nclient.once("ready", () => console.log(`Logged in as ${client.user.tag}`));\nclient.login(process.env.LEDGERS_BOT_TOKEN);\n');
   await fs.writeFile(path.join(appDir,"package.json"),JSON.stringify({name:"ledgers-discord-bot",version:"1.0.0",private:true,scripts:{start:"node index.js"},dependencies:{"discord.js":"^14.19.3"}},null,2));
  }else{
   await fs.writeFile(path.join(appDir,"index.py"),'import os\nimport discord\n\nintents = discord.Intents.default()\nclient = discord.Client(intents=intents)\n\n@client.event\nasync def on_ready():\n    print(f"Logged in as {client.user}")\n\nclient.run(os.environ["LEDGERS_BOT_TOKEN"])\n');
   await fs.writeFile(path.join(appDir,"requirements.txt"),"discord.py>=2.4,<3\n");
  }
  await fs.writeFile(path.join(dir,"meta.json"),JSON.stringify({ownerId,name,runtime,entry:runtime==="node"?"index.js":"index.py",uploadedAt:new Date().toISOString()}));
  res.status(201).json({sourcePath:appDir,workerId:"docker-worker"});
 }catch(e){await fs.rm(dir,{recursive:true,force:true});res.status(500).json({error:e.message||"Could not create starter bot"});}
});
app.post("/bots/upload",async(req,res)=>{
 const {botId,ownerId,name,runtime,zip}=req.body||{};
 if(!validId(botId)||!ownerId||!["node","python"].includes(runtime)||typeof zip!=="string")return res.status(400).json({error:"Invalid upload"});
 const buffer=Buffer.from(zip,"base64");if(!buffer.length||buffer.length>10*1024*1024)return res.status(413).json({error:"Invalid or oversized archive"});
 const dir=path.join(root,botId);
 try{
  await fs.mkdir(dir,{recursive:false});await extractAll(buffer,path.join(dir,"app"));
  const appDir=path.join(dir,"app");
  const entry=runtime==="node"?"index.js":"index.py";
  const stat=await fs.stat(path.join(appDir,entry)).catch(()=>null);
  if(!stat?.isFile())throw new Error(`ZIP must contain ${entry} at its root`);
  await fs.writeFile(path.join(dir,"meta.json"),JSON.stringify({ownerId,name,runtime,entry,uploadedAt:new Date().toISOString()}));
  res.status(201).json({sourcePath:appDir,workerId:"docker-worker"});
 }catch(e){await fs.rm(dir,{recursive:true,force:true});res.status(400).json({error:e.message||"Upload failed"});}
});
async function createBotContainer(id,meta,token){
 const image=meta.runtime==="node"?"node:22-alpine":"python:3.12-alpine";
 await new Promise((resolve,reject)=>docker.pull(image,(err,stream)=>{if(err)return reject(err);docker.modem.followProgress(stream,e=>e?reject(e):resolve());}));
 const appDir=path.join(root,id,"app");
 const cmd=meta.runtime==="node"
  ? ["sh","-lc","if [ -f package.json ]; then npm install --omit=dev --no-audit --no-fund; fi; exec node "+meta.entry]
  : ["sh","-lc","if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi; exec python "+meta.entry];
 const container=await docker.createContainer({Image:image,Cmd:cmd,WorkingDir:"/app",Env:[`LEDGERS_BOT_TOKEN=${token||""}`,"NODE_ENV=production","PYTHONUNBUFFERED=1"],
  HostConfig:{Binds:[`${appDir}:/app:ro`],Memory:maxMemory,NanoCpus:Math.floor(maxCpus*1e9),PidsLimit:maxPids,ReadonlyRootfs:true,NetworkMode:"bridge",
   CapDrop:["ALL"],SecurityOpt:["no-new-privileges:true"],Tmpfs:{"/tmp":"rw,noexec,nosuid,size=64m"} ,RestartPolicy:{Name:"unless-stopped"}},
  Labels:{"ledgers.botId":id}});
 await container.start();containers.set(id,container);return container;
}
async function action(req,res,kind){
 const {id}=req.params,ownerId=req.body?.ownerId,record=await owned(id,ownerId);
 if(!record)return res.status(404).json({error:"Bot not found"});
 try{
  let c=containers.get(id);if(!c)c=docker.getContainer(id);
  if(kind==="start"||kind==="restart"){
   if(kind==="restart"&&c){await c.stop().catch(()=>{});await c.remove().catch(()=>{});containers.delete(id);c=null;}
   if(c){const info=await c.inspect().catch(()=>null);if(info?.State?.Running)return res.json({ok:true,workerId:"docker-worker"});await c.remove().catch(()=>{});}
   c=await createBotContainer(id,record.meta,req.body?.token||"");
  }else if(kind==="stop"){
   await c.stop().catch(e=>{if(e.statusCode!==304&&e.statusCode!==404)throw e});await c.remove().catch(()=>{});containers.delete(id);
  }
  res.json({ok:true,workerId:"docker-worker"});
 }catch(e){res.status(500).json({error:e.message||"Container operation failed"});}
}
for(const a of ["start","stop","restart"])app.post(`/bots/:id/${a}`,(req,res)=>action(req,res,a));
app.post("/bots/:id/delete",async(req,res)=>{
 const record=await owned(req.params.id,req.body?.ownerId);if(!record)return res.status(404).json({error:"Bot not found"});
 try{const c=containers.get(req.params.id);if(c){await c.stop().catch(()=>{});await c.remove().catch(()=>{});containers.delete(req.params.id);}
  // Also remove a container left behind after a worker restart.
  const all=await docker.listContainers({all:true,filters:{label:[`ledgers.botId=${req.params.id}`]}});
  for(const item of all){const x=docker.getContainer(item.Id);await x.remove({force:true}).catch(()=>{});}
  await fs.rm(record.dir,{recursive:true,force:true});res.json({ok:true});
 }catch(e){res.status(500).json({error:e.message||"Delete failed"});}
});
app.post("/bots/:id/logs",async(req,res)=>{
 const record=await owned(req.params.id,req.body?.ownerId);if(!record)return res.status(404).json({error:"Bot not found"});
 try{const all=await docker.listContainers({all:true,filters:{label:[`ledgers.botId=${req.params.id}`]}});
  if(!all.length)return res.json({logs:"No container logs yet."});
  const c=docker.getContainer(all[0].Id),raw=await c.logs({stdout:true,stderr:true,tail:100,timestamps:true});
  res.json({logs:raw.toString("utf8").slice(-16000)});
 }catch(e){res.status(500).json({error:e.message||"Could not read logs"});}
});
app.listen(Number(process.env.WORKER_PORT||8787),"0.0.0.0",()=>console.log("LEDGERS worker listening"));
