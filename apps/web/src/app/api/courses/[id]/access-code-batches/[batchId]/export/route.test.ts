import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessCodeError, CourseAuthzError } from "@feedbackme/core-lms";

/** Xuất CSV mã kích hoạt (AC2): chỉ người sửa được khoá; tệp đúng định dạng, không cho lưu đệm. */

const { requireUserId, assertCanEditCourse, exportBatchCodesCsv } = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  assertCanEditCourse: vi.fn(),
  exportBatchCodesCsv: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-lms", async (importActual) => {
  const actual = await importActual<typeof import("@feedbackme/core-lms")>();
  return { ...actual, assertCanEditCourse, exportBatchCodesCsv };
});

const ctx = { params: { id: "c-1", batchId: "b-1" } };
const get = (qs = "") =>
  import("./route").then(({ GET }) => GET(new Request(`http://x/api/courses/c-1/access-code-batches/b-1/export${qs}`), ctx));

describe("GET …/access-code-batches/[batchId]/export", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue("u-1");
    assertCanEditCourse.mockReset().mockResolvedValue(undefined);
    exportBatchCodesCsv.mockReset().mockResolvedValue({ csv: "﻿STT,Mã\r\n1,AAAA-BBBB-CCCC\r\n", filename: "ma-kich-hoat-lo.csv", count: 1 });
  });

  it("chưa đăng nhập → 401, không xuất", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(exportBatchCodesCsv).not.toHaveBeenCalled();
  });

  it("không có quyền sửa khoá → 403, không xuất (không ghi sự kiện xuất)", async () => {
    assertCanEditCourse.mockRejectedValue(new CourseAuthzError("forbidden"));
    expect((await get()).status).toBe(403);
    expect(exportBatchCodesCsv).not.toHaveBeenCalled();
  });

  it("lô không thuộc khoá → 404", async () => {
    exportBatchCodesCsv.mockRejectedValue(new AccessCodeError("batch_not_found"));
    expect((await get()).status).toBe(404);
  });

  it("trả CSV đính kèm, no-store; mặc định xuất mã chưa dùng, ?scope=all xuất tất cả", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="ma-kich-hoat-lo.csv"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    // res.text() bỏ BOM khi giải mã, nên kiểm trên byte: phải mở đầu bằng EF BB BF để Excel nhận UTF-8.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe("STT,Mã\r\n1,AAAA-BBBB-CCCC\r\n");
    expect(exportBatchCodesCsv).toHaveBeenLastCalledWith("c-1", "b-1", "u-1", { scope: "unused" });

    await get("?scope=all");
    expect(exportBatchCodesCsv).toHaveBeenLastCalledWith("c-1", "b-1", "u-1", { scope: "all" });
    await get("?scope=bậy");
    expect(exportBatchCodesCsv).toHaveBeenLastCalledWith("c-1", "b-1", "u-1", { scope: "unused" });
  });
});
