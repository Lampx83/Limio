import { beforeEach, describe, expect, it, vi } from "vitest";

/** LANG G4 / G4.4.4 — GET /api/courses/:id/flashcards/stats[?userId=] */

const requireUserId = vi.fn();
const canGradeCourse = vi.fn();
const getFlashcardStats = vi.fn();
vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-lms", () => ({ canGradeCourse }));
vi.mock("@feedbackme/core-feedback", () => ({ getFlashcardStats }));

const ME = "11111111-2222-4333-8444-555555555555";
const OTHER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const COURSE = "cccccccc-1111-4222-8333-444444444444";
const call = async (q = "") => {
  const { GET } = await import("./route");
  return GET(new Request(`http://x/api/courses/${COURSE}/flashcards/stats${q}`), { params: { id: COURSE } });
};
const stats = { total: 3, learned: 1, dueToday: 1, struggling: 0, distribution: { new: 2, learning: 1, mature: 0 }, newAvailable: 2, enrolled: true };

describe("GET /api/courses/[id]/flashcards/stats", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(ME);
    canGradeCourse.mockReset().mockResolvedValue(false);
    getFlashcardStats.mockReset().mockResolvedValue(stats);
  });

  it("chưa đăng nhập → 401", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(getFlashcardStats).not.toHaveBeenCalled();
  });

  it("xem của mình (không tham số, hoặc userId = mình) → không cần hỏi quyền chấm bài", async () => {
    for (const q of ["", `?userId=${ME}`]) {
      getFlashcardStats.mockClear();
      expect((await call(q)).status).toBe(200);
      expect(getFlashcardStats).toHaveBeenCalledWith(ME, COURSE);
    }
    expect(canGradeCourse).not.toHaveBeenCalled();
  });

  it("xem của người khác: không phải giảng viên → 403; là giảng viên/trợ giảng → 200", async () => {
    expect((await call(`?userId=${OTHER}`)).status).toBe(403);
    expect(getFlashcardStats).not.toHaveBeenCalled();
    canGradeCourse.mockResolvedValue(true);
    expect((await call(`?userId=${OTHER}`)).status).toBe(200);
    expect(getFlashcardStats).toHaveBeenCalledWith(OTHER, COURSE);
  });

  it("userId không phải uuid → 400", async () => {
    expect((await call("?userId=../etc/passwd")).status).toBe(400);
  });

  it("không cache", async () => {
    expect((await call()).headers.get("cache-control")).toMatch(/no-store/);
  });
});
