import { randomBytes } from "node:crypto";
import { storageFor } from "./storage";
import type { StorageKey } from "./storage-keys";

/**
 * Lõi xử lý ảnh tải lên phía server, dùng chung cho ảnh đính kèm board (boardImage.ts) và ảnh ở ô hình của
 * slide Limio-Live (slideImage.ts).
 *
 * Vì sao: ảnh gốc từ điện thoại 3–5MB/4000px mà nơi hiển thị chỉ cần vài trăm px → tải nặng, giải mã nặng.
 * Mỗi ảnh lưu 1 bản "hiển thị" (≤1600px, đã bỏ EXIF/GPS) + 2 thumbnail WebP (480/960px); không giữ bản gốc.
 *
 * `sharp` là native module. Nếu không nạp được (môi trường thiếu binary) thì mọi hàm ở đây rơi về hành vi
 * cũ — lưu nguyên file (đã kiểm magic bytes), không thumbnail — thay vì làm hỏng upload.
 */

export const THUMB_WIDTHS = [480, 960] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

const DISPLAY_MAX_EDGE = 1600;
const MAX_INPUT_PIXELS = 60_000_000; // chặn "decompression bomb" (ảnh nhỏ KB nhưng giải nén ra hàng tỉ pixel)
const THUMB_QUALITY = 72;
const DISPLAY_QUALITY = 82;

type Sharp = typeof import("sharp").default;
let sharpPromise: Promise<Sharp | null> | null = null;

function loadSharp(): Promise<Sharp | null> {
  sharpPromise ??= import("sharp")
    .then((m) => {
      const sharp = m.default;
      // Web server dùng chung CPU với request khác: giới hạn luồng của libvips, tắt cache nội bộ.
      sharp.concurrency(2);
      sharp.cache(false);
      return sharp;
    })
    .catch((err) => {
      console.error("[imageVariants] không nạp được sharp — upload ảnh rơi về chế độ không xử lý:", err);
      return null;
    });
  return sharpPromise;
}

/** Nhận dạng định dạng theo magic bytes — không tin Content-Type do client gửi. */
export function sniffImageExt(buf: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 6 && buf.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}

const MIME_BY_EXT = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const;

/** Khoá lưu thumbnail: cùng thư mục với bản gốc, thêm hậu tố `.w480.webp`. */
export function thumbKeyFor(original: StorageKey, width: ThumbWidth): StorageKey {
  return { ...original, key: original.key.replace(/\.[^./]+$/, `.w${width}.webp`) };
}

