import { beforeEach, describe, expect, it, vi } from "vitest";

// Limiter giả trong bộ nhớ, cùng ngữ nghĩa với rate-limit.ts: `allow` đếm thêm
// một lượt (từ chối khi đã đầy), `isBlocked` chỉ xem.
const buckets = new Map<string, number>();
const key = (scope: string, subject: string) => `${scope}:${subject}`;
const allowImpl = async (scope: string, subject: string, limit: number) => {
  const n = buckets.get(key(scope, subject)) ?? 0;
  if (n >= limit) return { ok: false as const, retryAfterSec: 900 };
  buckets.set(key(scope, subject), n + 1);
  return { ok: true as const, remaining: limit - n - 1 };
};
const isBlockedImpl = async (scope: string, subject: string, limit: number) =>
  (buckets.get(key(scope, subject)) ?? 0) >= limit
    ? { ok: false as const, retryAfterSec: 600 }
    : { ok: true as const, remaining: limit };
const allow = vi.fn(allowImpl);
const isBlocked = vi.fn(isBlockedImpl);
const reset = vi.fn(async (scope: string, subject: string) => {
  buckets.delete(key(scope, subject));
});
vi.mock("@/lib/rate-limit", () => ({ allow, isBlocked, reset }));

const loginCredentials = vi.fn();
const logAudit = vi.fn(async () => {});
vi.mock("@feedbackme/core-lms", () => ({ loginCredentials, logAudit }));

const findUnique = vi.fn(async () => ({ id: "user-1" }));
vi.mock("@feedbackme/db", () => ({ prisma: { user: { findUnique } } }));

const { throttledLogin, clearLoginFailures, LOGIN_EMAIL_LIMIT, LOGIN_IP_LIMIT } = await import(
  "./loginThrottle"
);

const USER = { id: "user-1", email: "a@x.vn", name: "A", isEmailVerified: true };
const wrong = (email = "a@x.vn", ip = "1.2.3.4") =>
  throttledLogin({ email, password: "sai" }, ip);
const right = (email = "a@x.vn", ip = "1.2.3.4") =>
  throttledLogin({ email, password: "dung" }, ip);

beforeEach(() => {
  buckets.clear();
  vi.clearAllMocks();
  allow.mockImplementation(allowImpl);
  isBlocked.mockImplementation(isBlockedImpl);
  loginCredentials.mockImplementation(async (input: { password: string }) =>
    input.password === "dung" ? USER : null,
  );
});

describe("throttledLogin", () => {
  it("đăng nhập đúng thì không tốn ngân sách và xoá lượt sai theo email", async () => {
    await wrong();
    await wrong();
    expect(await right()).toEqual({ status: "ok", user: USER });
    expect(buckets.has("login:fail:email:a@x.vn")).toBe(false);
    // Bucket IP không được xoá — một tài khoản đúng không được rửa lượt dò của IP.
    expect(buckets.get("login:fail:ip:1.2.3.4")).toBe(2);
  });

  it("khoá email sau 5 lần sai, ghi audit đúng một lần", async () => {
    for (let i = 1; i < LOGIN_EMAIL_LIMIT; i++) expect(await wrong()).toEqual({ status: "invalid" });
    // Lượt sai thứ 5 lấp đầy cửa sổ → báo khoá ngay.
    expect((await wrong()).status).toBe("locked");
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login.locked",
        targetUserId: "user-1",
        payload: expect.objectContaining({ scope: "email", email: "a@x.vn", ip: "1.2.3.4" }),
      }),
    );

    // Đã khoá: kể cả mật khẩu ĐÚNG cũng bị chặn, và không hề so mật khẩu.
    loginCredentials.mockClear();
    expect(await right()).toEqual({ status: "locked", retryAfterSec: 600 });
    expect(loginCredentials).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledTimes(1);
  });

  it("email chuẩn hoá trước khi đếm (hoa/thường, khoảng trắng)", async () => {
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i++) await wrong(i % 2 ? " A@X.VN " : "a@x.vn");
    expect((await right()).status).toBe("locked");
  });

  it("email không tồn tại bị khoá y hệt — không lộ tài khoản có hay không", async () => {
    findUnique.mockResolvedValueOnce(null as never);
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i++) await wrong("khongco@x.vn");
    expect((await wrong("khongco@x.vn")).status).toBe("locked");
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ targetUserId: null }));
  });

  it("khoá IP sau 30 lần sai rải trên nhiều email", async () => {
    for (let i = 0; i < LOGIN_IP_LIMIT; i++) await wrong(`u${i}@x.vn`);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ scope: "ip", ip: "1.2.3.4" }) }),
    );
    expect((await right("moi@x.vn")).status).toBe("locked");
    // IP khác vẫn vào được.
    expect((await right("a@x.vn", "5.6.7.8")).status).toBe("ok");
  });

  it("IP 'unknown' thì bỏ hàng rào IP, vẫn giữ hàng rào email", async () => {
    for (let i = 0; i < LOGIN_IP_LIMIT + 5; i++) await wrong(`u${i}@x.vn`, "unknown");
    expect([...buckets.keys()].some((k) => k.includes(":ip:"))).toBe(false);
    expect((await right("a@x.vn", "unknown")).status).toBe("ok");
  });

  it("Redis lỗi thì cho qua (fail open)", async () => {
    isBlocked.mockRejectedValue(new Error("redis down"));
    allow.mockRejectedValue(new Error("redis down"));
    expect(await wrong()).toEqual({ status: "invalid" });
    expect(await right()).toEqual({ status: "ok", user: USER });
  });

  it("audit lỗi không làm hỏng đăng nhập", async () => {
    logAudit.mockRejectedValueOnce(new Error("db down"));
    for (let i = 1; i < LOGIN_EMAIL_LIMIT; i++) await wrong();
    expect((await wrong()).status).toBe("locked");
  });

  it("clearLoginFailures mở khoá email (sau khi đặt lại mật khẩu)", async () => {
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i++) await wrong();
    await clearLoginFailures("A@x.vn");
    expect((await right()).status).toBe("ok");
  });
});
