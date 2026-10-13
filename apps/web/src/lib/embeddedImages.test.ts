import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { countDocxImages, countPdfImages } from "./embeddedImages";

/** PDF tối giản chỉ đủ phần từ điển các đối tượng — đúng thứ countPdfImages đọc. */
function pdf(...objects: string[]): Buffer {
  return Buffer.from(
    ["%PDF-1.7", ...objects.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj`), "%%EOF"].join("\n"),
    "latin1",
  );
}
const img = (w: number, h: number, extra = "") =>
  `<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8${extra}/Length 3>>\nstream\nabc\nendstream`;

describe("countPdfImages", () => {
  it("PDF chỉ có chữ → 0", () => {
    expect(countPdfImages(pdf("<</Type/Page/Contents 2 0 R>>", "<</Length 5>>\nstream\nBT ET\nendstream"))).toBe(0);
  });

  it("đếm hình chèn (Word/Google Docs): mỗi đối tượng ảnh một hình", () => {
    expect(countPdfImages(pdf("<</Type/Page/Resources<</XObject<</Im1 2 0 R/Im2 3 0 R>>>>>>", img(800, 600), img(1200, 900)))).toBe(2);
  });

  it("ảnh trong suốt (ảnh + /SMask) chỉ tính một hình", () => {
    expect(countPdfImages(pdf(img(800, 600, "/SMask 2 0 R"), img(800, 600).replace("DeviceRGB", "DeviceGray")))).toBe(1);
  });

  it("bỏ ảnh chỉ dùng cho tô mẫu — bóng đổ/nền CSS khi in trang web ra PDF (Chrome/Skia)", () => {
    const pattern = "<</Type/Pattern/PatternType 1/PaintType 1/Resources<</XObject<</X2 2 0 R>>>>/Length 3>>\nstream\nabc\nendstream";
    expect(countPdfImages(pdf(pattern, img(533, 496)))).toBe(0);
  });

  it("bỏ hình quá nhỏ (biểu tượng, gạch đầu dòng)", () => {
    expect(countPdfImages(pdf(img(16, 16), img(533, 1), img(300, 200)))).toBe(1);
  });

  it("tệp không phải PDF → 0, không ném lỗi", () => {
    expect(countPdfImages(Buffer.from("không phải pdf"))).toBe(0);
  });
});

describe("countDocxImages", () => {
  async function docx(files: Record<string, string>): Promise<Buffer> {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document/>");
    for (const [p, c] of Object.entries(files)) zip.file(p, c);
    return zip.generateAsync({ type: "nodebuffer" });
  }

  it("đếm hình trong word/media/, kể cả hình vẽ EMF/WMF; bỏ tệp khác", async () => {
    const buf = await docx({
      "word/media/image1.png": "x",
      "word/media/image2.jpeg": "x",
      "word/media/image3.emf": "x",
      "word/embeddings/oleObject1.bin": "x",
      "word/theme/theme1.xml": "x",
    });
    expect(await countDocxImages(buf)).toBe(3);
  });

  it("Word chỉ có chữ → 0; tệp hỏng → 0", async () => {
    expect(await countDocxImages(await docx({}))).toBe(0);
    expect(await countDocxImages(Buffer.from("hỏng"))).toBe(0);
  });
});
