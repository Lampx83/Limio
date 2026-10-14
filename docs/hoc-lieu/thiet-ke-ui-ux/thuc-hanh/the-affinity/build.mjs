#!/usr/bin/env node
/**
 * Dựng bộ thẻ gom cụm (affinity map) cho Whiteboard của Limio, từ cards.json.
 * Không phụ thuộc gói nào ngoài Node 20+.
 *
 *   node build.mjs --out elements.json            ghi mảng phần tử Excalidraw
 *   node build.mjs --clipboard clipboard.json     ghi JSON dán được vào canvas (Ctrl+V)
 *   node build.mjs --key dap-an-giang-vien.md     ghi đáp án + nguồn từng thẻ (chỉ cho giảng viên)
 *   node build.mjs --post http://localhost:3000 CODE   đẩy thẳng vào một bảng đang mở (trang 0)
 *
 * Mã thẻ (B01…) xếp theo thứ tự xáo cố định (hạt giống 23), nên không lộ cụm.
 * Thẻ KHÔNG tô màu theo loại: phân biệt quan sát với đề xuất là việc của học viên.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(readFileSync(join(here, "cards.json"), "utf8"));

// ── xáo ổn định ────────────────────────────────────────────────────────────
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

// ── khoá phân số cho thuộc tính `index` của Excalidraw 0.18 ───────────────────
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const indexOf = (n) => (n < 62 ? "a" + DIGITS[n] : "b" + DIGITS[Math.floor((n - 62) / 62)] + DIGITS[(n - 62) % 62]);

// ── đo & ngắt dòng (ước lượng: Helvetica ≈ 0.55 em / ký tự, an toàn hơn là đẹp) ───
const FONT = 17, LINE = 1.25, CARD_W = 290, PAD = 5;
const INNER_W = CARD_W - 2 * PAD;
const MAX_CHARS = Math.floor((INNER_W - 10) / (FONT * 0.55));
function wrap(text) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= MAX_CHARS) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

let seedCounter = 1000;
const now = Date.now();
let n = 0;
const base = (o) => ({
  angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
  strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null,
  roundness: null, seed: seedCounter++, version: 2, versionNonce: seedCounter * 7919 % 2147483647,
  isDeleted: false, boundElements: null, updated: now, link: null, locked: false,
  index: indexOf(n++), ...o,
});

const els = [];
const COLS = 7, GAP_X = 26, GAP_Y = 28, TOP = 400, LEFT = 40;

// tiêu đề + luật chơi
const head = [
  { t: "BỘ THẺ GOM CỤM · Bài 2.3", size: 30 },
  { t: "1. 10 phút đầu KHÔNG AI NÓI. Chỉ kéo các thẻ có vẻ thuộc về nhau lại gần nhau.", size: 20 },
  { t: "2. Thẻ nào là lời ĐỀ XUẤT (\"nên bỏ…\", \"nên thêm…\") thì kéo sang vùng Bãi ý tưởng bên phải.", size: 20 },
  { t: "3. Rồi mới đặt tên mỗi cụm bằng MỘT CÂU đầy đủ. Mã B01… giúp truy ngược về lời người dùng.", size: 20 },
];
head.forEach((h, i) => {
  const w = Math.ceil(h.t.length * h.size * 0.55), hgt = Math.ceil(h.size * LINE);
  els.push(base({
    id: `hd${i}`, type: "text", x: LEFT, y: 90 + (i === 0 ? 0 : 50 + (i - 1) * 42), width: w, height: hgt,
    text: h.t, originalText: h.t, fontSize: h.size, fontFamily: 2, textAlign: "left", verticalAlign: "top",
    containerId: null, autoResize: true, lineHeight: LINE,
    strokeColor: i === 0 ? "#2f6b1f" : "#1e1e1e",
  }));
});

// vùng Bãi ý tưởng (khung nét đứt + nhãn)
const dumpX = LEFT + COLS * (CARD_W + GAP_X) + 60;
els.push(base({
  id: "dump-frame", type: "rectangle", x: dumpX, y: TOP - 60, width: CARD_W + 80, height: 900,
  strokeStyle: "dashed", strokeColor: "#9a7b00", backgroundColor: "#fffbe6", roundness: { type: 3 }, opacity: 60,
}));
const dl = "Bãi ý tưởng";
els.push(base({
  id: "dump-label", type: "text", x: dumpX + 16, y: TOP - 48, width: Math.ceil(dl.length * 24 * 0.55), height: 30,
  text: dl, originalText: dl, fontSize: 24, fontFamily: 2, textAlign: "left", verticalAlign: "top",
  containerId: null, autoResize: true, lineHeight: LINE, strokeColor: "#9a7b00",
}));

// các thẻ, lưới 7 cột, hàng cao theo thẻ cao nhất trong hàng
const rows = [];
for (let i = 0; i < order.length; i += COLS) rows.push(order.slice(i, i + COLS));
let y = TOP;
for (const row of rows) {
  const prepared = row.map((c) => {
    const lines = wrap(`${c.text}`).concat(["", c.code]);
    const th = Math.ceil(lines.length * FONT * LINE);
    return { c, lines, th, h: Math.max(110, th + 26) };
  });
  const rowH = Math.max(...prepared.map((p) => p.h));
  prepared.forEach((p, col) => {
    const jx = Math.round((rnd() - 0.5) * 10), jy = Math.round((rnd() - 0.5) * 8);
    const x = LEFT + col * (CARD_W + GAP_X) + jx, yy = y + jy;
    const rid = `card-${p.c.code}`, tid = `card-${p.c.code}-t`;
    els.push(base({
      id: rid, type: "rectangle", x, y: yy, width: CARD_W, height: p.h,
      strokeColor: "#c9a227", backgroundColor: "#fff3bf", roundness: { type: 3 },
      boundElements: [{ type: "text", id: tid }], customData: { card: p.c.code },
    }));
    const text = p.lines.join("\n");
    els.push(base({
      id: tid, type: "text", x: x + PAD, y: yy + (p.h - p.th) / 2, width: INNER_W, height: p.th,
      text, originalText: text, fontSize: FONT, fontFamily: 2, textAlign: "center", verticalAlign: "middle",
      containerId: rid, autoResize: true, lineHeight: LINE,
    }));
  });
  y += rowH + GAP_Y;
}

// ── đáp án cho giảng viên ───────────────────────────────────────────────
const CLUSTER = {
  "ban-do": ["Cụm: Người làm bài không biết câu nào đã làm, câu nào còn phân vân, nên phải tự nhớ.", "Có 1 thẻ đề xuất (đánh dấu câu)."],
  "thoat-luu": ["Cụm: Người làm bài không biết thoát ra thì bài có được lưu không, và lo mất bài.", "Thẻ \"bất ngờ khi bài làm đã được nộp\" chỉ một người nói nhưng hậu quả nặng: ví dụ cho quy tắc tần suất × hậu quả."],
  "nop-nham": ["Cụm: Nút Nộp bài dễ bấm nhầm, người làm bài không yên tâm khi nộp.", "Có 1 thẻ đề xuất (đổi màu nút)."],
  "xao-nhang": ["Cụm: Nút Đấu trường và Streak nổi bật hơn cả câu hỏi, kéo sự chú ý đi.", ""],
  "dong-ho": ["Hai thẻ nói NGƯỢC nhau (đồng hồ chưa đủ to / tạo áp lực). Đặt cạnh nhau, chưa kết luận.", "Dạy: mâu thuẫn trong dữ liệu là thông tin, đừng chọn bên có lợi cho ý mình."],
  "ket-qua": ["Cụm: Ở trang kết quả, người học cố xem lại từng câu nhưng gặp trở ngại (lời giải, màu chữ, cuộn dài).", "Có 1 thẻ đề xuất (danh sách ô chọn câu)."],
  "tong-quan": ["Cụm: Ở trang tổng quan, người dùng không đoán được chức năng và bị thu hút nhầm chỗ (thuật ngữ Anh–Việt, biểu tượng không nhãn, banner, thông báo, điều hướng).", "Cụm lớn, nên tách thành 2–3 cụm nhỏ."],
  "khac": ["Thẻ lẻ: \"chọn 1 hơi khó hiểu\" (mơ hồ, phải hỏi lại người thử), 2 thẻ thẩm mỹ chung, 1 thẻ điều hướng Câu trước/Câu sau và 3 thẻ đề xuất.", ""],
};
const TYPE = { "quan-sat": "Quan sát", "de-xuat": "ĐỀ XUẤT", "mo-ho": "Mơ hồ" };
function keyMd() {
  const by = {};
  for (const c of cards) (by[c.cluster] ??= []).push(c);
  let s = "# Đáp án bộ thẻ gom cụm · Bài 2.3 (chỉ cho giảng viên)\n\n";
  s += "Bộ thẻ dùng dữ liệu của Thực hành 1, **không** gồm cụm \"Độ tự tin\" vì cụm đó là ví dụ làm sẵn trong bài.\n";
  s += "Chữ cái trong cột Nguồn là mã báo cáo ẩn danh; không có bảng tra tên.\n\n";
  for (const [k, [title, note]] of Object.entries(CLUSTER)) {
    s += `## ${title}\n`;
    if (note) s += `${note}\n`;
    s += "\n| Mã | Loại | Nguồn | Nguyên văn |\n|---|---|---|---|\n";
    for (const c of (by[k] ?? []).sort((a, b) => a.code.localeCompare(b.code)))
      s += `| ${c.code} | ${TYPE[c.type]} | ${c.src} | ${c.text} |\n`;
    s += "\n";
  }
  s += "## Chuẩn bị trước buổi học (phương án giấy)\n\n";
  s += "1. In `phieu-nhom.pdf` (1 trang A4) cho mỗi nhóm.\n";
  s += "2. Gửi `bo-the-man-hinh.pdf` cho các nhóm (Zalo, email) để đọc trên điện thoại hoặc máy tính.\n";
  s += "3. Dặn các nhóm mang bút chì và ít nhất một thiết bị để đọc thẻ.\n";
  s += "4. Tạo bài tập cá nhân \"Bài tập về nhà Bài 2.3\" ở mục Bài tập của bài học (bài giảng đã nhắc học viên nộp ở đó).\n\n";
  s += "## Nhịp buổi học (khoảng 50 phút)\n\n";
  s += "Gom im lặng 10' (ghi mã thẻ vào cụm bằng bút chì) → Đặt tên cụm 10' → Chọn một cụm và viết một câu vấn đề 10' → Mỗi nhóm cầm phiếu lên trình bày khoảng 3' (2' nói, 1' nhận xét) → Nhóm nộp lại phiếu.\n\n";
  s += "Ba câu hỏi nhận xét sau mỗi nhóm: có cách sửa nào lẫn trong câu vấn đề không; câu vấn đề có kiểm chứng được không; nhóm có chỉ ra được ít nhất ba thẻ làm căn cứ không.\n\n";
  s += "## Điểm cần để ý khi đi các nhóm\n\n";
  s += "- Nhóm nào đặt tên cụm bằng MỘT TỪ (\"Nộp bài\") thì yêu cầu viết lại thành câu.\n";
  s += "- Thẻ đề xuất (6 thẻ) có bị dán lẫn vào cụm quan sát không?\n";
  s += "- Thẻ \"bất ngờ khi bài làm đã được nộp\" có bị bỏ rơi chỉ vì chỉ có một người nói không?\n";
  s += "- Hai thẻ đồng hồ nói ngược nhau: nhóm nào bỏ một thẻ cho gọn là đang chọn dữ liệu theo ý mình.\n";
  return s;
}

// ── dòng lệnh ───────────────────────────────────────────────────────────
const arg = (f) => { const i = process.argv.indexOf(f); return i < 0 ? undefined : process.argv[i + 1]; };
if (arg("--out")) writeFileSync(arg("--out"), JSON.stringify(els, null, 1));
if (arg("--clipboard")) writeFileSync(arg("--clipboard"), JSON.stringify({ type: "excalidraw/clipboard", elements: els, files: {} }));
if (arg("--key")) writeFileSync(arg("--key"), keyMd());
const pi = process.argv.indexOf("--post");
if (pi >= 0) {
  const baseUrl = process.argv[pi + 1].replace(/\/$/, ""), code = (process.argv[pi + 2] ?? "").toUpperCase();
  if (!baseUrl || !code) { console.error("Cách dùng: --post <baseUrl> <CODE>"); process.exit(1); }
  for (let i = 0; i < els.length; i += 200) {
    const res = await fetch(`${baseUrl}/api/public/whiteboards/${code}/elements`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ elements: els.slice(i, i + 200), page: 0 }),
    });
    console.log(`batch ${i / 200 + 1}: ${res.status}`);
    if (!res.ok) { console.error(await res.text()); process.exit(1); }
  }
}
console.log(`${cards.length} thẻ, ${els.length} phần tử`);
