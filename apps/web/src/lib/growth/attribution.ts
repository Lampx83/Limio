/**
 * First-touch attribution — phần LOGIC THUẦN (không I/O, không Node API).
 *
 * File này chạy trong middleware (edge runtime) nên chỉ dùng API có sẵn ở cả
 * edge lẫn Node: `btoa/atob`, `TextEncoder/TextDecoder`, `URL`. KHÔNG import
 * `node:crypto`, `Buffer`, Prisma hay bất cứ thứ gì kéo theo chúng.
 *
 * Luồng: middleware gọi `decideAttributionCookie()` → nếu `set` thì ghi cookie
 * `limio_attr`. Lúc đăng ký, server đọc lại cookie bằng `decodeAttributionCookie()`
 * (luôn sanitise lại — cookie là dữ liệu do client kiểm soát) rồi lưu vào
 * `AcquisitionTouch`. Xem docs/growth-events.md.
 *
 * Quyền riêng tư: chỉ lưu *loại* click id (fbclid/gclid/ttclid), không bao giờ
 * lưu giá trị; landingPath bỏ query string và che các đoạn trông như mã/token.
 */

export const ATTRIBUTION_COOKIE = "limio_attr";
/** 90 ngày. */
export const ATTRIBUTION_COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60;

export const CLICK_ID_KINDS = ["fbclid", "gclid", "ttclid"] as const;
export type ClickIdKind = (typeof CLICK_ID_KINDS)[number];

const UTM_PARAMS = {
  s: "utm_source",
  m: "utm_medium",
  c: "utm_campaign",
  ct: "utm_content",
  t: "utm_term",
} as const;

const MAX_VALUE_LEN = 100;
const MAX_PATH_LEN = 200;
const MAX_HOST_LEN = 100;
/** Cookie lớn hơn mức này thì không thèm parse (bình thường < 1.2KB). */
const MAX_COOKIE_LEN = 2048;
/** 2020-09-13 — mọi `at` hợp lệ đều sau mốc này. */
const MIN_AT_SEC = 1_600_000_000;

/** Phần của một "lần chạm" đầu tiên — cũng là hình dạng lưu vào AcquisitionTouch. */
export interface AttributionTouch {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickIdKind: ClickIdKind | null;
  landingPath: string | null;
  referrerHost: string | null;
  /** epoch giây, lúc cookie được tạo. */
  firstSeenAtSec: number;
}

// ---------------------------------------------------------------------------
// Sanitise
// ---------------------------------------------------------------------------

/**
 * Giá trị utm / host: trim → lower-case → bỏ ký tự điều khiển → chỉ giữ
 * `[a-z0-9 _.\-:/+%]` → cắt 100 → trim. Rỗng ⇒ null.
 */
export function sanitizeValue(raw: unknown, maxLen: number = MAX_VALUE_LEN): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^a-z0-9 _.\-:/+%]/g, "")
    .slice(0, maxLen)
    .trim();
  return cleaned === "" ? null : cleaned;
}

/** Host của referrer: hostname thường, không port, không path. */
export function sanitizeHost(raw: unknown): string | null {
  const v = sanitizeValue(raw, MAX_HOST_LEN);
  if (!v) return null;
  // Giữ đúng dạng hostname: bỏ mọi thứ sau `/`, `:` (port) hoặc `%`.
  const host = v.split(/[/:%+ ]/)[0] ?? "";
  return host === "" ? null : host.slice(0, MAX_HOST_LEN);
}

/** Đoạn đường dẫn trông như id/mã/token (uuid, hex dài, chuỗi dài lẫn chữ-số). */
function looksLikeToken(seg: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return true;
  if (/^[0-9a-f]{16,}$/i.test(seg)) return true;
  if (/^\d{5,}$/.test(seg)) return true;
  if (seg.length >= 20 && /\d/.test(seg)) return true;
  if (seg.length >= 32) return true;
  return false;
}

/** Tiền tố công khai mà đoạn thứ 2 là slug nội dung (không phải mã truy cập). */
const PUBLIC_TWO_SEGMENT_PREFIXES = new Set(["catalog", "learn", "p"]);

/**
 * Chuẩn hoá đường dẫn trang đích: chỉ pathname, không query/hash, che id-like,
 * và với mọi khu không nằm trong danh sách công khai thì chỉ giữ đoạn đầu
 * (`/join/ABC123` → `/join`, `/verify/<token>` → `/verify`) vì đoạn sau có thể
 * là mã mời / mã thi / token.
 */
