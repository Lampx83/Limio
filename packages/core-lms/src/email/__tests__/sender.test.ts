import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sender.ts cache Resend client ở module-level → import lại sạch cho từng case.
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const input = { to: "a@example.com", subject: "Chào", html: "<p>x</p>", text: "x" };
const ENV = { ...process.env };

async function load() {
  vi.resetModules();
  return (await import("../sender")).sendEmail;
}

beforeEach(() => {
  send.mockReset();
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
});
