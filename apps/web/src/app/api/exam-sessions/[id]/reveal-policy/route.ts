import { NextResponse } from "next/server";
import { setSessionRevealPolicy } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Đổi chính sách lộ đáp án của một ca thi.
 *
 * Body: { policy: "immediately" | "never" | "after_close" | null }
 * null = trả về kế thừa gói đề.
 */
const ALLOWED = ["immediately", "never", "after_close"] as const;
type Policy = (typeof ALLOWED)[number];

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { policy?: unknown } | null;
  const raw = body?.policy;
  // Phân biệt null (cố ý trả về kế thừa) với giá trị lạ (từ chối). Nếu gộp hai
  // trường hợp thì gõ sai một chữ sẽ âm thầm reset ca về theo gói đề.
  if (raw !== null && !ALLOWED.includes(raw as Policy)) {
    return NextResponse.json(
      {
        error: "validation_failed",
        details: `policy must be null or one of: ${ALLOWED.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const r = await setSessionRevealPolicy(
      userId,
      params.id,
      raw as Policy | null,
    );
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
