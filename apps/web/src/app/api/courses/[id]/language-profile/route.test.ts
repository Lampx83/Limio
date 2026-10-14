import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LANG G3 / G3.3 — GET /api/courses/:id/language-profile[?userId=]
 * Quyền kiểm ở đây (apps/web điều phối) rồi truyền `audience` cho core-feedback,
 * vì core-feedback không được import core-lms.
 */

const requireUserId = vi.fn();
const canGradeCourse = vi.fn();
const getLanguageProfile = vi.fn();

vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-lms", () => ({ canGradeCourse }));
vi.mock("@feedbackme/core-feedback", () => ({ getLanguageProfile }));

const ME = "11111111-2222-4333-8444-555555555555";
const OTHER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const COURSE = "cccccccc-1111-4222-8333-444444444444";

const call = async (query = "") => {
  const { GET } = await import("./route");
  return GET(new Request(`http://x/api/courses/${COURSE}/language-profile${query}`), { params: { id: COURSE } });
};

const ok = { enabled: true, skills: [], suggestion: null };

describe("GET /api/courses/[id]/language-profile", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(ME);
    canGradeCourse.mockReset().mockResolvedValue(false);
    getLanguageProfile.mockReset().mockResolvedValue(ok);
  });

  it("G3.3.5: chưa đăng nhập → 401, không đọc dữ liệu", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(getLanguageProfile).not.toHaveBeenCalled();
  });

  it("G3.3.1: xem hồ sơ của chính mình (không tham số hoặc userId = mình) → audience 'learner'", async () => {
    for (const q of ["", `?userId=${ME}`]) {
      getLanguageProfile.mockClear();
      const res = await call(q);
      expect(res.status).toBe(200);
      expect(getLanguageProfile).toHaveBeenCalledWith(ME, COURSE, "learner");
    }
    // Xem của mình thì không cần hỏi quyền chấm bài.
    expect(canGradeCourse).not.toHaveBeenCalled();
  });

  it("G3.3.1: xem hồ sơ người khác mà không phải giảng viên của khoá → 403, không đọc dữ liệu", async () => {
    const res = await call(`?userId=${OTHER}`);
    expect(res.status).toBe(403);
    expect(canGradeCourse).toHaveBeenCalledWith(ME, COURSE);
    expect(getLanguageProfile).not.toHaveBeenCalled();
  });

  it("G3.3.1: giảng viên/trợ giảng của khoá xem hồ sơ học viên → audience 'instructor'", async () => {
    canGradeCourse.mockResolvedValue(true);
    const res = await call(`?userId=${OTHER}`);
    expect(res.status).toBe(200);
    expect(getLanguageProfile).toHaveBeenCalledWith(OTHER, COURSE, "instructor");
  });

  it("userId không phải uuid → 400, không đọc dữ liệu", async () => {
    const res = await call("?userId=../../etc/passwd");
    expect(res.status).toBe(400);
    expect(getLanguageProfile).not.toHaveBeenCalled();
  });

  it("khoá không tồn tại → 404", async () => {
    getLanguageProfile.mockResolvedValue({ enabled: false, reason: "course_not_found", skills: [], suggestion: null });
    expect((await call()).status).toBe(404);
  });

  it("dữ liệu cá nhân: không cache, chỉ riêng người xem", async () => {
    const res = await call();
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(res.headers.get("cache-control")).toMatch(/private/);
  });

  it("G3.3.4: học viên lớp đối chứng KHÔNG được biết mình thuộc đối chứng qua lý do trả về", async () => {
    getLanguageProfile.mockResolvedValue({ enabled: false, reason: "control_variant", skills: [], suggestion: null });
    const body = await (await call()).json();
    expect(body.enabled).toBe(false);
    expect(body.reason).toBe("unavailable");
    expect(JSON.stringify(body)).not.toMatch(/control|variant|minimal/i);
  });

  it("giảng viên vẫn nhận lý do thật của hồ sơ tắt (để chẩn đoán)", async () => {
    canGradeCourse.mockResolvedValue(true);
    getLanguageProfile.mockResolvedValue({ enabled: false, reason: "language_mode_off", skills: [], suggestion: null });
    const body = await (await call(`?userId=${OTHER}`)).json();
    expect(body.reason).toBe("language_mode_off");
  });

  it("phản hồi cho học viên đi nguyên hình dạng core-feedback đã trả (không thêm số nào)", async () => {
    const learnerShape = {
      enabled: true,
      skills: [{ skill: "listening", label: "needs_review", lessonsTotal: 2, lessonsPracticed: 1 }],
      suggestion: null,
    };
    getLanguageProfile.mockResolvedValue(learnerShape);
    expect(await (await call()).json()).toEqual(learnerShape);
  });
});
