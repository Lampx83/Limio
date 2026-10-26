import { describe, expect, it } from "vitest";
import { mapWithLimit, splitIntoChunks } from "../aiTutor/textChunks";

const question = (n: number) =>
  `Câu ${n}. Nội dung câu hỏi số ${n} khá dài để chiếm chỗ trong lô.\nA. Lựa chọn một\nB. Lựa chọn hai\nC. Lựa chọn ba\nD. Lựa chọn bốn\nĐáp án: B`;

describe("splitIntoChunks", () => {
  it("văn bản ngắn hơn ngưỡng: đúng 1 lô, giữ nguyên", () => {
    expect(splitIntoChunks("  Câu 1. abc  ", 1000)).toEqual(["Câu 1. abc"]);
  });

  it("văn bản rỗng: không có lô nào", () => {
    expect(splitIntoChunks("   \n  ", 1000)).toEqual([]);
  });

  it("chia ở đầu câu hỏi, không cắt giữa một câu", () => {
    const text = Array.from({ length: 12 }, (_, i) => question(i + 1)).join("\n\n");
    const chunks = splitIntoChunks(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(500);
      // Mỗi lô bắt đầu bằng "Câu N" và câu nào cũng đủ đáp án ở cuối.
      expect(c).toMatch(/^Câu \d+\./);
      const starts = (c.match(/^Câu \d+\./gm) ?? []).length;
      const answers = (c.match(/^Đáp án:/gm) ?? []).length;
      expect(answers).toBe(starts);
    }
  });

  it("không mất, không trùng nội dung: ghép lại đủ mọi câu theo đúng thứ tự", () => {
    const text = Array.from({ length: 30 }, (_, i) => question(i + 1)).join("\n\n");
    const chunks = splitIntoChunks(text, 700);
    const nums = chunks.join("\n").match(/^Câu (\d+)\./gm)!.map((m) => Number(m.replace(/\D/g, "")));
    expect(nums).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("định dạng mỗi câu một dòng (bảng đáp án) không có 'Câu N': chia theo dòng", () => {
    const lines = Array.from(
      { length: 40 },
      (_, i) => `${i + 1}\tC${String(i).padStart(2, "0")}\tA\tVận dụng\tGiải thích dòng số ${i + 1}`,
    );
    const chunks = splitIntoChunks(lines.join("\n"), 400);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(400);
    // Không dòng nào bị cắt đôi.
    expect(chunks.join("\n").split("\n")).toEqual(lines);
  });

  it("một dòng dài hơn ngưỡng: cắt cứng, vẫn ≤ ngưỡng và không mất chữ", () => {
    const word = "abcdefghi "; // 10 ký tự
    const long = word.repeat(300).trim();
    const chunks = splitIntoChunks(long, 400);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(400);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(long);
  });

  it("20.000 ký tự (trần của Nhập bằng AI) chia thành vài lô, không phải hàng chục", () => {
    const text = Array.from({ length: 150 }, (_, i) => question(i + 1)).join("\n\n").slice(0, 20_000);
    const chunks = splitIntoChunks(text, 3_500);
    expect(chunks.length).toBeGreaterThanOrEqual(6);
    expect(chunks.length).toBeLessThanOrEqual(8);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(3_500);
  });
});

describe("mapWithLimit", () => {
  it("giữ thứ tự kết quả và không vượt giới hạn đồng thời", async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const out = await mapWithLimit(items, 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(out.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual(items.map((n) => n * 2));
  });

  it("một phần tử lỗi không làm mất kết quả của phần tử khác", async () => {
    const out = await mapWithLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(out.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("danh sách rỗng: trả mảng rỗng", async () => {
    expect(await mapWithLimit([], 3, async () => 1)).toEqual([]);
  });
});
