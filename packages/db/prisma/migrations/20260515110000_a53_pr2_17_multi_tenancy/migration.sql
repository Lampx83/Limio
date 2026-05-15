-- A5.3 PR2.17 — Multi-tenancy: Organization + OrgAdmin + SessionTemplate.

-- ====================================================================
-- 1. Organization + OrganizationAdmin tables
-- ====================================================================
CREATE TABLE "Organization" (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  locale          TEXT NOT NULL DEFAULT 'vi',
  timezone        TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "brandingLogoUrl" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Organization_code_idx" ON "Organization"(code);

CREATE TABLE "OrganizationAdmin" (
  "organizationId"  TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "grantedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedByUserId" TEXT,

  CONSTRAINT "OrganizationAdmin_pkey" PRIMARY KEY ("organizationId", "userId"),
  CONSTRAINT "OrganizationAdmin_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationAdmin_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrganizationAdmin_userId_idx" ON "OrganizationAdmin"("userId");

-- ====================================================================
-- 2. ExamSessionTemplate
-- ====================================================================
CREATE TABLE "ExamSessionTemplate" (
  id              TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  "startTime"     TEXT NOT NULL,
  "endTime"       TEXT NOT NULL,
  "orderIndex"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExamSessionTemplate_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExamSessionTemplate_organizationId_code_key"
  ON "ExamSessionTemplate"("organizationId", code);
CREATE INDEX "ExamSessionTemplate_organizationId_orderIndex_idx"
  ON "ExamSessionTemplate"("organizationId", "orderIndex");

-- ====================================================================
-- 3. Add organizationId to User + Course
-- ====================================================================
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

ALTER TABLE "Course" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Course_organizationId_idx" ON "Course"("organizationId");

-- ====================================================================
-- 4. Default Organization "Đại học Bách khoa Hà Nội" (BKHN)
--    Backfill mọi User + Course đang null sang org này.
-- ====================================================================
DO $$
DECLARE
  bkhn_id TEXT;
BEGIN
  INSERT INTO "Organization" (id, code, name, locale, timezone, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'BKHN', 'Đại học Bách khoa Hà Nội', 'vi', 'Asia/Ho_Chi_Minh', now(), now())
  RETURNING id INTO bkhn_id;

  UPDATE "User" SET "organizationId" = bkhn_id WHERE "organizationId" IS NULL;
  UPDATE "Course" SET "organizationId" = bkhn_id WHERE "organizationId" IS NULL;
END $$;

-- ====================================================================
-- 5. Add "org_admin" role to Role table (UserRole linkable via existing pattern).
--    Note: cross-org OrgAdmin assignment goes through OrganizationAdmin bridge,
--    not UserRole — but we still need the role to exist for UserRole queries.
-- ====================================================================
INSERT INTO "Role" (id, name, description)
SELECT gen_random_uuid()::text, 'org_admin', 'Quản trị viên trường (Organization Admin)'
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'org_admin');

-- ====================================================================
-- 6. Pre-assign Alice (Demo Instructor) as Org Admin of BKHN.
-- ====================================================================
DO $$
DECLARE
  bkhn_id TEXT;
  alice_id TEXT;
BEGIN
  SELECT id INTO bkhn_id FROM "Organization" WHERE code = 'BKHN';
  SELECT id INTO alice_id FROM "User" WHERE email = 'alice@feedbackme.dev';
  IF bkhn_id IS NOT NULL AND alice_id IS NOT NULL THEN
    INSERT INTO "OrganizationAdmin" ("organizationId", "userId", "grantedAt")
    VALUES (bkhn_id, alice_id, now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
