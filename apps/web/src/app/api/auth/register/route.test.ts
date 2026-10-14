import { beforeEach, describe, expect, it, vi } from "vitest";

class RegisterError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const registerUser = vi.fn();
vi.mock("@feedbackme/core-lms", () => ({ registerUser, RegisterError }));
const recordAcquisitionTouch = vi.fn();
vi.mock("@/lib/growth/touchStore", () => ({
  recordAcquisitionTouch,
  // Bản thật được test riêng ở lib/growth/touchStore.test.ts.
  readAttributionCookie: (h: string | null) => h?.match(/limio_attr=([^;]+)/)?.[1],
}));

const post = (cookie?: string) =>
  new Request("http://limio.test/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ email: "a@b.vn", password: "12345678", displayName: "A" }),
  });

describe("POST /api/auth/register — growth attribution", () => {
  beforeEach(() => {
    registerUser.mockReset().mockResolvedValue({ userId: "u1", email: "a@b.vn", emailSent: true });
    recordAcquisitionTouch.mockReset().mockResolvedValue("stored");
  });

  it("đăng ký xong thì lưu touch từ cookie limio_attr", async () => {
    const { POST } = await import("./route");
    const res = await POST(post("foo=1; limio_attr=abc123; bar=2"));
    expect(res.status).toBe(201);
    expect(recordAcquisitionTouch).toHaveBeenCalledWith("u1", "abc123");
  });

  it("lưu touch lỗi (kể cả throw) không làm hỏng đăng ký", async () => {
    recordAcquisitionTouch.mockRejectedValue(new Error("boom"));
    const { POST } = await import("./route");
    const res = await POST(post("limio_attr=abc123"));
    expect(res.status).toBe(201);
    expect((await res.json()).userId).toBe("u1");
  });

  it("đăng ký thất bại (email trùng) thì không lưu touch", async () => {
    registerUser.mockRejectedValue(new RegisterError("email_taken"));
    const { POST } = await import("./route");
    expect((await POST(post("limio_attr=abc123"))).status).toBe(409);
    expect(recordAcquisitionTouch).not.toHaveBeenCalled();
  });
});
