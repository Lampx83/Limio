import { describe, expect, it } from "vitest";
import { rankChunksByKeyword } from "../oralExam/keywordSearch";

const chunk = (chunkText: string) => ({ chunkText });

describe("rankChunksByKeyword (vấn đáp không cần embeddings)", () => {
  const chunks = [
    chunk("Vòng lặp for duyệt qua từng phần tử của mảng, còn while lặp cho tới khi điều kiện sai."),
    chunk("Đệ quy là kỹ thuật hàm tự gọi lại chính nó, cần có điều kiện dừng để tránh tràn ngăn xếp."),
    chunk("Con trỏ lưu địa chỉ của một biến trong bộ nhớ và có thể được cấp phát động."),
  ];

  it("đưa đoạn khớp câu trả lời lên đầu", () => {
    const r = rankChunksByKeyword("Em nghĩ đệ quy là hàm gọi lại chính nó", chunks, 3);
    expect(r[0]!.chunkText).toContain("Đệ quy");
  });

  it("không trả đoạn nào khi không có từ nào trùng — để caller tự lùi về phương án khác", () => {
    expect(rankChunksByKeyword("blockchain tiền mã hoá", chunks, 3)).toEqual([]);
  });

  it("chỉ trả tối đa k đoạn, điểm giảm dần", () => {
    const r = rankChunksByKeyword("bộ nhớ địa chỉ biến mảng phần tử", chunks, 1);
    expect(r).toHaveLength(1);
    const all = rankChunksByKeyword("bộ nhớ địa chỉ biến mảng phần tử", chunks, 3);
    for (let i = 1; i < all.length; i++) expect(all[i - 1]!.score).toBeGreaterThanOrEqual(all[i]!.score);
  });

  it("không phân biệt hoa thường", () => {
    const r = rankChunksByKeyword("VÒNG LẶP FOR", chunks, 1);
    expect(r[0]!.chunkText).toContain("Vòng lặp for");
  });

  it("từ hiếm nặng hơn từ phổ biến", () => {
    const docs = [
      chunk("hàm hàm hàm là khái niệm cơ bản trong lập trình"),
      chunk("hàm băm biến dữ liệu thành giá trị cố định"),
      chunk("hàm số học và các phép tính"),
    ];
    // "băm" chỉ có ở đoạn 2, "hàm" có ở cả ba.
    const r = rankChunksByKeyword("hàm băm", docs, 3);
    expect(r[0]!.chunkText).toContain("hàm băm");
  });

  it("bỏ đoạn chỉ khớp lẻ một từ chung khi đã có đoạn khớp thật", () => {
    const docs = [
      chunk("Đệ quy là kỹ thuật hàm tự gọi lại chính nó, cần có điều kiện dừng."),
      chunk("Sắp xếp so sánh từng cặp phần tử rồi đổi chỗ nếu sai thứ tự."),
    ];
    const r = rankChunksByKeyword("đệ quy là hàm tự gọi lại chính nó", docs, 3);
    expect(r).toHaveLength(1);
    expect(r[0]!.chunkText).toContain("Đệ quy");
  });

  it("bỏ qua từ đệm nên câu trả lời toàn từ đệm không kéo đoạn bừa", () => {
    expect(rankChunksByKeyword("là và của những", chunks, 3)).toEqual([]);
  });

  it("tiếng Trung không có dấu cách: so khớp theo cặp chữ liền kề", () => {
    const zh = [chunk("我喜欢吃苹果和香蕉。"), chunk("今天天气很好，适合出去散步。")];
    const r = rankChunksByKeyword("苹果好吃吗", zh, 2);
    expect(r).toHaveLength(1);
    expect(r[0]!.chunkText).toContain("苹果");
  });

  it("đầu vào rỗng không ném lỗi", () => {
    expect(rankChunksByKeyword("", chunks, 3)).toEqual([]);
    expect(rankChunksByKeyword("đệ quy", [], 3)).toEqual([]);
    expect(rankChunksByKeyword("đệ quy", chunks, 0)).toEqual([]);
  });

  it("giữ nguyên các trường khác của đoạn (id, chunkIndex…)", () => {
    const r = rankChunksByKeyword("đệ quy", [{ id: "a", chunkIndex: 7, chunkText: "đệ quy" }], 1);
    expect(r[0]).toMatchObject({ id: "a", chunkIndex: 7 });
  });
});
