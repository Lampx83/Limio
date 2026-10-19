import { describe, expect, it } from "vitest";
import {
  IMAGE_FRAMES,
  IMAGE_STYLES,
  autoImageFrame,
  autoImageStyles,
  frameApplies,
  imageStyleFits,
  resolveImageFrame,
  resolveImageStyle,
} from "./limioLiveImageStyle";
import { mergeSlideMeta, pickMeta } from "./limioLiveSlides";

/** Kiểu trình bày và khung hình của bố cục Chữ và hình — docs/tieu-chi/chu-va-hinh-kieu-khung.md (K1–K15). */

const PHOTO = "/api/limio-live-resource/a.png";
const img = (o: Record<string, unknown> = {}) => ({ layout: "image", title: "Thực tế tăng cường", bullets: ["Ý một.", "Ý hai.", "Ý ba."], ...o });
const s = (id: string, config: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ id, type: "content", config, ...extra });

describe("danh sách (K1, K7)", () => {
  it("sáu kiểu và bảy khung, kiểu đầu là kiểu hiện có", () => {
    expect(IMAGE_STYLES).toEqual(["right", "left", "bleed", "top", "overlay", "inset"]);
    expect(IMAGE_FRAMES).toEqual(["round", "circle", "arch", "hex", "blob", "leaf", "offset"]);
  });
});

describe("imageStyleFits (K3, K5)", () => {
  it("hình trên và hình nền chỉ khi có ảnh thật", () => {
    expect(imageStyleFits("top", img())).toBe(false);
    expect(imageStyleFits("overlay", img())).toBe(false);
    expect(imageStyleFits("top", img({ imageUrl: PHOTO }))).toBe(true);
    expect(imageStyleFits("overlay", img({ imageUrl: PHOTO }))).toBe(true);
  });
  it("hình trên cần 2 đến 3 ý", () => {
    expect(imageStyleFits("top", img({ imageUrl: PHOTO, bullets: ["Một.", "Hai.", "Ba.", "Bốn."] }))).toBe(false);
    expect(imageStyleFits("top", img({ imageUrl: PHOTO, bullets: ["Một."] }))).toBe(false);
  });
  it("chữ dài không dùng hình trên và hình nền", () => {
    const long = img({ imageUrl: PHOTO, bullets: ["Một câu rất dài ".repeat(12), "Câu thứ hai cũng dài ".repeat(5), "Ba."] });
    expect(imageStyleFits("top", long)).toBe(false);
    expect(imageStyleFits("overlay", long)).toBe(false);
    expect(imageStyleFits("inset", long)).toBe(true);
  });
  it("các kiểu còn lại luôn hợp", () => {
    for (const k of ["right", "left", "bleed", "inset"] as const) expect(imageStyleFits(k, img())).toBe(true);
  });
});

describe("resolveImageStyle (K2, K3)", () => {
  it("chọn tay thắng tự động", () => {
    expect(resolveImageStyle(img({ imageStyle: "left" }), "bleed")).toBe("left");
  });
  it("tự động dùng kiểu hệ thống chọn; không có thì hình bên phải", () => {
    expect(resolveImageStyle(img(), "bleed")).toBe("bleed");
    expect(resolveImageStyle(img())).toBe("right");
  });
  it("chọn tay kiểu không hợp thì vẽ như hình bên phải", () => {
    expect(resolveImageStyle(img({ imageStyle: "overlay" }))).toBe("right");
  });
  it("giá trị lạ coi như tự động", () => {
    expect(resolveImageStyle(img({ imageStyle: "zigzag" }), "left")).toBe("left");
  });
});

