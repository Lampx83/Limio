#!/usr/bin/env node
/**
 * Dựng bản IN GIẤY của bộ thẻ gom cụm (cho buổi học không dùng Whiteboard).
 *   node in-the-giay.mjs            → ghi bo-the-in.html
 * Rồi in ra PDF bằng Chrome:
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
 *     --no-pdf-header-footer --print-to-pdf=bo-the-in.pdf "file://$PWD/bo-the-in.html"
 *
 * Mã thẻ (B01…) lấy cùng cách xáo với build.mjs (hạt giống 23) nên khớp dap-an-giang-vien.md.
 * Một bộ = 3 trang A4: 2 trang thẻ (cắt theo nét đứt) + 1 phiếu nhóm. In mỗi nhóm một bộ.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(readFileSync(join(here, "cards.json"), "utf8"));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(23);
const order = [...cards];
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}
order.forEach((c, i) => (c.code = "B" + String(i + 1).padStart(2, "0")));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PER_PAGE = 21;
const pages = [];
for (let i = 0; i < order.length; i += PER_PAGE) pages.push(order.slice(i, i + PER_PAGE));

const cardPage = (list, n) => `
<section class="page cards">
  <div class="hint">Thẻ ${n}/2 · Cắt theo nét đứt · Mỗi nhóm một bộ · Bài 2.3</div>
  <div class="grid">${list
    .map((c) => `<div class="card"><p>${esc(c.text)}</p><span class="code">${c.code}</span></div>`)
    .join("")}</div>
</section>`;

const lines = (n) => Array.from({ length: n }, () => '<div class="line"></div>').join("");
const sheet = `
<section class="page sheet">
  <h1>PHIẾU NHÓM · Bài 2.3</h1>
  <div class="meta"><span>Lớp: ____________</span><span>Nhóm số: ______</span><span>Thành viên: ______________________________________</span></div>
  <p class="tip">Cả nhóm đọc bộ thẻ trên điện thoại hoặc máy tính. Dùng <b>bút chì</b> ghi MÃ THẺ (ví dụ B05) vào cụm, để dễ sửa khi xếp lại.</p>

  <h2>1. Các cụm của nhóm <small>(mỗi cụm một tên là MỘT CÂU đầy đủ; bên dưới ghi mã các thẻ thuộc cụm)</small></h2>
  ${[1, 2, 3, 4, 5, 6].map((i) => `<div class="cum"><b>Cụm ${i}:</b><div class="line"></div></div><div class="ma"><span>Mã thẻ:</span><div class="line"></div></div>`).join("")}

  <h2>2. Bãi ý tưởng <small>(mã các thẻ là ĐỀ XUẤT, tức cách sửa người thử nghĩ ra)</small></h2>
  <div class="ma"><span>Mã thẻ:</span><div class="line"></div></div>
  <h2>3. Thẻ chưa xếp được <small>(chưa biết xếp vào đâu; đừng bỏ đi)</small></h2>
  <div class="ma"><span>Mã thẻ:</span><div class="line"></div></div>

  <h2>4. Cụm quan trọng nhất và vì sao <small>(nhiều người gặp? hậu quả nặng?)</small></h2>
  <div class="box">${lines(2)}</div>

  <h2>5. Câu vấn đề của nhóm</h2>
  <table>
    <tr><th>Ai gặp vấn đề?</th><td></td></tr>
    <tr><th>Họ đang cố làm gì?</th><td></td></tr>
    <tr><th>Họ kẹt ở đâu?</th><td></td></tr>
    <tr><th>Hậu quả là gì?</th><td></td></tr>
  </table>
  <p class="join"><b>Ghép thành một câu:</b></p>
  ${lines(2)}
  <p class="mini">Ba điều cần kiểm tra: Có cách sửa nào lẫn trong câu không? · Câu có kiểm chứng được không? · Ghi được ít nhất 3 mã thẻ làm căn cứ chưa?</p>
</section>`;

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bộ thẻ gom cụm · Bài 2.3</title>
<style>
  @page { size: A4; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: Arial, "Helvetica Neue", sans-serif; color: #111 }
  .page { width: 210mm; height: 297mm; padding: 9mm 8mm; page-break-after: always; position: relative; overflow: hidden }
  .hint { font-size: 8pt; color: #666; height: 6mm }
  .grid { display: grid; grid-template-columns: repeat(3, 64.6mm); grid-auto-rows: 39.6mm }
  .card { border: 0.4mm dashed #888; padding: 3.2mm 3.4mm; position: relative; display: flex; align-items: center; justify-content: center }
  .card p { margin: 0; font-size: 10pt; line-height: 1.3; text-align: center }
  .code { position: absolute; right: 2mm; bottom: 1.2mm; font-size: 7.5pt; color: #777 }
  .sheet h1 { font-size: 18pt; margin: 0 0 4mm }
  .meta { display: flex; gap: 8mm; font-size: 10pt; margin-bottom: 4mm; flex-wrap: wrap }
  h2 { font-size: 10.5pt; margin: 3mm 0 1mm } h2 small { font-weight: 400; color: #555; font-size: 8.5pt }
  .cum { display: flex; align-items: flex-end; gap: 2mm; font-size: 10pt; margin-bottom: 1mm }
  .cum .line { flex: 1 }
  .ma { display: flex; align-items: flex-end; gap: 2mm; font-size: 9pt; color: #444; margin-bottom: 1.5mm } .ma .line { flex: 1; height: 6.5mm }
  .tip { font-size: 9pt; margin: 0 0 1mm; color: #333 }
  .line { border-bottom: 0.3mm solid #999; height: 7mm }
  .box { border: 0.4mm solid #999; padding: 1mm 3mm; min-height: 18mm }
  .box.short { min-height: 11mm }
  table { width: 100%; border-collapse: collapse; font-size: 10pt }
  th { text-align: left; width: 38mm; border: 0.4mm solid #999; padding: 2mm; background: #f2f2f2; vertical-align: top }
  td { border: 0.4mm solid #999; height: 9mm }
  .join { margin: 3mm 0 0; font-size: 10pt }
  .mini { font-size: 8.5pt; color: #444; margin-top: 3mm }
</style></head><body>
${pages.map((p, i) => cardPage(p, i + 1)).join("")}
${sheet}
</body></html>`;
writeFileSync(join(here, "bo-the-in.html"), html);

const head = html.slice(0, html.indexOf("<body>") + 6);
writeFileSync(join(here, "phieu-nhom.html"), head + sheet + "</body></html>");

const phoneCss = `<style>
  @page { size: 90mm 160mm; margin: 0 }
  .ph { width: 90mm; padding: 6mm 5mm 4mm; font-family: Arial, sans-serif }
  .ph h1 { font-size: 14pt; margin: 0 0 1.5mm } .ph .sub { font-size: 9.5pt; color: #444; margin: 0 0 3mm; line-height: 1.35 }
  .pc { border: 0.3mm solid #999; border-radius: 2.5mm; padding: 2.6mm 3mm; margin-bottom: 2.6mm; break-inside: avoid; display: flex; gap: 3mm; align-items: flex-start }
  .pc b { font-size: 12pt; color: #1f5f9c; min-width: 9mm } .pc span { font-size: 12pt; line-height: 1.35 }
</style>`;
const phone = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bộ thẻ Bài 2.3 (xem trên điện thoại)</title>${phoneCss}</head><body style="margin:0"><div class="ph">
<h1>Bộ thẻ · Bài 2.3</h1>
<p class="sub">${order.length} thẻ lấy từ phản hồi Thực hành 1. Đọc từng thẻ, rồi ghi MÃ THẺ (B01…) vào phiếu nhóm theo cụm. Thẻ nào là cách sửa người thử đề nghị thì ghi vào "Bãi ý tưởng".</p>
${order.map((c) => `<div class="pc"><b>${c.code}</b><span>${esc(c.text)}</span></div>`).join("")}
</div></body></html>`;
writeFileSync(join(here, "bo-the-man-hinh.html"), phone);
console.log(`${order.length} thẻ trên ${pages.length} trang + 1 phiếu nhóm`);
