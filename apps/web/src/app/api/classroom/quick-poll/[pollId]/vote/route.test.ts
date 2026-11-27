import { beforeEach, describe, expect, it, vi } from "vitest";

// Mỗi thiết bị / tài khoản một phiếu mỗi poll; bỏ lại thì đổi lựa chọn (không cộng phiếu).
const db = {
  classroomPoll: { findUnique: vi.fn() },
  liveSession: { findFirst: vi.fn() },
  classroomPollVote: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@feedbackme/db", () => ({ prisma: db }));
const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
const publish = vi.fn();
vi.mock("@/lib/realtime/publisher", () => ({ publish }));
vi.mock("@/lib/realtime/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, resetMs: 0 }),
}));

const CLIENT = "client-device-0001";
const post = (choice: string, clientId: string | undefined = CLIENT) =>
  new Request("http://limio.test/api/classroom/quick-poll/p1/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ choice, ...(clientId ? { clientId } : {}) }),
  });
const ctx = { params: { pollId: "p1" } };

describe("POST /api/classroom/quick-poll/[pollId]/vote", () => {
  beforeEach(() => {
    for (const m of [db.classroomPoll.findUnique, db.liveSession.findFirst, publish, auth]) m.mockReset();
    for (const m of Object.values(db.classroomPollVote)) m.mockReset();
    auth.mockResolvedValue(null);
    publish.mockResolvedValue(undefined);
    db.classroomPoll.findUnique.mockResolvedValue({ id: "p1", options: ["A", "B", "C"], sessionId: "s1" });
    db.liveSession.findFirst.mockResolvedValue(null);
    db.classroomPollVote.count.mockResolvedValue(0);
    db.classroomPollVote.findUnique.mockResolvedValue(null);
    db.classroomPollVote.findFirst.mockResolvedValue(null);
    db.classroomPollVote.create.mockImplementation(async ({ data }) => ({ ...data, createdAt: new Date() }));
    db.classroomPollVote.update.mockImplementation(async ({ data }) => ({
      pollId: "p1",
      createdAt: new Date(),
      ...data,
    }));
  });

  it("thiết bị chưa bỏ phiếu: tạo phiếu kèm clientId và phát sự kiện không có prev", async () => {
    const { POST } = await import("./route");
    const res = await POST(post("1"), ctx);
    expect(res.status).toBe(200);
    expect(db.classroomPollVote.create).toHaveBeenCalledWith({
      data: { pollId: "p1", userId: null, clientId: CLIENT, choice: "1" },
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[1]).not.toHaveProperty("prev");
  });

  it("thiết bị đã bỏ phiếu rồi bỏ lại: KHÔNG tạo phiếu mới, đổi lựa chọn và báo prev", async () => {
    db.classroomPollVote.findUnique.mockResolvedValue({ id: "v1", choice: "0" });
    const { POST } = await import("./route");
    const res = await POST(post("2"), ctx);
    expect(res.status).toBe(200);
    expect(db.classroomPollVote.create).not.toHaveBeenCalled();
    expect(db.classroomPollVote.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { choice: "2" } });
    expect(publish.mock.calls[0]?.[1]).toMatchObject({ choice: "2", prev: "0" });
  });

  it("bấm lại đúng lựa chọn cũ: không ghi, không phát sự kiện", async () => {
    db.classroomPollVote.findUnique.mockResolvedValue({ id: "v1", choice: "1" });
    const { POST } = await import("./route");
    const res = await POST(post("1"), ctx);
    expect(res.status).toBe(200);
    expect(db.classroomPollVote.create).not.toHaveBeenCalled();
    expect(db.classroomPollVote.update).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("đã đăng nhập: dedupe theo tài khoản dù đổi thiết bị", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    db.classroomPollVote.findFirst.mockResolvedValue({ id: "v9", choice: "0" });
    const { POST } = await import("./route");
    await POST(post("1", "another-device-0002"), ctx);
    expect(db.classroomPollVote.create).not.toHaveBeenCalled();
    expect(db.classroomPollVote.update).toHaveBeenCalledWith({ where: { id: "v9" }, data: { choice: "1" } });
  });

  it("hai yêu cầu cùng thiết bị chạm nhau (P2002): rơi về cập nhật, không trả lỗi", async () => {
    db.classroomPollVote.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const { POST } = await import("./route");
    const res = await POST(post("1"), ctx);
    expect(res.status).toBe(200);
    expect(db.classroomPollVote.update).toHaveBeenCalledWith({
      where: { pollId_clientId: { pollId: "p1", clientId: CLIENT } },
      data: { choice: "1" },
    });
  });

  it("đủ 500 phiếu thì thiết bị mới bị từ chối, nhưng thiết bị đã có phiếu vẫn đổi được", async () => {
    db.classroomPollVote.count.mockResolvedValue(500);
    const { POST } = await import("./route");
    expect((await POST(post("1"), ctx)).status).toBe(400);
    db.classroomPollVote.findUnique.mockResolvedValue({ id: "v1", choice: "0" });
    expect((await POST(post("1"), ctx)).status).toBe(200);
  });
});
