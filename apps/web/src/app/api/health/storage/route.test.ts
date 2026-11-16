import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@feedbackme/db", () => ({ prisma: { contentItem: { findFirst } } }));
const sizeOf = vi.fn();
const getRange = vi.fn();
vi.mock("@/lib/storage", () => ({ storageFor: () => ({ sizeOf, getRange }) }));
vi.mock("@/lib/storage-keys", () => ({ lessonVideoKeyFromFilename: (f: string) => ({ key: `videos/${f}` }) }));

const { GET } = await import("./route");

const body = (n: number) => Readable.from([Buffer.alloc(n)]);

describe("GET /api/health/storage", () => {
  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue({ payload: { url: "/api/lesson-media/videos/a.mp4" } });
    sizeOf.mockReset().mockResolvedValue(10_000_000);
    getRange.mockReset().mockImplementation(async (_k: string, s: number, e: number) => ({ body: body(e - s + 1), total: 10_000_000, start: s, end: e }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("200 khi đọc đủ byte", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("503 khi chỉ đọc được một phần (kho nghẽn)", async () => {
    getRange.mockResolvedValue({ body: body(3459), total: 10_000_000, start: 0, end: 262143 });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "storage_unavailable" });
  });

  it("503 khi kho báo lỗi", async () => {
    getRange.mockRejectedValue(new Error("socket hang up"));
    expect((await GET()).status).toBe(503);
  });

  it("200 khi chưa có video nào để thử", async () => {
    findFirst.mockResolvedValue(null);
    expect((await GET()).status).toBe(200);
  });
});
