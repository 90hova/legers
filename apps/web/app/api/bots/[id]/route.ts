import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerRequest } from "@/lib/worker";
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id}=await params;const bot=await db.bot.findFirst({where:{id,ownerId:user.id}});if(!bot)return NextResponse.json({error:"Bot not found"},{status:404});
 try{await workerRequest(`/bots/${id}/delete`,{ownerId:user.id});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Worker error"},{status:502});}
 await db.bot.delete({where:{id}});return NextResponse.json({ok:true});
}
