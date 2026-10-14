// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let root: string;
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "board-image-"));
  process.env.UPLOADS_ROOT = root;
  process.env.STORAGE_LEDGER = "off";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Ảnh nhiễu để JPEG không nén về ~0 byte (giống ảnh chụp thật).
async function photo(width: number, height: number, opts: { orientation?: number } = {}) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  let img = sharp(raw, { raw: { width, height, channels: 3 } });
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation, exif: { IFD0: { Copyright: "secret" } } });
  return img.jpeg({ quality: 95 }).toBuffer();
}

async function load(filename: string, suffix = "") {
  const { boardAttachmentKeyFromFilename } = await import("./storage-keys");
  const { storageFor } = await import("./storage");
  const { thumbKeyFor } = await import("./boardImage");
  const key = boardAttachmentKeyFromFilename(filename)!;
  const k = suffix ? thumbKeyFor(key, Number(suffix) as 480 | 960) : key;
  return storageFor(k).get(k.key);
}

describe("saveBoardImage", () => {
  it("thu ảnh lớn về ≤1600px, nhỏ hơn bản gốc, nhúng kích thước vào tên file", async () => {
    const { saveBoardImage } = await import("./boardImage");
    const input = await photo(3000, 2000);
    const saved = await saveBoardImage("board1", input);
    expect(saved).not.toBeNull();
    const m = /^board1-(\d+)x(\d+)-\d{10,}-[0-9a-f]+\.jpg$/.exec(saved!.filename);
    expect(m).not.toBeNull();
    expect([Number(m![1]), Number(m![2])]).toEqual([1600, 1067]);

    const stored = await load(saved!.filename);
    expect(stored.length).toBeLessThan(input.length);
    const meta = await sharp(stored).metadata();
    expect(meta.width).toBe(1600);
  });

  it("tạo thumbnail WebP 480 và 960 sẵn", async () => {
    const { saveBoardImage } = await import("./boardImage");
    const saved = await saveBoardImage("board2", await photo(2400, 1600));
    for (const w of ["480", "960"]) {
      const t = await load(saved!.filename, w);
      const meta = await sharp(t).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(Number(w));
    }
  });

  it("không phóng to ảnh nhỏ", async () => {
    const { saveBoardImage } = await import("./boardImage");
    const saved = await saveBoardImage("board3", await photo(300, 200));
    const meta = await sharp(await load(saved!.filename)).metadata();
    expect(meta.width).toBe(300);
    const thumb = await sharp(await load(saved!.filename, "480")).metadata();
    expect(thumb.width).toBe(300);
  });

  it("xoay đúng chiều theo EXIF và bỏ metadata", async () => {
    const { saveBoardImage } = await import("./boardImage");
    // orientation 6 = xoay 90°: ảnh lưu 400x200 phải ra 200x400.
    const saved = await saveBoardImage("board4", await photo(400, 200, { orientation: 6 }));
    const stored = await load(saved!.filename);
    const meta = await sharp(stored).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
    expect(meta.exif).toBeUndefined();
    expect(saved!.filename).toContain("-200x400-");
  });

  it("giữ PNG khi có nền trong suốt", async () => {
    const { saveBoardImage } = await import("./boardImage");
    const png = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
    })
      .png()
      .toBuffer();
    const saved = await saveBoardImage("board5", png);
    expect(saved!.filename.endsWith(".png")).toBe(true);
    expect((await sharp(await load(saved!.filename)).metadata()).hasAlpha).toBe(true);
  });

  it("từ chối file không phải ảnh, và ảnh đúng magic bytes nhưng hỏng", async () => {
    const { saveBoardImage } = await import("./boardImage");
    expect(await saveBoardImage("b", Buffer.from("hello world, not an image"))).toBeNull();
    const truncated = (await photo(100, 100)).subarray(0, 20);
    expect(await saveBoardImage("b", truncated)).toBeNull();
  });

  it("giữ nguyên GIF, không tạo thumbnail", async () => {
    const { saveBoardImage, getBoardThumb } = await import("./boardImage");
    const gif = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#fff" },
    })
      .gif()
      .toBuffer();
    const saved = await saveBoardImage("board6", gif);
    expect(saved!.filename.endsWith(".gif")).toBe(true);
    expect(await getBoardThumb(saved!.filename, 480)).toBeNull();
  });
});

describe("getBoardThumb", () => {
  it("sinh thumbnail theo yêu cầu cho ảnh cũ chưa có thumbnail, rồi lưu lại", async () => {
    const { getBoardThumb, thumbKeyFor } = await import("./boardImage");
    const { boardAttachmentKey } = await import("./storage-keys");
    const { storageFor } = await import("./storage");

    // Ảnh "cũ": lưu trực tiếp bản gốc 4000px theo tên file kiểu cũ, không qua saveBoardImage.
    const now = new Date();
    const filename = `legacyboard-${now.getTime()}-abc123def456.jpg`;
    const key = boardAttachmentKey(now, filename);
    await storageFor(key).put(key.key, await photo(4000, 3000), "image/jpeg");
    expect(await storageFor(key).exists(thumbKeyFor(key, 480).key)).toBe(false);

    // 5 request đồng thời cùng nhận được 1 kết quả.
    const results = await Promise.all(Array.from({ length: 5 }, () => getBoardThumb(filename, 480)));
    expect(results.every((r) => r && r.equals(results[0]!))).toBe(true);
    expect((await sharp(results[0]!).metadata()).width).toBe(480);
    expect(await storageFor(key).exists(thumbKeyFor(key, 480).key)).toBe(true);
  });

  it("trả null khi thiếu bản gốc", async () => {
    const { getBoardThumb } = await import("./boardImage");
    expect(await getBoardThumb(`nope-${Date.now()}-abc123.jpg`, 480)).toBeNull();
  });
});
