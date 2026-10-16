/**
 * Dải mạng được phép vào thi của một trường — Platform Admin hoặc OrgAdmin của
 * chính trường đó đổi được. Phạm vi và ngữ nghĩa: xem exam/ip-policy.ts.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { parseIpRules } from "../exam/ip-policy";
import { OrgMemberError } from "./members";

export class ExamNetworkValidationError extends Error {
  constructor(public readonly invalid: string[]) {
    super("invalid_ip_rules");
  }
}

/** Tối đa bao nhiêu quy tắc — đủ cho một trường nhiều cơ sở, chặn dán nhầm cả file. */
export const MAX_EXAM_IP_RULES = 100;

export async function getOrgExamNetwork(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db)))
    throw new OrgMemberError("forbidden");
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { examAllowedIps: true },
  });
  if (!org) throw new OrgMemberError("org_not_found");
  return org.examAllowedIps;
}

export async function updateOrgExamNetwork(
  actorUserId: string,
  organizationId: string,
  lines: string[],
  db: PrismaClient = prisma,
): Promise<string[]> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db)))
    throw new OrgMemberError("forbidden");
  const { rules, invalid } = parseIpRules(lines);
  if (invalid.length > 0) throw new ExamNetworkValidationError(invalid);
  if (rules.length > MAX_EXAM_IP_RULES)
    throw new ExamNetworkValidationError([`Tối đa ${MAX_EXAM_IP_RULES} dòng`]);

  const before = await db.organization.findUnique({
    where: { id: organizationId },
    select: { examAllowedIps: true },
  });
  if (!before) throw new OrgMemberError("org_not_found");

  const same =
    before.examAllowedIps.length === rules.length &&
    before.examAllowedIps.every((r, i) => r === rules[i]);
  if (same) return rules;

  await db.organization.update({
    where: { id: organizationId },
    data: { examAllowedIps: rules },
  });
  await logAudit(
    {
      action: "org.exam_network_changed",
      actorUserId,
      payload: { organizationId, from: before.examAllowedIps, to: rules },
    },
    db,
  );
  return rules;
}
