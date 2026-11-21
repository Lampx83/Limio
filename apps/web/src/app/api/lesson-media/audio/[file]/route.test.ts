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

// Cổng học liệu bản quyền có test riêng (lib/lessonMediaGuard.test.ts); ở đây chỉ cần route chạy như trước.
vi.mock("@/lib/lessonMediaGuard", () => ({ guardedLessonMedia: <T,>(h: T) => h }));

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
  beforeEach(async () => {
    (await import("@/lib/audioBufferCache")).resetAudioBufferCache();
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

  describe("kho chỉ đọc được cả file (không phát từng đoạn)", () => {
    const BYTES = Buffer.from("0123456789");
    const arrange = () => {
      const readAll = vi.fn().mockResolvedValue(BYTES);
      resolveKey.mockResolvedValue({ absPath: null, get: readAll });
      return readAll;
    };

    it("trả đúng đoạn được xin bằng 206 thay vì cả file bằng 200", async () => {
      arrange();
      const res = await get(`${FILE}.mp3`, { range: "bytes=2-5" });
      expect(res.status).toBe(206);
      expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
      expect(res.headers.get("content-length")).toBe("4");
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("2345");
    });

    it("không có Range → 200 cả file", async () => {
      arrange();
      const res = await get(`${FILE}.mp3`);
      expect(res.status).toBe(200);
      expect(res.headers.get("accept-ranges")).toBe("bytes");
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("0123456789");
    });

    it("Range ngoài file → 416", async () => {
      arrange();
      const res = await get(`${FILE}.mp3`, { range: "bytes=50-" });
      expect(res.status).toBe(416);
      expect(res.headers.get("content-range")).toBe("bytes */10");
    });

    it("chỉ đọc kho MỘT lần: yêu cầu sau (tua) lấy từ bộ nhớ, không chạm kho nữa", async () => {
      const readAll = arrange();
      await get(`${FILE}.mp3`, { range: "bytes=0-" });
      resolveKey.mockClear();
      streamStorageWithRange.mockClear();
      const res = await get(`${FILE}.mp3`, { range: "bytes=7-" });
      expect(res.status).toBe(206);
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("789");
      expect(readAll).toHaveBeenCalledTimes(1);
      expect(resolveKey).not.toHaveBeenCalled();
      expect(streamStorageWithRange).not.toHaveBeenCalled();
    });

    it("nhiều yêu cầu cùng lúc dùng chung một lần đọc kho", async () => {
      const readAll = arrange();
      const rs = await Promise.all([get(`${FILE}.mp3`, { range: "bytes=0-" }), get(`${FILE}.mp3`, { range: "bytes=3-" }), get(`${FILE}.mp3`)]);
      expect(rs.map((r) => r.status)).toEqual([206, 206, 200]);
      expect(readAll).toHaveBeenCalledTimes(1);
    });

    it("đọc kho lỗi thì không nhớ lỗi: yêu cầu sau thử lại", async () => {
      const readAll = vi.fn().mockRejectedValueOnce(new Error("nas")).mockResolvedValue(BYTES);
      resolveKey.mockResolvedValue({ absPath: null, get: readAll });
      await expect(get(`${FILE}.mp3`)).rejects.toThrow("nas");
      const res = await get(`${FILE}.mp3`);
      expect(res.status).toBe(200);
      expect(readAll).toHaveBeenCalledTimes(2);
    });
  });
});
