import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "");
const cookieName = "ledgers_session";
export async function createSession(userId: string) {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const token = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("7d").sign(secret);
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
}
export async function getSessionUserId() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || secret.length < 32) return null;
  try { return (await jwtVerify(token, secret)).payload.sub as string; } catch { return null; }
}
export async function destroySession() {
  (await cookies()).set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
