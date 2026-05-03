import { NextResponse } from "next/server";
import {
  H5pError,
  isAdmin,
  listH5pPackages,
  uploadH5pPackage,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const packages = await listH5pPackages();
  return NextResponse.json({ packages });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    const pkg = await uploadH5pPackage(userId, buf, file.name);
    return NextResponse.json(
      { id: pkg.id, title: pkg.title, mainLibrary: pkg.mainLibrary },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof H5pError) {
      const status =
        e.code === "package_too_large"
          ? 413
          : e.code === "h5p_json_missing" || e.code === "h5p_json_invalid"
            ? 400
            : 400;
      return NextResponse.json({ error: e.code, details: e.details }, { status });
    }
    throw e;
  }
}
