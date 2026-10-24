import type { Job } from "bullmq";
import { sendApprovedNotes, sendMeetingSummary } from "@feedbackme/core-lms";
import { recordMeetingNoteDelivery } from "@feedbackme/core-feedback";
import { SITE_URL } from "@/lib/seo";
import { getClassMailQueue, QUEUE_NAMES } from "./index";

/**
 * CENTER C4.17 — gửi email tổng kết chung và nhận xét cá nhân qua BullMQ.
 *
 * Cả hai việc idempotent theo (buổi, học viên) / (bản nhận xét) nên retry chỉ gửi lại phần còn lỗi. Job NÉM LỖI khi
 * còn email lỗi để BullMQ retry; email lỗi không chặn các email khác trong cùng lượt (xử lý trong core-lms).
 */
export type ClassMailJobData = { kind: "summary" | "notes"; meetingId: string };
export type ClassMailJobResult = { kind: string; meetingId: string; sent: number; failed: number; skipped: number };

export async function runClassMail(data: ClassMailJobData): Promise<ClassMailJobResult> {
  if (data.kind === "summary") {
    const r = await sendMeetingSummary(null, data.meetingId, { baseUrl: SITE_URL });
    return { kind: data.kind, meetingId: data.meetingId, ...r };
  }
  const r = await sendApprovedNotes(null, data.meetingId, {
    baseUrl: SITE_URL,
    // Mỗi bản đã gửi ghi một FeedbackDelivery mang toạ độ SSMMD (CLAUDE.md §4.8, C4.15).
    afterSent: (note) => recordMeetingNoteDelivery(note.id),
  });
  return { kind: data.kind, meetingId: data.meetingId, sent: r.sent, failed: r.failed, skipped: r.skipped };
}

export async function processClassMailJob(job: Job<ClassMailJobData, ClassMailJobResult>): Promise<ClassMailJobResult> {
  const r = await runClassMail(job.data);
  if (r.failed > 0) throw new Error(`class_mail_${job.data.kind}_failed:${r.failed}`);
  return r;
}

/**
 * Xếp hàng gửi. Redis chưa chạy (máy dev) hoặc xếp hàng lỗi thì chạy ngay trong tiến trình, nền, để tính năng
 * vẫn hoạt động — lỗi ở đây chỉ ghi log, không làm hỏng yêu cầu của giáo viên. Trả "queued" hay "inline".
 */
export async function dispatchClassMail(data: ClassMailJobData): Promise<"queued" | "inline"> {
  // Máy dev thường có Redis nhưng không chạy worker: job vào hàng đợi mà không ai gửi. Ngoài production thì gửi
  // thẳng trong tiến trình; đặt CLASS_MAIL_MODE=queue để thử hàng đợi thật, =inline để ép gửi trực tiếp.
  const mode = process.env.CLASS_MAIL_MODE;
  if (mode === "inline" || (mode !== "queue" && process.env.NODE_ENV !== "production")) {
    void runClassMail(data).catch((e) => console.error(`[class-mail] inline failed (${data.kind} ${data.meetingId}):`, e));
    return "inline";
  }
  try {
    await getClassMailQueue().add(data.kind, data, { jobId: `${data.kind}-${data.meetingId}-${Date.now()}` });
    return "queued";
  } catch (err) {
    console.error(`[class-mail] enqueue failed (${data.kind} ${data.meetingId}), chạy trực tiếp:`, (err as Error).message);
    void runClassMail(data).catch((e) => console.error(`[class-mail] inline failed (${data.kind} ${data.meetingId}):`, e));
    return "inline";
  }
}

export const CLASS_MAIL_QUEUE = QUEUE_NAMES.classMail;
