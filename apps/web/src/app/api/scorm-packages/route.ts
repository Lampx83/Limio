import { NextResponse } from "next/server";
import {
  isAdmin,
  listScormPackages,
  ScormError,
  uploadScormPackage,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs"; // adm-zip + fs need Node, not edge.

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const packages = await listScormPackages();
  return NextResponse.json({ packages });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Only instructors (any course) or admin can upload.
  const [admin, anyCourse] = await Promise.all([
    isAdmin(userId),
    prisma.courseInstructor.findFirst({ where: { userId } }),
  ]);
  if (!admin && !anyCourse) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const pkg = await uploadScormPackage(userId, buf, file.name);
    return NextResponse.json(
      { id: pkg.id, title: pkg.title, version: pkg.version, entryHref: pkg.entryHref },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ScormError) {
      const status =
        e.code === "package_too_large"
          ? 413
          : e.code === "manifest_missing" || e.code === "manifest_invalid"
            ? 400
            : e.code === "unsupported_version"
              ? 415
              : 400;
      return NextResponse.json({ error: e.code, details: e.details }, { status });
    }
    throw e;
  }
}
