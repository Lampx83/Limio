import { describe, expect, it, vi } from "vitest";
import { withLedger, type StorageAdapter, type StorageLedger } from "./storage";

function fakeInner(sizes: Record<string, number> = {}) {
  const calls: string[] = [];
  const inner: StorageAdapter = {
    put: vi.fn(async (k) => void calls.push(`put:${k}`)),
    get: vi.fn(async () => Buffer.from("x")),
    delete: vi.fn(async (k) => void calls.push(`delete:${k}`)),
    exists: vi.fn(async () => true),
    copy: vi.fn(async (_s, d) => void calls.push(`copy:${d}`)),
    publicUrl: () => null,
    sizeOf: vi.fn(async (k) => sizes[k] ?? null),
  };
  return { inner, calls };
}
const fakeLedger = (): StorageLedger & { record: ReturnType<typeof vi.fn>; markDeleted: ReturnType<typeof vi.fn> } => ({
  record: vi.fn().mockResolvedValue(undefined),
  markDeleted: vi.fn().mockResolvedValue(undefined),
});

describe("withLedger", () => {
  it("put: ghi file rồi ghi sổ đúng layer/key/dung lượng/loại", async () => {
    const { inner } = fakeInner();
    const ledger = fakeLedger();
    await withLedger(inner, "public", ledger).put("lesson-media/videos/2026/09/a.mp4", Buffer.alloc(1234), "video/mp4");
    expect(inner.put).toHaveBeenCalledOnce();
    expect(ledger.record).toHaveBeenCalledWith({
      layer: "public",
      key: "lesson-media/videos/2026/09/a.mp4",
      sizeBytes: 1234,
      contentType: "video/mp4",
    });
  });

  it("lỗi sổ KHÔNG làm hỏng upload (file vẫn đã ghi, put không ném lỗi)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { inner } = fakeInner();
    const ledger = fakeLedger();
    ledger.record.mockRejectedValue(new Error("db down"));
    await expect(withLedger(inner, "private", ledger).put("k", Buffer.from("abc"))).resolves.toBeUndefined();
    expect(inner.put).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("lỗi ghi file thật thì KHÔNG ghi sổ (không có dòng ma cho file không tồn tại)", async () => {
    const { inner } = fakeInner();
    (inner.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("disk full"));
    const ledger = fakeLedger();
    await expect(withLedger(inner, "public", ledger).put("k", Buffer.from("a"))).rejects.toThrow("disk full");
    expect(ledger.record).not.toHaveBeenCalled();
  });

  it("delete: xoá file rồi đánh dấu xoá trong sổ", async () => {
    const { inner } = fakeInner();
    const ledger = fakeLedger();
    await withLedger(inner, "public", ledger).delete("a/b.png");
    expect(ledger.markDeleted).toHaveBeenCalledWith("public", "a/b.png");
  });

  it("copy: đo dung lượng bản sao rồi ghi sổ; không đo được thì bỏ qua, không ném lỗi", async () => {
    const { inner } = fakeInner({ "dest.pdf": 777 });
    const ledger = fakeLedger();
    const a = withLedger(inner, "public", ledger);
    await a.copy("src.pdf", "dest.pdf");
    expect(ledger.record).toHaveBeenCalledWith({ layer: "public", key: "dest.pdf", sizeBytes: 777 });

    ledger.record.mockClear();
    await a.copy("src.pdf", "unknown.pdf");
    expect(ledger.record).not.toHaveBeenCalled();
  });

  it("các thao tác đọc đi thẳng xuống adapter, không đụng sổ", async () => {
    const { inner } = fakeInner();
    const ledger = fakeLedger();
    const a = withLedger(inner, "public", ledger);
    await a.get("k");
    await a.exists("k");
    expect(ledger.record).not.toHaveBeenCalled();
    expect(ledger.markDeleted).not.toHaveBeenCalled();
  });
});
