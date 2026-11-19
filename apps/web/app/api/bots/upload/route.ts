import { NextRequest,NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerRequest } from "@/lib/worker";
import { encrypt } from "@/lib/crypto";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(req:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const count=await db.bot.count({where:{ownerId:user.id}});if(count>=Number(process.env.MAX_BOTS_PER_USER||5))return NextResponse.json({error:"Bot limit reached"},{status:429});
 const form=await req.formData(),file=form.get("file"),name=String(form.get("name")||"").trim().slice(0,48),runtime=String(form.get("runtime")||"");
 if(!(file instanceof File)||!name||!["node","python"].includes(runtime))return NextResponse.json({error:"A ZIP, name, and valid runtime are required"},{status:400});
 const max=Number(process.env.MAX_UPLOAD_BYTES||10485760);if(file.size>max)return NextResponse.json({error:"ZIP exceeds upload limit"},{status:413});
 if(!file.name.toLowerCase().endsWith(".zip"))return NextResponse.json({error:"Only ZIP uploads are supported"},{status:400});
 const bot=await db.bot.create({data:{ownerId:user.id,name,runtime,entrypoint:runtime==="node"?"index.js":"index.py"}});
 try{
  const bytes=Buffer.from(await file.arrayBuffer());
  const result=await workerRequest("/bots/upload",{botId:bot.id,ownerId:user.id,name,runtime,zip:bytes.toString("base64")});
  await db.bot.update({where:{id:bot.id},data:{sourcePath:result.sourcePath,workerId:result.workerId}});
  return NextResponse.json({bot:{id:bot.id,name,runtime,status:bot.status}},{status:201});
 }catch(e){await db.bot.delete({where:{id:bot.id}});return NextResponse.json({error:e instanceof Error?e.message:"Upload failed"},{status:502});}
}
