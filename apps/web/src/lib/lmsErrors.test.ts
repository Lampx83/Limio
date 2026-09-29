import { describe, expect, it } from "vitest";
import { lmsErrorMessage } from "./lmsErrors";

describe("lmsErrorMessage", () => {
  it("dịch mã đã biết, không lộ mã thô", () => {
    expect(lmsErrorMessage("order_index_taken")).toMatch(/tải lại trang/);
    expect(lmsErrorMessage("empty_content")).toMatch(/chưa nhập nội dung/);
    expect(lmsErrorMessage("network_error")).toMatch(/Không kết nối/);
  });
  it("gói SCORM/H5P quá lớn sau giải nén: nói rõ giới hạn, không lộ mã thô", () => {
    expect(lmsErrorMessage("package_unpacked_too_large", 413)).toMatch(/1 GB/);
    expect(lmsErrorMessage("package_too_many_files", 413)).toMatch(/20\.000/);
  });
  it("mã có hậu tố chi tiết vẫn nhận ra phần đầu", () => {
    expect(lmsErrorMessage("upload_failed: 500")).toMatch(/Tải file lên/);
  });
  it("mã lạ rơi về câu chung theo status, không in mã", () => {
    expect(lmsErrorMessage("zzz_unknown", 500)).toMatch(/Máy chủ/);
    expect(lmsErrorMessage("zzz_unknown", 403)).toMatch(/quyền/);
    const m = lmsErrorMessage("zzz_unknown");
    expect(m).not.toContain("zzz_unknown");
    expect(lmsErrorMessage(undefined)).toBe(m);
  });
});
