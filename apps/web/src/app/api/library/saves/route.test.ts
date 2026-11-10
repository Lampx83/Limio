import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const save = vi.hoisted(() => vi.fn());
const unsave = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, saveLibraryCourse: save, unsaveLibraryCourse: unsave };
});

import { CourseError } from "@feedbackme/core-lms";
import { DELETE, POST } from "./route";

const req = (method: string, body?: unknown) =>
  new Request("http://localhost:3000/api/library/saves", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  state.userId = "u1";
  save.mockReset().mockResolvedValue({ saved: true });
  unsave.mockReset().mockResolvedValue({ saved: false });
});

describe("POST/DELETE /api/library/saves", () => {
  it("chưa đăng nhập → 401 và không gọi lõi", async () => {
    state.userId = null;
    expect((await POST(req("POST", { courseId: "c1" }))).status).toBe(401);
    expect((await DELETE(req("DELETE", { courseId: "c1" }))).status).toBe(401);
    expect(save).not.toHaveBeenCalled();
    expect(unsave).not.toHaveBeenCalled();
  });

  it("thân yêu cầu sai (thiếu, sai kiểu, rỗng, quá dài, không phải JSON) → 400", async () => {
    for (const body of [undefined, {}, { courseId: 5 }, { courseId: "" }, { courseId: "x".repeat(101) }, "nope"]) {
      expect((await POST(req("POST", body))).status).toBe(400);
    }
    expect(save).not.toHaveBeenCalled();
  });

  it("chỉ dùng userId của phiên, không lấy từ thân yêu cầu", async () => {
    const res = await POST(req("POST", { courseId: "c1", userId: "ke-khac" }));
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith("u1", "c1");
    await DELETE(req("DELETE", { courseId: "c1", userId: "ke-khac" }));
    expect(unsave).toHaveBeenCalledWith("u1", "c1");
  });

  it("khoá ngoài thư viện → 404", async () => {
    save.mockRejectedValue(new CourseError("not_found"));
    const res = await POST(req("POST", { courseId: "c1" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
