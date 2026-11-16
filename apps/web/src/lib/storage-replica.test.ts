import { Readable } from "node:stream";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReplicaReadAdapter, type StorageAdapter } from "./storage";

function fake(name: string, over: Partial<StorageAdapter> = {}): StorageAdapter & Record<string, ReturnType<typeof vi.fn>> {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(Buffer.from(name)),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    copy: vi.fn().mockResolvedValue(undefined),
    publicUrl: vi.fn().mockReturnValue(null),
    sizeOf: vi.fn().mockResolvedValue(100),
    getRange: vi.fn().mockImplementation(async (_k: string, s: number, e: number) => ({ body: Readable.from([Buffer.from(name)]), total: 100, start: s, end: e })),
    ...over,
  } as never;
}

describe("ReplicaReadAdapter", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("đọc từ kho chính khi kho chính khoẻ", async () => {
    const p = fake("P"), r = fake("R");
    const a = new ReplicaReadAdapter(p, r);
    expect((await a.get("k")).toString()).toBe("P");
    expect(r.get).not.toHaveBeenCalled();
  });

  it("kho chính ném lỗi → đọc bản sao, và các lần sau đi thẳng bản sao", async () => {
    const p = fake("P", { get: vi.fn().mockRejectedValue(new Error("socket hang up")) });
    const r = fake("R");
    const a = new ReplicaReadAdapter(p, r);
    expect((await a.get("k")).toString()).toBe("R");
    p.sizeOf = vi.fn().mockResolvedValue(5);
    expect(await a.sizeOf("k")).toBe(100); // từ bản sao, không hỏi kho chính nữa
    expect(p.sizeOf).not.toHaveBeenCalled();
  });

  it("sizeOf: kho chính trả null (không thấy) → hỏi bản sao", async () => {
    const p = fake("P", { sizeOf: vi.fn().mockResolvedValue(null) });
    const a = new ReplicaReadAdapter(p, fake("R", { sizeOf: vi.fn().mockResolvedValue(42) }));
    expect(await a.sizeOf("k")).toBe(42);
  });

  it("getRange: luồng kho chính báo lỗi → lần xin kế tiếp sang bản sao", async () => {
    const body = new Readable({ read() {} });
    const p = fake("P", { getRange: vi.fn().mockResolvedValue({ body, total: 100, start: 0, end: 9 }) });
    const r = fake("R");
    const a = new ReplicaReadAdapter(p, r);
    const first = await a.getRange("k", 0, 9);
    expect(first?.body).toBe(body);
    body.on("error", () => {});
    body.destroy(new Error("aborted"));
    await new Promise((res) => setImmediate(res));
    await a.getRange("k", 10, 19);
    expect(p.getRange).toHaveBeenCalledTimes(1);
    expect(r.getRange).toHaveBeenCalledTimes(1);
  });

  it("put ghi cả hai; bản sao lỗi không làm hỏng upload", async () => {
    const p = fake("P"), r = fake("R", { put: vi.fn().mockRejectedValue(new Error("nas2 down")) });
    const a = new ReplicaReadAdapter(p, r);
    await expect(a.put("k", Buffer.from("x"))).resolves.toBeUndefined();
    expect(p.put).toHaveBeenCalled();
  });

  it("put: kho chính lỗi thì lỗi lan ra (không nuốt)", async () => {
    const a = new ReplicaReadAdapter(fake("P", { put: vi.fn().mockRejectedValue(new Error("down")) }), fake("R"));
    await expect(a.put("k", Buffer.from("x"))).rejects.toThrow("down");
  });
});
