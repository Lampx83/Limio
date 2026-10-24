import type OpenAI from "openai";
import type { MeetingStudentNote } from "@feedbackme/db";
import { getOpenaiClient } from "@/lib/openaiClient";

/** Bản nhận xét trả cho giao diện giảng viên: bỏ dữ kiện soạn (mức thành thạo thô) — không bao giờ hiện số. */
export function noteDto(n: MeetingStudentNote) {
  const { facts: _facts, ...rest } = n;
  return rest;
}

/** Mô hình để soạn nháp; chưa cấu hình thì null và core-feedback tự dùng mẫu có sẵn (C4.13). */
export async function noteOpenaiOrNull(): Promise<OpenAI | null> {
  try {
    return await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return null;
    throw e;
  }
}
