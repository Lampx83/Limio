import { describe, expect, it } from "vitest";
import { PERSON_HEADERS, parsePastedTable } from "./pasteTable";

describe("parsePastedTable", () => {
  it("nhận cột theo tên, bất kể thứ tự, dấu và hoa thường; bỏ cột lạ", () => {
    const raw = "STT\tMã SV\tHọ và tên\tGhi chú\tEmail\n1\t1001\tNguyễn Văn An\tx\tan@e.com\n\n2\t1002\tTrần Bình\t\t";
    const { rows, fields } = parsePastedTable(raw, PERSON_HEADERS);
    expect(fields.sort()).toEqual(["displayName", "email", "mssv"]);
    expect(rows).toEqual([
      { line: 2, mssv: "1001", displayName: "Nguyễn Văn An", email: "an@e.com" },
      { line: 3, mssv: "1002", displayName: "Trần Bình" },
    ]);
  });

  it("đọc được CSV dấu chấm phẩy; không có cột nào khớp thì fields rỗng", () => {
    expect(parsePastedTable("họ tên;mssv\nAn;1", PERSON_HEADERS).rows).toEqual([
      { line: 2, displayName: "An", mssv: "1" },
    ]);
    expect(parsePastedTable("Nguyễn Văn An\t1001", PERSON_HEADERS).fields).toEqual([]);
  });
});
