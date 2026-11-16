import { beforeEach, describe, expect, it, vi } from "vitest";

/** CSV đối soát (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC3): kiểm quyền, có BOM, không lưu đệm, ghi sự kiện xuất. */

const { requireUserId, canViewCourseReport, exportRevenueCsv, recordReportExported } = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  canViewCourseReport: vi.fn(),
  exportRevenueCsv: vi.fn(),
  recordReportExported: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-lms", async (importActual) => {
  const actual = await importActual<typeof import("@feedbackme/core-lms")>();
  return { ...actual, canViewCourseReport, exportRevenueCsv, recordReportExported };
});

const get = () =>
  import("./route").then(({ GET }) =>
    GET(new Request("http://x/api/reports/courses/c-1/revenue-export"), { params: { courseId: "c-1" } }),
  );

describe("GET …/revenue-export", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue("u-1");
    canViewCourseReport.mockReset().mockResolvedValue(true);
    exportRevenueCsv.mockReset().mockResolvedValue({
      csv: "﻿Mã đơn,Số tiền\r\no-1,200000",
      filename: "doi-soat-on-thi-10-2026-11-16.csv",
    });
    recordReportExported.mockReset().mockResolvedValue(undefined);
  });

  it("không có quyền → 403, không xuất, không ghi sự kiện", async () => {
    canViewCourseReport.mockResolvedValue(false);
    expect((await get()).status).toBe(403);
    expect(exportRevenueCsv).not.toHaveBeenCalled();
    expect(recordReportExported).not.toHaveBeenCalled();
  });

  it("trả tệp CSV có BOM, tên theo khoá, không lưu đệm, có ghi sự kiện xuất", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="doi-soat-on-thi-10-2026-11-16.csv"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(recordReportExported).toHaveBeenCalledWith("u-1", "c-1", "revenue_csv");
  });
});
