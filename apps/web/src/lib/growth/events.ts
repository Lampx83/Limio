/**
 * Growth events — phần LOGIC THUẦN của `GET /api/internal/growth/events`:
 * allow-list, cursor, gộp nhiều nguồn thành một luồng có thứ tự xác định, ẩn
 * danh, coverage. Không đụng DB: nguồn dữ liệu được tiêm vào qua `GrowthEventSource`
 * (bản Prisma ở `eventSources.ts`, bản in-memory ở test).
 *
 * Thứ tự: (occurredAt ASC, eventId ASC) — eventId so sánh theo thứ tự ký tự
 * (ordinal), không locale. Cursor = "strictly after" cặp đó.
 *
 * Vì sao không chỉ `occurredAt >= cursor LIMIT n+1` từng nguồn: nhiều dòng có
 * thể trùng đúng một mili-giây (import hàng loạt — `now()` của Postgres là giờ
 * transaction), và eventId chứa HMAC nên SQL không sắp được theo nó. Nếu cắt
 * LIMIT giữa một đám trùng, sẽ lỡ dòng có eventId nhỏ hơn. Nên mỗi nguồn được
 * lấy theo kiểu: (a) mọi dòng đúng bằng mốc cursor, (b) n+1 dòng sau mốc, rồi
 * (c) nếu bị cắt thì lấy nốt mọi dòng cùng mili-giây với dòng cuối.
 */
import { anonIdOf, orderRefOf } from "./anonymise";

export const GROWTH_EVENT_TYPES = [
  "user.registered",
  "user.email_verified",
  "enrollment.created",
  "activity.first_recorded",
  "order.paid",
  "order.refunded",
] as const;
export type GrowthEventType = (typeof GROWTH_EVENT_TYPES)[number];

export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 500;
/** Trần số dòng trùng một mili-giây mà ta chịu đọc cho mỗi nguồn. */
export const TIE_CAP = 5000;

/** Một dòng thô từ DB — còn userId/orderId, CHƯA ẩn danh. Không bao giờ ra khỏi module này. */
export interface RawRow {
  /** Khoá duy nhất trong nguồn (userId hoặc orderId) — để khử trùng khi gộp. */
  key: string;
  userId: string;
  occurredAt: Date;
  orderId?: string;
  amountMinor?: number;
  currency?: string;
}

export interface GrowthEventSource {
  type: GrowthEventType;
  /** Mọi dòng có occurredAt đúng bằng `at` (≤ cap dòng). */
  fetchAt(at: Date, cap: number): Promise<RawRow[]>;
  /**
   * Tối đa `n` dòng có `after < occurredAt <= upTo`, sắp theo (occurredAt, key)
   * tăng dần. `after = null` = từ đầu.
   */
  fetchAfter(after: Date | null, n: number, upTo: Date): Promise<RawRow[]>;
}

export interface TouchSource {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickIdKind: string | null;
  landingPath: string | null;
  referrerHost: string | null;
}

export interface GrowthEvent {
  eventId: string;
  type: GrowthEventType;
  occurredAt: string;
  anonId: string;
  source: TouchSource;
  amountMinor: number | null;
  currency: string | null;
}

export interface GrowthEventsPage {
  events: GrowthEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  coverage: { registered: number; registeredWithSource: number };
}

const EMPTY_SOURCE: TouchSource = Object.freeze({
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  clickIdKind: null,
  landingPath: null,
  referrerHost: null,
});

// ---------------------------------------------------------------------------
// Tham số
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseTypes(raw: string | null | undefined): ParseResult<GrowthEventType[]> {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { ok: true, value: [...GROWTH_EVENT_TYPES] };
  }
  const out: GrowthEventType[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (!(GROWTH_EVENT_TYPES as readonly string[]).includes(t)) {
      return { ok: false, error: "unknown_type" };
    }
    if (!out.includes(t as GrowthEventType)) out.push(t as GrowthEventType);
  }
  return { ok: true, value: out };
}

export function parseLimit(raw: string | null | undefined): ParseResult<number> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: DEFAULT_LIMIT };
  if (!/^\d{1,4}$/.test(raw)) return { ok: false, error: "invalid_limit" };
  const n = Number(raw);
  if (n < 1 || n > MAX_LIMIT) return { ok: false, error: "invalid_limit" };
  return { ok: true, value: n };
}

export interface Cursor {
  occurredAt: Date;
  iso: string;
  eventId: string;
}

const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EVENT_ID_RE = /^[a-z_]+\.[a-z_]+:[0-9a-f]{16,32}$/;

export function formatCursor(iso: string, eventId: string): string {
  return `${iso}|${eventId}`;
}

/** `null` (không có cursor) ⇒ từ đầu. Định dạng: `<ISO-8601 ms Z>|<eventId>`. */
export function parseCursor(raw: string | null | undefined): ParseResult<Cursor | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (raw.length > 200) return { ok: false, error: "invalid_cursor" };
  const bar = raw.indexOf("|");
  if (bar < 0) return { ok: false, error: "invalid_cursor" };
  const iso = raw.slice(0, bar);
  const eventId = raw.slice(bar + 1);
  if (!ISO_MS_RE.test(iso) || !EVENT_ID_RE.test(eventId)) {
    return { ok: false, error: "invalid_cursor" };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.toISOString() !== iso) {
    return { ok: false, error: "invalid_cursor" };
  }
  const type = eventId.slice(0, eventId.indexOf(":"));
  if (!(GROWTH_EVENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "invalid_cursor" };
  }
  return { ok: true, value: { occurredAt: d, iso, eventId } };
}

