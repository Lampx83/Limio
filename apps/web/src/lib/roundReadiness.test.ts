import { describe, expect, it } from "vitest";
import { computeRoundReadiness, type ReadinessSession } from "./roundReadiness";

const ok = (over: Partial<ReadinessSession> = {}): ReadinessSession => ({
  id: "s1",
  label: "Ca 1",
  examTitle: "Đề A",
  examStatus: "published",
  accessMode: "open_code",
  roomCount: 1,
  ...over,
});

const byKey = (items: ReturnType<typeof computeRoundReadiness>, key: string) =>
  items.find((i) => i.key === key)!;

describe("computeRoundReadiness", () => {
  it("chưa có ca nào: chỉ bước đầu là việc cần làm, các bước sau không đánh giá", () => {
    const items = computeRoundReadiness([]);
    expect(byKey(items, "sessions").status).toBe("todo");
    expect(items.every((i) => i.key === "sessions" || i.status === "skipped")).toBe(true);
    expect(byKey(items, "sessions").tab).toBe("sessions");
  });

  it("mọi thứ đã sẵn sàng: tất cả ok", () => {
    const items = computeRoundReadiness([ok(), ok({ id: "s2", label: "Ca 2" })]);
    expect(items.map((i) => i.status)).toEqual(items.map(() => "ok"));
  });

  it("ca dùng đề chưa publish: nêu đích danh ca và đề", () => {
    const items = computeRoundReadiness([ok(), ok({ id: "s2", label: "Ca 2", examTitle: "Đề B", examStatus: "draft" })]);
    const it_ = byKey(items, "exams-published");
    expect(it_.status).toBe("todo");
    expect(it_.problems).toEqual(["Ca 2 — đề \"Đề B\" chưa publish"]);
  });

  it("ca phát mã theo phòng mà chưa có phòng: cần làm; ca mã tự do không cần phòng", () => {
    const items = computeRoundReadiness([
      ok({ id: "s1", label: "Ca 1", accessMode: "assigned_code", roomCount: 0 }),
      ok({ id: "s2", label: "Ca 2", accessMode: "open_code", roomCount: 0 }),
    ]);
    const rooms = byKey(items, "rooms");
    expect(rooms.status).toBe("todo");
    expect(rooms.problems).toEqual(["Ca 1 chưa có phòng nào"]);
  });

  it("ca còn ở 'Chưa chọn' cách vào thi: chỉ là lưu ý, không chặn", () => {
    const items = computeRoundReadiness([ok({ accessMode: "authenticated" })]);
    const access = byKey(items, "access-mode");
    expect(access.status).toBe("info");
    expect(access.problems![0]).toContain("Ca 1");
  });

  it("phần phòng được bỏ qua khi không ca nào phát mã theo phòng", () => {
    const items = computeRoundReadiness([ok({ accessMode: "open_code", roomCount: 0 })]);
    expect(byKey(items, "rooms").status).toBe("ok");
  });
});
