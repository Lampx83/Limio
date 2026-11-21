import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hubEnabled, signFeedbackToken } from "./feedback-hub";
import { feedbackContext, isExamPath, readActiveRole } from "./feedback-hub-paths";

const ENV = { ...process.env };
beforeEach(() => {
  process.env.FEEDBACK_HUB_URL = "https://hub.example.com/";
  process.env.FEEDBACK_HUB_SECRET = "test-secret-test-secret-test-secret";
  delete process.env.FEEDBACK_HUB_PROJECT;
});
afterEach(() => {
  process.env = { ...ENV };
});

const decode = (t: string) => JSON.parse(Buffer.from(t.split(".")[1]!, "base64url").toString());

describe("signFeedbackToken", () => {
  it("ký HS256 đúng chữ ký, aud và hạn 10 phút", () => {
    const now = 1_800_000_000_000;
    const t = signFeedbackToken({ id: "u1", name: "An", email: "an@x.vn", admin: false }, now)!;
    const [h, b, s] = t.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
    expect(s).toBe(createHmac("sha256", process.env.FEEDBACK_HUB_SECRET!).update(`${h}.${b}`).digest("base64url"));
    expect(decode(t)).toMatchObject({ prj: "limio", aud: "feedback-hub", uid: "u1", name: "An", role: "USER", email: "an@x.vn", iat: now / 1000, exp: now / 1000 + 600 });
  });
  it("admin → ADMIN; không có email thì bỏ claim email", () => {
    const c = decode(signFeedbackToken({ id: "a", name: "Ad", admin: true })!);
    expect(c.role).toBe("ADMIN");
    expect("email" in c).toBe(false);
  });
  it("dùng FEEDBACK_HUB_PROJECT khi có; thiếu khoá ký → null", () => {
    process.env.FEEDBACK_HUB_PROJECT = "limio-staging";
    expect(decode(signFeedbackToken({ id: "u", name: "n", admin: false })!).prj).toBe("limio-staging");
    delete process.env.FEEDBACK_HUB_SECRET;
    expect(signFeedbackToken({ id: "u", name: "n", admin: false })).toBeNull();
    expect(hubEnabled()).toBe(false);
  });
});

describe("hubEnabled / isExamPath", () => {
  it("cần cả URL lẫn khoá", () => {
    expect(hubEnabled()).toBe(true);
    delete process.env.FEEDBACK_HUB_URL;
    expect(hubEnabled()).toBe(false);
  });
  it("chỉ khớp đúng tiền tố đường dẫn", () => {
    for (const p of ["/thi", "/thi/abc", "/exam-take/x", "/play/1", "/join/ABC"]) expect(isExamPath(p)).toBe(true);
    for (const p of ["/", "/thinking", "/me/dashboard", "/exam/1", "/playlist", "/learn/x"]) expect(isExamPath(p)).toBe(false);
  });
});

describe("feedbackContext", () => {
  it("bài học → lesson:<id> + course + vai trò + cỡ màn hình", () => {
    expect(feedbackContext("/learn/python-co-ban/lessons/abc123", "learner", "390x800")).toEqual({
      contentRef: "lesson:abc123",
      extra: { role: "learner", viewport: "390x800", course: "python-co-ban" },
    });
  });
  it("diễn đàn, khoá học, catalog, soạn khoá của giảng viên", () => {
    expect(feedbackContext("/learn/c1/threads/t9").contentRef).toBe("thread:t9");
    expect(feedbackContext("/learn/c1").contentRef).toBe("course:c1");
    expect(feedbackContext("/catalog/c2").extra.course).toBe("c2");
    expect(feedbackContext("/instructor/courses/id7/assessment")).toEqual({ contentRef: "course:id7", extra: { area: "instructor" } });
  });
  it("trang khác → không có contentRef; slug có dấu được giải mã", () => {
    expect(feedbackContext("/me/dashboard")).toEqual({ contentRef: undefined, extra: {} });
    expect(feedbackContext("/learn/to%C3%A1n").extra.course).toBe("toán");
  });
  it("đọc vai trò từ cookie", () => {
    expect(readActiveRole("a=1; fbm-active-role=instructor; b=2")).toBe("instructor");
    expect(readActiveRole("a=1")).toBeUndefined();
  });
});
