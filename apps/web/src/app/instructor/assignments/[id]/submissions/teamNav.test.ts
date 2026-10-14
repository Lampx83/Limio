import { describe, expect, it } from "vitest";
import { neighborTeams } from "./teamNav";

// AC D4 — "Chấm & bài tiếp" của bài nhóm:
//  Given danh sách nhóm theo thứ tự GV đang thấy
//  When  GV chuyển Trước/Sau
//  Then  đi theo nhóm, bỏ qua nhóm chưa nộp; "chỉ bài chờ chấm" bỏ nhóm đã chấm
//        trừ nhóm đang mở
type Row = { team: { id: string }; latest: { status: "submitted" | "graded" } | null };
const t = (id: string, status: "submitted" | "graded" | null): Row => ({
  team: { id },
  latest: status ? { status } : null,
});

const rows: Row[] = [t("N1", "graded"), t("N2", null), t("N3", "submitted"), t("N4", "submitted")];

describe("neighborTeams", () => {
  it("bỏ qua nhóm chưa nộp", () => {
    expect(neighborTeams(rows, "N1", false)).toEqual({ prevId: null, nextId: "N3", position: 1, total: 3 });
    expect(neighborTeams(rows, "N3", false)).toEqual({ prevId: "N1", nextId: "N4", position: 2, total: 3 });
  });

  it("chỉ bài chờ chấm: bỏ nhóm đã chấm, nhưng giữ nhóm đang mở", () => {
    expect(neighborTeams(rows, "N3", true)).toEqual({ prevId: null, nextId: "N4", position: 1, total: 2 });
    expect(neighborTeams(rows, "N1", true)).toEqual({ prevId: null, nextId: "N3", position: 1, total: 3 });
  });

  it("nhóm không có bài nộp → không có hàng xóm", () => {
    expect(neighborTeams(rows, "N2", false)).toEqual({ prevId: null, nextId: null, position: 0, total: 3 });
  });
});
