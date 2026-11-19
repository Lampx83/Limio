import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  userId: "u1" as string | null,
  exam: null as Record<string, unknown> | null,
  canEdit: true,
}));

vi.mock("@/lib/session", () => ({ requireUserId: async () => h.userId }));
vi.mock("@feedbackme/db", () => ({ prisma: { exam: { findUnique: async () => h.exam } } }));
vi.mock("@feedbackme/core-lms", () => ({
  canEditExam: async () => h.canEdit,
  commitWordExamImport: vi.fn(),
  parseExamWord: vi.fn(),
  wordPromptToText: (s: string) => s,
}));
vi.mock("@/lib/storage", () => ({ storageFor: vi.fn() }));
vi.mock("@/lib/storage-keys", () => ({ examAssetKey: vi.fn() }));

import { NextResponse } from "next/server";
import { readWordUpload, previewPayload } from "./examWordImport";

function req(file?: { bytes: number[]; name?: string }, extra: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.append("file", new File([new Uint8Array(file.bytes)], file.name ?? "de.docx"));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return new Request("http://x/api", { method: "POST", body: form });
}
const ZIP = [0x50, 0x4b, 3, 4, 0, 0];
const body = async (r: unknown) => ({ status: (r as NextResponse).status, json: await (r as NextResponse).json() });

describe("readWordUpload", () => {
  beforeEach(() => {
    h.userId = "u1";
    h.canEdit = true;
    h.exam = { id: "e1", courseId: "c1", createdById: "u1", status: "draft", purpose: "assessment", _count: { attempts: 0 } };
  });

  it("chưa đăng nhập → 401", async () => {
    h.userId = null;
    expect(await body(await readWordUpload(req({ bytes: ZIP }), "e1"))).toEqual({ status: 401, json: { error: "unauthorized" } });
  });

  it("đề không tồn tại → 404; không có quyền sửa → 403", async () => {
    h.exam = null;
    expect((await body(await readWordUpload(req({ bytes: ZIP }), "e1"))).status).toBe(404);
    h.exam = { id: "e1", status: "draft", purpose: "assessment", _count: { attempts: 0 } };
    h.canEdit = false;
    expect((await body(await readWordUpload(req({ bytes: ZIP }), "e1"))).status).toBe(403);
  });

  it("đề Khảo sát → 400; đề đã xuất bản có lượt thi → 409", async () => {
    h.exam = { id: "e1", status: "draft", purpose: "survey", _count: { attempts: 0 } };
    expect((await body(await readWordUpload(req({ bytes: ZIP }), "e1"))).json.error).toBe("survey_import_unsupported");
    h.exam = { id: "e1", status: "published", purpose: "assessment", _count: { attempts: 3 } };
    expect((await body(await readWordUpload(req({ bytes: ZIP }), "e1"))).json.error).toBe("exam_has_attempts");
  });

  it("thiếu file → 400; file không phải ZIP (.doc cũ, văn bản) → 415", async () => {
    expect((await body(await readWordUpload(req(), "e1"))).json).toEqual({ error: "validation_failed", details: "no_file" });
    expect((await body(await readWordUpload(req({ bytes: [0xd0, 0xcf, 0x11, 0xe0, 1, 2] }), "e1"))).status).toBe(415);
    expect((await body(await readWordUpload(req({ bytes: [104, 105, 106, 107, 108] }), "e1"))).status).toBe(415);
  });

  it("file hợp lệ → trả buffer và cờ includeWarnings", async () => {
    const r = await readWordUpload(req({ bytes: ZIP }, { includeWarnings: "true" }), "e1");
    expect(r).not.toBeInstanceOf(NextResponse);
    expect(r).toMatchObject({ userId: "u1", examId: "e1", includeWarnings: true });
    expect((r as { buf: Buffer }).buf.length).toBe(ZIP.length);
  });

  it("đề đã xuất bản nhưng chưa có lượt thi vẫn được (như Excel)", async () => {
    h.exam = { id: "e1", status: "published", purpose: "assessment", _count: { attempts: 0 } };
    expect(await readWordUpload(req({ bytes: ZIP }), "e1")).not.toBeInstanceOf(NextResponse);
  });
});

describe("previewPayload", () => {
  it("rút đề bài thành chữ, thêm số ảnh, không lộ buffer ảnh", () => {
    const out = previewPayload({
      summary: { ok: 1, warning: 0, error: 0, total: 1 },
      notes: [],
      images: [{ index: 0, contentType: "image/png", alt: "a", data: Buffer.from("secret") }],
      passages: [],
      rows: [
        {
          rowNumber: 7,
          status: "ok",
          errors: [],
          warnings: [],
          passageKey: null,
          imageIndexes: [0],
          parsed: { type: "mcq", prompt: "Đề", passageId: null, passageTitleRaw: "", points: 1, difficulty: 2, config: {}, skillIds: [], unresolvedSkillCodes: [], notes: null },
        },
      ],
    } as never);
    expect(out.imageCount).toBe(1);
    expect(out.rows[0]!.parsed!.imageCount).toBe(1);
    expect(JSON.stringify(out)).not.toContain("secret");
  });
});