export function normalizeLandingPath(rawPathname: unknown): string | null {
  if (typeof rawPathname !== "string") return null;
  // Phòng khi ai đó đưa vào cả query/hash.
  const noQuery = rawPathname.split(/[?#]/)[0] ?? "";
  if (!noQuery.startsWith("/")) return null;
  const segs = noQuery
    .split("/")
    .filter((s) => s !== "")
    .map((s) => {
      let d = s;
      try {
        d = decodeURIComponent(s);
      } catch {
        // giữ nguyên nếu không decode được
      }
      return d.toLowerCase().replace(/[^a-z0-9_.\-~]/g, "");
    })
    .filter((s) => s !== "");
  if (segs.length === 0) return "/";
  const first = segs[0]!;
  const keep = PUBLIC_TWO_SEGMENT_PREFIXES.has(first) ? 2 : 1;
  const kept = segs.slice(0, keep).map((s, i) => (i > 0 && looksLikeToken(s) ? ":id" : s));
  return `/${kept.join("/")}`.slice(0, MAX_PATH_LEN);
}

function clickIdKindOf(params: URLSearchParams): ClickIdKind | null {
  for (const kind of CLICK_ID_KINDS) {
    // Chỉ tính khi có giá trị — `?fbclid=` rỗng không phải một cú click.
    const v = params.get(kind);
    if (v !== null && v.trim() !== "") return kind;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cookie encode / decode (base64url của JSON, khoá ngắn)
// ---------------------------------------------------------------------------

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

interface CookiePayload {
  s: string | null;
  m: string | null;
  c: string | null;
  ct: string | null;
  t: string | null;
  k: ClickIdKind | null;
  p: string | null;
  r: string | null;
  at: number;
}

export function encodeAttributionCookie(touch: AttributionTouch): string {
  const payload: CookiePayload = {
    s: touch.utmSource,
    m: touch.utmMedium,
    c: touch.utmCampaign,
    ct: touch.utmContent,
    t: touch.utmTerm,
    k: touch.clickIdKind,
    p: touch.landingPath,
    r: touch.referrerHost,
    at: touch.firstSeenAtSec,
  };
  return toBase64Url(JSON.stringify(payload));
}

function hasAnySignal(t: Omit<AttributionTouch, "firstSeenAtSec">): boolean {
  return (
    t.utmSource !== null ||
    t.utmMedium !== null ||
    t.utmCampaign !== null ||
    t.utmContent !== null ||
    t.utmTerm !== null ||
    t.clickIdKind !== null ||
    t.referrerHost !== null
  );
}

/**
 * Giải mã + kiểm tra. Trả null với MỌI thứ không hợp lệ (sai base64/JSON, quá
 * dài, `at` vô lý, hoàn toàn không có nguồn). Mọi chuỗi được sanitise lại.
 */
export function decodeAttributionCookie(
  raw: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
): AttributionTouch | null {
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_COOKIE_LEN) return null;
  const json = fromBase64Url(raw);
  if (json === null) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;

  const at = o.at;
  if (typeof at !== "number" || !Number.isInteger(at)) return null;
  if (at < MIN_AT_SEC || at > nowSec + 24 * 60 * 60) return null;

  const k = o.k;
  const clickIdKind =
    typeof k === "string" && (CLICK_ID_KINDS as readonly string[]).includes(k)
      ? (k as ClickIdKind)
      : null;

  const touch: AttributionTouch = {
    utmSource: sanitizeValue(o.s),
    utmMedium: sanitizeValue(o.m),
    utmCampaign: sanitizeValue(o.c),
    utmContent: sanitizeValue(o.ct),
    utmTerm: sanitizeValue(o.t),
    clickIdKind,
    landingPath: typeof o.p === "string" ? normalizeLandingPath(o.p) : null,
    referrerHost: sanitizeHost(o.r),
    firstSeenAtSec: at,
  };
  return hasAnySignal(touch) ? touch : null;
}

// ---------------------------------------------------------------------------
// Quyết định ở middleware (hàm thuần)
// ---------------------------------------------------------------------------

/**
 * Referrer mà "đến từ đó" không có ý nghĩa marketing: luồng đăng nhập SSO và
 * cổng thanh toán quay về site. Bỏ qua để không biến người dùng trực tiếp thành
 * "referrer = accounts.google.com".
 */
const IGNORED_REFERRER_HOSTS = [
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "checkout.stripe.com",
  "vnpayment.vn",
  "sandbox.vnpayment.vn",
  "pay.vnpay.vn",
  "momo.vn",
  "payment.momo.vn",
  "test-payment.momo.vn",
];

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** `host[:port]` hoặc URL đầy đủ → hostname thường (không port, không www). */
function normalizeSiteHost(h: string): string {
  const s = h.trim().toLowerCase();
  const fromUrl = s.includes("://") ? hostOf(s) : null;
  const host = fromUrl ?? s.replace(/:\d+$/, "");
  return stripWww(host);
}

function hasFileExtension(pathname: string): boolean {
  const last = pathname.split("/").pop() ?? "";
  return /\.[a-z0-9]{1,8}$/i.test(last);
}

/** Trang (không phải API / asset / file có đuôi) có đáng xét cookie không. */
export function isPageNavigationPath(pathname: string): boolean {
  if (pathname === "/api" || pathname.startsWith("/api/")) return false;
  if (pathname === "/_next" || pathname.startsWith("/_next/")) return false;
  if (pathname.startsWith("/favicon")) return false;
  if (pathname.startsWith("/.well-known/")) return false;
  if (hasFileExtension(pathname)) return false;
  return true;
}

export interface AttributionDecisionInput {
  method: string;
  /** pathname đã bỏ basePath (như `req.nextUrl.pathname`). */
  pathname: string;
  searchParams: URLSearchParams;
  /** Header `Referer` thô, hoặc null. */
  referer: string | null;
  /** Host(s) của chính site: để phân biệt referrer nội bộ / ngoài. */
  siteHosts: string[];
  /** Giá trị cookie `limio_attr` hiện có, hoặc undefined. */
  existingCookie: string | undefined;
  nowSec: number;
  /** Header `Sec-Fetch-Dest` nếu có (trình duyệt hiện đại luôn gửi). */
  secFetchDest?: string | null;
  /** Có header `Next-Router-Prefetch` / `Purpose: prefetch` — không phải người dùng ghé thật. */
  isPrefetch?: boolean;
}

export type AttributionDecision =
  | { action: "set"; value: string; touch: AttributionTouch }
  | { action: "skip"; reason: SkipReason };

export type SkipReason =
  | "not_get"
  | "not_page"
  | "prefetch"
  | "not_document"
  | "has_cookie"
  | "no_signal";

export function decideAttributionCookie(input: AttributionDecisionInput): AttributionDecision {
  if (input.method !== "GET") return { action: "skip", reason: "not_get" };
  if (!isPageNavigationPath(input.pathname)) return { action: "skip", reason: "not_page" };
  if (input.isPrefetch) return { action: "skip", reason: "prefetch" };
  if (input.secFetchDest && input.secFetchDest.toLowerCase() !== "document") {
    return { action: "skip", reason: "not_document" };
  }
  // First touch wins: cookie hợp lệ đã có thì không bao giờ ghi đè. Cookie hỏng
  // coi như chưa có.
  if (decodeAttributionCookie(input.existingCookie, input.nowSec) !== null) {
    return { action: "skip", reason: "has_cookie" };
  }

  const p = input.searchParams;
  const utm = {
    utmSource: sanitizeValue(p.get(UTM_PARAMS.s)),
    utmMedium: sanitizeValue(p.get(UTM_PARAMS.m)),
    utmCampaign: sanitizeValue(p.get(UTM_PARAMS.c)),
    utmContent: sanitizeValue(p.get(UTM_PARAMS.ct)),
    utmTerm: sanitizeValue(p.get(UTM_PARAMS.t)),
  };
  const clickIdKind = clickIdKindOf(p);

  // Referrer ngoài site.
  let referrerHost: string | null = null;
  if (input.referer) {
    const h = hostOf(input.referer);
    if (h) {
      const bare = stripWww(h);
      const own = input.siteHosts.map(normalizeSiteHost);
      const internal = own.includes(bare);
      const ignored = IGNORED_REFERRER_HOSTS.some((x) => bare === x || bare.endsWith(`.${x}`));
      if (!internal && !ignored) referrerHost = sanitizeHost(h);
    }
  }

  const hasUrlSignal =
    utm.utmSource !== null ||
    utm.utmMedium !== null ||
    utm.utmCampaign !== null ||
    utm.utmContent !== null ||
    utm.utmTerm !== null ||
    clickIdKind !== null;
  if (!hasUrlSignal && referrerHost === null) return { action: "skip", reason: "no_signal" };

  const touch: AttributionTouch = {
    ...utm,
    clickIdKind,
    landingPath: normalizeLandingPath(input.pathname),
    referrerHost,
    firstSeenAtSec: input.nowSec,
  };
  return { action: "set", value: encodeAttributionCookie(touch), touch };
}

/** Thuộc tính cookie (middleware dùng với `res.cookies.set`). */
export function attributionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SEC,
    secure,
  };
}
