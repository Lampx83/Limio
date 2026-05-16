/**
 * Admin-side helpers for managing email templates.
 *
 * Scope model:
 *   - "global" → organizationId = NULL row (1 per key). System default.
 *   - <orgId>  → organizationId = orgId row (per-org override). May not
 *               exist yet; first save creates it (snapshot from global).
 *
 * Editing a global row is restricted to platform admins.
 * Editing an org row is allowed for OrgAdmin of that org OR platform admin.
 * Authorization is enforced at the API route layer; this module assumes
 * the caller has already checked permissions.
 */
import { prisma, type Prisma } from "@feedbackme/db";

export type TemplateScope = "global" | { organizationId: string };

export interface AdminTemplateSummary {
  key: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  /** True when this row exists for the given scope (org-only). */
  overriddenForScope: boolean;
  /** "global" if no org override, else "org". Tells the UI what's effective. */
  effectiveSource: "org" | "global" | "none";
  updatedAt: Date;
  updatedByUserId: string | null;
}

export interface AdminTemplateDetail extends AdminTemplateSummary {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: Array<{
    name: string;
    label: string;
    example: string;
    required?: boolean;
  }>;
}

export interface AdminRevisionSummary {
  id: string;
  subject: string;
  editedAt: Date;
  editedByUserId: string;
  editedByName: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scopeWhere(scope: TemplateScope): Prisma.EmailTemplateWhereInput {
  return scope === "global"
    ? { organizationId: null }
    : { organizationId: scope.organizationId };
}

async function findRow(key: string, scope: TemplateScope) {
  return prisma.emailTemplate.findFirst({
    where: { key, ...scopeWhere(scope) },
  });
}

async function findGlobal(key: string) {
  return prisma.emailTemplate.findFirst({
    where: { key, organizationId: null },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List all templates with effective state for a given scope. */
export async function listTemplatesForScope(
  scope: TemplateScope,
): Promise<AdminTemplateSummary[]> {
  // Load globals as the canonical list of available keys.
  const globals = await prisma.emailTemplate.findMany({
    where: { organizationId: null },
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  if (scope === "global") {
    return globals.map((g) => ({
      key: g.key,
      name: g.name,
      description: g.description,
      category: g.category,
      enabled: g.enabled,
      overriddenForScope: true,
      effectiveSource: "global",
      updatedAt: g.updatedAt,
      updatedByUserId: g.updatedByUserId,
    }));
  }

  const orgRows = await prisma.emailTemplate.findMany({
    where: { organizationId: scope.organizationId },
  });
  const byKey = new Map(orgRows.map((r) => [r.key, r]));

  return globals.map((g) => {
    const org = byKey.get(g.key);
    if (org) {
      return {
        key: g.key,
        name: org.name,
        description: org.description,
        category: org.category,
        enabled: org.enabled,
        overriddenForScope: true,
        effectiveSource: "org",
        updatedAt: org.updatedAt,
        updatedByUserId: org.updatedByUserId,
      };
    }
    return {
      key: g.key,
      name: g.name,
      description: g.description,
      category: g.category,
      enabled: g.enabled,
      overriddenForScope: false,
      effectiveSource: "global",
      updatedAt: g.updatedAt,
      updatedByUserId: null,
    };
  });
}

/**
 * Get full detail for a (key, scope). If scope=org and no override exists,
 * returns the global row's content but flagged effectiveSource="global"
 * and overriddenForScope=false — UI shows "Inherited" label.
 */
export async function getTemplateForScope(
  key: string,
  scope: TemplateScope,
): Promise<AdminTemplateDetail | null> {
  if (scope === "global") {
    const g = await findGlobal(key);
    if (!g) return null;
    return rowToDetail(g, { overriddenForScope: true, effectiveSource: "global" });
  }

  const org = await findRow(key, scope);
  if (org) {
    return rowToDetail(org, { overriddenForScope: true, effectiveSource: "org" });
  }
  const g = await findGlobal(key);
  if (!g) return null;
  return rowToDetail(g, { overriddenForScope: false, effectiveSource: "global" });
}

/**
 * Save subject/body/enabled changes. Creates an org override on first
 * save at org scope. Always writes a revision of the previous values
 * (for rollback). Throws if the template key doesn't exist globally.
 */
export async function saveTemplate(input: {
  key: string;
  scope: TemplateScope;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  enabled: boolean;
  editorUserId: string;
}): Promise<AdminTemplateDetail> {
  const global = await findGlobal(input.key);
  if (!global) throw new Error(`unknown_template_key: ${input.key}`);

  if (input.scope === "global") {
    // Edit the canonical row in place.
    return saveExisting(global.id, input);
  }

  // Org scope: find existing or seed from global.
  const existing = await findRow(input.key, input.scope);
  if (existing) {
    return saveExisting(existing.id, input);
  }

  // First override for this org: create a new row snapshotting global metadata.
  const created = await prisma.emailTemplate.create({
    data: {
      organizationId: input.scope.organizationId,
      key: input.key,
      name: global.name,
      description: global.description,
      category: global.category,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      variables: global.variables as Prisma.InputJsonValue,
      enabled: input.enabled,
      updatedByUserId: input.editorUserId,
    },
  });

  // No revision for the very first creation — there's no "previous" state
  // to roll back to (admin can disable the org row to fall back to global).
  return rowToDetail(created, { overriddenForScope: true, effectiveSource: "org" });
}

async function saveExisting(
  rowId: string,
  input: {
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
    enabled: boolean;
    editorUserId: string;
  },
): Promise<AdminTemplateDetail> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.emailTemplate.findUniqueOrThrow({ where: { id: rowId } });
    // Record previous state as a revision (rollback target).
    await tx.emailTemplateRevision.create({
      data: {
        templateId: rowId,
        subject: before.subject,
        bodyHtml: before.bodyHtml,
        bodyText: before.bodyText,
        editedByUserId: input.editorUserId,
      },
    });
    const updated = await tx.emailTemplate.update({
      where: { id: rowId },
      data: {
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        enabled: input.enabled,
        updatedByUserId: input.editorUserId,
      },
    });
    return rowToDetail(updated, {
      overriddenForScope: true,
      effectiveSource: updated.organizationId == null ? "global" : "org",
    });
  });
}

/**
 * Disable an org override entirely — removes the row so the template falls
 * back to global. No-op on global scope (use saveTemplate with enabled=false
 * to disable a global template instead, though that's almost always wrong).
 */
export async function removeOrgOverride(
  key: string,
  organizationId: string,
): Promise<{ removed: boolean }> {
  const row = await prisma.emailTemplate.findFirst({
    where: { key, organizationId },
    select: { id: true },
  });
  if (!row) return { removed: false };
  await prisma.emailTemplate.delete({ where: { id: row.id } });
  return { removed: true };
}

/** List revisions newest-first. */
export async function listRevisions(
  key: string,
  scope: TemplateScope,
  limit = 50,
): Promise<AdminRevisionSummary[]> {
  const row = await findRow(key, scope);
  if (!row) return [];
  const revs = await prisma.emailTemplateRevision.findMany({
    where: { templateId: row.id },
    orderBy: { editedAt: "desc" },
    take: limit,
    include: { editedBy: { select: { displayName: true } } },
  });
  return revs.map((r) => ({
    id: r.id,
    subject: r.subject,
    editedAt: r.editedAt,
    editedByUserId: r.editedByUserId,
    editedByName: r.editedBy?.displayName ?? null,
  }));
}

/** Restore subject/body from a revision. Records the revert as a new edit. */
export async function revertToRevision(input: {
  key: string;
  scope: TemplateScope;
  revisionId: string;
  editorUserId: string;
}): Promise<AdminTemplateDetail> {
  const row = await findRow(input.key, input.scope);
  if (!row) throw new Error("template_not_found_for_scope");
  const rev = await prisma.emailTemplateRevision.findUnique({
    where: { id: input.revisionId },
  });
  if (!rev || rev.templateId !== row.id) throw new Error("revision_not_found");

  return saveExisting(row.id, {
    subject: rev.subject,
    bodyHtml: rev.bodyHtml,
    bodyText: rev.bodyText,
    enabled: row.enabled,
    editorUserId: input.editorUserId,
  });
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

type RowSnapshot = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: Prisma.JsonValue;
  enabled: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
};

function rowToDetail(
  row: RowSnapshot,
  meta: { overriddenForScope: boolean; effectiveSource: "org" | "global" },
): AdminTemplateDetail {
  // variables is stored as Json; we trust the schema we seeded.
  const vars = (row.variables ?? []) as AdminTemplateDetail["variables"];
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    variables: vars,
    enabled: row.enabled,
    overriddenForScope: meta.overriddenForScope,
    effectiveSource: meta.effectiveSource,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}
