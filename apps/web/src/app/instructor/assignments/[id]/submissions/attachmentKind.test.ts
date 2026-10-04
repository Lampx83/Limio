import { describe, expect, it } from "vitest";
import { detectAttachmentKind, googleEmbedUrl } from "./attachmentKind";

// Acceptance criteria (xem hàm detectAttachmentKind):
//  Given file nộp qua upload nội bộ (/api/assignment-media/...)
//  When  đuôi file là pdf/ảnh/audio/video
//  Then  trả đúng loại để modal chấm bài nhúng preview
//  Given URL ngoài hệ thống trỏ tới .pdf
//  Then  KHÔNG nhúng iframe (site ngoài có thể chặn/ép tải) → "link"
describe("detectAttachmentKind", () => {
  it("nhận PDF nội bộ", () => {
    expect(detectAttachmentKind("/api/assignment-media/abc123.pdf")).toBe("pdf");
  });

  it("nhận PDF nội bộ có query/hash", () => {
    expect(detectAttachmentKind("/api/assignment-media/abc123.PDF?x=1")).toBe("pdf");
    expect(detectAttachmentKind("/api/assignment-media/abc123.pdf#page=2")).toBe("pdf");
  });

  it("PDF ở domain ngoài chỉ là link", () => {
    expect(detectAttachmentKind("https://example.com/bai-nop.pdf")).toBe("link");
  });

  it("nhận ảnh, audio, video", () => {
    expect(detectAttachmentKind("/api/assignment-media/a.jpg")).toBe("image");
    expect(detectAttachmentKind("/api/assignment-media/a.png")).toBe("image");
    expect(detectAttachmentKind("/api/assignment-media/a.mp3")).toBe("audio");
    expect(detectAttachmentKind("/api/assignment-media/a.mp4")).toBe("video");
  });

  it("ảnh ở domain ngoài vẫn hiện được", () => {
    expect(detectAttachmentKind("https://example.com/a.png")).toBe("image");
  });

  it("file không xem được thì là link", () => {
    expect(detectAttachmentKind("/api/assignment-media/a.zip")).toBe("link");
    expect(detectAttachmentKind("/api/assignment-media/a.json")).toBe("link");
    expect(detectAttachmentKind("/api/assignment-media/a.txt")).toBe("link");
  });

  it("YouTube/Vimeo giữ nguyên là embed", () => {
    expect(detectAttachmentKind("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(detectAttachmentKind("https://vimeo.com/123456")).toBe("vimeo");
  });
});

// Acceptance criteria (Google):
//  Given link Docs/Sheets/Slides/Drive đúng host của Google
//  Then  dựng URL nhúng từ ID tài liệu (không dùng nguyên URL người dán)
//  Given host giả (docs.google.com.evil.com, http://…)
//  Then  không nhúng
describe("googleEmbedUrl", () => {
  const ID = "1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789";

  it("Google Docs → /preview", () => {
    expect(googleEmbedUrl(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`)).toBe(
      `https://docs.google.com/document/d/${ID}/preview`,
    );
  });

  it("Google Sheets → /preview", () => {
    expect(googleEmbedUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/preview`,
    );
  });

  it("Google Slides → /embed", () => {
    expect(googleEmbedUrl(`https://docs.google.com/presentation/d/${ID}/edit`)).toBe(
      `https://docs.google.com/presentation/d/${ID}/embed`,
    );
  });

  it("Drive file → /preview (cả dạng /file/d và open?id=)", () => {
    expect(googleEmbedUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(
      `https://drive.google.com/file/d/${ID}/preview`,
    );
    expect(googleEmbedUrl(`https://drive.google.com/open?id=${ID}`)).toBe(
      `https://drive.google.com/file/d/${ID}/preview`,
    );
  });

  it("Drive folder → embeddedfolderview", () => {
    expect(googleEmbedUrl(`https://drive.google.com/drive/folders/${ID}?usp=sharing`)).toBe(
      `https://drive.google.com/embeddedfolderview?id=${ID}#list`,
    );
  });

  it("Drive file có /u/0/ vẫn nhận", () => {
    expect(googleEmbedUrl(`https://drive.google.com/file/u/0/d/${ID}/view`)).toBe(
      `https://drive.google.com/file/d/${ID}/preview`,
    );
  });

  it("từ chối host giả, http, form, link không có ID", () => {
    expect(googleEmbedUrl(`https://docs.google.com.evil.com/document/d/${ID}/edit`)).toBeNull();
    expect(googleEmbedUrl(`https://evil.com/?https://docs.google.com/document/d/${ID}`)).toBeNull();
    expect(googleEmbedUrl(`http://docs.google.com/document/d/${ID}/edit`)).toBeNull();
    expect(googleEmbedUrl(`https://docs.google.com/forms/d/${ID}/viewform`)).toBeNull();
    expect(googleEmbedUrl("https://docs.google.com/document/")).toBeNull();
    expect(googleEmbedUrl("/api/assignment-media/a.pdf")).toBeNull();
    expect(googleEmbedUrl("not a url")).toBeNull();
  });

  it("detectAttachmentKind trả google", () => {
    expect(detectAttachmentKind(`https://docs.google.com/document/d/${ID}/edit`)).toBe("google");
  });
});
