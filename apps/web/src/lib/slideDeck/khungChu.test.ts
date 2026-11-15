import { describe, expect, it } from "vitest";
import { chayToan } from "./khungToan.js";

const L = chayToan({ chiLoi: true }) as unknown as {
  chamDapAn: (loai: string, nhap: string, dapAn: string, saiSo?: number) => { hopLe: boolean; dung: boolean };
};
const cham = (nhap: string, dapAn: string) => L.chamDapAn("chu", nhap, dapAn);

// Kiểu data-loai="chu" của .nhap-dap-an cho bài ngoại ngữ (docs/tieu-chi/slide-giang-song-ngu.md, B3).
describe('nhap-dap-an kiểu "chu"', () => {
  it("không phân biệt hoa thường, thừa khoảng trắng, dấu câu cuối", () => {
    expect(cham("  Was   built. ", "was built").dung).toBe(true);
    expect(cham("HAD HER HAIR DONE!", "had her hair done").dung).toBe(true);
  });
  it("nhiều đáp án chấp nhận ngăn bằng |", () => {
    expect(cham("isn't", "is not|isn't").dung).toBe(true);
    expect(cham("is not", "is not|isn't").dung).toBe(true);
    expect(cham("not is", "is not|isn't").dung).toBe(false);
  });
  it("nháy cong và nháy thẳng coi như nhau, nhưng nháy và gạch nối không bị bỏ", () => {
    expect(cham("isn’t", "isn't").dung).toBe(true);
    expect(cham("isnt", "isn't").dung).toBe(false);
    expect(cham("well known", "well-known").dung).toBe(false);
  });
  it("chữ sai thì sai (không bị coi là không đọc được), kể cả có số hay chữ giống số", () => {
    expect(cham("was build", "was built")).toEqual({ hopLe: true, dung: false });
    expect(cham("1/2", "one half").dung).toBe(false);
  });
  it("các kiểu cũ không đổi: số vẫn chấm theo sai số", () => {
    expect(L.chamDapAn("so", "0,5", "1/2", 0.001).dung).toBe(true);
    expect(L.chamDapAn("so", "0.6", "1/2", 0.001).dung).toBe(false);
  });
});
