import { NextResponse } from "next/server";
import { listOrdersForAdmin } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const raw = new URL(req.url).searchParams.get("status") ?? "pending";
  const status = (["pending", "paid", "cancelled", "all"] as const).includes(
    raw as "pending",
  )
    ? (raw as "pending" | "paid" | "cancelled" | "all")
    : "pending";
  return NextResponse.json({ orders: await listOrdersForAdmin(status) });
}
