import { describe, expect, it } from "vitest";
import { collectGradingSources, type GradingSourceDeps, type TranscribeOutcome } from "./gradingSources";
import type { GoogleDocTextResult } from "./googleDocText";
import type { LoadedSubmissionFile } from "./submissionFile";

const OWNER = "u1";
const media = (name: string) => `/api/assignment-media/${OWNER}-1-abc.${name}`;

function deps(
  over: {
    doc?: GoogleDocTextResult;
    transcript?: TranscribeOutcome;
    file?: LoadedSubmissionFile;
    text?: string | null;
    images?: number;
  } = {},
) {
  const calls = { doc: 0, transcribe: [] as string[], load: [] as Array<{ url: string; maxBytes: number }>, extract: [] as string[] };
  const d: GradingSourceDeps = {
    fetchGoogleDoc: async () => {
      calls.doc++;
      return over.doc ?? { ok: false, reason: "not_google" };
    },
    transcribe: async (url) => {
      calls.transcribe.push(url);
      return over.transcript ?? { ok: true, text: "Hello my name is Anna.", created: false };
    },
    loadFile: async (url, maxBytes) => {
      calls.load.push({ url, maxBytes });
      return over.file ?? { ok: true, buffer: Buffer.from("x"), mimeType: "application/pdf", kind: "pdf", filename: "f" };
    },
    extractText: async (_b, mime) => {
      calls.extract.push(mime);
      return over.text === undefined ? "Chữ trong tệp." : over.text;
    },
    countImages: async () => over.images ?? 0,
  };
  return { d, calls };
}

const base = { submissionId: "s1", submissionBody: "Bài viết.", attachmentUrl: null, responseFormat: "text" as const };

describe("collectGradingSources — chữ và Google Docs", () => {
  it("chỉ có chữ: đọc phần chữ, không đụng tới Google/kho/Whisper", async () => {
    const { d, calls } = deps();
    const r = await collectGradingSources(base, d);
    expect(r).toEqual({ body: "Bài viết.", attachments: [], unread: null, read: ["phần chữ"] });
    expect(calls.doc + calls.load.length + calls.transcribe.length).toBe(0);
  });

  it("Google Docs mở được → vào đính kèm", async () => {
    const { d } = deps({ doc: { ok: true, kind: "document", text: "Nội dung Doc", truncated: false } });
    const r = await collectGradingSources({ ...base, attachmentUrl: "https://docs.google.com/document/d/x/edit" }, d);
    expect(r.attachments).toEqual([{ label: "Google Docs học viên dán link", text: "Nội dung Doc" }]);
    expect(r.read).toEqual(["phần chữ", "Google Docs"]);
    expect(r.unread).toBeNull();
  });

  it("Google Docs chưa mở quyền → unread nói cách khắc phục", async () => {
    const { d } = deps({ doc: { ok: false, reason: "not_accessible" } });
    const r = await collectGradingSources({ ...base, attachmentUrl: "https://docs.google.com/document/d/x/edit" }, d);
    expect(r.unread?.what).toBe("một tài liệu Google (dán link)");
    expect(r.unread?.why).toContain("Bất kỳ ai có đường liên kết");
  });

  it("link ngoài hệ thống (YouTube, Drive) → không tải, unread", async () => {
    const { d, calls } = deps();
    const yt = await collectGradingSources({ ...base, attachmentUrl: "https://youtu.be/dQw4w9WgXcQ" }, d);
    expect(yt.unread?.what).toBe("một video");
    expect(yt.unread?.why).toContain("link ngoài hệ thống");
    const drive = await collectGradingSources({ ...base, attachmentUrl: "https://drive.google.com/file/d/abcdefghijk/view" }, d);
    expect(drive.unread?.what).toBe("một tệp trên Google Drive");
    expect(calls.load).toHaveLength(0);
    expect(calls.transcribe).toHaveLength(0);
  });
});

describe("collectGradingSources — bài nói", () => {
  const speaking = { ...base, submissionBody: "(bài nói)", attachmentUrl: media("webm"), responseFormat: "audio" as const };

  it("bài nói: bỏ chuỗi giữ chỗ, dùng bản chữ", async () => {
    const { d, calls } = deps();
    const r = await collectGradingSources(speaking, d);
    expect(r.body).toBe("");
    expect(r.attachments[0]?.text).toBe("Hello my name is Anna.");
    expect(r.read).toEqual(["bản chữ bài nói"]);
    expect(calls.transcribe).toEqual([media("webm")]);
  });

  it("vừa chuyển chữ → nhãn báo đã tính vào ví người chấm", async () => {
    const { d } = deps({ transcript: { ok: true, text: "Xin chào.", created: true } });
    const r = await collectGradingSources(speaking, d);
    expect(r.read[0]).toContain("tính vào ví AI của bạn");
  });

  it("chuyển chữ không được → unread kèm lý do đúng", async () => {
    for (const [reason, needle] of [
      ["not_configured", "Whisper"],
      ["too_large", "25 MB"],
      ["silent", "không nghe thấy"],
      ["failed", "thử lại"],
    ] as const) {
      const { d } = deps({ transcript: { ok: false, reason } });
      const r = await collectGradingSources(speaking, d);
      expect(r.attachments).toHaveLength(0);
      expect(r.unread?.what).toBe("một bản ghi âm (bài nói)");
      expect(r.unread?.why.toLowerCase()).toContain(needle.toLowerCase());
    }
  });
});

