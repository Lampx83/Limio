import { beforeEach, describe, expect, it, vi } from "vitest";

/** POST /api/lesson-media/files — upload File đính kèm (≤10 MB, chỉ giảng viên). */

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
  return new Request("http://x/api/lesson-media/files", { method: "POST", body: form });
}
const doc = (name = "Bài tập 1.docx", bytes = 2048, type = "application/octet-stream") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("POST /api/lesson-media/files", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(UID);
    isInstructor.mockReset().mockResolvedValue(true);
    put.mockClear();
  });

  it("chưa đăng nhập → 401; không phải giảng viên → 403; không ghi file", async () => {
    const { POST } = await import("./route");
    requireUserId.mockResolvedValueOnce(null);
    expect((await POST(upload(doc()))).status).toBe(401);
    isInstructor.mockResolvedValueOnce(false);
    expect((await POST(upload(doc()))).status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("docx hợp lệ (kể cả MIME octet-stream) → 201, lưu ở lesson-media/files/yyyy/mm, trả tên gốc", async () => {
    const { POST } = await import("./route");
    const res = await POST(upload(doc("Bài tập 1.docx", 4096)));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, sizeBytes: 4096, originalName: "Bài tập 1.docx" });
    expect(body.filename).toMatch(new RegExp(`^${UID}-\\d{10,}-[0-9a-f]{16}\\.docx$`));
    expect(body.url).toBe(`/api/lesson-media/files/${body.filename}`);

    const [key, data, contentType] = put.mock.calls[0]!;
    expect(key).toMatch(new RegExp(`^lesson-media/files/\\d{4}/\\d{2}/${body.filename}$`));
    expect((data as Buffer).length).toBe(4096);
    // content-type theo đuôi, không theo MIME client gửi.
    expect(contentType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("quá 10 MB → 413, không ghi file", async () => {
    const { POST } = await import("./route");
    const res = await POST(upload(doc("a.pdf", 10 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("file_too_large");
    expect(put).not.toHaveBeenCalled();
  });

  it("html/svg dù khai MIME vô hại → 415, không ghi file", async () => {
    const { POST } = await import("./route");
    for (const name of ["trang.html", "logo.svg"]) {
      expect((await POST(upload(doc(name, 100, "text/plain")))).status).toBe(415);
    }
    expect(put).not.toHaveBeenCalled();
  });

  it("file rỗng / thiếu file → 400", async () => {
    const { POST } = await import("./route");
    expect((await POST(upload(doc("a.pdf", 0)))).status).toBe(400);
    expect((await POST(upload())).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("kiểm quyền TRƯỚC khi đọc thân request", async () => {
    isInstructor.mockResolvedValue(false);
    const { POST } = await import("./route");
    const req = upload(doc());
    const spy = vi.spyOn(req, "formData");
    await POST(req);
    expect(spy).not.toHaveBeenCalled();
  });
});
