import { describe, expect, it } from "vitest";
import { limioHskLabel, unitNumberLabel } from "./hskLevelLabel";

describe("limioHskLabel", () => {
  it("lấy cấp từ 'Cấp N' và không nhầm số phiên bản 3.0 là cấp", () => {
    expect(limioHskLabel("Tiếng Trung chuẩn HSK 3.0 — Cấp 4 (bản gốc Limio)")).toBe("Limio HSK 4");
  });
  it("lấy cấp từ 'HSKN' dính liền", () => {
    expect(limioHskLabel("Limio HSK4 (3.0) - Quyển 1")).toBe("Limio HSK 4");
    expect(limioHskLabel("HSK 5 luyện thi")).toBe("Limio HSK 5");
  });
  it("không nhận ra cấp hoặc không phải HSK thì null", () => {
    expect(limioHskLabel("Tiếng Trung chuẩn HSK 3.0")).toBeNull();
    expect(limioHskLabel("Tiếng Anh Speakout Cấp 2")).toBeNull();
    expect(limioHskLabel("")).toBeNull();
  });
});

describe("unitNumberLabel", () => {
  it("lấy 'Chủ đề N' từ tên module", () => {
    expect(unitNumberLabel("Chủ đề 1 · 搬进新家 — Dọn về nhà mới")).toBe("Chủ đề 1");
    expect(unitNumberLabel("Chủ đề 12 · 小狗和公园")).toBe("Chủ đề 12");
    expect(unitNumberLabel("Unit 3 · Travel")).toBe("Unit 3");
  });
  it("không có số thì null", () => {
    expect(unitNumberLabel("Ôn tập tổng kết")).toBeNull();
    expect(unitNumberLabel("")).toBeNull();
  });
});
