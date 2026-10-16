/**
 * Giới hạn mạng khi vào thi — phần web: lấy IP người dùng và áp quy tắc của trường.
 *
 * IP lấy từ header do proxy của MÌNH đặt (X-Real-IP rồi X-Forwarded-For), không
 * dùng clientIp() của rate-limit vì hàm đó chủ ý BỎ QUA IP nội bộ — còn ở đây
 * mạng trường có thể chính là dải nội bộ. Header này chỉ đáng tin khi Caddy đứng
 * trước và ghi đè nó (xem docker/caddy/Caddyfile); trang cài đặt hiển thị IP máy
 * chủ thấy để quản trị viên kiểm tra trước khi bật.
 */
import { NextResponse } from "next/server";
import {
  evaluateNetwork,
  examNetworkRulesForExam,
  type NetworkCheck,
} from "@feedbackme/core-lms";

type HeaderReader = { get(name: string): string | null };

/** IP người dùng theo header của proxy; null khi không có. */
export function examClientIp(headers: HeaderReader): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

/** Kiểm tra mạng cho một đề; cho vào khi trường của đề không cấu hình giới hạn. */
export async function checkExamNetwork(
  examId: string,
  headers: HeaderReader,
): Promise<NetworkCheck> {
  const rules = await examNetworkRulesForExam(examId);
  return evaluateNetwork(examClientIp(headers), rules);
}

/** Trả lời API khi bị chặn mạng: 403 kèm lý do để giao diện nói đúng. */
export function networkBlockedResponse(
  check: Extract<NetworkCheck, { allowed: false }>,
): NextResponse {
  return NextResponse.json(
    { error: "network_not_allowed", reason: check.reason },
    { status: 403 },
  );
}

/** IP nội bộ/loopback — thấy IP này nghĩa là proxy chưa truyền IP thật của người dùng. */
export function isInternalIp(ip: string): boolean {
  const s = ip.trim().toLowerCase();
  if (/^10\./.test(s) || /^192\.168\./.test(s) || /^127\./.test(s) || /^169\.254\./.test(s))
    return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(s)) return true;
  if (s === "::1" || /^fe80:/.test(s) || /^f[cd][0-9a-f]{2}:/.test(s)) return true;
  return false;
}
