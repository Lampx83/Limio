import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Máy chủ tải một ảnh từ địa chỉ do giảng viên dán vào (ảnh ở ô hình của slide Limio-Live), có chặn SSRF.
 *
 * Vì sao máy chủ tải chứ không giữ đường dẫn gốc: ảnh không chết khi trang gốc gỡ, được thu nhỏ như ảnh tải lên,
 * và trang ngoài không thấy IP của người xem. Đổi lại, máy chủ trở thành công cụ gửi request theo ý người dùng,
 * nên phải chặn mọi đường vào mạng nội bộ:
 * - chỉ http/https, cổng 80/443, không nhúng tài khoản trong URL;
 * - kiểm địa chỉ IP NGAY LÚC KẾT NỐI (hàm lookup của socket), nên đổi DNS giữa lúc kiểm và lúc nối
 *   (DNS rebinding) cũng không lọt; IP viết thẳng trong URL cũng qua cùng cửa kiểm;
 * - tự đi theo chuyển hướng (tối đa 3 lần), mỗi lần kiểm lại từ đầu;
 * - giới hạn dung lượng (đếm khi đang nhận, không tin Content-Length) và thời gian chờ;
 * - chỉ nhận phản hồi Content-Type image/* (loại thật được kiểm lại bằng magic bytes ở bước xử lý ảnh).
 */

export const REMOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export type RemoteImageError =
  | "invalid_url" // không phải http(s), sai cổng, có tài khoản trong URL
  | "blocked_address" // trỏ vào mạng nội bộ / localhost
  | "not_image" // phản hồi không phải ảnh
  | "too_large"
  | "fetch_failed"; // không kết nối được, mã lỗi HTTP, quá thời gian, chuyển hướng quá nhiều

export class RemoteImageFetchError extends Error {
  constructor(readonly code: RemoteImageError) {
    super(code);
  }
}

/** IPv4 dạng số 32 bit, hoặc null nếu không phải IPv4. */
function v4(ip: string): number | null {
  if (net.isIPv4(ip)) return ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
  return null;
}
const inV4 = (n: number, base: string, bits: number) => {
  const b = v4(base)!;
  const size = 2 ** (32 - bits);
  return n >= b && n < b + size;
};
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "mạng này", 0.0.0.0
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, metadata đám mây (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // dành riêng + broadcast
];

/** Địa chỉ IP không được phép kết nối tới (nội bộ, loopback, link-local, multicast, dành riêng). */
export function isBlockedAddress(ip: string): boolean {
  const n = v4(ip);
  if (n !== null) return BLOCKED_V4.some(([b, bits]) => inV4(n, b, bits));
  if (!net.isIPv6(ip)) return true; // không nhận ra thì chặn
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4 nhúng trong IPv6 (::ffff:10.0.0.1, ::10.0.0.1, 64:ff9b::10.0.0.1) xét theo phần IPv4.
  const tail = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (tail) return isBlockedAddress(tail[1]!);
  const full = expandV6(a);
  if (!full) return true;
  if (full.every((h) => h === 0)) return true; // ::
  if (full.slice(0, 7).every((h) => h === 0) && full[7] === 1) return true; // ::1
  if (full.slice(0, 5).every((h) => h === 0) && full[5] === 0xffff) {
    return isBlockedAddress(`${full[6]! >> 8}.${full[6]! & 255}.${full[7]! >> 8}.${full[7]! & 255}`);
  }
  const h0 = full[0]!;
  if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (cũ)
  if ((h0 & 0xff00) === 0xff00) return true; // multicast
  if (h0 === 0x2001 && full[1] === 0x0db8) return true; // tài liệu
  if (h0 === 0x0064 && full[1] === 0xff9b) return true; // NAT64 (phần IPv4 dạng hex)
  if (h0 === 0x2002) return true; // 6to4 nhúng IPv4 bất kỳ
  return false;
}

function expandV6(a: string): number[] | null {
  const parts = a.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (parts.length === 1 ? head.length !== 8 : fill < 0) return null;
  const out = [...head, ...Array(parts.length === 2 ? fill : 0).fill("0"), ...tail].map((h) => parseInt(h, 16));
  return out.length === 8 && out.every((h) => Number.isInteger(h) && h >= 0 && h <= 0xffff) ? out : null;
}

