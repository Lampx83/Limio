// Gắn ảnh minh hoạ từ nguồn internet vào slide Chữ và hình lúc tạo slide (docs/tieu-chi/nguon-web-link-anh.md, W8–W13).
// Ảnh được tải qua đường lấy ảnh an toàn hiện có (chặn địa chỉ nội bộ, giới hạn dung lượng) và lưu như ảnh ô hình
// (bỏ EXIF, tạo bản 480 và 960), để bài giảng không hỏng khi trang gốc đổi hay xoá ảnh. Lỗi ở ảnh nào thì bỏ ảnh đó:
// slide giữ hình tự vẽ, việc tạo slide không bao giờ hỏng vì ảnh.

import { fetchRemoteImage } from "./safeFetchImage";
import { saveSlideImage } from "./slideImage";
import { imageCredit, webImageCandidates } from "./limioLiveWebImages";
import type { WebSourceRef } from "./limioLiveOutline";

/** Ảnh hẹp hơn mức này thường là biểu tượng hay ảnh nhỏ, nhìn vỡ trên máy chiếu (W7). */
export const WEB_IMAGE_MIN_WIDTH = 400;
const CONCURRENCY = 3;
/** Mỗi ảnh chờ tối đa chừng này; tổng thời gian tạo slide đã dài sẵn. */
const FETCH_TIMEOUT_MS = 12_000;

export interface WebImageDeps {
  fetchImage: (url: string) => Promise<Buffer>;
  /** Bề ngang ảnh gốc; null khi không đo được (khi đó không chặn theo bề ngang). */
  widthOf: (buf: Buffer) => Promise<number | null>;
  save: (userId: string, buf: Buffer) => Promise<{ filename: string } | null>;
}

async function widthOf(buf: Buffer): Promise<number | null> {
  try {
    const sharp = (await import("sharp")).default;
    return (await sharp(buf).metadata()).width ?? null;
  } catch {
    return null;
  }
}

const defaultDeps: WebImageDeps = {
  fetchImage: async (url) => (await fetchRemoteImage(url, { timeoutMs: FETCH_TIMEOUT_MS })).body,
  widthOf,
  save: saveSlideImage,
};

/** Slide vừa tạo; `webImage` là mã ảnh AI chọn cho ô hình (GeneratedSlide.webImage). */
type SlideLike = { type: string; config: Record<string, unknown>; webImage?: string };

/**
 * Gắn ảnh nguồn theo lựa chọn của AI (W8): chỉ slide Chữ và hình chưa có ảnh, chỉ mã có trong danh sách ứng viên
 * (webImageCandidates, cùng thứ tự với lời dặn AI), mỗi ảnh cho slide chọn nó trước. Tải, lưu, rồi ghi vào config (sửa trực
 * tiếp các slide được truyền vào). Trả số ảnh đã gắn.
 */
export async function attachWebImages(userId: string, slides: SlideLike[], refs: WebSourceRef[], deps: WebImageDeps = defaultDeps): Promise<number> {
  const byId = new Map(webImageCandidates(refs).map((c) => [c.id, c]));
  const used = new Set<string>();
  const picks: Array<{ index: number; image: { url: string; alt: string }; ref: WebSourceRef }> = [];
  slides.forEach((s, index) => {
    const c = s.webImage ? byId.get(s.webImage) : undefined;
    const hasImage = typeof s.config.imageUrl === "string" && !!s.config.imageUrl;
    if (!c || used.has(c.id) || s.type !== "content" || s.config.layout !== "image" || hasImage) return;
    used.add(c.id);
    picks.push({ index, image: c.image, ref: c.ref });
  });
  let attached = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < picks.length) {
      const p = picks[cursor++]!;
      try {
        const buf = await deps.fetchImage(p.image.url);
        const w = await deps.widthOf(buf);
        if (w !== null && w < WEB_IMAGE_MIN_WIDTH) continue;
        const saved = await deps.save(userId, buf);
        if (!saved) continue;
        Object.assign(slides[p.index]!.config, {
          imageUrl: `/api/limio-live-resource/${saved.filename}`,
          ...(p.image.alt ? { imageAlt: p.image.alt } : {}),
          imageCredit: imageCredit(p.ref),
          imageSourceUrl: p.ref.url,
        });
        attached += 1;
      } catch (e) {
        console.warn("[Limio-Live web image]", p.image.url, (e as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picks.length) }, worker));
  return attached;
}
