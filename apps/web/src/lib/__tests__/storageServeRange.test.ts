import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ start: number; end?: number }> = [];
let lastBody: Readable | null = null;
const TOTAL = 100 * 1024 * 1024;

vi.mock("../storage", () => ({
  localAbsPath: () => null,
  storageFor: () => ({
    getRange: async (_key: string, start: number, end?: number) => {
      calls.push({ start, end });
      lastBody = Readable.from([Buffer.alloc(8)]);
      return { body: lastBody, total: TOTAL, start, end: end ?? TOTAL - 1 };
    },
    sizeOf: async () => TOTAL,
  }),
}));

import { MAX_RANGE_BYTES, streamStorageWithRange } from "../storage-serve";

const key = { layer: "public", key: "lesson-media/videos/2026/09/x.mp4" } as never;
const req = (range?: string, signal?: AbortSignal) =>
  new Request("http://x/video", { headers: range ? { range } : {}, signal });

describe("streamStorageWithRange — mỗi yêu cầu chỉ giữ socket S3 cho một đoạn ngắn", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("`bytes=0-` (trình duyệt xin tới hết file) bị cắt còn MAX_RANGE_BYTES, trả 206 đúng Content-Range", async () => {
    const res = await streamStorageWithRange(key, "video/mp4", req("bytes=0-"));
    expect(res?.status).toBe(206);
    expect(calls[0]).toEqual({ start: 0, end: MAX_RANGE_BYTES - 1 });
    expect(res?.headers.get("content-length")).toBe(String(MAX_RANGE_BYTES));
    expect(res?.headers.get("content-range")).toBe(`bytes 0-${MAX_RANGE_BYTES - 1}/${TOTAL}`);
  });

  it("không có header Range: trả đủ file với 200, không cắt cụt", async () => {
    const res = await streamStorageWithRange(key, "video/mp4", req());
    expect(res?.status).toBe(200);
    expect(calls[0]).toEqual({ start: 0, end: TOTAL - 1 });
    expect(res?.headers.get("content-length")).toBe(String(TOTAL));
    expect(res?.headers.has("content-range")).toBe(false);
  });

  it("đoạn nhỏ hơn giới hạn giữ nguyên", async () => {
    await streamStorageWithRange(key, "video/mp4", req("bytes=100-199"));
    expect(calls[0]).toEqual({ start: 100, end: 199 });
  });

  it("đoạn cuối file không vượt tổng dung lượng", async () => {
    const res = await streamStorageWithRange(key, "video/mp4", req(`bytes=${TOTAL - 10}-`));
    expect(calls[0]!.end).toBe(TOTAL - 1);
    expect(res?.headers.get("content-length")).toBe("10");
  });

  it("client ngắt giữa chừng thì luồng S3 bị đóng (không giữ socket)", async () => {
    const ac = new AbortController();
    await streamStorageWithRange(key, "video/mp4", req("bytes=0-", ac.signal));
    expect(lastBody!.destroyed).toBe(false);
    ac.abort();
    expect(lastBody!.destroyed).toBe(true);
  });
});
