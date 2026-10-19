/**
 * Đọc chữ từ link Google Docs/Sheets/Slides học viên dán vào bài nộp — để "Gợi ý điểm bằng AI"
 * chấm được cả bài viết nằm trên Google thay vì chỉ ô nội dung.
 *
 * Chỉ đọc được tài liệu chia sẻ "Bất kỳ ai có đường liên kết": máy chủ gọi Google không đăng nhập.
 * An toàn: URL tải được DỰNG LẠI từ ID trên host cố định của Google (không gọi nguyên URL người dán),
 * và chuyển hướng chỉ được đi tới host của Google — link này đến từ học viên, không được để nó dẫn
 * máy chủ đi gọi địa chỉ tuỳ ý.
 */

export type GoogleDocKind = "document" | "spreadsheets" | "presentation";

const GDOC_ID = /^[A-Za-z0-9_-]{10,}$/;
const MAX_REDIRECTS = 4;

export function googleDocExportUrl(url: string): { kind: GoogleDocKind; exportUrl: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null;
  const seg = u.pathname.split("/").filter(Boolean);
  // /document/d/{id}/edit, hoặc /document/u/0/d/{id}/edit khi người dán đang đăng nhập nhiều tài khoản.
  const kind = seg[0];
  const di = seg.indexOf("d");
  const id = di > 0 ? seg[di + 1] : undefined;
  if (!id || !GDOC_ID.test(id)) return null;
  const base = `https://docs.google.com/${kind}/d/${id}`;
  if (kind === "document") return { kind, exportUrl: `${base}/export?format=txt` };
  // Trang tính: CSV chỉ ra trang đầu (hoặc trang có gid trong link) — đủ cho bài nộp dạng bảng.
  if (kind === "spreadsheets") {
    const gid = /(?:^|[#&?])gid=(\d+)/.exec(u.hash + u.search)?.[1];
    return { kind, exportUrl: `${base}/export?format=csv${gid ? `&gid=${gid}` : ""}` };
  }
  if (kind === "presentation") return { kind, exportUrl: `${base}/export/txt` };
  return null;
}

function isGoogleHost(hostname: string): boolean {
  return hostname === "docs.google.com" || hostname.endsWith(".googleusercontent.com");
}

export type GoogleDocTextResult =
  | { ok: true; kind: GoogleDocKind; text: string; truncated: boolean }
  /**
   * not_accessible: Google đòi đăng nhập / không cho xem / link sai — gần như luôn là chưa mở quyền chia sẻ.
   * fetch_failed: mạng, quá giờ, Google lỗi — thử lại có thể được.
   * empty: mở được nhưng tài liệu trống.
   */
  | { ok: false; reason: "not_google" | "not_accessible" | "fetch_failed" | "empty" };

export async function fetchGoogleDocText(
  url: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; maxBytes?: number } = {},
): Promise<GoogleDocTextResult> {
  const target = googleDocExportUrl(url);
  if (!target) return { ok: false, reason: "not_google" };
  const doFetch = opts.fetchImpl ?? fetch;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8_000);
  try {
    let next = target.exportUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await doFetch(next, { redirect: "manual", signal: ctrl.signal, headers: { accept: "text/plain, text/csv" } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, reason: "fetch_failed" };
        const u = new URL(loc, next);
        // Tài liệu riêng tư → Google chuyển tới trang đăng nhập (accounts.google.com).
        if (u.protocol !== "https:" || !isGoogleHost(u.hostname)) return { ok: false, reason: "not_accessible" };
        next = u.toString();
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) return { ok: false, reason: "not_accessible" };
      if (!res.ok) return { ok: false, reason: "fetch_failed" };
      // 200 nhưng là trang HTML (màn đăng nhập / "cần quyền truy cập") chứ không phải nội dung tài liệu.
      const type = res.headers.get("content-type") ?? "";
      if (!/^text\/(plain|csv)/i.test(type)) return { ok: false, reason: "not_accessible" };
      const { text, truncated } = await readCapped(res, maxBytes);
      const clean = text.replace(/^﻿/, "").trim();
      if (!clean) return { ok: false, reason: "empty" };
      return { ok: true, kind: target.kind, text: clean, truncated };
    }
    return { ok: false, reason: "fetch_failed" };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Đọc tối đa maxBytes rồi dừng — trang tính lớn không được kéo cả chục MB về chỉ để cắt còn 20 nghìn ký tự. */
async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) {
    const t = await res.text();
    return { text: t.slice(0, maxBytes), truncated: t.length > maxBytes };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= maxBytes) {
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const buf = new Uint8Array(Math.min(size, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, buf.length - off));
    buf.set(part, off);
    off += part.byteLength;
    if (off >= buf.length) break;
  }
  // fatal:false — nếu cắt giữa một ký tự nhiều byte thì chỉ mất ký tự cuối, không ném lỗi.
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(buf), truncated };
}
