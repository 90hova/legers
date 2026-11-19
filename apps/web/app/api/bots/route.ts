import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { workerRequest } from "@/lib/worker";
export const runtime="nodejs";
export async function GET(){const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const bots=await db.bot.findMany({where:{ownerId:user.id},orderBy:{createdAt:"desc"}});return NextResponse.json({bots:bots.map(({tokenCipher,...b})=>b)});}
export async function POST(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const count=await db.bot.count({where:{ownerId:user.id}});if(count>=Number(process.env.MAX_BOTS_PER_USER||5))return NextResponse.json({error:"Bot limit reached"},{status:429});
 const body=await req.json();const name=String(body.name||"").trim().slice(0,48),runtime=body.runtime;
 if(!name||!["node","python"].includes(runtime))return NextResponse.json({error:"Name and supported runtime are required"},{status:400});
 const token=typeof body.token==="string"?body.token.trim():"";
 if(token.length>256)return NextResponse.json({error:"Invalid token length"},{status:400});
 const bot=await db.bot.create({data:{ownerId:user.id,name,runtime,entrypoint:runtime==="node"?"index.js":"index.py",tokenCipher:token?encrypt(token):null}});
 try {
  const result=await workerRequest("/bots/create",{botId:bot.id,ownerId:user.id,name,runtime});
  await db.bot.update({where:{id:bot.id},data:{sourcePath:result.sourcePath,workerId:result.workerId}});
  return NextResponse.json({bot:{id:bot.id,name:bot.name,runtime:bot.runtime,status:bot.status}}, {status:201});
 } catch(e) {
  await db.bot.delete({where:{id:bot.id}});
  return NextResponse.json({error:e instanceof Error?e.message:"Worker error"},{status:502});
 }
}