describe("autoImageStyles (K4, K5, K6)", () => {
  it("có ảnh: xoay vòng phải, tràn nửa, trái, hình trên, hình nền", () => {
    const slides = [1, 2, 3, 4, 5, 6].map((n) => s(`p${n}`, img({ imageUrl: PHOTO })));
    const m = autoImageStyles(slides);
    expect(slides.map((x) => m.get(x.id))).toEqual(["right", "bleed", "left", "top", "overlay", "right"]);
  });
  it("chưa có ảnh: phải, trái, tràn nửa, hình nhỏ", () => {
    const slides = [1, 2, 3, 4, 5].map((n) => s(`m${n}`, img()));
    const m = autoImageStyles(slides);
    expect(slides.map((x) => m.get(x.id))).toEqual(["right", "left", "bleed", "inset", "right"]);
  });
  it("bỏ qua slide khác bố cục, slide ẩn, slide đã chọn tay vẫn tính vào thứ tự", () => {
    const slides = [
      s("a", img()),
      s("b", { layout: "cards", title: "Thẻ" }),
      s("c", img({ hidden: true })),
      s("d", img({ imageStyle: "inset" })),
      s("e", img()),
      s("q", {}, { type: "quiz" }),
    ];
    const m = autoImageStyles(slides);
    expect(m.get("a")).toBe("right");
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(false);
    expect(m.has("q")).toBe(false);
    // "d" đứng thứ hai (chọn tay "inset"); "e" đứng thứ ba nhưng không được trùng "inset" của slide liền trước.
    expect(m.get("e")).not.toBe("inset");
  });
  it("hai slide Chữ và hình liền nhau không cùng kiểu, kể cả khi trộn có ảnh và chưa có ảnh", () => {
    const slides = [s("1", img({ imageUrl: PHOTO })), s("2", img({ imageUrl: PHOTO })), s("3", img()), s("4", img()), s("5", img({ imageUrl: PHOTO }))];
    const m = autoImageStyles(slides);
    const seq = slides.map((x) => m.get(x.id));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });
  it("chữ dài nhận hình nhỏ có chú thích thay cho lượt tràn nửa", () => {
    const long = img({ imageUrl: PHOTO, bullets: ["Một câu rất dài ".repeat(12), "Câu thứ hai cũng dài ".repeat(5), "Ba."] });
    const m = autoImageStyles([s("1", img({ imageUrl: PHOTO })), s("2", long)]);
    expect(m.get("2")).toBe("inset");
  });
});

describe("khung hình (K8, K9, K10)", () => {
  it("chỉ áp cho kiểu có ô hình riêng", () => {
    expect(["right", "left", "inset"].every((k) => frameApplies(k as never))).toBe(true);
    expect(["bleed", "top", "overlay"].some((k) => frameApplies(k as never))).toBe(false);
  });
  it("tự động theo hoa văn chủ đạo của bài", () => {
    expect(autoImageFrame("lucgiac")).toBe("hex");
    expect(autoImageFrame("cham")).toBe("circle");
    expect(autoImageFrame("vong")).toBe("circle");
    expect(autoImageFrame("cung")).toBe("arch");
    expect(autoImageFrame("song")).toBe("blob");
    expect(autoImageFrame("gach")).toBe("round");
    expect(autoImageFrame(null)).toBe("round");
  });
  it("slide thắng bài, bài thắng tự động", () => {
    expect(resolveImageFrame({ config: img({ imageFrame: "leaf" }), deckFrame: "hex", deckMotif: "cham" })).toBe("leaf");
    expect(resolveImageFrame({ config: img(), deckFrame: "hex", deckMotif: "cham" })).toBe("hex");
    expect(resolveImageFrame({ config: img(), deckFrame: null, deckMotif: "cham" })).toBe("circle");
    expect(resolveImageFrame({ config: img({ imageFrame: "xx" }), deckFrame: "zz", deckMotif: null })).toBe("round");
  });
});

describe("khoá meta (K2, K10, K15)", () => {
  it("pickMeta giữ kiểu và khung hợp lệ, bỏ giá trị lạ", () => {
    expect(pickMeta(img({ imageStyle: "left", imageFrame: "hex" }))).toMatchObject({ imageStyle: "left", imageFrame: "hex" });
    const m = pickMeta(img({ imageStyle: "zigzag", imageFrame: "star" }));
    expect(m.imageStyle).toBeUndefined();
    expect(m.imageFrame).toBeUndefined();
  });
  it("đổi kiểu hay khung không làm slide AI thành đã sửa tay", () => {
    const old = img({ aiGenerated: true, outlineId: "o1" });
    expect(mergeSlideMeta(old, { ...old, imageStyle: "left" }).editedByUser).toBeUndefined();
    expect(mergeSlideMeta(old, { ...old, imageFrame: "circle" }).editedByUser).toBeUndefined();
    expect(mergeSlideMeta(old, { ...old, title: "Tiêu đề khác" }).editedByUser).toBe(true);
  });
});
