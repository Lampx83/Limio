import { beforeEach, describe, expect, it, vi } from "vitest";

// Mô phỏng production hiện tại: bảng EmailTemplate TRỐNG → chỉ có FALLBACKS trong code.
const { findFirst, sendEmail } = vi.hoisted(() => ({ findFirst: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@feedbackme/db", () => ({ prisma: { emailTemplate: { findFirst } } }));
vi.mock("../sender", () => ({ sendEmail }));

import { renderTemplate, sendTemplatedEmail, type TemplateKey } from "../templates";

const ALL_KEYS: TemplateKey[] = [
  "auth.verify_email", "auth.password_reset", "exam.access_code", "exam.proctor_invite",
  "exam.proctor_invite_bulk", "exam.instructor_invite_bulk", "cohort.instructor_invite",
  "course.co_instructor_invite", "course.welcome", "course.access_expiring",
  "exam.grade_published", "exam.deadline_reminder", "gamification.level_up",
  "gamification.badge_earned", "notification.weekly_digest",
];

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null); // DB rỗng
  sendEmail.mockReset().mockResolvedValue({ delivered: true, providerId: "m", loggedOnly: false });
});

describe("template fallback khi DB rỗng (trạng thái production)", () => {
  it.each(ALL_KEYS)("%s render được", async (key) => {
    const r = await renderTemplate({ key, variables: { displayName: "An" } });
    expect(r.source).toBe("fallback");
    expect(r.subject.length).toBeGreaterThan(0);
  });

  it.each(ALL_KEYS)("%s được bọc khung thương hiệu (logo, thẻ, chân thư, preheader)", async (key) => {
    const r = await renderTemplate({ key, variables: { displayName: "An" } });
    expect(r.html).toMatch(/^<!doctype html>/i);
    expect(r.html).toContain("Lim<span");
    expect(r.html).toContain("/email/logo-lime.png");
    expect(r.html).toContain("Thư này được gửi tự động");
    expect(r.html).toContain("display:none;max-height:0"); // preheader ẩn
  });

  it("mẫu admin dán nguyên tài liệu HTML → không bọc lần hai", async () => {
    findFirst.mockResolvedValueOnce({ subject: "s", bodyHtml: "<html><body>tự thiết kế</body></html>", bodyText: "t" });
    const r = await renderTemplate({ key: "auth.verify_email", variables: {} });
    expect(r.html).toBe("<html><body>tự thiết kế</body></html>");
  });

  it("biến thiếu → chuỗi rỗng, không lộ '{{...}}'", async () => {
    const r = await renderTemplate({ key: "auth.verify_email", variables: {} });
    expect(r.html).not.toContain("{{");
  });

  it("HTML-escape tên người dùng (chống chèn script vào thư)", async () => {
    const r = await renderTemplate({
      key: "auth.verify_email",
      variables: { displayName: "<script>alert(1)</script>", verificationUrl: "https://x" },
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("ưu tiên template của DB (org) hơn fallback", async () => {
    findFirst.mockResolvedValueOnce({ subject: "Org {{n}}", bodyHtml: "<b>{{n}}</b>", bodyText: null });
    const r = await renderTemplate({ key: "auth.verify_email", organizationId: "o1", variables: { n: "A" } });
    expect(r).toMatchObject({ source: "org", subject: "Org A", text: "A" });
    expect(r.html).toContain("<b>A</b>"); // nội dung admin được giữ, nằm trong khung
  });
});

describe("sendTemplatedEmail", () => {
  it("truyền kết quả gửi + nguồn template", async () => {
    const r = await sendTemplatedEmail({
      key: "auth.password_reset", to: "a@example.com", variables: { displayName: "An", resetUrl: "https://r" },
    });
    expect(r).toMatchObject({ delivered: true, source: "fallback" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@example.com" }));
  });

  it("gửi thất bại → trả delivered=false, không throw, và GHI LOG (che địa chỉ nhận)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockResolvedValue({ delivered: false, providerId: null, loggedOnly: false, error: "429" });
    const r = await sendTemplatedEmail({ key: "auth.verify_email", to: "nguyenvana@example.com", variables: {} });
    expect(r.delivered).toBe(false);
    const line = String(err.mock.calls[0]?.[0]);
    expect(line).toContain("[email:send_failed]");
    expect(line).toContain("key=auth.verify_email");
    expect(line).toContain("ng***@example.com");
    expect(line).not.toContain("nguyenvana");
    err.mockRestore();
  });

  it("chế độ dev (loggedOnly) → không coi là lỗi, không log lỗi", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockResolvedValue({ delivered: false, providerId: null, loggedOnly: true });
    await sendTemplatedEmail({ key: "auth.verify_email", to: "a@example.com", variables: {} });
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
