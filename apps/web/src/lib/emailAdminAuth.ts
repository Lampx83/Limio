/**
 * Shared auth + scope-parsing for /api/admin/emails/* routes.
 *
 * Scope query param: ?scope=global | <orgId>
 *   - "global" → platform admin only.
 *   - <orgId>  → OrgAdmin of that org (or platform admin).
 */
import { NextResponse } from "next/server";
import type { TemplateScope } from "@feedbackme/core-lms";
import { isAdmin, isOrgAdminOf } from "@feedbackme/core-lms";
import { requireUserId } from "./session";

export type ScopeAccess =
  | { ok: true; userId: string; scope: TemplateScope }
  | { ok: false; response: NextResponse };

export async function requireScopeAccess(
  scopeParam: string | null,
): Promise<ScopeAccess> {
  const userId = await requireUserId();
  if (!userId)
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };

  // Default to global if no scope provided.
  const raw = (scopeParam ?? "global").trim();

  if (raw === "global") {
    if (!(await isAdmin(userId))) {
      return {
        ok: false,
        response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      };
    }
    return { ok: true, userId, scope: "global" };
  }

  // Org scope. raw is the orgId.
  if (!(await isOrgAdminOf(userId, raw))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, userId, scope: { organizationId: raw } };
}
