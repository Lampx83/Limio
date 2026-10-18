import { describe, expect, it } from "vitest";
import {
  MOTIF_LABELS,
  SLIDE_MOTIFS,
  hash32,
  hexColorsIn,
  isMotifChoice,
  isSlideMotifChoice,
  motifAfterRegenerate,
  slideArtLabel,
  motifImageOrdinals,
  motifOpacityCap,
  motifSlot,
  resolveSlideMotif,
} from "./limioLiveMotifs";
import { motifSvgBody } from "./limioLiveMotifArt";
import { mergeSlideMeta, normalizeContentSlideConfig, pickMeta, sanitizeLayoutConfig } from "./limioLiveSlides";
import { contrastRatio, hexToRgb } from "./limioLiveBrand";
import { SLIDE_ILLUSTRATIONS, SLIDE_ILLUSTRATION_GROUPS, SLIDE_ILLUSTRATION_LABELS, SLIDE_ILLUSTRATION_TOPICS } from "@feedbackme/shared-types";

/** Màu của nền sau khi phủ `ink` với độ đậm a, dạng #RRGGBB (để kiểm tra độc lập với hàm đang test). */
const mixHex = (ink: string, bg: string, a: number): string => {
  const [x, y] = [hexToRgb(ink)!, hexToRgb(bg)!];
  return "#" + x.map((c, i) => Math.round(c * a + y[i]! * (1 - a)).toString(16).padStart(2, "0")).join("");
};

const cover = { layout: "cover", title: "Bìa" };
const section = { layout: "section", title: "Phần 1" };
const sectionToc = { layout: "section", title: "Phần 2", toc: ["Một", "Hai", "Ba"], tocCurrent: 2 };
const quote = { layout: "quote", quote: "Học là làm." };
const image = { layout: "image", title: "Chữ và hình", bullets: ["a"] };
const photo = { layout: "image", title: "Có ảnh", bullets: ["a"], imageUrl: "/api/x.png" };

