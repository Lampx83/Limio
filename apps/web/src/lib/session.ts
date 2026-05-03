import { auth } from "./auth";
import { isAdmin } from "@feedbackme/core-lms";

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireAdmin(): Promise<string | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const ok = await isAdmin(userId);
  return ok ? userId : null;
}
