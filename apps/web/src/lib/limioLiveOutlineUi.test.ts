import { describe, expect, it } from "vitest";
import {
  OUTLINE_KIND_GROUPS,
  OUTLINE_KIND_HINT,
  OUTLINE_KIND_LABEL,
  OUTLINE_KIND_ORDER,
  OUTLINE_KIND_TITLE,
  OUTLINE_LAYOUT_UI,
  OUTLINE_POINT_LABELS,
  changeKind,
  glyphKey,
  joinPoint,
  kindGroupOf,
  pointStatus,
  rowSubtitle,
  splitPoint,
} from "./limioLiveOutlineUi";
import { OUTLINE_KINDS, OUTLINE_LAYOUTS, type OutlineSlide } from "./limioLiveOutline";

const slide = (p: Partial<OutlineSlide>): OutlineSlide => ({ id: "a", kind: "content", layout: "image", title: "T", points: [], ...p });

describe("danh mục loại slide", () => {
  it("lưới có đủ 7 loại, ba loại cộng tác đứng đầu, mỗi loại có tên, nhãn ô nhập và nhóm", () => {
    expect(OUTLINE_KIND_ORDER).toEqual(["collaborate_board", "draw_it", "whiteboard", "content", "quiz", "poll", "word_cloud"]);
    expect([...OUTLINE_KIND_ORDER].sort()).toEqual([...OUTLINE_KINDS].sort());
    for (const k of OUTLINE_KINDS) {
      expect(OUTLINE_KIND_LABEL[k]).toBeTruthy();
      expect(OUTLINE_KIND_TITLE[k]).toBeTruthy();
      expect(kindGroupOf(k)).toBeTruthy();
      if (k !== "content") expect(OUTLINE_KIND_HINT[k]).toBeTruthy();
    }
    expect(OUTLINE_KIND_GROUPS.map((g) => g.group)).toEqual(["Cộng tác trên bảng", "Trình bày", "Hỏi và lấy ý kiến"]);
  });
  it("tên khớp bộ chọn loại slide của trình sửa bài giảng", () => {
    expect(OUTLINE_KIND_LABEL.collaborate_board).toBe("Dán Note");
    expect(OUTLINE_KIND_LABEL.draw_it).toBe("Draw-it (vẽ)");
    expect(OUTLINE_KIND_LABEL.whiteboard).toBe("Whiteboard");
    expect(OUTLINE_KIND_LABEL.word_cloud).toBe("Word Cloud");
  });
  it("mọi bố cục có mô tả, khoảng số ý và nhãn cho từng ý", () => {
    for (const l of OUTLINE_LAYOUTS) {
      const u = OUTLINE_LAYOUT_UI[l];
      expect(u.label && u.hint && u.need).toBeTruthy();
      expect(u.min).toBeLessThanOrEqual(u.max);
      expect(OUTLINE_POINT_LABELS[l].length).toBeGreaterThanOrEqual(u.max);
    }
  });
});

describe("splitPoint / joinPoint", () => {
  it("tách và nối lại đúng, dữ liệu vẫn là một chuỗi", () => {
    expect(splitPoint("Mục tiêu: nêu rõ đích đến.")).toEqual(["Mục tiêu", "nêu rõ đích đến."]);
    expect(joinPoint("Mục tiêu", "nêu rõ đích đến.")).toBe("Mục tiêu: nêu rõ đích đến.");
  });
  it("không có tiêu đề thì giữ nguyên câu; dấu hai chấm không theo sau khoảng trắng không bị tách", () => {
    expect(splitPoint("Tỷ lệ 3:1 là hợp lý.")).toEqual(["", "Tỷ lệ 3:1 là hợp lý."]);
    expect(joinPoint("", "Chỉ có câu.")).toBe("Chỉ có câu.");
  });
  it("tiêu đề đã gõ mà chưa có giải thích vẫn đọc lại đúng sau khi lưu (bị cắt khoảng trắng cuối)", () => {
    expect(splitPoint(joinPoint("Bước một", "").trim())).toEqual(["Bước một", ""]);
  });
});

describe("pointStatus", () => {
  it("đếm ý có chữ so với yêu cầu của bố cục", () => {
    expect(pointStatus("cards", ["a", "b", ""]).ok).toBe(false);
    expect(pointStatus("cards", ["a", "b", "c"])).toEqual({ n: 3, ok: true, need: "3 ý" });
    expect(pointStatus("section", []).ok).toBe(true);
  });
});

describe("dòng trong danh sách", () => {
  it("slide nội dung: hình theo bố cục, dòng phụ là bố cục và số ý có chữ", () => {
    const s = slide({ layout: "cards", points: ["a: b", "c: d", ""] });
    expect(glyphKey(s)).toBe("cards");
    expect(rowSubtitle(s)).toBe("Ba thẻ · 2 ý");
  });
  it("slide tương tác: hình và dòng phụ theo loại", () => {
    const s = slide({ kind: "draw_it", layout: null });
    expect(glyphKey(s)).toBe("draw_it");
    expect(rowSubtitle(s)).toBe("Draw-it (vẽ)");
  });
});

describe("changeKind", () => {
  it("nội dung → tương tác: bỏ bố cục và ý, không đụng tới tiêu đề", () => {
    const p = changeKind(slide({ layout: "steps", points: ["a: b"] }), "whiteboard");
    expect(p).toEqual({ kind: "whiteboard", layout: null, points: [] });
    expect(p).not.toHaveProperty("title");
  });
  it("tương tác → nội dung: bố cục mặc định, bắt đầu bằng một ý trống", () => {
    expect(changeKind(slide({ kind: "quiz", layout: null }), "content")).toEqual({ kind: "content", layout: "image", points: [""] });
  });
  it("giữa hai loại tương tác: chỉ đổi loại", () => {
    expect(changeKind(slide({ kind: "poll", layout: null }), "collaborate_board")).toEqual({ kind: "collaborate_board", layout: null, points: [] });
  });
  it("chọn lại đúng loại đang có thì không đổi gì (không mất ý đã gõ)", () => {
    expect(changeKind(slide({ points: ["x"] }), "content")).toEqual({});
  });
});