async function renderThumb(sharp: Sharp, buf: Buffer, width: ThumbWidth): Promise<Buffer> {
  return sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

export interface SavedImage {
  /** Tên file (phần cuối URL phục vụ). */
  filename: string;
  /** Kích thước bản hiển thị; không có khi rơi về lưu nguyên file (thiếu sharp). */
  width?: number;
  height?: number;
}

/** Nơi lưu: tiền tố tên file (vd. mã board, mã người dùng) và hàm dựng khoá lưu từ tên file. */
export interface ImageTarget {
  prefix: string;
  keyFor: (date: Date, filename: string) => StorageKey;
}

/**
 * Kiểm tra, chuẩn hoá và lưu 1 ảnh cùng thumbnail.
 * Trả null nếu không phải ảnh hợp lệ (caller trả 415).
 */
export async function saveImageWithVariants(target: ImageTarget, input: Buffer): Promise<SavedImage | null> {
  const { prefix, keyFor } = target;
  const sniffed = sniffImageExt(input);
  if (!sniffed) return null;

  const sharp = await loadSharp();
  const now = new Date();
  const stem = `${prefix}-${now.getTime()}-${randomBytes(6).toString("hex")}`;

  // Không có sharp: hành vi cũ.
  if (!sharp) {
    const filename = `${stem}.${sniffed}`;
    const key = keyFor(now, filename);
    await storageFor(key).put(key.key, input, MIME_BY_EXT[sniffed]);
    return { filename };
  }

  // Ảnh hỏng/giả mạo (đúng magic bytes nhưng không giải mã được) bị loại ở đây.
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return null;
  }
  if (!meta.width || !meta.height) return null;

  // GIF động giữ nguyên (xử lý lại sẽ mất hoạt ảnh); không tạo thumbnail — nơi hiển thị dùng bản gốc.
  if (sniffed === "gif") {
    const filename = `${stem}.gif`;
    const key = keyFor(now, filename);
    await storageFor(key).put(key.key, input, "image/gif");
    return { filename, width: meta.width, height: meta.height };
  }

  // Bản hiển thị: xoay đúng chiều theo EXIF rồi bỏ metadata (kể cả toạ độ GPS của ảnh chụp).
  // PNG có nền trong suốt giữ PNG; còn lại JPEG.
  const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: DISPLAY_MAX_EDGE, height: DISPLAY_MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const keepPng = sniffed === "png" && meta.hasAlpha === true;
  const displayBuf = keepPng
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: DISPLAY_QUALITY, mozjpeg: true }).toBuffer();
  const ext = keepPng ? "png" : "jpg";

  // Nhúng kích thước vào tên file để client dựng khung đúng tỉ lệ trước khi ảnh tải xong (không giật bố cục).
  const info = await sharp(displayBuf).metadata();
  const filename = `${prefix}-${info.width}x${info.height}-${now.getTime()}-${randomBytes(6).toString("hex")}.${ext}`;
  const key = keyFor(now, filename);
  await storageFor(key).put(key.key, displayBuf, MIME_BY_EXT[ext]);

  // Thumbnail tạo sẵn để lần xem đầu của cả lớp không phải chờ (và không dồn N request cùng sinh 1 thumbnail).
  // Lỗi thumbnail không làm hỏng upload — route phục vụ sẽ tự sinh lại khi cần.
  await Promise.all(
    THUMB_WIDTHS.map(async (w) => {
      try {
        const t = thumbKeyFor(key, w);
        await storageFor(t).put(t.key, await renderThumb(sharp, displayBuf, w), "image/webp");
      } catch (err) {
        console.error("[imageVariants] tạo thumbnail lỗi:", err);
      }
    }),
  );

  return { filename, width: info.width, height: info.height };
}

// Gộp các request cùng đòi 1 thumbnail chưa có (ảnh cũ trước khi có tính năng này) thành 1 lần xử lý.
const inflight = new Map<string, Promise<Buffer | null>>();

/**
 * Lấy thumbnail theo tên file gốc; chưa có thì sinh từ bản gốc rồi lưu lại (ảnh cũ được "nâng cấp" dần).
 * Trả null nếu không dùng được thumbnail (GIF, sharp không có, ảnh hỏng, thiếu bản gốc) — caller phục vụ bản gốc.
 */
export async function getImageThumb(
  filename: string,
  width: ThumbWidth,
  keyFromFilename: (filename: string) => StorageKey | null,
): Promise<Buffer | null> {
  if (/\.gif$/i.test(filename)) return null;
  const original = keyFromFilename(filename);
  if (!original) return null;
  const thumb = thumbKeyFor(original, width);
  const adapter = storageFor(thumb);

  if (await adapter.exists(thumb.key)) return adapter.get(thumb.key);

  const pending = inflight.get(thumb.key);
  if (pending) return pending;

  const job = (async () => {
    const sharp = await loadSharp();
    if (!sharp) return null;
    const src = storageFor(original);
    if (!(await src.exists(original.key))) return null;
    try {
      const out = await renderThumb(sharp, await src.get(original.key), width);
      await adapter.put(thumb.key, out, "image/webp");
      return out;
    } catch (err) {
      console.error("[imageVariants] sinh thumbnail theo yêu cầu lỗi:", filename, err);
      return null;
    }
  })().finally(() => inflight.delete(thumb.key));
  inflight.set(thumb.key, job);
  return job;
}
