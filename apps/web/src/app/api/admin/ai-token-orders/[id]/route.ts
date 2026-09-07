import { NextResponse } from "next/server";
import {
  TokenOrderError,
  cancelTokenOrder,
  confirmTokenOrder,
} from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Admin đối soát một đơn. Body: { action: "confirm" | "cancel", note? }.
 *
 * `credited: false` trong kết quả confirm nghĩa là đơn này đã được cộng token
 * từ trước — không phải lỗi, chỉ là bấm hai lần.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await readJson(req)) as
    | { action?: "confirm" | "cancel"; note?: string }
    | null;
  if (body?.action !== "confirm" && body?.action !== "cancel") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    if (body.action === "confirm") {
      const r = await confirmTokenOrder(params.id, userId);
      return NextResponse.json({ ok: true, ...r });
    }
    await cancelTokenOrder(params.id, userId, body.note ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TokenOrderError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: e.code === "order_not_found" ? 404 : 409 },
      );
    }
    throw e;
  }
}
