import { NextResponse } from "next/server";
import { canAccessProtectedMedia, findProtectingCourseIds } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { isSafeFilename } from "@/lib/storage-serve";

/**
 * Cổng cho `/api/lesson-media/*` (docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md, AC1).
 *
 * File không thuộc khoá bản quyền nào đi qua như trước: một lần tra bảng (cache ngắn), không đụng tới phiên
 * đăng nhập, giữ nguyên `cache-control: public, immutable` mà các route tự đặt. File của khoá bản quyền thì
 * đòi người dùng đang có quyền vào khoá (ghi danh còn hiệu lực, người dạy, hoặc khoá công khai) và trả
 * `private` để CDN / proxy dùng chung không lưu hộ.
 *
 * Quyền được kiểm theo PHIÊN đăng nhập chứ không theo liên kết ký: phiên là JWT nên không tốn truy vấn, và
 * ghi danh kiểm trực tiếp nên hoàn tiền / hết hạn có hiệu lực ngay (cache chỉ vài chục giây). Mọi nơi đang
 * nhúng URL file — kể cả ảnh trong HTML văn bản — đều chạy đúng mà không phải viết lại URL.
 */

/** Một file vừa được đăng ký bảo vệ có thể còn phục vụ công khai tới chừng này giây ở các bản chạy khác. */
export const PROTECTION_LOOKUP_TTL_MS = 30_000;
/** Người vừa bị thu quyền có thể còn xem được chừng này giây (xem file đã được cấp, không phải trang bài). */
export const ACCESS_DECISION_TTL_MS = 60_000;
export const PROTECTED_CACHE_CONTROL = "private, max-age=3600";

const MAX_ENTRIES = 5_000;

interface Cached<T> {
  v: T;
  exp: number;
}

const protectionCache = new Map<string, Cached<string[]>>();
const decisionCache = new Map<string, Cached<boolean>>();

function remember<T>(cache: Map<string, Cached<T>>, key: string, v: T, ttl: number) {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { v, exp: Date.now() + ttl });
}

function recall<T>(cache: Map<string, Cached<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.exp <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.v;
}

/** Cho test, và cho nơi vừa đổi bảng tra trên cùng một bản chạy. */
export function resetLessonMediaGuardCache() {
  protectionCache.clear();
  decisionCache.clear();
}

export type LessonMediaAccess =
  | { allowed: true; protected: boolean }
  | { allowed: false; response: NextResponse };

export async function lessonMediaAccess(filename: string): Promise<LessonMediaAccess> {
  let courseIds = recall(protectionCache, filename);
  if (courseIds === undefined) {
    try {
      courseIds = await findProtectingCourseIds(filename);
    } catch {
      // Không biết file có được bảo vệ không thì không phục vụ: đóng còn hơn lộ.
      return { allowed: false, response: new NextResponse("unavailable", { status: 503 }) };
    }
    remember(protectionCache, filename, courseIds, PROTECTION_LOOKUP_TTL_MS);
  }
  if (courseIds.length === 0) return { allowed: true, protected: false };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const decisionKey = `${userId ?? "-"}|${[...courseIds].sort().join(",")}`;
  let ok = recall(decisionCache, decisionKey);
  if (ok === undefined) {
    try {
      ok = await canAccessProtectedMedia(userId, courseIds);
    } catch {
      return { allowed: false, response: new NextResponse("unavailable", { status: 503 }) };
    }
    remember(decisionCache, decisionKey, ok, ACCESS_DECISION_TTL_MS);
  }
  if (!ok) return { allowed: false, response: new NextResponse("forbidden", { status: 403 }) };
  return { allowed: true, protected: true };
}

type MediaHandler = (req: Request, ctx: { params: { file: string } }) => Promise<NextResponse>;

/**
 * Bọc handler GET của một route `/api/lesson-media/<loại>/[file]`. Tên file không hợp lệ đi thẳng vào
 * handler để nó tự trả 403 như trước (không tra bảng với chuỗi lạ).
 */
export function guardedLessonMedia(handler: MediaHandler): MediaHandler {
  return async (req, ctx) => {
    const file = ctx.params.file;
    if (!isSafeFilename(file)) return handler(req, ctx);
    const access = await lessonMediaAccess(file);
    if (!access.allowed) return access.response;
    const res = await handler(req, ctx);
    if (access.protected && res.status < 400) res.headers.set("cache-control", PROTECTED_CACHE_CONTROL);
    return res;
  };
}
