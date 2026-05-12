#!/usr/bin/env node
/**
 * One-time migration: move files from the legacy flat upload layout
 *
 *   apps/web/uploads/{avatars,lesson-images,lesson-videos,lesson-pdfs,exam-assets,assignment-submissions}/*
 *
 * to the new layered, sharded layout
 *
 *   apps/web/uploads/public/avatars/{userId}/{filename}
 *   apps/web/uploads/public/lesson-media/images/{yyyy}/{mm}/{filename}
 *   apps/web/uploads/public/lesson-media/videos/{yyyy}/{mm}/{filename}
 *   apps/web/uploads/public/lesson-media/pdfs/{yyyy}/{mm}/{filename}
 *   apps/web/uploads/public/exam-assets/{yyyy}/{mm}/{filename}
 *   apps/web/uploads/private/submissions/{yyyy}/{mm}/{filename}
 *
 * Safe to re-run (idempotent — skips files already at the destination).
 * Files in the legacy directory are left in place during dry-run; on
 * apply, originals are removed only after a successful copy.
 *
 * Usage:
 *   node scripts/migrate-uploads.mjs            # dry-run, prints plan
 *   node scripts/migrate-uploads.mjs --apply    # actually move files
 *   UPLOADS_ROOT=/var/lib/feedbackme node scripts/migrate-uploads.mjs --apply
 *
 * DB rows are NOT modified — URLs in the database stay flat
 * (`/api/lesson-media/images/<filename>`); the serving routes derive the
 * sharded location from the filename.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT =
  process.env.UPLOADS_ROOT ??
  path.resolve(process.cwd(), "apps", "web", "uploads");

function ym(date) {
  return {
    yyyy: String(date.getUTCFullYear()),
    mm: String(date.getUTCMonth() + 1).padStart(2, "0"),
  };
}

function deriveDestForDateSharded(layer, kind, filename) {
  const m = /-(\d{10,})-[A-Za-z0-9]+\.[A-Za-z0-9]+$/.exec(filename);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  const { yyyy, mm } = ym(new Date(ms));
  return path.join(ROOT, layer, kind, yyyy, mm, filename);
}

function deriveDestForAvatar(filename) {
  const m = /^([A-Za-z0-9_-]+)-[A-Za-z0-9]+\.[A-Za-z0-9]+$/.exec(filename);
  if (!m) return null;
  return path.join(ROOT, "public", "avatars", m[1], filename);
}

const MIGRATIONS = [
  { legacy: "avatars", derive: deriveDestForAvatar },
  {
    legacy: "lesson-images",
    derive: (f) => deriveDestForDateSharded("public", "lesson-media/images", f),
  },
  {
    legacy: "lesson-videos",
    derive: (f) => deriveDestForDateSharded("public", "lesson-media/videos", f),
  },
  {
    legacy: "lesson-pdfs",
    derive: (f) => deriveDestForDateSharded("public", "lesson-media/pdfs", f),
  },
  {
    legacy: "exam-assets",
    derive: (f) => deriveDestForDateSharded("public", "exam-assets", f),
  },
  {
    legacy: "assignment-submissions",
    derive: (f) => deriveDestForDateSharded("private", "submissions", f),
  },
];

async function listFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

let moved = 0;
let skipped = 0;
let unparseable = 0;

for (const { legacy, derive } of MIGRATIONS) {
  const srcDir = path.join(ROOT, legacy);
  const files = await listFiles(srcDir);
  if (files.length === 0) continue;
  console.log(`\n[${legacy}] ${files.length} file(s) in ${srcDir}`);

  for (const filename of files) {
    const dest = derive(filename);
    if (!dest) {
      console.log(`  ! ${filename} — cannot derive destination (skipping)`);
      unparseable++;
      continue;
    }
    const src = path.join(srcDir, filename);

    try {
      await fs.access(dest);
      console.log(`  = ${filename} → already at dest, removing legacy copy`);
      if (APPLY) await fs.unlink(src);
      skipped++;
      continue;
    } catch {
      /* dest missing — proceed */
    }

    console.log(`  → ${filename} → ${path.relative(ROOT, dest)}`);
    if (APPLY) {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    }
    moved++;
  }
}

console.log(
  `\n${APPLY ? "APPLIED" : "DRY-RUN"}: moved=${moved} already-migrated=${skipped} unparseable=${unparseable}`,
);
if (!APPLY) {
  console.log("\nRe-run with --apply to actually move files.");
}
