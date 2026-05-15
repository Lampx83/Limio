import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  deleteCohort,
  findOrInviteUserByEmail,
  updateCohort,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function getBaseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  // PR2.14 — Accept `instructorEmail` as alternative to `instructorId`.
  // Resolve email → existing user, or invite if not found.
  let resolvedInstructorId: string | null | undefined;
  let invited = false;
  if (typeof body.instructorEmail === "string") {
    const email = body.instructorEmail.trim();
    if (email === "") {
      resolvedInstructorId = null;
    } else {
      try {
        const result = await findOrInviteUserByEmail({
          email,
          displayName: email.split("@")[0]!,
          baseUrl: getBaseUrl(),
          subject: "Bạn được mời làm GV phụ trách lớp trên FeedBackMe",
          bodyTemplate: ({ name, resetUrl }) => `Xin chào ${name},

Bạn được mời làm giáo viên phụ trách 1 lớp học trên hệ thống FeedBackMe (Limio).

Nhấn link sau để đặt mật khẩu (TTL 1h):
${resetUrl}

Sau khi đặt mật khẩu, đăng nhập tại Limio để xem các lớp bạn được phân công.
`,
        });
        resolvedInstructorId = result.userId;
        invited = result.invited;
      } catch (e) {
        const msg = (e as Error).message;
        return NextResponse.json(
          { error: msg === "invalid_email" ? "invalid_email" : "invite_failed" },
          { status: 400 },
        );
      }
    }
  } else if (body.instructorId === null) {
    resolvedInstructorId = null;
  } else if (typeof body.instructorId === "string") {
    resolvedInstructorId = body.instructorId;
  }

  try {
    await updateCohort(userId, params.id, {
      name: typeof body.name === "string" ? body.name : undefined,
      code:
        body.code === null
          ? null
          : typeof body.code === "string"
            ? body.code
            : undefined,
      instructorId: resolvedInstructorId,
      description:
        body.description === null
          ? null
          : typeof body.description === "string"
            ? body.description
            : undefined,
    });
    return NextResponse.json({ ok: true, invited });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await deleteCohort(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
