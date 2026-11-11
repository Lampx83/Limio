import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const getAudio = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, getPracticeAnswerAudio: getAudio };
});
const resolveKey = vi.hoisted(() => vi.fn());
const streamWithRange = vi.hoisted(() => vi.fn());
const streamStorageWithRange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage-serve", () => ({ resolveKey, streamWithRange, streamStorageWithRange }));
vi.mock("@/lib/storage", () => ({ storageFor: vi.fn() }));

import { ExamError } from "@feedbackme/core-lms";
import { GET } from "./route";

const call = (headers: Record<string, string> = {}) =>
  GET(new Request("http://localhost:3000/api/practice-sessions/s1/audio/q1", { headers }), { params: { id: "s1", questionId: "q1" } });

beforeEach(() => {
  state.userId = "u1";
  getAudio.mockReset().mockResolvedValue({ audioKey: "practice-answers/s1/q1-aaaa1111.webm", mimeType: "audio/webm" });
  resolveKey.mockReset().mockResolvedValue({ get: async () => Buffer.from([1, 2, 3]), absPath: null });
  streamStorageWithRange.mockReset().mockResolvedValue(null);
  streamWithRange.mockReset();
});

describe("GET /api/practice-sessions/[id]/audio/[questionId]", () => {
  it("chưa đăng nhập → 401", async () => {
    state.userId = null;
    expect((await call()).status).toBe(401);
    expect(getAudio).not.toHaveBeenCalled();
  });

  it("chủ buổi: phát tệp (S3, đọc cả tệp), đúng MIME, KHÔNG cho bộ nhớ đệm", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(getAudio).toHaveBeenCalledWith("u1", "s1", "q1");
    expect(resolveKey).toHaveBeenCalledWith({ layer: "private", key: "practice-answers/s1/q1-aaaa1111.webm" });
    expect(res.headers.get("content-type")).toBe("audio/webm");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("tệp trên đĩa: dùng luồng có Range nhưng ghi đè cache-control thành private, no-store", async () => {
    resolveKey.mockResolvedValue({ get: async () => Buffer.alloc(0), absPath: "/data/private/practice-answers/s1/q1-aaaa1111.webm" });
    streamWithRange.mockResolvedValue(
      new NextResponse("x", { status: 206, headers: { "cache-control": "public, max-age=604800, immutable", "content-range": "bytes 0-0/10" } }),
    );
    const res = await call({ range: "bytes=0-0" });
    expect(res.status).toBe(206);
    expect(streamWithRange).toHaveBeenCalledWith("/data/private/practice-answers/s1/q1-aaaa1111.webm", "audio/webm", expect.any(Request));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-range")).toBe("bytes 0-0/10");
  });

  it("S3 có Range: dùng đoạn trả về nhưng cũng private, no-store", async () => {
    streamStorageWithRange.mockResolvedValue(new NextResponse("x", { status: 206, headers: { "cache-control": "public, max-age=604800, immutable" } }));
    const res = await call({ range: "bytes=0-0" });
    expect(res.status).toBe(206);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("người khác (không phải chủ buổi) → 404 như buổi không tồn tại, không đụng tới kho", async () => {
    getAudio.mockRejectedValue(new ExamError("practice_session_not_found"));
    const res = await call();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(resolveKey).not.toHaveBeenCalled();
  });

  it("chưa ghi âm → 404; tệp không còn trong kho → 404", async () => {
    getAudio.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(404);
    resolveKey.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(404);
  });

  it("khoá hỏng hoặc thuộc buổi khác không bao giờ được đọc", async () => {
    for (const audioKey of ["practice-answers/s2/q1-aaaa1111.webm", "submissions/2026/11/x.webm", "practice-answers/s1/../../x.webm"]) {
      getAudio.mockResolvedValueOnce({ audioKey, mimeType: "audio/webm" });
      expect((await call()).status).toBe(404);
    }
    expect(resolveKey).not.toHaveBeenCalled();
  });
});
