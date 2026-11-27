import { describe, expect, it } from "vitest";
import { ORG_KINDS } from "@feedbackme/core-lms";
import { SPACE_EDITABLE_COPY, SPACE_TEMPLATES, isBlankSpace, templateForKind, templatesForKind } from "../templates";
import { isHexColor } from "../theme";
import { normalizeStored } from "../settings";
import { SPACE_LANGS } from "../types";

describe("mẫu space theo loại tổ chức", () => {
  it("AC1: danh sách mẫu có mẫu của ĐÚNG loại đứng đầu, rồi các mẫu dự án như cũ", () => {
    for (const kind of ORG_KINDS) {
      const list = templatesForKind(kind, "Tổ chức thử");
      expect(list[0]).toMatchObject({ id: `kind-${kind}`, group: "kind" });
      expect(list.filter((t) => t.group === "kind")).toHaveLength(1);
      expect(list.slice(1).map((t) => t.id)).toEqual(SPACE_TEMPLATES.map((t) => t.id));
      expect(list.slice(1).every((t) => t.group === "project")).toBe(true);
    }
  });

  it("AC6: màu hợp lệ, qua normalizeStored không mất trường nào, khoá chữ nằm trong danh sách sửa được, đủ ngôn ngữ, không sót {T}", () => {
    for (const kind of ORG_KINDS) {
      const t = templateForKind(kind, "Trung tâm Ánh Dương");
      for (const c of [t.primary, t.accent, t.dark, t.soft, t.accent2]) expect(isHexColor(c ?? ""), `${kind} ${c}`).toBe(true);
      const round = normalizeStored(JSON.parse(JSON.stringify(t)));
      expect(round.name).toBe("Trung tâm Ánh Dương");
      for (const l of SPACE_LANGS) {
        const copy = t.copy?.[l] ?? {};
        expect(Object.keys(copy).sort(), `${kind} ${l}`).toEqual([...SPACE_EDITABLE_COPY].sort());
        expect(round.copy?.[l], `${kind} ${l} sau normalizeStored`).toEqual(copy);
      }
      const texts = SPACE_LANGS.flatMap((l) => Object.values(t.copy?.[l] ?? {}) as string[]);
      expect(texts.some((x) => /[{}]/.test(x)), `${kind} còn sót {T}`).toBe(false);
      expect(texts.some((x) => x.includes("Trung tâm Ánh Dương"))).toBe(true);
    }
  });

  it("AC7: chữ không hứa tính năng trang space chưa có, không nhắc học viên hay người mua", () => {
    const banned = /khai giảng|mã kích hoạt|activation|mua ngay|buy now|giỏ hàng|thanh toán|người mua|tên học viên|buyer/i;
    for (const kind of ORG_KINDS) {
      expect(JSON.stringify(templateForKind(kind, "X")), kind).not.toMatch(banned);
    }
  });

  it("mẫu theo loại không mang khoá, logo hay mã space (chỉ chữ và màu)", () => {
    for (const kind of ORG_KINDS) {
      const t = templateForKind(kind, "X");
      expect(t.courses).toBeUndefined();
      expect(t.logoUrl).toBeUndefined();
      expect(t.limioBrand).toBeUndefined();
    }
  });

  it("tên tổ chức trống thì dùng tên chung, không để trống hay sót {T}", () => {
    expect(templateForKind("school", "   ").name).toBe("Tổ chức");
  });
});

describe("isBlankSpace (AC2, AC3)", () => {
  it("chưa cấu hình gì → trống (cả khi lưu rỗng hoặc chỉ có mảng và object rỗng)", () => {
    expect(isBlankSpace(normalizeStored(null))).toBe(true);
    expect(isBlankSpace(normalizeStored({}))).toBe(true);
    expect(isBlankSpace({ courses: [], copy: { vi: {}, en: {} } })).toBe(true);
  });

  it("có bất kỳ cấu hình nào (dù chỉ có tên) → không trống, không bị mẫu ghi đè", () => {
    expect(isBlankSpace(normalizeStored({ name: "A" }))).toBe(false);
    expect(isBlankSpace({ copy: { vi: { intro: "x" } } })).toBe(false);
    expect(isBlankSpace({ courses: [{ slug: "a", title: "A" }] })).toBe(false);
    expect(isBlankSpace({ logoUrl: "/x.png" })).toBe(false);
    expect(isBlankSpace({ bundles: ["b"] })).toBe(false);
  });

  it("mẫu theo loại tự nó không phải space trống", () => {
    expect(isBlankSpace(templateForKind("center", "X"))).toBe(false);
  });
});