describe("collectGradingSources — ảnh, video và tài liệu", () => {
  it("ảnh và video: AI không chấm — unread, không tải tệp, không gọi Whisper", async () => {
    for (const [ext, format, what] of [
      ["png", "image", "một ảnh"],
      ["mp4", "video", "một video"],
      ["webm", "video", "một video"],
    ] as const) {
      const { d, calls } = deps();
      const r = await collectGradingSources({ ...base, attachmentUrl: media(ext), responseFormat: format }, d);
      expect(r.attachments).toHaveLength(0);
      expect(r.read).toEqual(["phần chữ"]);
      expect(r.unread).toEqual({ what, why: "AI không chấm ảnh và video — hãy tự xem trước khi chốt điểm." });
      expect(calls.load).toHaveLength(0);
      expect(calls.transcribe).toHaveLength(0);
    }
  });

  it("PDF/Word đọc với trần 20 MB", async () => {
    const { d, calls } = deps();
    await collectGradingSources({ ...base, attachmentUrl: media("pdf") }, d);
    expect(calls.load[0]?.maxBytes).toBe(20 * 1024 * 1024);
  });

  it("PDF có chữ / Word → đính kèm; PDF scan → unread", async () => {
    const pdf = await collectGradingSources({ ...base, attachmentUrl: media("pdf") }, deps().d);
    expect(pdf.attachments).toEqual([{ label: "tệp PDF học viên tải lên (chỉ phần chữ)", text: "Chữ trong tệp." }]);
    expect(pdf.unread).toBeNull();
    expect(pdf.read).toEqual(["phần chữ", "tệp PDF"]);

    const docx = await collectGradingSources(
      { ...base, attachmentUrl: media("docx") },
      deps({ file: { ok: true, buffer: Buffer.from("x"), mimeType: "application/docx", kind: "docx", filename: "f" } }).d,
    );
    expect(docx.read).toEqual(["phần chữ", "tệp Word"]);

    const scan = await collectGradingSources({ ...base, attachmentUrl: media("pdf") }, deps({ text: null }).d);
    expect(scan.attachments).toHaveLength(0);
    expect(scan.unread?.why).toContain("ảnh scan");
  });

  it("PDF/Word có hình: vẫn chấm phần chữ nhưng cảnh báo số hình AI không xem", async () => {
    const pdf = await collectGradingSources({ ...base, attachmentUrl: media("pdf") }, deps({ images: 4 }).d);
    expect(pdf.attachments).toHaveLength(1);
    expect(pdf.read).toEqual(["phần chữ", "chữ trong tệp PDF"]);
    expect(pdf.unread).toEqual({
      what: "4 hình trong tệp PDF",
      why: "AI chỉ đọc chữ trong tệp PDF, không xem hình — hãy tự xem các hình trước khi chốt điểm.",
    });
    const docx = await collectGradingSources(
      { ...base, attachmentUrl: media("docx") },
      deps({ images: 1, file: { ok: true, buffer: Buffer.from("x"), mimeType: "application/docx", kind: "docx", filename: "f" } }).d,
    );
    expect(docx.unread?.what).toBe("1 hình trong tệp Word");
  });

  it("txt/json đọc thẳng, không qua bộ rút chữ", async () => {
    const { d, calls } = deps({ file: { ok: true, buffer: Buffer.from('{"nodes":["A","B"]}'), mimeType: "application/json", kind: "text", filename: "f" } });
    const r = await collectGradingSources({ ...base, attachmentUrl: media("json"), responseFormat: "concept_map" }, d);
    expect(r.attachments[0]?.text).toBe('{"nodes":["A","B"]}');
    expect(calls.extract).toHaveLength(0);
  });

  it("tệp không phải của người nộp / quá cỡ / zip → unread", async () => {
    const notOwner = await collectGradingSources({ ...base, attachmentUrl: media("pdf") }, deps({ file: { ok: false, reason: "not_owner" } }).d);
    expect(notOwner.unread?.why).toContain("không do học viên này");
    const big = await collectGradingSources({ ...base, attachmentUrl: media("pdf") }, deps({ file: { ok: false, reason: "too_large" } }).d);
    expect(big.unread?.why).toContain("20 MB");
    const { d, calls } = deps();
    const zip = await collectGradingSources({ ...base, attachmentUrl: media("zip") }, d);
    expect(zip.unread?.why).toContain("loại tệp này");
    expect(calls.load).toHaveLength(0);
  });
});
