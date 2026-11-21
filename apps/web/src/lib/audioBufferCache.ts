import { NextResponse } from "next/server";

/**
 * Bộ nhớ đệm cho audio bài học nhỏ khi kho lưu trữ chỉ đọc được "cả file một lần" (không phát từng đoạn được).
 *
 * Vì sao có: khi đường phát từng đoạn (Range) từ kho thất bại, route rơi về đọc CẢ file rồi trả 200 bỏ qua Range.
 * Mỗi lần trình duyệt xin lại (tua, hoặc mở yêu cầu mới sau khi đệm hết) lại phải chờ kho đọc lại từ đầu — trên
 * prod đã đo ~12 s mỗi yêu cầu, nên audio đứng ở giây 4, giây 8… Giữ file trong bộ nhớ của tiến trình web sau lần
 * đọc đầu thì các yêu cầu sau tức thì và trả đúng đoạn được xin (206), tua được.
 *
 * Tên file audio mang hậu tố ngẫu nhiên và không bao giờ bị ghi đè (cache `immutable`), nên nội dung theo tên là cố định;
 * TTL chỉ để file đã xoá khỏi kho không còn phát mãi. Việc kiểm quyền (học liệu bản quyền) đã làm ở `guardedLessonMedia`
 * TRƯỚC khi tới route, nên đọc từ đệm không vượt qua cổng đó.
 */

/** File lớn hơn không đệm (không để một audio dài chiếm hết bộ nhớ); vẫn phát được như trước. */
export const MAX_CACHED_AUDIO_BYTES = 8 * 1024 * 1024;
/** Tổng bộ nhớ tối đa cho đệm audio của mỗi tiến trình web. */
export const MAX_CACHE_TOTAL_BYTES = 64 * 1024 * 1024;
export const AUDIO_CACHE_TTL_MS = 10 * 60_000;

interface Entry {
  buf: Buffer;
  exp: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Buffer>>();
let total = 0;

export function resetAudioBufferCache() {
  cache.clear();
  inflight.clear();
  total = 0;
}

function drop(key: string) {
  const e = cache.get(key);
  if (!e) return;
  total -= e.buf.length;
  cache.delete(key);
}

export function getCachedAudio(key: string, now = Date.now()): Buffer | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (e.exp <= now) {
    drop(key);
    return undefined;
  }
  // Dùng gần đây thì đưa xuống cuối Map: lúc dọn, bỏ cái ít dùng nhất trước.
  cache.delete(key);
  cache.set(key, e);
  return e.buf;
}

function remember(key: string, buf: Buffer, now = Date.now()) {
  if (buf.length > MAX_CACHED_AUDIO_BYTES) return;
  drop(key);
  for (const k of cache.keys()) {
    if (total + buf.length <= MAX_CACHE_TOTAL_BYTES) break;
    drop(k);
  }
  cache.set(key, { buf, exp: now + AUDIO_CACHE_TTL_MS });
  total += buf.length;
}

/**
 * Đọc file một lần dù nhiều yêu cầu cùng đến (trình duyệt hay mở vài yêu cầu Range song song): các yêu cầu cùng chờ một lần đọc
 * thay vì mỗi cái kéo cả file từ kho. Lỗi không được nhớ — yêu cầu sau thử lại.
 */
export function loadAudioOnce(key: string, load: () => Promise<Buffer>): Promise<Buffer> {
  const hit = getCachedAudio(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = load()
    .then((buf) => {
      remember(key, buf);
      return buf;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Trả `buf` theo header Range (206 / 416) hoặc cả file (200) nếu không có Range. Chỉ hiểu `bytes=a-b` và `bytes=a-`, như route video. */
export function bufferResponse(buf: Buffer, contentType: string, req: Request): NextResponse {
  const base = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=604800, immutable",
  };
  const range = req.headers.get("range");
  if (!range) {
    return new NextResponse(new Uint8Array(buf), { headers: { ...base, "content-length": String(buf.length) } });
  }
  const m = /^bytes=(\d+)-(\d+)?$/.exec(range);
  if (!m) return new NextResponse("invalid_range", { status: 416, headers: { "content-range": `bytes */${buf.length}` } });
  const start = Number(m[1]);
  const end = Math.min(m[2] ? Number(m[2]) : buf.length - 1, buf.length - 1);
  if (start >= buf.length || start > end) {
    return new NextResponse("invalid_range", { status: 416, headers: { "content-range": `bytes */${buf.length}` } });
  }
  return new NextResponse(new Uint8Array(buf.subarray(start, end + 1)), {
    status: 206,
    headers: { ...base, "content-length": String(end - start + 1), "content-range": `bytes ${start}-${end}/${buf.length}` },
  });
}
