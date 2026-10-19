import { describe, expect, it } from "vitest";
import { attachWebImages, type WebImageDeps } from "./limioLiveWebImagesServer";

/** Gắn ảnh nguồn vào slide Chữ và hình (W8–W13), với phụ thuộc giả: không mạng, không lưu file thật. */

const refs = [
  { n: 1, title: "Thực tế tăng cường", url: "https://vi.wikipedia.org/wiki/AR", images: [{ url: "https://a.org/tablet.jpg", alt: "Học sinh dùng máy tính bảng xem mô hình ba chiều" }] },
  { n: 2, title: "Kính VR", url: "https://b.org/vr", images: [{ url: "https://b.org/kinh.jpg", alt: "Kính thực tế ảo đeo trên đầu" }] },
];
const mk = (): Array<{ type: string; config: Record<string, unknown> }> => [
  { type: "content", config: { layout: "cover", title: "Thực tế tăng cường" } },
  { type: "content", config: { layout: "image", title: "Mô hình ba chiều", bullets: ["Học sinh xem trên máy tính bảng."] } },
  { type: "content", config: { layout: "image", title: "Kính thực tế ảo", bullets: ["Kính thay khung cảnh thật."] } },
  { type: "quiz", config: { question: "Mô hình ba chiều trên máy tính bảng?" } },
];

const deps = (over: Partial<WebImageDeps> = {}): WebImageDeps => ({
  fetchImage: async (url) => Buffer.from(url),
  widthOf: async () => 1200,
  save: async (_u, buf) => ({ filename: `u_${buf.toString().split("/").pop()}` }),
  ...over,
});

describe("attachWebImages", () => {
  it("gắn ảnh, chữ thay thế, dòng ghi nguồn và trang nguồn vào đúng slide Chữ và hình", async () => {
    const slides = mk();
    expect(await attachWebImages("u", slides, refs, deps())).toBe(2);
    expect(slides[1]!.config).toMatchObject({
      imageUrl: "/api/limio-live-resource/u_tablet.jpg",
      imageAlt: "Học sinh dùng máy tính bảng xem mô hình ba chiều",
      imageCredit: "Thực tế tăng cường (vi.wikipedia.org)",
      imageSourceUrl: "https://vi.wikipedia.org/wiki/AR",
    });
    expect(slides[2]!.config.imageUrl).toBe("/api/limio-live-resource/u_kinh.jpg");
    expect(slides[0]!.config.imageUrl).toBeUndefined();
    expect(slides[3]!.config).not.toHaveProperty("imageUrl");
  });

  it("ảnh hẹp hơn 400 px, tải lỗi hay lưu không được thì bỏ ảnh đó, slide giữ hình tự vẽ (W7, W13)", async () => {
    const slides = mk();
    const n = await attachWebImages(
      "u",
      slides,
      refs,
      deps({
        fetchImage: async (url) => {
          if (url.includes("kinh")) throw new Error("fetch_failed");
          return Buffer.from(url);
        },
        widthOf: async () => 300,
      }),
    );
    expect(n).toBe(0);
    expect(slides[1]!.config.imageUrl).toBeUndefined();
    expect(await attachWebImages("u", mk(), refs, deps({ save: async () => null }))).toBe(0);
  });

  it("slide đã có ảnh riêng thì giữ nguyên", async () => {
    const slides = mk();
    slides[1]!.config = { ...slides[1]!.config, imageUrl: "/api/limio-live-resource/rieng.jpg" };
    await attachWebImages("u", slides, refs, deps());
    expect(slides[1]!.config.imageUrl).toBe("/api/limio-live-resource/rieng.jpg");
  });
});
