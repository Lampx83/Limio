import { describe, expect, it } from "vitest";
import { loadSubmissionFile, submissionFileKind } from "./submissionFile";

describe("submissionFileKind", () => {
  it("phân loại theo đuôi file hệ thống; link ngoài → null", () => {
    expect(submissionFileKind("/api/assignment-media/u-1-a.png")).toBe("image");
    expect(submissionFileKind("http://localhost:3000/api/assignment-media/u-1-a.PDF")).toBe("pdf");
    expect(submissionFileKind("/api/assignment-media/u-1-a.docx")).toBe("docx");
    expect(submissionFileKind("/api/assignment-media/u-1-a.m4a")).toBe("audio");
    expect(submissionFileKind("/api/assignment-media/u-1-a.webm")).toBe("video");
    expect(submissionFileKind("/api/assignment-media/u-1-a.zip")).toBe("other");
    expect(submissionFileKind("https://youtu.be/x")).toBeNull();
    expect(submissionFileKind("/api/assignment-media/../etc/passwd")).toBeNull();
  });
});

describe("loadSubmissionFile — chặn trước khi đụng kho", () => {
  it("link ngoài / tên file không an toàn → not_hosted", async () => {
    expect(await loadSubmissionFile("https://evil.example/a.png", "u1", { maxBytes: 10 })).toEqual({ ok: false, reason: "not_hosted" });
    expect(await loadSubmissionFile("/api/assignment-media/..x.png", "u1", { maxBytes: 10 })).toEqual({ ok: false, reason: "not_hosted" });
  });

  it("file mang userId của người khác → not_owner", async () => {
    expect(await loadSubmissionFile("/api/assignment-media/u2-1-a.png", "u1", { maxBytes: 10 })).toEqual({ ok: false, reason: "not_owner" });
  });
});
