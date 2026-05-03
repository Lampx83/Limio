import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logEvent, type EventType } from "@/lib/log";

const ALLOWED: EventType[] = [
  "page_view",
  "assignment_open",
  "assignment_focus",
  "assignment_blur",
  "assignment_paste",
  "assignment_keystroke_batch",
  "assignment_submit",
  "feedback_view",
  "feedback_metacog_response",
];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  let body: {
    event_type?: string;
    assignment_id?: number | null;
    payload?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const evt = body.event_type as EventType;
  if (!ALLOWED.includes(evt)) {
    return NextResponse.json({ error: "Loại sự kiện không hợp lệ" }, { status: 400 });
  }
  logEvent(
    user.id,
    evt,
    body.assignment_id ?? null,
    body.payload ?? {},
  );
  return NextResponse.json({ ok: true });
}
