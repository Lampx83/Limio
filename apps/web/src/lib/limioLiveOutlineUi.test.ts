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
  addContentPart,
  addSlideToPart,
  moveSlide,
  partRuns,
  patchSlide,
  removeSlide,
  renamePart,
  restoreSlide,
} from "./limioLiveOutlineUi";
import { OUTLINE_KINDS, OUTLINE_LAYOUTS, sanitizeOutline, type Outline, type OutlineSlide } from "./limioLiveOutline";

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

describe("thao tác trên phần của dàn ý", () => {
  const c = (id: string, partId: string, title: string, layout: OutlineSlide["layout"] = "image"): OutlineSlide => ({ id, partId, kind: "content", layout, title, points: ["Một câu."] });
  const base = (): Outline =>
    sanitizeOutline({
      title: "AR",
      parts: [
        { id: "cv", role: "cover", name: "" },
        { id: "ag", role: "agenda", name: "" },
        { id: "hk", role: "hook", name: "" },
        { id: "c1", role: "content", name: "Khái niệm" },
        { id: "c2", role: "content", name: "Ứng dụng" },
        { id: "sm", role: "summary", name: "" },
      ],
      slides: [
        c("1", "cv", "Bìa", "cover"),
        c("2", "ag", "Nội dung buổi học", "summary"),
        c("3", "hk", "Hook"),
        c("4", "c1", "Khái niệm", "section"),
        c("5", "c1", "AR là gì"),
        c("6", "c2", "Ứng dụng", "section"),
        c("7", "c2", "Ba nhóm"),
        c("8", "sm", "Kết", "summary"),
      ],
    });
  const ids = (o: Outline) => o.slides.map((s) => s.id).join("");
  const partOf = (o: Outline, id: string) => o.slides.find((s) => s.id === id)!.partId;

  it("partRuns: khoảng slide và số thứ tự phần Nội dung", () => {
    expect(partRuns(base()).map((r) => [r.part.id, r.from, r.to, r.ordinal])).toEqual([
      ["cv", 0, 0, 0],
      ["ag", 1, 1, 0],
      ["hk", 2, 2, 0],
      ["c1", 3, 4, 1],
      ["c2", 5, 6, 2],
      ["sm", 7, 7, 0],
    ]);
  });

  it("thả lên một slide: vào chỗ slide đó và thuộc phần của nó", () => {
    const o = moveSlide(base(), "5", { over: "7" });
    expect(ids(o)).toBe("12346758");
    expect(partOf(o, "5")).toBe("c2");
    const up = moveSlide(base(), "7", { over: "5" });
    expect(ids(up)).toBe("12347568");
    expect(partOf(up, "7")).toBe("c1");
  });

  it("thả lên tên phần thành slide đầu; thả lên cuối phần thành slide cuối", () => {
    const a = moveSlide(base(), "3", { start: "c2" });
    expect(ids(a)).toBe("12453678");
    expect(partOf(a, "3")).toBe("c2");
    expect(a.parts.some((p) => p.id === "hk")).toBe(false);
    const b = moveSlide(base(), "7", { end: "c1" });
    expect(ids(b)).toBe("12345768");
    expect(partOf(b, "7")).toBe("c1");
  });

  it("xoá rồi hoàn tác: slide và phần trở lại đúng chỗ", () => {
    const { outline, removed } = removeSlide(base(), "3");
    expect(outline.parts.some((p) => p.id === "hk")).toBe(false);
    const back = restoreSlide(outline, removed!);
    expect(ids(back)).toBe("12345678");
    expect(partRuns(back).map((r) => r.part.id)).toEqual(["cv", "ag", "hk", "c1", "c2", "sm"]);
  });

  it("không xoá được slide cuối cùng", () => {
    const one = sanitizeOutline({ parts: [{ id: "x", role: "content", name: "X" }], slides: [c("1", "x", "Một")] });
    expect(removeSlide(one, "1").removed).toBeNull();
  });

  it("thêm slide vào cuối một phần", () => {
    const { outline, id } = addSlideToPart(base(), "c1");
    expect(outline.slides[5]!.id).toBe(id);
    expect(partOf(outline, id)).toBe("c1");
  });

  it("thêm phần Nội dung trước Tổng kết; buổi đủ mạch có slide Mở phần, Mục lục cập nhật", () => {
    const { outline, partId } = addContentPart(base(), true, "Thiết kế");
    const runs = partRuns(outline);
    expect(runs.map((r) => r.part.id).slice(-2)).toEqual([partId, "sm"]);
    expect(outline.slides.find((s) => s.partId === partId)).toMatchObject({ layout: "section", title: "Thiết kế" });
    expect(outline.slides[1]!.points).toEqual(["Khái niệm", "Ứng dụng", "Thiết kế"]);
    const short = addContentPart(base(), false).outline;
    expect(short.slides.find((s) => s.partId === partRuns(short).at(-2)!.part.id)).toMatchObject({ layout: "image" });
  });

  it("đổi tên phần đổi tiêu đề slide mở phần và Mục lục; sửa tiêu đề slide mở phần đổi tên phần", () => {
    const a = renamePart(base(), "c1", "Bản chất của AR");
    expect(a.slides[3]!.title).toBe("Bản chất của AR");
    expect(a.slides[1]!.points[0]).toBe("Bản chất của AR");
    const b = patchSlide(base(), "6", { title: "Dùng AR trong lớp" });
    expect(b.parts.find((p) => p.id === "c2")!.name).toBe("Dùng AR trong lớp");
    expect(b.slides[1]!.points).toEqual(["Khái niệm", "Dùng AR trong lớp"]);
    expect(renamePart(base(), "c1", "   ")).toEqual(base());
  });
});
