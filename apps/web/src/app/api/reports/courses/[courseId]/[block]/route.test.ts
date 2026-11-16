import { beforeEach, describe, expect, it, vi } from "vitest";

/** Báo cáo nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC1): mọi khối đều kiểm quyền trước khi tính. */

const { requireUserId, canViewCourseReport, getActivationReport, getRevenueReport, getLearnerReport } = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  canViewCourseReport: vi.fn(),
  getActivationReport: vi.fn(),
  getRevenueReport: vi.fn(),
  getLearnerReport: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-lms", async (importActual) => {
  const actual = await importActual<typeof import("@feedbackme/core-lms")>();
  return { ...actual, canViewCourseReport, getActivationReport, getRevenueReport, getLearnerReport };
});

const get = (block: string, qs = "") =>
  import("./route").then(({ GET }) =>
    GET(new Request(`http://x/api/reports/courses/c-1/${block}${qs}`), { params: { courseId: "c-1", block } }),
  );

describe("GET /api/reports/courses/[courseId]/[block]", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue("u-1");
    canViewCourseReport.mockReset().mockResolvedValue(true);
    getActivationReport.mockReset().mockResolvedValue({ batches: [], weekly: [], totals: {} });
    getRevenueReport.mockReset().mockResolvedValue({ currencies: [], incompleteOrders: 0 });
    getLearnerReport.mockReset().mockResolvedValue({ enrolled: 0 });
  });

  it("chưa đăng nhập → 401, không tính số liệu", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await get("revenue")).status).toBe(401);
    expect(getRevenueReport).not.toHaveBeenCalled();
  });

  it("không có quyền xem → 403, không tính số liệu", async () => {
    canViewCourseReport.mockResolvedValue(false);
    const res = await get("revenue");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(getRevenueReport).not.toHaveBeenCalled();
  });

  it("khối không có → 404", async () => {
    expect((await get("hoc-vien")).status).toBe(404);
  });

  it("khoảng thời gian mặc định 90 ngày; 30 và từ đầu đọc từ query", async () => {
    await get("learners");
    expect(getLearnerReport).toHaveBeenLastCalledWith("c-1", { range: 90 });
    await get("learners", "?range=30");
    expect(getLearnerReport).toHaveBeenLastCalledWith("c-1", { range: 30 });
    await get("learners", "?range=all");
    expect(getLearnerReport).toHaveBeenLastCalledWith("c-1", { range: "all" });
  });

  it("lọc theo lô: 'loose' là mã lẻ (null), bỏ trống là mọi lô", async () => {
    await get("activation", "?batch=loose");
    expect(getActivationReport).toHaveBeenLastCalledWith("c-1", { range: 90, batchId: null });
    await get("activation");
    expect(getActivationReport).toHaveBeenLastCalledWith("c-1", { range: 90, batchId: undefined });
  });

  it("trả dữ liệu kèm thời điểm tính, không cho lưu đệm dùng chung", async () => {
    const res = await get("revenue");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.data).toEqual({ currencies: [], incompleteOrders: 0 });
    expect(typeof body.generatedAt).toBe("string");
  });
});
