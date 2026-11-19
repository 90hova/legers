import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
export async function GET() {
 const client=process.env.DISCORD_CLIENT_ID, redirect=process.env.DISCORD_REDIRECT_URI;
 if(!client||!redirect)return NextResponse.json({error:"Discord OAuth is not configured"},{status:500});
 const state=randomBytes(24).toString("hex");
 const url=new URL("https://discord.com/oauth2/authorize");
 url.searchParams.set("client_id",client);url.searchParams.set("redirect_uri",redirect);
 url.searchParams.set("response_type","code");url.searchParams.set("scope","identify");url.searchParams.set("state",state);
 const res=NextResponse.redirect(url);res.cookies.set("ledgers_oauth_state",state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600});return res;
}
