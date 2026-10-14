import { describe, expect, it, vi } from "vitest";
import { uploadLessonAudio } from "@/lib/uploadLessonAudio";
import { AUDIO_MAX_BYTES } from "@/lib/lessonAudio";

/**
 * LANG G2 — các bảng từ vựng/hội thoại cho upload audio TỪNG dòng; dùng chung một
 * hàm gọi route /api/lesson-media/audio, trả kết quả có cấu trúc thay vì ném lỗi.
 */

const file = (size = 1024, type = "audio/mpeg", name = "bai-nghe.mp3") => new File([new Uint8Array(size)], name, { type });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("uploadLessonAudio", () => {
  it("thành công: trả url và tên file gốc; gửi multipart tới đúng route", async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, url: "/api/lesson-media/audio/x-1-ab.mp3" }, 201));
    const r = await uploadLessonAudio(file(), f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, url: "/api/lesson-media/audio/x-1-ab.mp3", originalName: "bai-nghe.mp3" });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/api/lesson-media/audio");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("quá 50 MB: từ chối ngay ở máy khách, không gửi request", async () => {
    const f = vi.fn();
    const r = await uploadLessonAudio(file(AUDIO_MAX_BYTES + 1), f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, error: "file_too_large" });
    expect(f).not.toHaveBeenCalled();
  });

  it("server từ chối: trả mã lỗi và status của server", async () => {
    const f = vi.fn().mockResolvedValue(json({ error: "unsupported_media_type" }, 415));
    expect(await uploadLessonAudio(file(1024, "audio/wav", "a.wav"), f as unknown as typeof fetch)).toMatchObject({
      ok: false, error: "unsupported_media_type", status: 415,
    });
    const g = vi.fn().mockResolvedValue(json({ error: "forbidden" }, 403));
    expect(await uploadLessonAudio(file(), g as unknown as typeof fetch)).toMatchObject({ ok: false, error: "forbidden", status: 403 });
  });

  it("phản hồi lỗi không phải JSON vẫn cho kết quả có cấu trúc", async () => {
    const f = vi.fn().mockResolvedValue(new Response("boom", { status: 502 }));
    expect(await uploadLessonAudio(file(), f as unknown as typeof fetch)).toMatchObject({ ok: false, error: "upload_failed", status: 502 });
  });

  it("mất mạng: network_error, không ném lỗi", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await uploadLessonAudio(file(), f as unknown as typeof fetch)).toMatchObject({ ok: false, error: "network_error" });
  });
});
