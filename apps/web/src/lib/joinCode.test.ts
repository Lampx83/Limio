import { describe, expect, it } from "vitest";
import { decideJoin, findJoinMatches, normalizeJoinCode, resolutionKind, type JoinMatch } from "./joinCode";

const none = async () => null;

/** DB giả: mặc định không bảng nào khớp, từng test ghi đè bảng cần thiết. */
function fakeDb(over: Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>> = {}) {
  const table = (name: string) => ({ findUnique: none, findFirst: none, ...(over[name] ?? {}) });
  return {
    courseSection: table("courseSection"),
    examSession: table("examSession"),
    exam: table("exam"),
    vanDapSession: table("vanDapSession"),
    gameSession: table("gameSession"),
    liveSession: table("liveSession"),
    liveSlideCode: table("liveSlideCode"),
    interactiveBoard: table("interactiveBoard"),
    whiteboard: table("whiteboard"),
  } as unknown as Parameters<typeof findJoinMatches>[1];
}

const game = (status = "lobby") => ({ gameSession: { findUnique: async () => ({ title: "Ôn chương 2", status }) } });

describe("normalizeJoinCode", () => {
  it("chữ in hoa, bỏ dấu cách và gạch", () => {
    expect(normalizeJoinCode(" ab3 k-9x ")).toBe("AB3K9X");
    expect(normalizeJoinCode("abcd-efgh-jkmn")).toBe("ABCDEFGHJKMN");
  });
});

describe("decideJoin", () => {
  const m = (over: Partial<JoinMatch> = {}): JoinMatch => ({
    kind: "gameshow",
    href: "/play/ABC234",
    label: "Trò chơi: X",
    ended: false,
    ...over,
  });

  it("12 ký tự là mã kích hoạt khoá, 8 ký tự là mã thí sinh", () => {
    expect(decideJoin("ABCDEFGHJKMN", [])).toEqual({ result: "access_code" });
    expect(decideJoin("ABCDEFGH", [])).toEqual({ result: "redirect", kind: "exam_assigned", href: "/exam/ABCDEFGH" });
  });

  it("độ dài khác hoặc không khớp gì là không tìm thấy", () => {
    expect(decideJoin("ABC", [])).toEqual({ result: "not_found" });
    expect(decideJoin("ABC234", [])).toEqual({ result: "not_found" });
  });

  it("khớp đúng một loại thì chuyển thẳng, đã kết thúc thì báo kết thúc", () => {
    expect(decideJoin("ABC234", [m()])).toEqual({ result: "redirect", kind: "gameshow", href: "/play/ABC234" });
    expect(decideJoin("ABC234", [m({ ended: true })]).result).toBe("ended");
  });

  it("khớp nhiều loại thì để học viên chọn", () => {
    const r = decideJoin("ABC234", [m(), m({ kind: "section", href: "/enroll/ABC234" })]);
    expect(r.result).toBe("choose");
    expect(resolutionKind(r)).toEqual({ kind: "ambiguous", ended: false });
  });
});

describe("findJoinMatches", () => {
  it("mã trò chơi trùng mã lớp: liệt kê cả hai với tên dễ nhận", async () => {
    const db = fakeDb({
      ...game(),
      courseSection: {
        findUnique: async () => ({ name: "K65-CS1", isDefault: false, course: { title: "Đại số cơ bản", status: "published" } }),
      },
    });
    const out = await findJoinMatches("ABC234", db);
    expect(out.map((x) => x.label)).toEqual(["Lớp K65-CS1 — Đại số cơ bản", "Trò chơi: Ôn chương 2"]);
    expect(out.map((x) => x.href)).toEqual(["/enroll/ABC234", "/play/ABC234"]);
  });

  it("trò chơi đã kết thúc được đánh dấu ended", async () => {
    const out = await findJoinMatches("ABC234", fakeDb(game("ended")));
    expect(out[0]).toMatchObject({ kind: "gameshow", ended: true });
  });

  it("bỏ qua bản nháp, lớp mặc định và bảng đã xoá", async () => {
    const db = fakeDb({
      courseSection: {
        findUnique: async () => ({ name: "Mặc định", isDefault: true, course: { title: "K", status: "published" } }),
      },
      examSession: { findFirst: async () => ({ title: "Ca 1", status: "draft", exam: { title: "Đề" } }), findUnique: none },
      interactiveBoard: { findUnique: async () => ({ title: "Bảng", status: "open", deletedAt: new Date() }) },
    });
    expect(await findJoinMatches("ABC234", db)).toEqual([]);
  });

  it("mã slide của bài giảng trực tiếp dẫn về cùng trang bài giảng", async () => {
    const db = fakeDb({
      liveSlideCode: { findUnique: async () => ({ session: { endedAt: null, deck: { title: "OER" } } }) },
    });
    expect(await findJoinMatches("ABC234", db)).toEqual([
      { kind: "live", href: "/learn/live/ABC234", label: "Bài giảng trực tiếp: OER", ended: false },
    ]);
  });

  it("mã buổi Limio Vấn đáp dẫn vào phòng của bản mới, tách khỏi vấn đáp cũ (AC0.6)", async () => {
    const db = fakeDb({
      vanDapSession: { findUnique: async () => ({ title: null, status: "open", exam: { title: "Vấn đáp chương 3", status: "published" } }) },
    });
    expect(await findJoinMatches("ABC234", db)).toEqual([
      { kind: "van_dap", href: "/van-dap/ABC234", label: "Limio Vấn đáp: Vấn đáp chương 3", ended: false },
    ]);
  });

  it("buổi Limio Vấn đáp đã đóng báo ended; đề chưa xuất bản coi như không tồn tại", async () => {
    const closed = fakeDb({
      vanDapSession: { findUnique: async () => ({ title: "Buổi sáng", status: "closed", exam: { title: "Đề", status: "published" } }) },
    });
    expect((await findJoinMatches("ABC234", closed))[0]).toMatchObject({ kind: "van_dap", ended: true, label: "Limio Vấn đáp: Buổi sáng" });
    const draft = fakeDb({
      vanDapSession: { findUnique: async () => ({ title: null, status: "open", exam: { title: "Đề", status: "draft" } }) },
    });
    expect(await findJoinMatches("ABC234", draft)).toEqual([]);
  });

  it("mã Limio Vấn đáp trùng mã vấn đáp cũ: hiện màn chọn, không đoán hộ", async () => {
    const db = fakeDb({
      examSession: { findFirst: none, findUnique: async () => ({ title: "Buổi cũ", status: "open", exam: { title: "Đề cũ" } }) },
      vanDapSession: { findUnique: async () => ({ title: null, status: "open", exam: { title: "Đề mới", status: "published" } }) },
    });
    const out = await findJoinMatches("ABC234", db);
    expect(out.map((m) => m.kind)).toEqual(["oral", "van_dap"]);
    const r = decideJoin("ABC234", out);
    expect(r.result).toBe("choose");
  });

  it("mã không phải 6 ký tự thì không tra DB", async () => {
    expect(await findJoinMatches("ABCDEFGH", fakeDb(game()))).toEqual([]);
  });
});
