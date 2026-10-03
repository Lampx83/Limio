import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LANG G1 / AUD.1 — POST /api/lesson-media/audio.
 * Khác route video ở một điểm có chủ ý: video chỉ cần "đã đăng nhập", còn audio
 * phải là giảng viên (401 = chưa đăng nhập, 403 = đăng nhập nhưng không phải GV).
 */

const requireUserId = vi.fn();
const isInstructor = vi.fn();
const put = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@feedbackme/core-lms", () => ({ isInstructor }));
vi.mock("@/lib/storage", () => ({ storageFor: () => ({ put }) }));

const UID = "11111111-2222-4333-8444-555555555555";

function upload(file?: File) {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("http://x/api/lesson-media/audio", { method: "POST", body: form });
}
const audioFile = (type = "audio/mpeg", bytes = 2048) =>
  new File([new Uint8Array(bytes)], "bai-nghe", { type });

describe("POST /api/lesson-media/audio", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(UID);
    isInstructor.mockReset().mockResolvedValue(true);
    put.mockClear();
  });

  it("AUD.1.4: chưa đăng nhập → 401, không ghi file", async () => {
    requireUserId.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(upload(audioFile()));
    expect(res.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it("AUD.1.4: đã đăng nhập nhưng không phải giảng viên → 403, không ghi file", async () => {
    isInstructor.mockResolvedValue(false);
    const { POST } = await import("./route");
    const res = await POST(upload(audioFile()));
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("AUD.1.1: mp3 hợp lệ → 201, lưu ở lesson-media/audio/yyyy/mm, tên có hậu tố ngẫu nhiên", async () => {
    const { POST } = await import("./route");
    const res = await POST(upload(audioFile("audio/mpeg", 4096)));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, sizeBytes: 4096, mime: "audio/mpeg" });
    expect(body.filename).toMatch(new RegExp(`^${UID}-\\d{10,}-[0-9a-f]{16}\\.mp3$`));
    expect(body.url).toBe(`/api/lesson-media/audio/${body.filename}`);

    expect(put).toHaveBeenCalledTimes(1);
    const [key, data, contentType] = put.mock.calls[0]!;
    expect(key).toMatch(new RegExp(`^lesson-media/audio/\\d{4}/\\d{2}/${body.filename}$`));
    expect((data as Buffer).length).toBe(4096);
    expect(contentType).toBe("audio/mpeg");
  });

  it.each([
    ["audio/mp4", "m4a"],
    ["audio/x-m4a", "m4a"],
    ["audio/ogg", "ogg"],
    ["audio/webm", "webm"],
  ])("AUD.1.1: %s → đuôi .%s", async (type, ext) => {
    const { POST } = await import("./route");
    const res = await POST(upload(audioFile(type)));
    expect(res.status).toBe(201);
    expect((await res.json()).filename).toMatch(new RegExp(`\\.${ext}$`));
  });

  it("AUD.1.2: quá 50 MB → 413, không ghi file", async () => {
    const { POST } = await import("./route");
    const res = await POST(upload(audioFile("audio/mpeg", 50 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("file_too_large");
    expect(put).not.toHaveBeenCalled();
  });

  it("AUD.1.3: wav và video → 415, không ghi file", async () => {
    const { POST } = await import("./route");
    for (const type of ["audio/wav", "audio/x-wav", "video/mp4"]) {
      const res = await POST(upload(audioFile(type)));
      expect(res.status).toBe(415);
    }
    expect(put).not.toHaveBeenCalled();
  });

  it("AUD.1.5: file rỗng → 400; thiếu file → 400", async () => {
    const { POST } = await import("./route");
    expect((await POST(upload(audioFile("audio/mpeg", 0)))).status).toBe(400);
    expect((await POST(upload())).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("kiểm quyền TRƯỚC khi đọc thân request (người lạ không bắt server nuốt 50 MB)", async () => {
    isInstructor.mockResolvedValue(false);
    const { POST } = await import("./route");
    const req = upload(audioFile());
    const spy = vi.spyOn(req, "formData");
    await POST(req);
    expect(spy).not.toHaveBeenCalled();
  });
});
