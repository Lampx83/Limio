import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LANG G1 / AUD.2 — GET /api/lesson-media/audio/[file].
 * Phần cắt Range (206) nằm trong streamWithRange dùng chung với video; ở đây
 * chỉ thử phần keo của route: lọc tên file, tìm đúng key, chọn MIME, chuyền
 * nguyên Request (mang header Range) cho hàm stream.
 */

const resolveKey = vi.fn();
const streamWithRange = vi.fn();
const streamStorageWithRange = vi.fn();

vi.mock("@/lib/storage-serve", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/storage-serve")>();
  return { ...actual, resolveKey, streamWithRange, streamStorageWithRange };
});

// 1790000000000 ms = tháng 09/2026 (cùng mốc các test lưu trữ khác).
const FILE = "11111111-2222-4333-8444-555555555555-1790000000000-ab12cd34ef567890";
const get = (file: string, headers: Record<string, string> = {}) =>
  import("./route").then(({ GET }) =>
    GET(new Request(`http://x/api/lesson-media/audio/${file}`, { headers }), { params: { file } }),
  );

describe("GET /api/lesson-media/audio/[file]", () => {
  beforeEach(() => {
    resolveKey.mockReset().mockResolvedValue({ absPath: "/data/x", get: vi.fn() });
    streamWithRange.mockReset().mockResolvedValue(new Response("audio", { status: 206 }));
    streamStorageWithRange.mockReset().mockResolvedValue(null);
  });

  it("AUD.2.2: tên file có ../ hoặc ký tự lạ → 403, không chạm vào kho", async () => {
    for (const bad of ["../etc/passwd.mp3", "a/b.mp3", "..%2Fx.mp3", "a\\b.mp3"]) {
      const res = await get(bad);
      expect(res.status).toBe(403);
    }
    expect(resolveKey).not.toHaveBeenCalled();
  });

  it("tên không đúng dạng upload (không suy được key) → 404", async () => {
    resolveKey.mockResolvedValue(null);
    const res = await get("khong-co-moc-thoi-gian.mp3");
    expect(res.status).toBe(404);
  });

  it("file không còn trong kho → 404", async () => {
    resolveKey.mockResolvedValue(null);
    const res = await get(`${FILE}.mp3`);
    expect(res.status).toBe(404);
  });

  it("tìm đúng key lesson-media/audio/2026/09/<file> ở layer public", async () => {
    await get(`${FILE}.mp3`);
    expect(resolveKey).toHaveBeenCalledWith({ layer: "public", key: `lesson-media/audio/2026/09/${FILE}.mp3` });
  });

  it.each([
    ["mp3", "audio/mpeg"],
    ["m4a", "audio/mp4"],
    ["ogg", "audio/ogg"],
    ["webm", "audio/webm"],
  ])("AUD.2.1: .%s phát với MIME %s và chuyền Request có Range cho streamWithRange", async (ext, mime) => {
    const res = await get(`${FILE}.${ext}`, { range: "bytes=0-99" });
    expect(res.status).toBe(206);
    expect(streamWithRange).toHaveBeenCalledTimes(1);
    const [absPath, gotMime, req] = streamWithRange.mock.calls[0]!;
    expect(absPath).toBe("/data/x");
    expect(gotMime).toBe(mime);
    expect((req as Request).headers.get("range")).toBe("bytes=0-99");
  });

  it("đuôi không thuộc danh sách (kể cả wav) → không phát, 404", async () => {
    for (const ext of ["wav", "exe", "html"]) {
      const res = await get(`${FILE}.${ext}`);
      expect(res.status).toBe(404);
    }
    expect(streamWithRange).not.toHaveBeenCalled();
  });

  it("kho S3 (không có đường dẫn local) → stream từng đoạn, không nạp cả file vào RAM", async () => {
    resolveKey.mockResolvedValue({ absPath: null, get: vi.fn() });
    streamStorageWithRange.mockResolvedValue(new Response("chunk", { status: 206 }));
    const res = await get(`${FILE}.mp3`, { range: "bytes=10-" });
    expect(res.status).toBe(206);
    expect(streamStorageWithRange).toHaveBeenCalledTimes(1);
  });
});
