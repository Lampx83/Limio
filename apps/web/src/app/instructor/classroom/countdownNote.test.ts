import { describe, it, expect } from "vitest";
import { noteToPlainText, NOTE_SIZES, normalizeNoteSize, DEFAULT_NOTE_SIZE } from "./countdownNote";

describe("noteToPlainText", () => {
  it("giữ nguyên chữ thường", () => {
    expect(noteToPlainText("Thảo luận 4 người\n1. Đọc đề")).toBe("Thảo luận 4 người\n1. Đọc đề");
  });

  it("chữ thường có dấu < không bị coi là HTML", () => {
    expect(noteToPlainText("Nhập a < b rồi so sánh")).toBe("Nhập a < b rồi so sánh");
  });

  it("chuyển đoạn, heading, br thành xuống dòng", () => {
    expect(noteToPlainText("<h2>Nhiệm vụ</h2><p>Đọc đề</p><p>Ghi ý chính<br>Nộp bài</p>")).toBe(
      "Nhiệm vụ\nĐọc đề\nGhi ý chính\nNộp bài",
    );
  });

  it("chuyển li thành gạch đầu dòng", () => {
    expect(noteToPlainText("<ul><li>Một</li><li>Hai</li></ul>")).toBe("- Một\n- Hai");
  });

  it("bỏ thẻ định dạng và màu, giải mã ký tự đặc biệt", () => {
    expect(noteToPlainText('<span style="background:#fef08a">A&nbsp;&amp;&nbsp;B</span> &lt;ok&gt;')).toBe(
      "A & B <ok>",
    );
  });

  it("gộp dòng trống thừa và cắt đầu cuối", () => {
    expect(noteToPlainText("<div>A</div><div><br></div><div><br></div><div>B</div>")).toBe("A\n\nB");
  });

  it("rỗng hoặc null", () => {
    expect(noteToPlainText("")).toBe("");
    expect(noteToPlainText(null)).toBe("");
    expect(noteToPlainText(undefined)).toBe("");
  });
});

describe("cỡ chữ ghi chú", () => {
  it("có đúng 4 mức, mặc định Vừa", () => {
    expect(NOTE_SIZES.map((s) => s.id)).toEqual(["sm", "md", "lg", "xl"]);
    expect(DEFAULT_NOTE_SIZE).toBe("md");
  });

  it("giá trị lạ hoặc thiếu rơi về mặc định", () => {
    expect(normalizeNoteSize("xl")).toBe("xl");
    expect(normalizeNoteSize("huge")).toBe("md");
    expect(normalizeNoteSize(null)).toBe("md");
    expect(normalizeNoteSize(undefined)).toBe("md");
  });
});
