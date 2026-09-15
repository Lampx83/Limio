import { describe, expect, it } from "vitest";
import { groupNotesByColumn, UNASSIGNED_COLUMN_LABEL } from "./boardNoteStyle";

interface FakeNote {
  id: string;
  column: string | null;
}

const note = (id: string, column: string | null): FakeNote => ({ id, column });

describe("groupNotesByColumn", () => {
  it("board tắt grid (columns=[]) nhưng note cũ vẫn giữ column → vẫn hiện theo nhãn gốc, không mất dữ liệu", () => {
    const result = groupNotesByColumn([note("1", "Nhóm 1")], []);
    expect(result).toEqual([{ label: "Nhóm 1", notes: [note("1", "Nhóm 1")] }]);
  });

  it("giữ đúng thứ tự cột GV đặt, kể cả cột chưa có note nào", () => {
    const notes = [note("1", "Nhóm 2"), note("2", "Nhóm 1")];
    const result = groupNotesByColumn(notes, ["Nhóm 1", "Nhóm 2", "Nhóm 3"]);
    expect(result.map((g) => g.label)).toEqual(["Nhóm 1", "Nhóm 2", "Nhóm 3"]);
    expect(result[0]!.notes).toEqual([note("2", "Nhóm 1")]);
    expect(result[1]!.notes).toEqual([note("1", "Nhóm 2")]);
    expect(result[2]!.notes).toEqual([]);
  });

  it("note cột đã bị xoá khỏi danh sách active vẫn hiển thị, không bị mất", () => {
    const notes = [note("1", "Nhóm cũ (đã xoá)")];
    const result = groupNotesByColumn(notes, ["Nhóm 1"]);
    expect(result).toEqual([
      { label: "Nhóm 1", notes: [] },
      { label: "Nhóm cũ (đã xoá)", notes: [note("1", "Nhóm cũ (đã xoá)")] },
    ]);
  });

  it("note không có column (post trước khi bật grid) → bucket Chưa phân nhóm ở cuối", () => {
    const notes = [note("1", "Nhóm 1"), note("2", null)];
    const result = groupNotesByColumn(notes, ["Nhóm 1"]);
    expect(result).toEqual([
      { label: "Nhóm 1", notes: [note("1", "Nhóm 1")] },
      { label: UNASSIGNED_COLUMN_LABEL, notes: [note("2", null)] },
    ]);
  });
});
