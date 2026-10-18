// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let root: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "slide-image-"));
  process.env.UPLOADS_ROOT = root;
  process.env.STORAGE_LEDGER = "off";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("saveSlideImage", () => {
  it("lưu bản hiển thị + thumbnail ở thư mục tài nguyên slide; URL nhận ra được để dựng srcset", async () => {
    const { saveSlideImage, getSlideImageThumb } = await import("./slideImage");
    const { slideImageSources } = await import("./limioLiveImage");
    const raw = Buffer.alloc(2400 * 1600 * 3, 120);
    const saved = await saveSlideImage("user1", await sharp(raw, { raw: { width: 2400, height: 1600, channels: 3 } }).jpeg().toBuffer());
    expect(saved?.filename).toMatch(/^user1-1600x1067-\d{10,}-[0-9a-f]+\.jpg$/);
    const src = slideImageSources(`/api/limio-live-resource/${saved!.filename}`);
    expect(src.width).toBe(1600);
    expect(src.srcSet).toContain("?w=960 960w");
    const t = await getSlideImageThumb(saved!.filename, 480);
    expect((await sharp(t!).metadata()).width).toBe(480);
  });

  it("từ chối SVG và tệp không phải ảnh", async () => {
    const { saveSlideImage } = await import("./slideImage");
    expect(await saveSlideImage("user1", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(await saveSlideImage("user1", Buffer.from("%PDF-1.4"))).toBeNull();
  });
});
