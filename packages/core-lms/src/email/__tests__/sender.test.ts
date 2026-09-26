import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sender.ts cache Resend client ở module-level → import lại sạch cho từng case.
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
const { logCreate } = vi.hoisted(() => ({ logCreate: vi.fn() }));
vi.mock("@feedbackme/db", () => ({ prisma: { emailSendLog: { create: logCreate } } }));

const input = { to: "a@example.com", subject: "Chào", html: "<p>x</p>", text: "x" };
const ENV = { ...process.env };

async function load() {
  vi.resetModules();
  return (await import("../sender")).sendEmail;
}

beforeEach(() => {
  send.mockReset();
  logCreate.mockReset().mockResolvedValue({});
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Limio <no-reply@limio.vn>";
});
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("gửi thành công → delivered + providerId, đúng from/to", async () => {
    send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const r = await (await load())(input);
    expect(r).toEqual({ delivered: true, providerId: "msg_1", loggedOnly: false });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Limio <no-reply@limio.vn>", to: "a@example.com" }),
    );
  });

  it.each([
    ["thiếu RESEND_API_KEY", () => delete process.env.RESEND_API_KEY],
    ["thiếu EMAIL_FROM", () => delete process.env.EMAIL_FROM],
  ])("%s → chỉ log, không gọi Resend", async (_n, unset) => {
    unset();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await (await load())(input);
    expect(r).toEqual({ delivered: false, providerId: null, loggedOnly: true });
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("Resend trả error (vd. rate limit, domain chưa verify) → delivered=false + error, KHÔNG throw", async () => {
    send.mockResolvedValue({ data: null, error: { message: "Too many requests" } });
    const r = await (await load())(input);
    expect(r).toMatchObject({ delivered: false, loggedOnly: false, error: "Too many requests" });
  });

  it("lỗi mạng (fetch throw) → delivered=false + error, KHÔNG throw", async () => {
    send.mockRejectedValue(new Error("ECONNRESET"));
    const r = await (await load())(input);
    expect(r).toMatchObject({ delivered: false, loggedOnly: false, error: "ECONNRESET" });
  });

  describe("nhật ký gửi (EmailSendLog)", () => {
    it("gửi thành công → ghi 1 dòng 'sent', chỉ lưu DOMAIN người nhận + khoá template", async () => {
      send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
      await (await load())({ ...input, to: "Nguyen.Van@HUST.edu.vn", templateKey: "auth.verify_email" });
      expect(logCreate).toHaveBeenCalledTimes(1);
      const data = logCreate.mock.calls[0]![0].data;
      expect(data).toMatchObject({ status: "sent", providerId: "msg_1", templateKey: "auth.verify_email", toDomain: "hust.edu.vn" });
      expect(JSON.stringify(data)).not.toMatch(/nguyen/i); // không lộ địa chỉ đầy đủ
    });

    it("Resend trả lỗi → ghi 'failed' kèm lý do", async () => {
      send.mockResolvedValue({ data: null, error: { message: "Too many requests" } });
      await (await load())(input);
      expect(logCreate.mock.calls[0]![0].data).toMatchObject({ status: "failed", error: "Too many requests", templateKey: null });
    });

    it("chế độ dev (không có key) → KHÔNG ghi log (chưa gọi provider)", async () => {
      delete process.env.RESEND_API_KEY;
      vi.spyOn(console, "log").mockImplementation(() => {});
      await (await load())(input);
      expect(logCreate).not.toHaveBeenCalled();
    });

    it("ghi log hỏng → không làm hỏng việc gửi", async () => {
      send.mockResolvedValue({ data: { id: "m" }, error: null });
      logCreate.mockRejectedValue(new Error("db down"));
      const r = await (await load())(input);
      expect(r.delivered).toBe(true);
    });
  });
});
