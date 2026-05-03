import { prisma } from "@feedbackme/db";
import type { DbClient } from "./tokens";

export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  payload: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorUserId: entry.actorUserId ?? null,
      targetUserId: entry.targetUserId ?? null,
      payload: entry.payload as object,
    },
  });
}
