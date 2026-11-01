/**
 * Chuyển các bài demo Toán 10 của SmartDoc sang file nhập khoá của Limio.
 *
 *   tsx scripts/convert-smartdoc-lesson.ts <thư-mục-demo-toan10> <manifest.json>
 *   pnpm import:course -- --file manifest.json --owner gv@example.com --dry-run
 *
 * Thư mục nguồn là `Smartdoc/frontend/public/demo-toan10` (bai.json, bai-conic.json, …). Mỗi slide thành một mục `##`
 * của bài, lời giảng thành đoạn Nghe giảng bám theo mục đó (xem `src/lib/smartdocConvert.ts`). Khoá tạo ra ở trạng thái
 * nháp; giọng tạo sau ở trang quản trị «Giọng đọc». In báo cáo những gì bị bỏ khi chuyển.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { convertSlide, type ConvertedSlide, type SmartdocSlide } from "../src/lib/smartdocConvert";

const LESSONS = [
  { tep: "bai.json", tieuDe: "Hàm số bậc hai và đồ thị", moTa: "Parabol quanh ta, đỉnh, trục đối xứng, bảng biến thiên và bài toán thực tế.", phut: 85 },
  { tep: "bai-conic.json", tieuDe: "Ba đường conic", moTa: "Elip, hypebol, parabol: phương trình chính tắc và hình dạng.", phut: 25 },
  { tep: "bai-tam-giac.json", tieuDe: "Hệ thức lượng trong tam giác", moTa: "Định lí côsin, định lí sin và giải tam giác trong thực tế.", phut: 25 },
  { tep: "bai-toi-uu.json", tieuDe: "Hệ bất phương trình bậc nhất hai ẩn và tối ưu", moTa: "Miền nghiệm trên mặt phẳng toạ độ và bài toán tìm giá trị tốt nhất.", phut: 25 },
  { tep: "bai-xac-suat.json", tieuDe: "Xác suất cổ điển", moTa: "Không gian mẫu, biến cố và cách tính xác suất bằng định nghĩa cổ điển.", phut: 25 },
];

// Bộ chuyển cần DOMParser — dựng bằng jsdom (cùng cách với convert-legacy-ai-lessons.ts).
(globalThis as unknown as Record<string, unknown>).DOMParser = new JSDOM("").window.DOMParser;

// Giảng viên mặc định của demo: Tiến Đạt (giọng `tiendat`), xưng «thầy».
const PERSONA = { xung: "thầy", ten: "Tiến Đạt" };

function main() {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) {
    console.error("usage: convert-smartdoc-lesson.ts <thư-mục-demo-toan10> <manifest.json>");
    process.exit(1);
  }
  const report: string[] = [];
  const lessons = LESSONS.map((meta) => {
    const raw = JSON.parse(readFileSync(join(dir, meta.tep), "utf8")) as { slides: SmartdocSlide[] };
    const converted: ConvertedSlide[] = raw.slides.map((s, i) => convertSlide(s, PERSONA, `Phần ${i + 1}`));

    // Tiêu đề mục phải khác nhau: `anchor` của lời giảng trỏ vào chúng.
    const seen = new Map<string, number>();
    for (const c of converted) {
      const n = (seen.get(c.title) ?? 0) + 1;
      seen.set(c.title, n);
      if (n > 1) c.title = `${c.title} (${n})`;
    }

    const cover = converted.find((c) => c.isCover);
    const objectives = (cover?.markdown.match(/^- (.+)$/gm) ?? []).map((l) => l.slice(2)).slice(0, 10);
    const body = converted
      .filter((c) => !c.isCover)
      .map((c) => `## ${c.title}\n\n${c.markdown}`.trimEnd())
      .join("\n\n");
    const lecture = converted
      .filter((c) => c.narration)
      .map((c) => ({ anchor: c.isCover ? "mo-dau" : c.title, text: c.narration }));

    const figures = converted.reduce((n, c) => n + c.figures, 0);
    const silent = converted.filter((c) => !c.narration).length;
    report.push(`${meta.tieuDe}: ${converted.length} slide, ${lecture.length} đoạn lời giảng, ${figures} hình SVG bỏ, ${silent} slide không có lời`);

    return {
      title: meta.tieuDe,
      description: meta.moTa,
      ...(objectives.length ? { objectives } : {}),
      body,
      splitSections: true,
      toc: false,
      durationMin: meta.phut,
      lecture,
    };
  });

  const manifest = {
    course: {
      title: "Toán 10 — học cùng giảng viên ảo (demo)",
      slug: "toan-10-giang-vien-ao-demo",
      description:
        "Bản demo năm bài Toán 10 (Chương trình GDPT 2018) chuyển từ SmartDoc: mỗi bài là các mục có lời giảng của giảng viên ảo. " +
        "Bản demo chưa có hình vẽ và tương tác trên slide.",
      language: "vi",
      level: "beginner" as const,
    },
    modules: [{ title: "Toán 10", lessons }],
  };
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(report.join("\n"));
  console.log(`Đã ghi ${out}. Mất khi chuyển: tương tác trên slide, hình SVG, gia sư 1-1.`);
}

main();
