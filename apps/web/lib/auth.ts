import { getSessionUserId } from "./session";
import { db } from "./db";
export async function currentUser() {
  const id = await getSessionUserId();
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}
