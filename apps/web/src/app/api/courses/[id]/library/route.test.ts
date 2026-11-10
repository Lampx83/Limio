import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const update = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, updateCourseLibraryMeta: update };
});

import { CourseAuthzError, CourseError } from "@feedbackme/core-lms";
import { PUT } from "./route";

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost:3000/api/courses/c1/library", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: { id: "c1" } },
  );

beforeEach(() => {
  state.userId = "u1";
  update.mockReset().mockResolvedValue({ inLibrary: true });
});

describe("PUT /api/courses/[id]/library", () => {
  it("chưa đăng nhập → 401", async () => {
    state.userId = null;
    expect((await put({ inLibrary: true })).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("thân không phải đối tượng → 400", async () => {
    for (const body of [null, [], "x", 3]) expect((await put(body)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("chuyển nguyên thân cho lõi cùng userId và id khoá", async () => {
    const res = await put({ inLibrary: true, publisher: "NGL" });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith("u1", "c1", { inLibrary: true, publisher: "NGL" });
  });

  it("ánh xạ lỗi: không phải chủ khoá 403, không có khoá 404, dữ liệu sai 400", async () => {
    update.mockRejectedValueOnce(new CourseAuthzError("forbidden"));
    expect((await put({ publisher: "x" })).status).toBe(403);
    update.mockRejectedValueOnce(new CourseAuthzError("not_found"));
    expect((await put({ publisher: "x" })).status).toBe(404);
    update.mockRejectedValueOnce(new CourseError("validation_failed", { levelBand: "sai" }));
    const res = await put({ levelBand: "x" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("validation_failed");
  });
});
