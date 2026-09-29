import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runOrphanSweep = vi.fn();
class OrphanSweepError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
vi.mock("@feedbackme/core-lms", () => ({ runOrphanSweep, OrphanSweepError }));
const del = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/storage", () => ({ getLayerStorage: () => ({ delete: del }) }));

const req = (secret?: string) =>
  new Request("http://x/api/cron/storage-orphan-sweep", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("GET /api/cron/storage-orphan-sweep", () => {
  const env = { ...process.env };
  beforeEach(() => {
    runOrphanSweep.mockReset().mockResolvedValue({ mode: "dry-run", deleted: 0 });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.CRON_SECRET = "s3cret";
    delete process.env.STORAGE_ORPHAN_SWEEP;
    delete process.env.STORAGE_ORPHAN_DAYS;
    delete process.env.STORAGE_ORPHAN_MAX_DELETE;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("từ chối khi thiếu hoặc sai bí mật", async () => {
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("wrong"))).status).toBe(401);
    expect(runOrphanSweep).not.toHaveBeenCalled();
  });

  it("từ chối khi server CHƯA đặt CRON_SECRET (không được mở cho mọi người như cron khác)", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("./route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("undefined"))).status).toBe(401);
    expect(runOrphanSweep).not.toHaveBeenCalled();
  });

  it("mặc định chạy thử (apply=false), 30 ngày, tối đa 500 file", async () => {
    const { GET } = await import("./route");
    expect((await GET(req("s3cret"))).status).toBe(200);
    expect(runOrphanSweep.mock.calls[0]![0]).toEqual({ apply: false, olderThanDays: 30, maxDelete: 500 });
  });

  it("chỉ xoá thật khi STORAGE_ORPHAN_SWEEP=apply đúng từng chữ", async () => {
    const { GET } = await import("./route");
    for (const v of ["true", "1", "APPLY", "yes"]) {
      process.env.STORAGE_ORPHAN_SWEEP = v;
      await GET(req("s3cret"));
      expect(runOrphanSweep.mock.calls.at(-1)![0].apply).toBe(false);
    }
    process.env.STORAGE_ORPHAN_SWEEP = "apply";
    await GET(req("s3cret"));
    expect(runOrphanSweep.mock.calls.at(-1)![0].apply).toBe(true);
  });

  it("số ngày chờ không hạ được dưới 7 dù cấu hình thấp hơn", async () => {
    const { GET } = await import("./route");
    process.env.STORAGE_ORPHAN_DAYS = "0";
    await GET(req("s3cret"));
    expect(runOrphanSweep.mock.calls.at(-1)![0].olderThanDays).toBe(30); // 0 không hợp lệ → mặc định
    process.env.STORAGE_ORPHAN_DAYS = "1";
    await GET(req("s3cret"));
    expect(runOrphanSweep.mock.calls.at(-1)![0].olderThanDays).toBe(7);
    process.env.STORAGE_ORPHAN_DAYS = "90";
    await GET(req("s3cret"));
    expect(runOrphanSweep.mock.calls.at(-1)![0].olderThanDays).toBe(90);
  });

  it("chốt chặn quét hỏng trả 500 có mã lỗi, không văng lỗi thô", async () => {
    runOrphanSweep.mockRejectedValue(new OrphanSweepError("reference_scan_empty"));
    const { GET } = await import("./route");
    const res = await GET(req("s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "reference_scan_empty" });
  });

  it("hàm xoá truyền xuống đi qua adapter lưu trữ", async () => {
    runOrphanSweep.mockImplementation(async (_o, deleteFile) => {
      await deleteFile("public", "lesson-media/videos/2026/06/x.mp4");
      return { mode: "apply", deleted: 1 };
    });
    const { GET } = await import("./route");
    await GET(req("s3cret"));
    expect(del).toHaveBeenCalledWith("lesson-media/videos/2026/06/x.mp4");
  });
});
