import { db, type UserRow, type UserRole } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const SESSION_COOKIE = "fbm_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, userId, expires.toISOString());
  return token;
}

export function deleteSession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getUserByToken(token: string): UserRow | null {
  const row = db
    .prepare(
      `SELECT u.* FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .get(token) as UserRow | undefined;
  return row ?? null;
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserByToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 3600,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function getUserByUsername(username: string): UserRow | null {
  return (db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined) ?? null;
}

export async function requireRole(role: UserRole): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role !== role) throw new Error("FORBIDDEN");
  return user;
}

export async function requireAuth(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export interface ImpersonationInfo {
  original_user_id: number;
  original_username: string;
  original_role: string;
}

export function logAudit(
  actorId: number | null,
  action: string,
  targetType: string | null,
  targetId: number | null,
  payload: Record<string, unknown> = {},
): void {
  db.prepare(
    "INSERT INTO audit_logs (actor_id, action, target_type, target_id, payload) VALUES (?, ?, ?, ?, ?)",
  ).run(actorId, action, targetType, targetId, JSON.stringify(payload));
}

export async function getImpersonation(): Promise<ImpersonationInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT i.original_user_id, u.username AS original_username, u.role AS original_role
       FROM impersonations i JOIN users u ON u.id = i.original_user_id
       WHERE i.session_token = ?`,
    )
    .get(token) as ImpersonationInfo | undefined;
  return row ?? null;
}
