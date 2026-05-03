import { db } from "./db";

export type EventType =
  | "page_view"
  | "assignment_open"
  | "assignment_focus"
  | "assignment_blur"
  | "assignment_paste"
  | "assignment_keystroke_batch"
  | "assignment_submit"
  | "feedback_view"
  | "feedback_metacog_response"
  | "ls_complete"
  | "srl_pre_complete"
  | "srl_post_complete";

export function logEvent(
  userId: number,
  eventType: EventType,
  assignmentId: number | null,
  payload: Record<string, unknown> = {},
): void {
  db.prepare(
    "INSERT INTO behavioral_logs (user_id, assignment_id, event_type, payload) VALUES (?, ?, ?, ?)",
  ).run(userId, assignmentId, eventType, JSON.stringify(payload));
}