/** Kiểm hình thức URL trước khi kết nối; trả URL đã chuẩn hoá hoặc ném RemoteImageFetchError("invalid_url"). */
export function checkRemoteImageUrl(raw: string, anyPort = false): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new RemoteImageFetchError("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new RemoteImageFetchError("invalid_url");
  if (u.username || u.password) throw new RemoteImageFetchError("invalid_url");
  if (!anyPort && u.port && u.port !== "80" && u.port !== "443") throw new RemoteImageFetchError("invalid_url");
  return u;
}

type LookupFn = typeof dnsLookup;

export interface FetchImageOptions {
  /** Chỉ cho test: thay luật chặn địa chỉ và cho mọi cổng (máy chủ thử chạy ở 127.0.0.1, cổng ngẫu nhiên). */
  testing?: { isBlocked: (ip: string) => boolean; anyPort: true };
  maxBytes?: number;
  timeoutMs?: number;
}

/** Tải ảnh, trả nội dung (chưa xử lý) và Content-Type; lỗi ném RemoteImageFetchError. */
export async function fetchRemoteImage(raw: string, opts: FetchImageOptions = {}): Promise<{ body: Buffer; contentType: string }> {
  const blocked = opts.testing?.isBlocked ?? isBlockedAddress;
  const anyPort = opts.testing?.anyPort === true;
  const maxBytes = opts.maxBytes ?? REMOTE_IMAGE_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let url = checkRemoteImageUrl(raw, anyPort);
  for (let hop = 0; ; hop++) {
    const res = await requestOnce(url, blocked, maxBytes, Math.max(1, deadline - Date.now()));
    if (res.kind === "redirect") {
      if (hop >= MAX_REDIRECTS) throw new RemoteImageFetchError("fetch_failed");
      url = checkRemoteImageUrl(new URL(res.location, url).toString(), anyPort);
      continue;
    }
    return { body: res.body, contentType: res.contentType };
  }
}

type Once = { kind: "redirect"; location: string } | { kind: "ok"; body: Buffer; contentType: string };

function requestOnce(url: URL, blocked: (ip: string) => boolean, maxBytes: number, timeoutMs: number): Promise<Once> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (code: RemoteImageError) => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(new RemoteImageFetchError(code));
    };

    // Kiểm IP đúng lúc socket nối: đây là địa chỉ thật sự được dùng, không có khe giữa kiểm và nối.
    const lookup: LookupFn = ((hostname: string, options: unknown, cb: (...a: unknown[]) => void) => {
      dnsLookup(hostname, { all: true }, (err, addrs) => {
        if (err) return cb(err);
        const list = addrs as Array<{ address: string; family: number }>;
        if (!list.length || list.some((a) => blocked(a.address))) {
          fail("blocked_address");
          return cb(new Error("blocked_address"));
        }
        const o = (options ?? {}) as { all?: boolean };
        if (o.all) cb(null, list);
        else cb(null, list[0]!.address, list[0]!.family);
      });
    }) as unknown as LookupFn;

    // IP viết thẳng trong URL không đi qua lookup, nên kiểm ở đây.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && blocked(host)) {
      settled = true;
      reject(new RemoteImageFetchError("blocked_address"));
      return;
    }

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      { method: "GET", lookup, headers: { "user-agent": "LimioImageFetch/1.0", accept: "image/*" }, timeout: timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          settled = true;
          resolve({ kind: "redirect", location: res.headers.location });
          return;
        }
        if (status !== 200) {
          res.resume();
          return fail("fetch_failed");
        }
        const ct = String(res.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
        if (!ct.startsWith("image/")) {
          res.resume();
          return fail("not_image");
        }
        if (Number(res.headers["content-length"]) > maxBytes) {
          res.resume();
          return fail("too_large");
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) return fail("too_large");
          chunks.push(c);
        });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ kind: "ok", body: Buffer.concat(chunks), contentType: ct });
        });
        res.on("error", () => fail("fetch_failed"));
      },
    );
    req.on("timeout", () => fail("fetch_failed"));
    req.on("error", () => fail("fetch_failed"));
    setTimeout(() => fail("fetch_failed"), timeoutMs).unref();
    req.end();
  });
}