describe("bộ hoa văn", () => {
  it("16 hoa văn, mã không trùng, đều có tên hiển thị", () => {
    expect(SLIDE_MOTIFS).toHaveLength(16);
    expect(new Set(SLIDE_MOTIFS).size).toBe(16);
    for (const id of SLIDE_MOTIFS) expect(MOTIF_LABELS[id]).toBeTruthy();
  });

  it("hình chỉ tô bằng biến giao diện, không có màu cứng hay ảnh ngoài", () => {
    for (const id of SLIDE_MOTIFS) {
      const body = motifSvgBody(id, 464, 500, "x1");
      expect(body.length).toBeGreaterThan(100);
      expect(body).not.toMatch(/(fill|stroke)="#|stop-color:#/i);
      expect(body).not.toMatch(/<image|href=|https?:/);
      expect(body).not.toContain("__ID__");
    }
  });

  it("cùng hoa văn, cùng cỡ thì luôn ra cùng một hình; id nội bộ theo tiền tố của nơi vẽ", () => {
    expect(motifSvgBody("diemnoi", 600, 440)).toBe(motifSvgBody("diemnoi", 600, 440));
    expect(motifSvgBody("soc", 600, 440, "a")).toContain('url(#ac)');
    expect(motifSvgBody("soc", 600, 440, "b")).toContain('url(#bc)');
  });
});

describe("chỗ đặt hoa văn theo bố cục", () => {
  it("bìa ở dải phải, bìa phần ở góc dưới phải, bìa phần có mục lục ở góc dưới trái, trích dẫn ở góc trên phải", () => {
    expect(motifSlot(cover)).toBe("side");
    expect(motifSlot(section)).toBe("br");
    expect(motifSlot(sectionToc)).toBe("bl");
    expect(motifSlot(quote)).toBe("tr");
    expect(motifSlot(image)).toBe("fill");
  });

  it("bố cục nhiều chữ, slide có ảnh và slide chèn học liệu không có hoa văn", () => {
    for (const layout of ["cards", "compare", "steps", "stats", "summary", "classic"]) expect(motifSlot({ layout })).toBeNull();
    expect(motifSlot(photo)).toBeNull();
    expect(motifSlot({ ...cover, resource: { type: "video" } })).toBeNull();
    expect(motifSlot(null)).toBeNull();
  });

  it("mục lục chưa hợp lệ (ít hơn 2 phần, phần hiện tại ngoài khoảng) thì coi như bìa phần thường", () => {
    expect(motifSlot({ ...section, toc: ["Một"], tocCurrent: 1 })).toBe("br");
    expect(motifSlot({ ...section, toc: ["Một", "Hai"], tocCurrent: 3 })).toBe("br");
  });
});

describe("tự chọn hoa văn", () => {
  const deckId = "4f1d2c3b-0000-4000-8000-000000000001";

  it("bìa, bìa phần và trích dẫn cùng dùng hoa văn chủ đạo suy ra từ mã bài giảng", () => {
    const base = SLIDE_MOTIFS[hash32(deckId) % 16];
    for (const config of [cover, section, sectionToc, quote]) expect(resolveSlideMotif({ deckId, config })?.motif).toBe(base);
  });

  it("ổn định: cùng bài giảng luôn ra cùng hoa văn; bài khác nhau rải đều trên bộ hoa văn", () => {
    expect(resolveSlideMotif({ deckId, config: cover })).toEqual(resolveSlideMotif({ deckId, config: cover }));
    const seen = new Set(Array.from({ length: 400 }, (_, i) => resolveSlideMotif({ deckId: `deck-${i}`, config: cover })!.motif));
    expect(seen.size).toBe(16);
  });

  it("ô hình không trùng hoa văn chủ đạo, hai ô liền nhau khác nhau, đi hết 15 hoa văn còn lại mới lặp", () => {
    const base = resolveSlideMotif({ deckId, config: cover })!.motif;
    const seq = Array.from({ length: 15 }, (_, k) => resolveSlideMotif({ deckId, config: image, imageOrdinal: k })!.motif);
    expect(seq).not.toContain(base);
    expect(new Set(seq).size).toBe(15);
    for (let k = 1; k < seq.length; k++) expect(seq[k]).not.toBe(seq[k - 1]);
    expect(resolveSlideMotif({ deckId, config: image, imageOrdinal: 15 })!.motif).toBe(seq[0]);
  });

  it("hoa văn chủ đạo do giảng viên chọn cho cả bài thay cho hoa văn tự động", () => {
    expect(resolveSlideMotif({ deckId, deckChoice: "tia", config: cover })?.motif).toBe("tia");
    expect(resolveSlideMotif({ deckId, deckChoice: "tia", config: image, imageOrdinal: 0 })?.motif).not.toBe("tia");
  });

  it("tắt cho cả bài thì không slide nào có hoa văn, trừ slide được chọn riêng", () => {
    expect(resolveSlideMotif({ deckId, deckChoice: "none", config: cover })).toBeNull();
    expect(resolveSlideMotif({ deckId, deckChoice: "none", config: { ...cover, motif: "song" } })).toEqual({ motif: "song", slot: "side" });
  });

  it("lựa chọn riêng của slide thắng lựa chọn của cả bài; 'none' tắt riêng slide đó", () => {
    expect(resolveSlideMotif({ deckId, deckChoice: "tia", config: { ...quote, motif: "cham" } })?.motif).toBe("cham");
    expect(resolveSlideMotif({ deckId, deckChoice: "tia", config: { ...quote, motif: "none" } })).toBeNull();
  });

  it("giá trị lạ (dữ liệu cũ, gõ sai) được coi như tự động", () => {
    const auto = resolveSlideMotif({ deckId, config: cover });
    expect(resolveSlideMotif({ deckId, deckChoice: "hoa-hong", config: { ...cover, motif: 42 } })).toEqual(auto);
    expect(isMotifChoice("hoa-hong")).toBe(false);
    expect(isMotifChoice("none")).toBe(true);
  });

  it("slide có ảnh không bao giờ có hoa văn, kể cả khi chọn riêng", () => {
    expect(resolveSlideMotif({ deckId, config: { ...photo, motif: "song" } })).toBeNull();
  });

  it("thứ tự ô hình chỉ đếm slide Chữ và hình chưa có ảnh, theo thứ tự trình chiếu", () => {
    const ord = motifImageOrdinals([
      { id: "a", type: "content", config: cover },
      { id: "b", type: "content", config: image },
      { id: "c", type: "quiz", config: { layout: "image" } },
      { id: "d", type: "content", config: photo },
      { id: "e", type: "content", config: image },
    ]);
    expect([...ord]).toEqual([
      ["b", 0],
      ["e", 1],
    ]);
  });
});

describe("lưu lựa chọn hoa văn của slide", () => {
  it("là khoá meta: giữ khi lưu, khi đổi bố cục và khi AI viết lại; bỏ giá trị lạ", () => {
    expect(pickMeta({ motif: "song" }).motif).toBe("song");
    expect(pickMeta({ motif: "none" }).motif).toBe("none");
    expect(pickMeta({ motif: "<svg>" }).motif).toBeUndefined();
    expect((normalizeContentSlideConfig({ layout: "section", title: "x", motif: "tia" }) as Record<string, unknown>).motif).toBe("tia");
    expect(sanitizeLayoutConfig("cover", { title: "x", motif: "song" }).motif).toBeUndefined();
  });

  it("đổi hoa văn của slide do AI sinh không tính là sửa tay nội dung", () => {
    const old = { layout: "cover", title: "x", outlineId: "o1", aiGenerated: true };
    expect(mergeSlideMeta(old, { ...old, motif: "cham" }).editedByUser).toBeUndefined();
    expect(mergeSlideMeta(old, { ...old, title: "y" }).editedByUser).toBe(true);
  });
});

describe("độ đậm an toàn cho chữ", () => {
  const light = { inks: ["#4D7C0F", "#BE185D"], bgs: ["#FFFFFF"], text: "#20241F", muted: "#5A6256", accent: "#4D7C0F" };

  it("ở độ đậm trả về, chữ vẫn đạt ngưỡng; nhích thêm 0,02 thì không còn bảo đảm", () => {
    const cap = motifOpacityCap(light);
    expect(cap).toBeGreaterThan(0.05);
    expect(cap).toBeLessThan(0.5);
    const worst = (a: number) =>
      Math.min(
        ...light.inks.flatMap((ink) => {
          const bg = mixHex(ink, "#FFFFFF", a);
          return [contrastRatio(light.text, bg) / 4.5, contrastRatio(light.muted, bg) / 4.5, contrastRatio(light.accent, bg) / 3];
        }),
      );
    expect(worst(cap)).toBeGreaterThanOrEqual(1);
    expect(worst(cap + 0.02)).toBeLessThan(1);
  });

  it("chữ đã sát ngưỡng ngay trên nền trơn thì không có độ đậm nào an toàn", () => {
    expect(motifOpacityCap({ ...light, muted: "#8A8A8A" })).toBe(0);
    expect(motifOpacityCap({ ...light, bgs: [] })).toBe(0);
  });

  it("đọc được các màu của nền dải màu", () => {
    expect(hexColorsIn("linear-gradient(135deg,#F3FADC 0%,#FDEBF3 100%)")).toEqual(["#F3FADC", "#FDEBF3"]);
    expect(hexColorsIn("#FFFFFF")).toEqual(["#FFFFFF"]);
  });
});

describe("hình minh hoạ theo chủ đề (chỉ ở ô hình)", () => {
  const deckId = "deck_hinh";

  it("24 hình, mã không trùng với nhau và không trùng mã hoa văn, đều có tên hiển thị và chủ đề cho AI", () => {
    expect(SLIDE_ILLUSTRATIONS).toHaveLength(24);
    expect(new Set([...SLIDE_ILLUSTRATIONS, ...SLIDE_MOTIFS]).size).toBe(40);
    for (const id of SLIDE_ILLUSTRATIONS) {
      expect(slideArtLabel(id)).toBe(SLIDE_ILLUSTRATION_LABELS[id]);
      expect(SLIDE_ILLUSTRATION_TOPICS[id]).toBeTruthy();
    }
  });

  it("năm nhóm chủ đề, mỗi hình nằm đúng một nhóm", () => {
    expect(SLIDE_ILLUSTRATION_GROUPS.map((g) => g.label)).toEqual([
      "Học tập và sáng tạo",
      "Con người và xã hội",
      "Khoa học và công nghệ",
      "Tự nhiên và Trái Đất",
      "Kinh tế và phát triển",
    ]);
    const all = SLIDE_ILLUSTRATION_GROUPS.flatMap((g) => g.ids);
    expect(all).toHaveLength(SLIDE_ILLUSTRATIONS.length);
    expect(new Set(all)).toEqual(new Set(SLIDE_ILLUSTRATIONS));
  });

  it("hình chỉ tô bằng biến giao diện, không có màu cứng hay ảnh ngoài; ô vuông nhỏ thì thu theo tỉ lệ", () => {
    for (const id of SLIDE_ILLUSTRATIONS) {
      const body = motifSvgBody(id, 464, 500, "x1");
      expect(body.length).toBeGreaterThan(100);
      expect(body).toContain("var(--sa)");
      expect(body).not.toMatch(/(fill|stroke)="#|stop-color:#/i);
      expect(body).not.toMatch(/<image|href=|https?:/);
      expect(body).not.toContain("__ID__");
      expect(motifSvgBody(id, 240, 240, "x2")).toMatch(/^<g transform="translate\([-\d.]+ [-\d.]+\) scale\([\d.]+\)">/);
    }
  });

  it("Chữ và hình chưa có ảnh: hình chọn riêng cho slide được vẽ ở ô hình, kể cả khi bài tắt hoa văn", () => {
    expect(resolveSlideMotif({ deckId, config: { ...image, motif: "ketnoi" } })).toEqual({ motif: "ketnoi", slot: "fill" });
    expect(resolveSlideMotif({ deckId, deckChoice: "none", config: { ...image, motif: "antoan" } })).toEqual({ motif: "antoan", slot: "fill" });
  });

  it("bố cục khác hoặc slide đã có ảnh: mã hình bị bỏ qua, chỗ trang trí quay về hoa văn của bài", () => {
    for (const c of [cover, section, quote]) {
      expect(resolveSlideMotif({ deckId, config: { ...c, motif: "ketnoi" } })).toEqual(resolveSlideMotif({ deckId, config: c }));
    }
    expect(resolveSlideMotif({ deckId, config: { ...photo, motif: "ketnoi" } })).toBeNull();
  });

  it("slide có hình vẫn giữ chỗ trong vòng xoay hoa văn, nên các ô hình khác không đổi hoa văn", () => {
    const slides = [
      { id: "a", type: "content", config: image },
      { id: "b", type: "content", config: { ...image, motif: "thoigian" } },
      { id: "c", type: "content", config: image },
    ];
    expect(motifImageOrdinals(slides).get("c")).toBe(2);
  });

  it("lưu được ở slide (khoá meta) nhưng không phải lựa chọn cho cả bài", () => {
    expect(isSlideMotifChoice("ketnoi")).toBe(true);
    expect(isSlideMotifChoice("song")).toBe(true);
    expect(isSlideMotifChoice("none")).toBe(true);
    expect(isSlideMotifChoice("maytinh")).toBe(false);
    expect(isMotifChoice("ketnoi")).toBe(false);
    expect(pickMeta({ motif: "ketnoi" }).motif).toBe("ketnoi");
    expect((normalizeContentSlideConfig({ layout: "cover", title: "x", motif: "ketnoi" }) as Record<string, unknown>).motif).toBe("ketnoi");
  });

  it("viết lại slide từ dàn ý: giữ hoa văn hay “Không dùng” của giảng viên; hình cũ nhường cho hình AI vừa chọn", () => {
    expect(motifAfterRegenerate("song", "ketnoi")).toBe("song");
    expect(motifAfterRegenerate("none", "ketnoi")).toBe("none");
    expect(motifAfterRegenerate("thoigian", "ketnoi")).toBe("ketnoi");
    expect(motifAfterRegenerate("thoigian", undefined)).toBe("thoigian");
    expect(motifAfterRegenerate(undefined, "ketnoi")).toBe("ketnoi");
    expect(motifAfterRegenerate(undefined, undefined)).toBeUndefined();
    expect(motifAfterRegenerate("<svg>", "maytinh")).toBeUndefined();
  });
});
