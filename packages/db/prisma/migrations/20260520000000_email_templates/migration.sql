-- Email Templates: admin-editable transactional email templates.
-- Two tables: EmailTemplate (current state) + EmailTemplateRevision (history).
--
-- Multi-tenancy: organizationId is nullable.
--   - NULL row = global system default (one per `key`).
--   - Non-null row = per-organization override for that `key`.
-- Code looks up in order: (org-specific) → (global) → (hard-coded fallback).

CREATE TABLE "EmailTemplate" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT,
    "key"             TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "category"        TEXT NOT NULL,
    "subject"         TEXT NOT NULL,
    "bodyHtml"        TEXT NOT NULL,
    "bodyText"        TEXT,
    "variables"       JSONB NOT NULL,
    "enabled"         BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- (org, key) uniqueness — Postgres treats NULLs as distinct, so this allows
-- one row per org for each key, plus any number of NULL-org rows. We enforce
-- single global row per key separately via a partial unique index below.
CREATE UNIQUE INDEX "EmailTemplate_organizationId_key_key"
    ON "EmailTemplate"("organizationId", "key");

-- Partial unique index: only one global (NULL org) row per key.
CREATE UNIQUE INDEX "EmailTemplate_global_key_unique"
    ON "EmailTemplate"("key")
    WHERE "organizationId" IS NULL;

CREATE INDEX "EmailTemplate_category_idx" ON "EmailTemplate"("category");
CREATE INDEX "EmailTemplate_key_idx" ON "EmailTemplate"("key");

ALTER TABLE "EmailTemplate"
    ADD CONSTRAINT "EmailTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailTemplate"
    ADD CONSTRAINT "EmailTemplate_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailTemplateRevision" (
    "id"             TEXT NOT NULL,
    "templateId"     TEXT NOT NULL,
    "subject"        TEXT NOT NULL,
    "bodyHtml"       TEXT NOT NULL,
    "bodyText"       TEXT,
    "editedByUserId" TEXT NOT NULL,
    "editedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTemplateRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailTemplateRevision_templateId_editedAt_idx"
    ON "EmailTemplateRevision"("templateId", "editedAt");

ALTER TABLE "EmailTemplateRevision"
    ADD CONSTRAINT "EmailTemplateRevision_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailTemplateRevision"
    ADD CONSTRAINT "EmailTemplateRevision_editedByUserId_fkey"
    FOREIGN KEY ("editedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
