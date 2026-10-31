import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

/** Cổng học liệu bản quyền (AC1): bảng tra, quyết định theo phiên, cache, header. */

const findProtectingCourseIds = vi.fn();
const canAccessProtectedMedia = vi.fn();
const auth = vi.fn();

vi.mock("@feedbackme/core-lms", () => ({ findProtectingCourseIds, canAccessProtectedMedia }));
vi.mock("@/lib/auth", () => ({ auth }));

const FILE = "u1-1790000000000-aaaa1111bbbb2222.pdf";
const ctx = (file = FILE) => ({ params: { file } });
const req = () => new Request(`http://x/api/lesson-media/pdfs/${FILE}`);
const ok = () => new NextResponse("bytes", { headers: { "cache-control": "public, max-age=604800, immutable" } });

async function load() {
  return import("./lessonMediaGuard");
}

describe("guardedLessonMedia", () => {
  beforeEach(async () => {
    findProtectingCourseIds.mockReset().mockResolvedValue([]);
    canAccessProtectedMedia.mockReset().mockResolvedValue(true);
    auth.mockReset().mockResolvedValue({ user: { id: "u-1" } });
    (await load()).resetLessonMediaGuardCache();
  });

  it("file không thuộc khoá bản quyền: đi thẳng, giữ nguyên cache công khai, không đụng tới phiên", async () => {
    const { guardedLessonMedia } = await load();
    const res = await guardedLessonMedia(async () => ok())(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800, immutable");
    expect(auth).not.toHaveBeenCalled();
    expect(canAccessProtectedMedia).not.toHaveBeenCalled();
  });

  it("file được bảo vệ, người ẩn danh → 403 và handler không chạy (không đọc byte nào)", async () => {
    findProtectingCourseIds.mockResolvedValue(["c-1"]);
    auth.mockResolvedValue(null);
    canAccessProtectedMedia.mockResolvedValue(false);
    const handler = vi.fn(async () => ok());
    const { guardedLessonMedia } = await load();

    const res = await guardedLessonMedia(handler)(req(), ctx());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(canAccessProtectedMedia).toHaveBeenCalledWith(null, ["c-1"]);
  });

  it("file được bảo vệ, người có quyền → phục vụ và đổi cache sang private", async () => {
    findProtectingCourseIds.mockResolvedValue(["c-1"]);
    const { guardedLessonMedia } = await load();
    const res = await guardedLessonMedia(async () => ok())(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(canAccessProtectedMedia).toHaveBeenCalledWith("u-1", ["c-1"]);
  });

  it("không đổi header của phản hồi lỗi (404 từ handler giữ nguyên)", async () => {
    findProtectingCourseIds.mockResolvedValue(["c-1"]);
    const { guardedLessonMedia } = await load();
    const res = await guardedLessonMedia(async () => new NextResponse("not_found", { status: 404 }))(req(), ctx());
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).not.toBe("private, max-age=3600");
  });

  it("tên file lạ đi thẳng vào handler để nó tự trả 403, không tra bảng", async () => {
    const handler = vi.fn(async () => new NextResponse("forbidden", { status: 403 }));
    const { guardedLessonMedia } = await load();
    const res = await guardedLessonMedia(handler)(req(), ctx("../etc/passwd"));
    expect(res.status).toBe(403);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(findProtectingCourseIds).not.toHaveBeenCalled();
  });

  it("tra bảng hỏng → 503, không phục vụ (đóng còn hơn lộ)", async () => {
    findProtectingCourseIds.mockRejectedValue(new Error("db down"));
    const handler = vi.fn(async () => ok());
    const { guardedLessonMedia } = await load();
    const res = await guardedLessonMedia(handler)(req(), ctx());
    expect(res.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it("kiểm quyền hỏng → 503", async () => {
    findProtectingCourseIds.mockResolvedValue(["c-1"]);
    canAccessProtectedMedia.mockRejectedValue(new Error("db down"));
    const { guardedLessonMedia } = await load();
    const res = await guardedLessonMedia(async () => ok())(req(), ctx());
    expect(res.status).toBe(503);
  });

  it("tua video: nhiều request liên tiếp chỉ tra bảng và kiểm quyền một lần (cache)", async () => {
    findProtectingCourseIds.mockResolvedValue(["c-1"]);
    const { guardedLessonMedia } = await load();
    const g = guardedLessonMedia(async () => ok());
    for (let i = 0; i < 20; i++) expect((await g(req(), ctx())).status).toBe(200);
    expect(findProtectingCourseIds).toHaveBeenCalledTimes(1);
    expect(canAccessProtectedMedia).toHaveBeenCalledTimes(1);
  });

  it("quyết định cache theo từng người: A được, B không, không lẫn nhau", async () => {
    findProtectingCourseIds.mockResolvedValue(["c-1"]);
    canAccessProtectedMedia.mockImplementation(async (userId: string | null) => userId === "u-a");
    const { guardedLessonMedia } = await load();
    const g = guardedLessonMedia(async () => ok());

    auth.mockResolvedValue({ user: { id: "u-a" } });
    expect((await g(req(), ctx())).status).toBe(200);
    auth.mockResolvedValue({ user: { id: "u-b" } });
    expect((await g(req(), ctx())).status).toBe(403);
    auth.mockResolvedValue({ user: { id: "u-a" } });
    expect((await g(req(), ctx())).status).toBe(200);
  });

  it("cache hết hạn thì hỏi lại: người vừa bị thu quyền (hoàn tiền) bị chặn sau tối đa ACCESS_DECISION_TTL_MS", async () => {
    vi.useFakeTimers();
    try {
      findProtectingCourseIds.mockResolvedValue(["c-1"]);
      const { guardedLessonMedia, ACCESS_DECISION_TTL_MS } = await load();
      const g = guardedLessonMedia(async () => ok());
      expect((await g(req(), ctx())).status).toBe(200);

      canAccessProtectedMedia.mockResolvedValue(false);
      expect((await g(req(), ctx())).status).toBe(200); // còn trong cache
      vi.advanceTimersByTime(ACCESS_DECISION_TTL_MS + 1);
      expect((await g(req(), ctx())).status).toBe(403);
    } finally {
      vi.useRealTimers();
    }
  });

  it("file vừa đăng ký bảo vệ thì các bản chạy khác thấy sau tối đa PROTECTION_LOOKUP_TTL_MS", async () => {
    vi.useFakeTimers();
    try {
      const { guardedLessonMedia, PROTECTION_LOOKUP_TTL_MS } = await load();
      const g = guardedLessonMedia(async () => ok());
      expect((await g(req(), ctx())).headers.get("cache-control")).toBe("public, max-age=604800, immutable");

      findProtectingCourseIds.mockResolvedValue(["c-1"]);
      vi.advanceTimersByTime(PROTECTION_LOOKUP_TTL_MS + 1);
      expect((await g(req(), ctx())).headers.get("cache-control")).toBe("private, max-age=3600");
    } finally {
      vi.useRealTimers();
    }
  });
});
