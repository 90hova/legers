import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
export async function GET(req:NextRequest) {
 const code=req.nextUrl.searchParams.get("code"),state=req.nextUrl.searchParams.get("state");
 const saved=req.cookies.get("ledgers_oauth_state")?.value;
 if(!code||!state||!saved||state!==saved)return NextResponse.json({error:"Invalid OAuth state"},{status:400});
 const tokenRes=await fetch("https://discord.com/api/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID||"",client_secret:process.env.DISCORD_CLIENT_SECRET||"",grant_type:"authorization_code",code,redirect_uri:process.env.DISCORD_REDIRECT_URI||""})});
 if(!tokenRes.ok)return NextResponse.json({error:"Discord token exchange failed"},{status:502});
 const token=await tokenRes.json() as {access_token:string};
 const profileRes=await fetch("https://discord.com/api/users/@me",{headers:{authorization:`Bearer ${token.access_token}`}});
 if(!profileRes.ok)return NextResponse.json({error:"Could not load Discord profile"},{status:502});
 const profile=await profileRes.json() as {id:string;username:string;avatar:string|null};
 const user=await db.user.upsert({where:{discordId:profile.id},create:{discordId:profile.id,username:profile.username,avatar:profile.avatar},update:{username:profile.username,avatar:profile.avatar}});
 await createSession(user.id);
 const res=NextResponse.redirect(new URL("/dashboard",req.url));res.cookies.set("ledgers_oauth_state","",{maxAge:0,path:"/"});return res;
}
