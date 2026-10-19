import { describe, expect, it } from "vitest";
import { slideImageSources, slideImageThumb } from "./limioLiveImage";

const own = "/api/limio-live-resource/u1-1600x1067-1760000000000-abc123.jpg";

describe("slideImageSources", () => {
  it("ảnh đã xử lý: srcset gồm bản 480, 960 và bản hiển thị, kèm kích thước", () => {
    expect(slideImageSources(own)).toEqual({
      src: own,
      srcSet: `${own}?w=480 480w, ${own}?w=960 960w, ${own} 1600w`,
      width: 1600,
      height: 1067,
    });
  });
  it("ảnh nhỏ hơn 960 px không có bản 960 (thumbnail không phóng to)", () => {
    const small = "/api/limio-live-resource/u1-800x600-1760000000000-abc123.png";
    expect(slideImageSources(small).srcSet).toBe(`${small}?w=480 480w, ${small} 800w`);
  });
  it("URL ngoài, GIF, tài nguyên cũ không có kích thước: giữ nguyên", () => {
    for (const u of ["https://example.com/a.jpg", "/api/limio-live-resource/u1-1760000000000-abc.gif", "/api/limio-live-resource/u1-1760000000000-abc.png"]) {
      expect(slideImageSources(u)).toEqual({ src: u });
      expect(slideImageThumb(u)).toBe(u);
    }
    expect(slideImageThumb(own)).toBe(`${own}?w=480`);
  });
});

describe("lưu thông tin ảnh riêng ở ô hình", async () => {
  const { convertLayoutConfig, sanitizeLayoutConfig } = await import("./limioLiveSlides");
  const base = { title: "T", bullets: ["a"], imageUrl: own };

  it("giữ mô tả, cách đặt, nguồn ảnh, địa chỉ gốc; bỏ giá trị lạ", () => {
    const out = sanitizeLayoutConfig("image", {
      ...base,
      imageAlt: "  Sơ đồ ba bước  ",
      imageFit: "contain",
      imageCredit: "Wikimedia Commons",
      imageSourceUrl: "https://commons.wikimedia.org/a.jpg",
    });
    expect(out).toMatchObject({ imageAlt: "Sơ đồ ba bước", imageFit: "contain", imageCredit: "Wikimedia Commons", imageSourceUrl: "https://commons.wikimedia.org/a.jpg" });
    const bad = sanitizeLayoutConfig("image", { ...base, imageFit: "stretch", imageSourceUrl: "javascript:alert(1)" });
    expect(bad.imageFit).toBeUndefined();
    expect(bad.imageSourceUrl).toBeUndefined();
  });

  it("không có ảnh thì không giữ thông tin đi kèm", () => {
    const out = sanitizeLayoutConfig("image", { title: "T", bullets: ["a"], imageAlt: "x", imageFit: "contain", imageCredit: "y" });
    expect(out.imageAlt ?? out.imageFit ?? out.imageCredit).toBeUndefined();
  });

  it("đổi bố cục rồi đổi lại: ảnh và thông tin đi kèm không mất", () => {
    const img = { layout: "image", ...base, imageAlt: "Mô tả", imageFit: "contain", imageCredit: "Nguồn" };
    const back = convertLayoutConfig(convertLayoutConfig(img, "classic"), "image");
    expect(back).toMatchObject({ imageUrl: own, imageAlt: "Mô tả", imageFit: "contain", imageCredit: "Nguồn" });
  });
});