// ---------------------------------------------------------------------------
// Dựng trang
// ---------------------------------------------------------------------------

interface Candidate {
  eventId: string;
  type: GrowthEventType;
  at: number;
  iso: string;
  row: RawRow;
}

export function compareCandidates(
  a: { at: number; eventId: string },
  b: { at: number; eventId: string },
): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.eventId === b.eventId) return 0;
  return a.eventId < b.eventId ? -1 : 1;
}

export interface BuildPageOptions {
  sources: GrowthEventSource[];
  cursor: Cursor | null;
  limit: number;
  anonSecret: string;
  /** Mốc trên (giờ đã trừ độ trễ lắng) — không phát sự kiện muộn hơn mốc này. */
  upTo: Date;
  loadTouches: (userIds: string[]) => Promise<Map<string, TouchSource>>;
  tieCap?: number;
}

function eventIdOf(type: GrowthEventType, row: RawRow, anonSecret: string): string {
  if (type === "order.paid" || type === "order.refunded") {
    return `${type}:${orderRefOf(anonSecret, row.orderId ?? row.key)}`;
  }
  return `${type}:${anonIdOf(anonSecret, row.userId)}`;
}

async function collect(
  source: GrowthEventSource,
  cursor: Cursor | null,
  limit: number,
  upTo: Date,
  tieCap: number,
): Promise<RawRow[]> {
  const byKey = new Map<string, RawRow>();
  const add = (rows: RawRow[]) => {
    for (const r of rows) {
      if (r.occurredAt.getTime() > upTo.getTime()) continue;
      byKey.set(r.key, r);
    }
  };

  if (cursor) add(await source.fetchAt(cursor.occurredAt, tieCap));

  const after = await source.fetchAfter(cursor ? cursor.occurredAt : null, limit + 1, upTo);
  add(after);
  if (after.length > limit) {
    // Bị cắt ở LIMIT — lấy nốt đám trùng mili-giây với dòng cuối.
    const last = after[after.length - 1]!;
    add(await source.fetchAt(last.occurredAt, tieCap));
  }
  return [...byKey.values()];
}

export async function buildEventsPage(opts: BuildPageOptions): Promise<GrowthEventsPage> {
  const { sources, cursor, limit, anonSecret, upTo } = opts;
  const tieCap = opts.tieCap ?? TIE_CAP;

  const perSource = await Promise.all(
    sources.map(async (s) => ({ type: s.type, rows: await collect(s, cursor, limit, upTo, tieCap) })),
  );

  const candidates: Candidate[] = [];
  for (const { type, rows } of perSource) {
    for (const row of rows) {
      const at = row.occurredAt.getTime();
      const eventId = eventIdOf(type, row, anonSecret);
      // Strictly after cursor.
      if (cursor && compareCandidates({ at, eventId }, { at: cursor.occurredAt.getTime(), eventId: cursor.eventId }) <= 0) {
        continue;
      }
      candidates.push({ eventId, type, at, iso: row.occurredAt.toISOString(), row });
    }
  }
  candidates.sort(compareCandidates);

  const hasMore = candidates.length > limit;
  const page = candidates.slice(0, limit);

  const userIds = [...new Set(page.map((c) => c.row.userId))];
  const touches = userIds.length > 0 ? await opts.loadTouches(userIds) : new Map<string, TouchSource>();

  let registered = 0;
  let registeredWithSource = 0;
  const events: GrowthEvent[] = page.map((c) => {
    const t = touches.get(c.row.userId);
    // Chỉ chép đúng 8 trường nguồn đã biết — không để trường lạ lọt ra.
    const source: TouchSource = t
      ? {
          utmSource: t.utmSource ?? null,
          utmMedium: t.utmMedium ?? null,
          utmCampaign: t.utmCampaign ?? null,
          utmContent: t.utmContent ?? null,
          utmTerm: t.utmTerm ?? null,
          clickIdKind: t.clickIdKind ?? null,
          landingPath: t.landingPath ?? null,
          referrerHost: t.referrerHost ?? null,
        }
      : { ...EMPTY_SOURCE };
    if (c.type === "user.registered") {
      registered++;
      if (Object.values(source).some((v) => v !== null)) registeredWithSource++;
    }
    const money = c.type === "order.paid" || c.type === "order.refunded";
    return {
      eventId: c.eventId,
      type: c.type,
      occurredAt: c.iso,
      anonId: anonIdOf(anonSecret, c.row.userId),
      source,
      amountMinor: money ? (c.row.amountMinor ?? null) : null,
      currency: money ? (c.row.currency ?? null) : null,
    };
  });

  const last = events[events.length - 1];
  const nextCursor = last
    ? formatCursor(last.occurredAt, last.eventId)
    : cursor
      ? formatCursor(cursor.iso, cursor.eventId)
      : null;

  return { events, nextCursor, hasMore, coverage: { registered, registeredWithSource } };
}
