import { createHmac } from "node:crypto";

/**
 * Tích hợp Feedback Hub (https://github.com/Lampx83/FeedbackHub) — hộp góp ý dùng chung.
 *
 * Bật bằng biến môi trường phía MÁY CHỦ (đọc lúc chạy, không cần build lại image):
 *   FEEDBACK_HUB_URL      địa chỉ hub, vd. https://feedback.example.com
 *   FEEDBACK_HUB_SECRET   khoá ký token của dự án trên hub — CHỈ ở máy chủ, không bao giờ gửi xuống trình duyệt
 *   FEEDBACK_HUB_PROJECT  mã dự án trên hub (mặc định "limio")
 *
 * Thiếu FEEDBACK_HUB_URL hoặc FEEDBACK_HUB_SECRET ⇒ tắt hoàn toàn: không nút, không route, trang chạy y như trước.
 * Chỉ người đã đăng nhập mới thấy nút (dự án hub đặt anonymousSubmit=false).
 *
 * Chỉ import ở MÁY CHỦ (dùng node:crypto); phần chạy được ở trình duyệt nằm ở feedback-hub-paths.ts.
 * Ký bằng node:crypto thay vì thêm thư viện JWT: token chỉ là HS256 với vài claim (xem docs/INTEGRATION.md của hub).
 */
export const hubUrl = () => (process.env.FEEDBACK_HUB_URL ?? "").trim().replace(/\/$/, "");
export const hubProject = () => (process.env.FEEDBACK_HUB_PROJECT ?? "").trim() || "limio";
export const hubEnabled = () => Boolean(hubUrl() && process.env.FEEDBACK_HUB_SECRET);

const TOKEN_TTL_SEC = 600;
const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export type FeedbackIdentity = { id: string; name: string; email?: string | null; admin: boolean };

/** Token HS256 sống 10 phút; widget tự xin lại khi hết hạn. Trả null nếu chưa cấu hình khoá. */
export function signFeedbackToken(who: FeedbackIdentity, now = Date.now()): string | null {
  const secret = process.env.FEEDBACK_HUB_SECRET;
  if (!secret) return null;
  const iat = Math.floor(now / 1000);
  const claims: Record<string, unknown> = {
    prj: hubProject(),
    aud: "feedback-hub",
    iat,
    exp: iat + TOKEN_TTL_SEC,
    uid: who.id,
    name: who.name,
    role: who.admin ? "ADMIN" : "USER",
  };
  if (who.email) claims.email = who.email;
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
