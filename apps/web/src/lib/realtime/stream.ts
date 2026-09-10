import { getRedis, createBlockingConnection } from "../redis";

// Wrapper mỏng quanh Redis Streams. Mỗi channel = 1 stream key `rt:{channel}`.
// MAXLEN ~ N giữ stream gọn (xấp xỉ, không exact — `~` nhanh hơn nhiều).
// ID trả về dạng "<ms>-<seq>" (Redis native). Client gửi lại làm Last-Event-ID khi reconnect.

const KEY_PREFIX = "rt:";
const DEFAULT_MAXLEN = 10_000;
const BLOCK_MS = 25_000; // < 30s để không bị proxy timeout

export type StreamEvent = {
  id: string;
  channel: string;
  data: unknown;
};

function key(channel: string) {
  return `${KEY_PREFIX}${channel}`;
}

export async function publish(
  channel: string,
  data: unknown,
  opts: { maxlen?: number } = {},
): Promise<string> {
  const maxlen = opts.maxlen ?? DEFAULT_MAXLEN;
  const payload = JSON.stringify(data);
  // XADD rt:{ch} MAXLEN ~ 10000 * data <json>
  const id = await getRedis().xadd(key(channel), "MAXLEN", "~", maxlen, "*", "data", payload);
  if (!id) throw new Error("XADD returned null");
  return id;
}

// Lấy event từ `sinceId` (exclusive). "0" = từ đầu. Trả về tối đa `count` event.
export async function readSince(
  channel: string,
  sinceId: string,
  count = 100,
): Promise<StreamEvent[]> {
  const res = await getRedis().xrange(key(channel), `(${sinceId}`, "+", "COUNT", count);
  return parseEntries(channel, res);
}

// Snapshot toàn bộ event hiện có trong stream (giới hạn count).
export async function snapshot(channel: string, count = 1000): Promise<StreamEvent[]> {
  const res = await getRedis().xrange(key(channel), "-", "+", "COUNT", count);
  return parseEntries(channel, res);
}

// Async iterator block-read từ `sinceId`. Dùng cho SSE handler.
// Mỗi lần yield 1 batch event mới. Dừng khi `signal` abort.
export async function* subscribe(
  channel: string,
  sinceId: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent[], void, void> {
  let cursor = sinceId;
  // Connection RIÊNG cho listener này — không share với listener khác. XREAD
  // BLOCK giữ nguyên connection tới khi có data/hết BLOCK_MS; share 1
  // connection cho nhiều listener khiến các blocking call xếp hàng lên
  // nhau — listener join sau bị kẹt phía sau, và khi tới lượt thực thi,
  // cursor "$" resolve lại từ thời điểm ĐÓ nên bỏ lỡ đúng event vừa đánh
  // thức listener trước (bug thực tế: học viên join gameshow sau bị kẹt màn
  // hình chờ tới tận câu hỏi kế tiếp).
  const conn = createBlockingConnection();
  const onAbort = () => conn.disconnect();
  signal.addEventListener("abort", onAbort);
  try {
    while (!signal.aborted) {
      let res: [string, [string, string[]][]][] | null = null;
      try {
        // XREAD BLOCK 25000 COUNT 50 STREAMS rt:{ch} <cursor>
        // ioredis typing cho overload xread phức tạp — cast args qua any cho gọn,
        // shape return value vẫn đúng theo Redis protocol.
        res = (await (conn.xread as unknown as (
          ...args: unknown[]
        ) => Promise<[string, [string, string[]][]][] | null>)(
          "BLOCK",
          BLOCK_MS,
          "COUNT",
          50,
          "STREAMS",
          key(channel),
          cursor,
        )) ?? null;
      } catch {
        if (signal.aborted) return;
        // Reconnect/transient — chờ 500ms rồi thử lại
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (signal.aborted) return;
      if (!res || res.length === 0) {
        // Timeout block — yield empty để caller có dịp gửi heartbeat
        yield [];
        continue;
      }
      const first = res[0];
      if (!first) {
        yield [];
        continue;
      }
      const [, entries] = first;
      const events = parseEntries(channel, entries);
      if (events.length > 0) {
        const last = events[events.length - 1];
        if (last) cursor = last.id;
        yield events;
      }
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    conn.disconnect();
  }
}

function parseEntries(channel: string, entries: [string, string[]][]): StreamEvent[] {
  return entries.map(([id, fields]) => {
    // fields = ["data", "<json>"] — lookup an toàn theo cặp
    let data: unknown = null;
    for (let i = 0; i < fields.length; i += 2) {
      if (fields[i] === "data") {
        const raw = fields[i + 1] ?? "null";
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        break;
      }
    }
    return { id, channel, data };
  });
}
