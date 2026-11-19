import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerRequest } from "@/lib/worker";
import { decrypt } from "@/lib/crypto";
export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string;action:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id,action}=await params;if(!["start","stop","restart"].includes(action))return NextResponse.json({error:"Invalid action"},{status:400});
 const bot=await db.bot.findFirst({where:{id,ownerId:user.id}});if(!bot)return NextResponse.json({error:"Bot not found"},{status:404});
 try{
  const result=await workerRequest(`/bots/${id}/${action}`,{ownerId:user.id,token:bot.tokenCipher?decrypt(bot.tokenCipher):""});
  await db.bot.update({where:{id},data:{status:action==="stop"?"stopped":"running",workerId:result.workerId||bot.workerId}});
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Worker error"},{status:502});}
}
