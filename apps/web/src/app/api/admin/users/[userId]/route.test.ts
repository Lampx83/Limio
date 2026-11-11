import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ requireAdmin: async () => "admin1" }));
const deleteUser = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, deleteUser };
});
const del = vi.hoisted(() => vi.fn());
const storageFor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage", () => ({ storageFor }));

import { DELETE } from "./route";

const call = () => DELETE(new Request("http://localhost:3000/api/admin/users/u9", { method: "DELETE" }), { params: { userId: "u9" } });

beforeEach(() => {
  deleteUser.mockReset();
  del.mockReset().mockResolvedValue(undefined);
  storageFor.mockReset().mockReturnValue({ delete: del });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("DELETE /api/admin/users/[userId] — dọn tệp ghi âm", () => {
  it("tên tệp bài nộp xoá như cũ (kho private, theo tháng); khoá practice-answers/ xoá thẳng khoá đó ở kho private", async () => {
    deleteUser.mockResolvedValue({ removedFiles: ["u9-1760000000000-abc123.webm", "practice-answers/s1/q1-aaaa1111.webm"] });
    const res = await call();
    expect(res.status).toBe(200);
    const keys = storageFor.mock.calls.map((c) => c[0] as { layer: string; key: string });
    expect(keys).toEqual([
      expect.objectContaining({ layer: "private", key: expect.stringMatching(/^submissions\/\d{4}\/\d{2}\/u9-1760000000000-abc123\.webm$/) }),
      { layer: "private", key: "practice-answers/s1/q1-aaaa1111.webm" },
    ]);
    expect(del).toHaveBeenCalledWith("practice-answers/s1/q1-aaaa1111.webm");
  });

  it("khoá practice-answers/ sai dạng bị bỏ qua (không xoá linh tinh); hỏng một tệp không làm hỏng việc xoá tài khoản", async () => {
    deleteUser.mockResolvedValue({ removedFiles: ["practice-answers/../../x", "practice-answers/s1/q1-aaaa1111.webm"] });
    del.mockRejectedValueOnce(new Error("s3 down"));
    const res = await call();
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});
