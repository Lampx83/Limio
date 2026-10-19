import { prisma } from "@feedbackme/db";
import { loginCredentials, logAudit, type LoginResult } from "@feedbackme/core-lms";
import { allow, isBlocked, reset } from "@/lib/rate-limit";

/**
 * Chống dò mật khẩu cho đăng nhập email + mật khẩu. Đặt ở apps/web vì limiter
 * Redis nằm ở đây, còn core-lms không được import apps/web.
 *
 * Chỉ đếm lượt SAI (giống hàng rào mã thi): kiểm tra trước bằng `isBlocked`,
 * ghi nhận bằng `allow` khi thất bại — người gõ đúng không tốn ngân sách.
 *   - theo email: 5 lần sai / 15 phút — chặn dò một tài khoản cụ thể
 *   - theo IP:   30 lần sai / 15 phút — chặn rải mật khẩu qua nhiều email,
 *     vẫn dư cho phòng máy dùng chung một IP NAT
 *
 * Email bị đếm kể cả khi không tồn tại, nên "bị khoá" không lộ email có tài
 * khoản hay không. Redis lỗi thì cho qua: hạ tầng hỏng không được khoá cả
 * trường ra ngoài.
 */
export const LOGIN_EMAIL_LIMIT = 5;
export const LOGIN_IP_LIMIT = 30;
export const LOGIN_WINDOW_MS = 15 * 60_000;

const EMAIL_SCOPE = "login:fail:email";
const IP_SCOPE = "login:fail:ip";

export type ThrottledLoginResult =
  | { status: "ok"; user: LoginResult }
  | { status: "invalid" }
  | { status: "locked"; retryAfterSec: number };

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length > 0 && email.length <= 254 ? email : null;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function auditLocked(scope: "email" | "ip", email: string | null, ip: string | null) {
  try {
    const target =
      scope === "email" && email
        ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
        : null;
    await logAudit({
      action: "auth.login.locked",
      targetUserId: target?.id ?? null,
      payload: {
        scope,
        email: scope === "email" ? email : null,
        ip,
        limit: scope === "email" ? LOGIN_EMAIL_LIMIT : LOGIN_IP_LIMIT,
        windowMinutes: LOGIN_WINDOW_MS / 60_000,
      },
    });
  } catch {
    // Ghi audit hỏng không được làm hỏng luồng đăng nhập.
  }
}

/** Xoá lượt sai theo email (vd sau khi đặt lại mật khẩu). Không bao giờ throw. */
export async function clearLoginFailures(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (email) await safe(() => reset(EMAIL_SCOPE, email), undefined);
}

/** `ip` = kết quả `clientIp()`; "unknown" thì bỏ hàng rào IP (xem clientIp). */
export async function throttledLogin(
  credentials: { email?: unknown; password?: unknown },
  ip: string,
): Promise<ThrottledLoginResult> {
  const email = normalizeEmail(credentials.email);
  const ipKey = ip !== "unknown" ? ip : null;

  // Chặn TRƯỚC khi so mật khẩu: kẻ dò không được biết lượt kế tiếp đúng hay sai.
  const notBlocked = { ok: true as const, remaining: 0 };
  const [byEmail, byIp] = await Promise.all([
    email
      ? safe(() => isBlocked(EMAIL_SCOPE, email, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS), notBlocked)
      : notBlocked,
    ipKey
      ? safe(() => isBlocked(IP_SCOPE, ipKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS), notBlocked)
      : notBlocked,
  ]);
  if (!byEmail.ok || !byIp.ok) {
    return {
      status: "locked",
      retryAfterSec: Math.max(
        byEmail.ok ? 0 : byEmail.retryAfterSec,
        byIp.ok ? 0 : byIp.retryAfterSec,
      ),
    };
  }

  const user = await loginCredentials({
    email: credentials.email,
    password: credentials.password,
  });

  if (user) {
    if (email) await clearLoginFailures(email);
    return { status: "ok", user };
  }

  const [failEmail, failIp] = await Promise.all([
    email ? safe(() => allow(EMAIL_SCOPE, email, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS), null) : null,
    ipKey ? safe(() => allow(IP_SCOPE, ipKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS), null) : null,
  ]);
  // Lượt sai vừa lấp đầy cửa sổ = thời điểm bị khoá → audit đúng một lần, rồi
  // báo khoá ngay để người dùng biết phải chờ thay vì gõ tiếp vô ích.
  const emailJustLocked = failEmail?.ok === true && failEmail.remaining === 0;
  const ipJustLocked = failIp?.ok === true && failIp.remaining === 0;
  if (emailJustLocked) await auditLocked("email", email, ipKey);
  if (ipJustLocked) await auditLocked("ip", email, ipKey);
  if (emailJustLocked || ipJustLocked || failEmail?.ok === false || failIp?.ok === false) {
    return { status: "locked", retryAfterSec: Math.ceil(LOGIN_WINDOW_MS / 1000) };
  }
  return { status: "invalid" };
}
