/**
 * Khung dựng slide HTML cho Học liệu số.
 *
 * Mô hình AI (hoặc giảng viên) chỉ viết các thẻ <section> với một bộ thành phần đặt tên sẵn
 * (xem THU_VIEN_THANH_PHAN bên dưới — cũng là bảng hướng dẫn nhét vào lời nhắc của AI). Khung này
 * thêm toàn bộ giao diện và tương tác: sân khấu 16:9 tự co giãn, hiện dần từng ý, lật thẻ, trắc
 * nghiệm chấm ngay, ghép đôi, tab, biểu đồ, số đếm, khối mã tô màu, tổng quan, ghi chú người
 * trình bày, bút vẽ và con trỏ laser. Nhờ vậy slide luôn đồng đều và đẹp dù AI viết gọn; sửa
 * khung ở đây là mọi bộ slide đã lưu đẹp theo, không phải soạn lại.
 *
 * Kết quả là MỘT tài liệu HTML đầy đủ (dùng làm srcdoc của iframe sandbox, hoặc tải về mở offline).
 * Mã chạy trong iframe không có allow-same-origin và bị CSP chặn kết nối ra ngoài, nên HTML do AI
 * sinh ra không đụng được vào phiên đăng nhập hay dữ liệu của trang chủ.
 *
 * Module thuần JS, không phụ thuộc React: kiểm thử được bằng Node + trình duyệt không giao diện.
 */

import { CSS_TOAN, chayToan } from "./khungToan.js";
import { CSS_TOAN_MO_RONG, chayToanMoRong } from "./khungToanMoRong.js";
import { CSS_KATEX, datToanDem } from "./katexKhung.js";

export const MAU_SLIDE = [
  { ma: "xanh", ten: "Xanh NEU", mau: "#0b4ea2" },
  { ma: "tim", ten: "Tím", mau: "#6741d9" },
  { ma: "luc", ten: "Lục", mau: "#0b7a5a" },
  { ma: "cam", ten: "Cam", mau: "#d9480f" },
  { ma: "hong", ten: "Hồng", mau: "#c2255c" },
  { ma: "limio", ten: "Limio", mau: "#4d7c0f" },
];

export const GIOI_HAN_SLIDE = { soSlide: 40, doDaiMotSlide: 9000, ghiChu: 1500 };

/*
 * Bảng thành phần mà khung hiểu (tên lớp, cấu trúc thẻ) nằm ở
 * backend/src/main/resources/hocphan/slide-thanh-phan.txt — tệp đó được ghép nguyên văn vào lời nhắc của AI
 * (HpAiSoanService) và là danh sách thẻ/lớp mà bộ lọc HpSlideHtml cho phép. Thêm thành phần mới: viết CSS và
 * mã ở dưới, rồi thêm một dòng vào tệp đó.
 */
/* ───────────────────────────── Ngôn ngữ ───────────────────────────── */

/**
 * Chữ do KHUNG tạo ra (nhãn khối nhấn, nút, gợi ý, hộp phím tắt, thông báo). Chữ của nội dung slide do AI viết nên không ở đây.
 * Bộ slide mang `ngonNgu` của giáo trình: giáo trình tiếng Anh thì toàn bộ giao diện trong slide cũng tiếng Anh.
 */
export const TU_DIEN = {
  vi: {
    dinhNghia: "ĐỊNH NGHĨA", viDu: "VÍ DỤ", luuY: "LƯU Ý", canhBao: "CẢNH BÁO", meo: "MẸO", batDeLat: "Bấm để lật",
    tab: "Tab", xemDapAn: "Bấm để xem", chep: "Chép", daChep: "Đã chép ✓", khongChep: "Không chép được",
    ghepHuongDan: "Đã ghép {a}/{b} cặp — chọn một ô bên trái rồi một ô bên phải", ghepXong: "Hoàn thành! Bạn đã ghép đúng tất cả.",
    ghiChuTieuDe: "Ghi chú người trình bày", chuaGhiChu: "Slide này chưa có ghi chú.", tieuDeMacDinh: "Slide bài giảng",
    goiY: "→ hiện ý tiếp theo", lui: "Lùi", tiep: "Tiếp", tongQuan: "Tổng quan", ghiChu: "Ghi chú", but: "Bút", laser: "Laser",
    nen: "Nền sáng / tối", toanMan: "Toàn màn hình", troGiup: "Phím tắt", ghiChuTip: "Ghi chú người trình bày", butTip: "Bút vẽ",
    laserTip: "Con trỏ laser", phimTatTieuDe: "Phím tắt",
    phTien: "Hiện ý tiếp theo / sang slide sau", phLui: "Lùi lại", phTongQuan: "Tổng quan tất cả slide", phGhiChu: "Ghi chú người trình bày",
    phBut: "Bút vẽ", phXoa: "xoá nét vẽ", phLaser: "Con trỏ laser", phNen: "Nền sáng / tối", phToanMan: "Toàn màn hình",
  },
  en: {
    dinhNghia: "DEFINITION", viDu: "EXAMPLE", luuY: "NOTE", canhBao: "WARNING", meo: "TIP", batDeLat: "Click to flip",
    tab: "Tab", xemDapAn: "Click to reveal", chep: "Copy", daChep: "Copied ✓", khongChep: "Could not copy",
    ghepHuongDan: "Matched {a}/{b} pairs — pick an item on the left, then one on the right", ghepXong: "Done! You matched every pair correctly.",
    ghiChuTieuDe: "Speaker notes", chuaGhiChu: "This slide has no notes.", tieuDeMacDinh: "Lecture slides",
    goiY: "→ reveal next point", lui: "Back", tiep: "Next", tongQuan: "Overview", ghiChu: "Notes", but: "Pen", laser: "Laser",
    nen: "Light / dark", toanMan: "Full screen", troGiup: "Shortcuts", ghiChuTip: "Speaker notes", butTip: "Pen",
    laserTip: "Laser pointer", phimTatTieuDe: "Keyboard shortcuts",
    phTien: "Reveal next point / next slide", phLui: "Go back", phTongQuan: "Overview of all slides", phGhiChu: "Speaker notes",
    phBut: "Pen", phXoa: "clear drawing", phLaser: "Laser pointer", phNen: "Light / dark", phToanMan: "Full screen",
  },
};

const chuoiCss = (s) => JSON.stringify(s);

/** Nhãn của các khối nhấn đưa vào CSS qua biến, để cùng một CSS dùng được cho mọi ngôn ngữ. */
export function cssNhan(T) {
  return `:root { --t-dinh-nghia: ${chuoiCss(T.dinhNghia)}; --t-vi-du: ${chuoiCss(T.viDu)}; --t-luu-y: ${chuoiCss(T.luuY)}; --t-canh-bao: ${chuoiCss(T.canhBao)}; --t-meo: ${chuoiCss(T.meo)}; --t-bat-de-lat: ${chuoiCss(T.batDeLat)}; }`;
}

/* ───────────────────────────── CSS ───────────────────────────── */

export const CSS_KHUNG = `
:root {
  --mau: #0b4ea2; --mau-2: #2f80ed; --mau-dam: #082f63; --mau-nhat: #e6f0fd; --mau-vua: #bcd5f7;
  --nen: #f4f7fc; --the: #ffffff; --the-2: #eef3fb; --chu: #14213d; --chu-phu: #55637d; --vien: #d8e2f0;
  --dung: #1f9d62; --dung-nhat: #e3f6ec; --sai: #d64545; --sai-nhat: #fdeaea; --vang: #f2b632; --vang-nhat: #fff6dd;
  --bong: 0 10px 30px rgba(20, 33, 61, 0.10), 0 2px 6px rgba(20, 33, 61, 0.06);
  --font: "Be Vietnam Pro", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", system-ui, sans-serif;
  --mono: "JetBrains Mono", "Fira Code", Consolas, "SFMono-Regular", Menlo, monospace;
}
[data-mau="tim"] { --mau: #6741d9; --mau-2: #9775fa; --mau-dam: #32207a; --mau-nhat: #efe9ff; --mau-vua: #d0bfff; }
[data-mau="luc"] { --mau: #0b7a5a; --mau-2: #20c997; --mau-dam: #064535; --mau-nhat: #def7ee; --mau-vua: #a6e9d2; }
[data-mau="cam"] { --mau: #d9480f; --mau-2: #ff922b; --mau-dam: #7a2606; --mau-nhat: #ffeddf; --mau-vua: #ffd0a8; }
[data-mau="hong"] { --mau: #c2255c; --mau-2: #f06595; --mau-dam: #6b1233; --mau-nhat: #ffe8f0; --mau-vua: #fbc2d6; }
/* Giao diện Limio: nhấn xanh chanh (--brand) trên nền trắng/xám nhạt như phần còn lại của trang, tối thì theo token tối của Limio. */
[data-mau="limio"] { --mau: #4d7c0f; --mau-2: #65a30d; --mau-dam: #365314; --mau-nhat: #f7fee7; --mau-vua: #d9f99d;
  --nen: #fafafc; --the: #ffffff; --the-2: #f4f4f8; --chu: #030712; --chu-phu: #475062; --vien: #e2e2e8;
  --bong: 0 10px 30px rgba(3, 7, 18, 0.08), 0 2px 6px rgba(3, 7, 18, 0.05); }
[data-theme="toi"] {
  --nen: #0b1220; --the: #141e35; --the-2: #1b2744; --chu: #eaf0fb; --chu-phu: #a3b2cc; --vien: #2a3858;
  --mau-nhat: #1a2a4a; --mau-vua: #31507f; --dung-nhat: #11382a; --sai-nhat: #432024; --vang-nhat: #3b3112;
  --bong: 0 10px 30px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3);
}
[data-theme="toi"] { --mau: #3d86f0; --mau-2: #74b0ff; }
[data-theme="toi"][data-mau="tim"] { --mau: #8b6cf0; --mau-2: #b197fc; --mau-nhat: #251c4d; --mau-vua: #4a3a8f; }
[data-theme="toi"][data-mau="luc"] { --mau: #1fae85; --mau-2: #4fe0b5; --mau-nhat: #0f3a2f; --mau-vua: #1f6b57; }
[data-theme="toi"][data-mau="cam"] { --mau: #f06a2a; --mau-2: #ffa94d; --mau-nhat: #3f2210; --mau-vua: #8a4a1e; }
[data-theme="toi"][data-mau="hong"] { --mau: #e64980; --mau-2: #ff8fb3; --mau-nhat: #43182b; --mau-vua: #8a3a5a; }
[data-theme="toi"][data-mau="limio"] { --mau: #84cc16; --mau-2: #a3e635; --mau-nhat: #21320c; --mau-vua: #3f6212;
  --nen: #090b14; --the: #111320; --the-2: #181b2b; --chu: #f0f2fa; --chu-phu: #a0a8bc; --vien: #262a3c; }

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--nen); color: var(--chu); font-family: var(--font); -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; cursor: pointer; }
.san-khau { position: fixed; inset: 0 0 52px 0; display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: radial-gradient(1200px 700px at 15% 0%, var(--mau-nhat), transparent 60%), radial-gradient(900px 600px at 100% 100%, var(--mau-nhat), transparent 55%), var(--nen); }
.khung { position: absolute; left: 50%; top: 50%; width: 1600px; height: 900px; transform-origin: 0 0; border-radius: 22px; overflow: hidden; overflow: clip;
  background: var(--the); box-shadow: 0 30px 80px rgba(8, 20, 50, 0.28), 0 0 0 1px var(--vien); }

/* ── Slide ── */
.khung > section { position: absolute; inset: 0; font-size: 36px; line-height: 1.45; padding: 120px 110px 84px; overflow: hidden; overflow: clip;
  opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .35s ease; background: var(--the); }
.khung > section.hien-tai { opacity: 1; visibility: visible; pointer-events: auto; z-index: 2; }
.khung > section.hien-tai.tien { animation: vaoPhai .5s cubic-bezier(.2, .7, .2, 1); }
.khung > section.hien-tai.lui { animation: vaoTrai .5s cubic-bezier(.2, .7, .2, 1); }
@keyframes vaoPhai { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: none; } }
@keyframes vaoTrai { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: none; } }
@keyframes len { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
.khung > section.hien-tai > :not(.dau-slide):not(.ghi-chu):not(.than), .khung > section.hien-tai > .than > * { animation: len .55s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i, 0) * 70ms + 120ms); }
.khung > section::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 14px; background: linear-gradient(180deg, var(--mau), var(--mau-2)); }
.khung > section::after { content: ""; position: absolute; right: -180px; top: -180px; width: 460px; height: 460px; border-radius: 50%;
  background: radial-gradient(circle, var(--mau-nhat), transparent 68%); pointer-events: none; z-index: 0; }
.khung > section > * { position: relative; z-index: 1; }
.dau-slide { position: absolute !important; left: 110px; right: 110px; top: 38px; display: flex; justify-content: space-between; align-items: center;
  font-size: .55em; letter-spacing: .04em; color: var(--chu-phu); text-transform: uppercase; font-weight: 600; z-index: 3; }
.dau-slide b { color: var(--mau); }
section:not(.bia):not(.chuong):not(.hai-cot) { display: flex; flex-direction: column; }
section > .than { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-bottom: 28px; }
section > .than > :first-child { margin-top: auto; }
section > .than > :last-child { margin-bottom: auto; }
.luoi-so, .bieu-do, .quy-trinh, .so-sanh, .luoi-the, .tabs, .ghep-doi, .trac-nghiem, .bam-de-xem, pre.ma { margin-top: .45em; margin-bottom: .75em; }
section h1 { font-size: 2.55em; line-height: 1.12; margin: 0 0 .25em; font-weight: 800; letter-spacing: -.015em; }
section h2 { font-size: 1.55em; line-height: 1.18; margin: 0 0 .5em; font-weight: 800; letter-spacing: -.01em; position: relative; padding-bottom: .38em; }
section h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 96px; height: 7px; border-radius: 4px; background: linear-gradient(90deg, var(--mau), var(--mau-2)); }
section h3 { font-size: 1.05em; margin: 0 0 .35em; font-weight: 700; color: var(--mau); }
section p { margin: 0 0 .6em; }
section .phu-de { font-size: .9em; color: var(--chu-phu); margin: -.2em 0 .8em; }
section ul, section ol { margin: 0 0 .6em; padding-left: 1.25em; }
section li { margin: .28em 0; padding-left: .2em; }
section li::marker { color: var(--mau); font-weight: 700; }
section strong, section b { font-weight: 700; }
section mark { background: linear-gradient(transparent 55%, var(--vang) 55%); color: inherit; padding: 0 .1em; }
section code { font-family: var(--mono); font-size: .86em; background: var(--the-2); border: 1px solid var(--vien); padding: .04em .32em; border-radius: 7px; color: var(--mau); }
section kbd { font-family: var(--mono); font-size: .8em; border: 1px solid var(--vien); border-bottom-width: 3px; border-radius: 7px; padding: .02em .4em; background: var(--the-2); }
section .chip { display: inline-block; font-size: .62em; font-weight: 700; padding: .12em .7em; border-radius: 999px; background: var(--mau-nhat); color: var(--mau); letter-spacing: .02em; margin-right: .4em; vertical-align: middle; }
section table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: .8em; border: 1px solid var(--vien); border-radius: 14px; overflow: hidden; }
section th { background: var(--mau); color: #fff; text-align: left; padding: .5em .8em; }
section td { padding: .5em .8em; border-top: 1px solid var(--vien); }
section svg { max-width: 100%; height: auto; }
section hr { border: 0; border-top: 2px dashed var(--vien); margin: .8em 0; }
.ghi-chu { display: none !important; }

/* Bố cục */
section.bia { background: linear-gradient(135deg, var(--mau-dam) 0%, var(--mau) 55%, var(--mau-2) 120%); color: #fff; padding: 0 140px; display: flex; flex-direction: column; justify-content: center; }
section.bia::before { width: 0; }
section.bia::after { right: -120px; top: auto; bottom: -220px; width: 760px; height: 760px; background: radial-gradient(circle, rgba(255, 255, 255, .18), transparent 66%); }
section.bia h1 { font-size: 2.9em; color: #fff; max-width: 1150px; }
section.bia .phu-de { color: rgba(255, 255, 255, .86); font-size: 1em; max-width: 1000px; margin: .2em 0 0; }
section.bia p { color: rgba(255, 255, 255, .8); }
section.bia .dau-slide { display: none; }
section.bia .chip { background: rgba(255, 255, 255, .18); color: #fff; align-self: flex-start; margin: 0 0 1.1em; padding: .3em 1em; font-size: .6em; }
section.bia h1::before { content: ""; display: block; width: 110px; height: 9px; border-radius: 5px; background: var(--vang); margin-bottom: .55em; }
section.chuong { background: linear-gradient(135deg, var(--mau-nhat), var(--the)); display: flex; flex-direction: column; justify-content: center; padding-left: 150px; }
section.chuong h2 { font-size: 2.3em; padding-bottom: .45em; max-width: 1200px; }
section.chuong h2::after { width: 140px; }
section.chuong .phu-de { font-size: 1em; }
section.hai-cot { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr; column-gap: 70px; align-content: start; }
section.hai-cot > h2, section.hai-cot > .phu-de { grid-column: 1 / -1; }
section.hai-cot > .cot { min-width: 0; }
section.tong-ket { background: linear-gradient(160deg, var(--mau-nhat), var(--the) 70%); }
section.tong-ket li { list-style: none; position: relative; padding: .42em .8em .42em 1.7em; margin: .3em 0; background: var(--the); border: 1px solid var(--vien); border-radius: 14px; box-shadow: var(--bong); }
section.tong-ket li::before { content: "✓"; position: absolute; left: .55em; top: .42em; color: var(--dung); font-weight: 800; }
section.tong-ket ul, section.tong-ket ol { padding-left: 0; }

/* Hiện dần */
.an-buoc { opacity: 0; visibility: hidden; transform: translateY(18px); transition: opacity .45s ease, transform .45s ease, visibility 0s linear .45s; }
.an-buoc.da-hien, body.tat-ca .an-buoc { opacity: 1; visibility: visible; transform: none; transition: opacity .45s ease, transform .45s ease; }

/* Khối nhấn */
.dinh-nghia, .vi-du, .luu-y, .canh-bao, .meo { position: relative; margin: .55em 0; padding: .95em 1.2em .85em 1.4em; border-radius: 16px; background: var(--the-2); border: 1px solid var(--vien); border-left: 9px solid var(--mau); font-size: .93em; }
.dinh-nghia::before, .vi-du::before, .luu-y::before, .canh-bao::before, .meo::before { display: block; font-size: .62em; font-weight: 800; letter-spacing: .12em; margin-bottom: .35em; color: var(--mau); }
.dinh-nghia::before { content: var(--t-dinh-nghia); }
.vi-du { border-left-color: var(--dung); background: var(--dung-nhat); } .vi-du::before { content: var(--t-vi-du); color: var(--dung); }
.luu-y { border-left-color: var(--vang); background: var(--vang-nhat); } .luu-y::before { content: var(--t-luu-y); color: #b07800; }
.canh-bao { border-left-color: var(--sai); background: var(--sai-nhat); } .canh-bao::before { content: var(--t-canh-bao); color: var(--sai); }
.meo { border-left-color: #7048e8; } .meo::before { content: var(--t-meo); color: #7048e8; }
.dinh-nghia > :last-child, .vi-du > :last-child, .luu-y > :last-child, .canh-bao > :last-child, .meo > :last-child { margin-bottom: 0; }

/* Thẻ lật */
.luoi-the { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 28px; margin-top: .4em; }
.the-lat { position: relative; height: 330px; perspective: 1400px; cursor: pointer; outline: none; }
.the-lat .mat-truoc, .the-lat .mat-sau { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 26px 30px; border-radius: 24px;
  backface-visibility: hidden; transition: transform .7s cubic-bezier(.3, .8, .2, 1); font-size: .95em; line-height: 1.32; box-shadow: var(--bong); }
.the-lat .mat-truoc { background: linear-gradient(145deg, var(--mau), var(--mau-2)); color: #fff; font-weight: 800; font-size: 1.12em; }
.the-lat .mat-truoc::after { content: var(--t-bat-de-lat); position: absolute; bottom: 16px; font-size: .46em; font-weight: 600; opacity: .8; letter-spacing: .08em; text-transform: uppercase; }
.the-lat .mat-sau { background: var(--the); border: 2px solid var(--mau); transform: rotateY(180deg); font-size: .8em; }
.the-lat.lat .mat-truoc { transform: rotateY(-180deg); } .the-lat.lat .mat-sau { transform: rotateY(0); }
.the-lat:focus-visible .mat-truoc { outline: 4px solid var(--vang); }

/* Trắc nghiệm */
.trac-nghiem { background: var(--the-2); border: 1px solid var(--vien); border-radius: 24px; padding: 34px 40px; box-shadow: var(--bong); counter-reset: lc; }
.trac-nghiem .cau { font-weight: 800; font-size: 1.08em; margin-bottom: .7em; }
.trac-nghiem .lc { display: flex; align-items: center; gap: 20px; width: 100%; text-align: left; margin: .38em 0; padding: .55em 1em; font-size: .9em; border-radius: 16px;
  background: var(--the); border: 2px solid var(--vien); transition: transform .15s, border-color .15s, background .15s; counter-increment: lc; }
.trac-nghiem .lc > .nd-lc { flex: 1 1 auto; min-width: 0; }
.trac-nghiem .lc::before { content: counter(lc, upper-alpha); flex: none; width: 1.7em; height: 1.7em; display: grid; place-items: center; border-radius: 50%; background: var(--mau-nhat); color: var(--mau); font-weight: 800; font-size: .85em; }
.trac-nghiem:not(.da-tra-loi) .lc:hover { border-color: var(--mau); transform: translateX(6px); }
.trac-nghiem.da-tra-loi .lc { cursor: default; opacity: .75; }
.trac-nghiem .lc.la-dung { border-color: var(--dung); background: var(--dung-nhat); opacity: 1; }
.trac-nghiem .lc.la-dung::before { content: "✓"; background: var(--dung); color: #fff; }
.trac-nghiem .lc.la-sai { border-color: var(--sai); background: var(--sai-nhat); opacity: 1; animation: lac .4s; }
.trac-nghiem .lc.la-sai::before { content: "✗"; background: var(--sai); color: #fff; }
.trac-nghiem .giai-thich { display: none; margin-top: .7em; padding: .7em 1em; border-radius: 14px; background: var(--vang-nhat); font-size: .8em; border-left: 7px solid var(--vang); }
.trac-nghiem.da-tra-loi .giai-thich { display: block; animation: len .45s both; }
.trac-nghiem .phan-hoi { margin: -.15em 0 .65em; padding: .5em .9em; border-radius: 14px; font-size: .8em; font-weight: 600; line-height: 1.35;
  background: var(--mau-nhat); border-left: 7px solid var(--mau); animation: len .45s both; }
.trac-nghiem .phan-hoi.dung { background: var(--dung-nhat); border-left-color: var(--dung); }
.trac-nghiem .phan-hoi.sai { background: var(--sai-nhat); border-left-color: var(--sai); }
@keyframes lac { 20% { transform: translateX(-10px); } 40% { transform: translateX(10px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }

/* Ghép đôi */
.ghep-doi { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 90px; position: relative; }
.ghep-doi .o { padding: .6em 1.1em; border-radius: 16px; background: var(--the); border: 2px solid var(--vien); font-size: .95em; line-height: 1.3; cursor: pointer; transition: all .18s; text-align: left; box-shadow: var(--bong); }
.ghep-doi .o:hover { border-color: var(--mau); }
.ghep-doi .o.chon { border-color: var(--mau); background: var(--mau-nhat); transform: scale(1.03); }
.ghep-doi .o.sai { border-color: var(--sai); background: var(--sai-nhat); animation: lac .4s; }
.ghep-doi .o.xong { cursor: default; color: #fff; border-color: transparent; transform: none; }
.ghep-doi .tien-do { grid-column: 1 / -1; text-align: center; font-size: .6em; color: var(--chu-phu); font-weight: 600; }

/* So sánh */
.so-sanh { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 30px; }
.so-sanh .cot { background: var(--the); border: 1px solid var(--vien); border-radius: 22px; padding: 0 0 .8em; box-shadow: var(--bong); overflow: hidden; font-size: .98em; }
.so-sanh .cot h3 { margin: 0 0 .6em; padding: .55em 1em; background: linear-gradient(135deg, var(--mau), var(--mau-2)); color: #fff; font-size: 1.05em; }
.so-sanh .cot:nth-child(2) h3 { background: linear-gradient(135deg, #7048e8, #9775fa); }
.so-sanh .cot:nth-child(3) h3 { background: linear-gradient(135deg, #0b7a5a, #20c997); }
.so-sanh .cot ul, .so-sanh .cot p { margin-left: 1em; margin-right: 1em; }

/* Quy trình */
.quy-trinh { display: flex; gap: 22px; counter-reset: b; align-items: stretch; flex-wrap: nowrap; }
.quy-trinh .buoc { flex: 1 1 0; min-width: 0; position: relative; counter-increment: b; background: var(--the); border: 1px solid var(--vien); border-radius: 22px; padding: 100px 24px 22px; box-shadow: var(--bong); font-size: .92em; line-height: 1.32; min-height: 300px; }
.quy-trinh .buoc::before { content: counter(b); position: absolute; left: 22px; top: 18px; width: 2em; height: 2em; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, var(--mau), var(--mau-2)); color: #fff; font-weight: 800; font-size: 1.05em; }
.quy-trinh .buoc:not(:last-child)::after { content: ""; position: absolute; right: -23px; top: 52px; width: 24px; height: 4px; background: var(--mau-vua); }
.quy-trinh .buoc b { display: block; font-size: 1.12em; margin-bottom: .25em; color: var(--chu); }
.quy-trinh .buoc p { margin: 0; color: var(--chu-phu); }

/* Tab */
.tab-thanh { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.tab-nut { border: 2px solid var(--vien); background: var(--the); border-radius: 999px; padding: .28em 1.1em; font-size: .78em; font-weight: 700; color: var(--chu-phu); transition: all .15s; }
.tab-nut:hover { border-color: var(--mau); color: var(--mau); }
.tab-nut.dang { background: linear-gradient(135deg, var(--mau), var(--mau-2)); color: #fff; border-color: transparent; }
.tabs .tab { display: none; background: var(--the-2); border: 1px solid var(--vien); border-radius: 22px; padding: 26px 34px; font-size: .92em; }
.tabs .tab.dang { display: block; animation: len .4s both; }
.tabs .tab > :last-child { margin-bottom: 0; }

/* Bấm để xem */
.bam-de-xem { position: relative; border: 2px dashed var(--mau-vua); border-radius: 22px; padding: 26px 34px; min-height: 150px; font-size: .92em; }
.bam-de-xem > .nd { filter: blur(14px); opacity: .25; user-select: none; transition: all .5s; }
.bam-de-xem.mo > .nd { filter: none; opacity: 1; user-select: text; }
.bam-de-xem > .nut-xem { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: .45em 1.4em; font-weight: 800; border-radius: 999px; border: 0; color: #fff; font-size: .85em;
  background: linear-gradient(135deg, var(--mau), var(--mau-2)); box-shadow: 0 10px 24px rgba(0, 0, 0, .22); transition: transform .15s; }
.bam-de-xem > .nut-xem:hover { transform: translate(-50%, -50%) scale(1.06); }
.bam-de-xem.mo > .nut-xem { display: none; }

/* Biểu đồ + số liệu */
.bieu-do { display: grid; gap: 16px; margin: .3em 0; }
.bieu-do .thanh { position: relative; height: 62px; border-radius: 16px; background: var(--the-2); border: 1px solid var(--vien); overflow: hidden; }
.bieu-do .thanh::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 16px; background: linear-gradient(90deg, var(--mau), var(--mau-2)); transition: width 1.1s cubic-bezier(.2, .8, .2, 1); }
.bieu-do .thanh.chay::before { width: var(--gt, 0%); }
.bieu-do .thanh span { position: absolute; left: 22px; top: 0; bottom: 0; display: flex; align-items: center; font-size: .72em; font-weight: 700; color: #fff; mix-blend-mode: normal; text-shadow: 0 1px 4px rgba(0, 0, 0, .35); z-index: 2; }
.bieu-do .thanh em { position: absolute; right: 18px; top: 0; bottom: 0; display: flex; align-items: center; font-style: normal; font-weight: 800; font-size: .72em; color: var(--chu); z-index: 2; }
.luoi-so { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 28px; }
.so-lieu { text-align: center; padding: 30px 22px; border-radius: 24px; background: var(--the); border: 1px solid var(--vien); box-shadow: var(--bong); }
.so-lieu b { font-size: 2.6em; line-height: 1; font-weight: 800; background: linear-gradient(135deg, var(--mau), var(--mau-2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.so-lieu > span { font-size: 1.4em; font-weight: 800; color: var(--mau); margin-left: 4px; }
.so-lieu p { margin: .5em 0 0; font-size: .72em; color: var(--chu-phu); }

/* Mã nguồn */
pre.ma { position: relative; margin: .4em 0 .6em; padding: 64px 28px 24px; border-radius: 20px; background: #0f1b33; color: #e6edf9; font-family: var(--mono); font-size: .66em; line-height: 1.55; overflow: hidden; box-shadow: var(--bong); tab-size: 4; white-space: pre; }
pre.ma::before { content: attr(data-ngon-ngu); position: absolute; left: 100px; top: 15px; font-size: .9em; letter-spacing: .08em; text-transform: uppercase; color: #8aa0c4; font-weight: 700; }
pre.ma .cham { position: absolute; left: 24px; top: 20px; width: 14px; height: 14px; border-radius: 50%; background: #ff6159; box-shadow: 24px 0 #ffbd2e, 48px 0 #28c93f; }
pre.ma code { background: none; border: 0; padding: 0; color: inherit; font-size: 1em; }
pre.ma .sao { position: absolute; right: 18px; top: 10px; border: 1px solid #2c3d63; background: #172545; color: #c7d4ee; border-radius: 10px; padding: 4px 14px; font-size: .9em; }
pre.ma .sao:hover { background: #20315a; }
.tk { color: #ff7b9c; font-weight: 600; } .ts { color: #9ce38a; } .tn { color: #ffb86b; } .tc { color: #6f86ad; font-style: italic; } .th { color: #7cc4ff; } .tg { color: #ff9ac1; }

/* Gợi ý bấm tiếp khi slide còn ý chưa hiện */
.goi-y { position: absolute; right: 36px; bottom: 26px; z-index: 6; padding: 8px 20px; border-radius: 999px; background: var(--mau); color: #fff; font-size: 24px; font-weight: 700;
  letter-spacing: .01em; box-shadow: 0 8px 22px rgba(0, 0, 0, .22); opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity .3s, transform .3s; }
.goi-y.co { opacity: .95; transform: none; animation: nhip 1.8s ease-in-out infinite; }
@keyframes nhip { 50% { transform: translateY(-5px); } }

/* Thanh điều khiển */
.thanh-duoi { position: fixed; left: 0; right: 0; bottom: 0; height: 52px; display: flex; align-items: center; gap: 6px; padding: 0 14px; background: var(--the); border-top: 1px solid var(--vien); font-size: 14px; z-index: 20; }
.thanh-duoi .tien-trinh { position: absolute; left: 0; top: -3px; height: 3px; width: 0; background: linear-gradient(90deg, var(--mau), var(--mau-2)); transition: width .3s; }
.nut-dk { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 38px; height: 36px; padding: 0 10px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--chu-phu); font-weight: 600; }
.nut-dk:hover { background: var(--the-2); color: var(--chu); }
.nut-dk[aria-pressed="true"] { background: var(--mau-nhat); color: var(--mau); border-color: var(--mau-vua); }
.nut-dk:focus-visible { outline: 3px solid var(--vang); }
.thanh-duoi .so-trang { min-width: 76px; text-align: center; font-weight: 700; color: var(--chu); font-variant-numeric: tabular-nums; }
.thanh-duoi .gian { flex: 1; }
.thanh-duoi .diem { display: none; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: var(--dung-nhat); color: var(--dung); font-weight: 800; }
.thanh-duoi .diem.co { display: inline-flex; }
@media (max-width: 700px) { .nut-dk .nhan { display: none; } .thanh-duoi { gap: 2px; padding: 0 6px; } }

/* Tổng quan, ghi chú, trợ giúp */
.tong-quan { position: fixed; inset: 0 0 52px 0; z-index: 30; background: color-mix(in srgb, var(--nen) 94%, transparent); backdrop-filter: blur(8px); overflow: auto; padding: 28px; display: none; }
.tong-quan.mo { display: block; animation: len .3s both; }
.tong-quan .luoi { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; max-width: 1500px; margin: 0 auto; }
.thu { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; border: 2px solid var(--vien); background: var(--the); cursor: pointer; padding: 0; transition: transform .15s, border-color .15s; box-shadow: var(--bong); }
.thu:hover { transform: translateY(-4px); border-color: var(--mau); }
.thu.dang { border-color: var(--mau); box-shadow: 0 0 0 4px var(--mau-vua); }
.thu .trong { position: absolute; left: 0; top: 0; width: 1600px; height: 900px; transform-origin: 0 0; pointer-events: none; }
.thu .trong > section { position: absolute; inset: 0; opacity: 1; visibility: visible; animation: none !important; }
.thu .trong > section * { animation: none !important; }
.thu .so { position: absolute; left: 8px; bottom: 6px; padding: 1px 9px; border-radius: 8px; background: rgba(8, 20, 50, .78); color: #fff; font-size: 12px; font-weight: 700; z-index: 2; }
.khay-ghi-chu { position: fixed; left: 0; right: 0; bottom: 52px; z-index: 25; max-height: 34vh; overflow: auto; padding: 16px 28px 18px; background: var(--the); border-top: 3px solid var(--mau); box-shadow: 0 -14px 34px rgba(0, 0, 0, .16); font-size: 17px; line-height: 1.55; display: none; }
.khay-ghi-chu.mo { display: block; animation: len .25s both; }
.khay-ghi-chu b { color: var(--mau); display: block; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
.tro-giup { position: fixed; inset: 0; z-index: 40; display: none; place-items: center; background: rgba(6, 14, 34, .62); }
.tro-giup.mo { display: grid; }
.tro-giup > div { background: var(--the); border-radius: 22px; padding: 26px 34px; width: min(560px, 92vw); box-shadow: 0 30px 80px rgba(0, 0, 0, .4); }
.tro-giup h4 { margin: 0 0 12px; font-size: 20px; }
.tro-giup dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; margin: 0; font-size: 15px; }
.tro-giup dt kbd { font-family: var(--mono); border: 1px solid var(--vien); border-bottom-width: 3px; border-radius: 7px; padding: 1px 8px; background: var(--the-2); }
.tro-giup dd { margin: 0; color: var(--chu-phu); }
canvas.but { position: fixed; left: 0; top: 0; width: 100%; height: calc(100% - 52px); z-index: 15; pointer-events: none; }
body.dang-but canvas.but { pointer-events: auto; cursor: crosshair; z-index: 28; }
.laser { position: fixed; z-index: 50; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; pointer-events: none; display: none;
  background: radial-gradient(circle, #ff3b3b 0 30%, rgba(255, 59, 59, .55) 55%, transparent 72%); box-shadow: 0 0 22px 8px rgba(255, 59, 59, .45); }
body.dang-laser .laser { display: block; }
body.dang-laser, body.dang-laser * { cursor: none !important; }
/* Chỉ vào bảng: vầng sáng, gạch chân vẽ dần, con trỏ tròn (toạ độ logic trong .khung) */
.chi-sang { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 8; pointer-events: none; border-radius: 18px; opacity: 0; transform: scale(.97);
  background: color-mix(in srgb, var(--mau) 9%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mau) 62%, transparent), 0 0 38px 8px color-mix(in srgb, var(--mau) 32%, transparent);
  transition: opacity .35s ease, transform .4s cubic-bezier(.22, 1, .36, 1), left .35s ease, top .35s ease, width .35s ease, height .35s ease; }
.khung.dang-chi .chi-sang { opacity: 1; transform: none; animation: chiNhip 2.6s ease-in-out .5s infinite; }
@keyframes chiNhip { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--mau) 40%, transparent), 0 0 56px 12px color-mix(in srgb, var(--mau) 22%, transparent); } }
.chi-gach { position: absolute; left: 0; top: 0; height: 16px; z-index: 9; pointer-events: none; overflow: visible; opacity: 0; transition: opacity .3s; }
.khung.dang-chi .chi-gach { opacity: 1; }
.chi-gach path { fill: none; stroke: var(--vang); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.chi-gach.ve path { stroke-dashoffset: 0; transition: stroke-dashoffset .8s cubic-bezier(.45, 0, .25, 1); }
.chi-tro { position: absolute; left: 0; top: 0; z-index: 10; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; pointer-events: none; opacity: 0;
  background: radial-gradient(circle, #fff 0 24%, var(--mau-2) 28% 60%, transparent 64%);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--mau) 28%, transparent), 0 8px 20px rgba(0, 0, 0, .3);
  transition: transform .45s cubic-bezier(.22, 1, .36, 1), opacity .3s ease; }
.chi-tro.hien { opacity: 1; }
.chi-tro.di { transition: transform .8s cubic-bezier(.45, 0, .25, 1), opacity .3s ease; }
.phao { position: fixed; z-index: 60; width: 10px; height: 14px; top: -20px; pointer-events: none; animation: roi 1.9s ease-in forwards; }
@keyframes roi { to { transform: translateY(110vh) rotate(720deg); opacity: .9; } }
/* Giảm chuyển động: hoạt ảnh chạy tức thì, BỎ độ trễ (phần tử "both" + delay từng đứng ẩn ở khung đầu), không lặp vô hạn;
   vẫn giữ animation (không "none") để animationend còn bắn. Transition đặt 0s chứ KHÔNG .01ms: transition-property mặc định
   là "all", nên .01ms biến MỌI thay đổi (cỡ chữ, visibility…) thành chuyển tiếp — đọc kích thước ngay sau khi đổi ra số cũ
   (co chữ đo sai) và visibility có lúc kẹt ở trạng thái ẩn. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
    transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }
}
/* Khối quá cao so với slide (đã co chữ tới mức nhỏ nhất) thì cuộn bên trong, không bị cắt. */
/* Lúc co chữ: tắt chuyển tiếp (vd. "transition: all" của nút ghép đôi/tab) để kích thước đọc ra là kích thước mới. */
.dang-co .khung *, .dang-co .khung *::before, .dang-co .khung *::after { transition: none !important; }
.cuon-trong { overflow-y: auto !important; overscroll-behavior: contain; scrollbar-width: thin; }
`;

/* ───────────────────────────── Kiểu "hoclieu" ───────────────────────────── */

/* BẮT ĐẦU CSS_HOC_LIEU */
/**
 * Giao diện trình chiếu kiểu Học liệu AI Research (Portal-Deploy/Research/HocLieu/src/slides/slides.css): nền tối xanh đen có
 * quầng sáng, slide liền với nền (không viền trái), tiêu đề lớn đậm có vạch nhấn mọc ra, thẻ bo tròn bóng mềm, chip nhãn,
 * thanh điều khiển nổi dạng viên thuốc dồn TRÁI (góc dưới phải ~300×200 để trang cha đặt khung người giảng), tiến độ mảnh.
 * Chỉ dùng biến màu của khung (--mau, --mau-2…): màu nhấn theo `mau` của bộ slide (xanh NEU), không cố định chàm/tím.
 * Mặc định tối (dungTaiLieuSlide đặt data-theme="toi"); phím T vẫn đổi sang nền sáng, mọi quy tắc dưới đây theo biến nên vẫn đúng.
 */
export const CSS_HOC_LIEU = `
[data-kieu="hoclieu"] { --bo: 18px; --em: cubic-bezier(.22, 1, .36, 1); --bong: 0 1px 2px rgba(20, 23, 43, .06), 0 10px 28px rgba(20, 23, 43, .10); }
[data-kieu="hoclieu"][data-theme="toi"] { --nen: #0d0f1c; --the: #161931; --the-2: #1f2342; --chu: #eceefb; --chu-phu: #9aa0c4; --vien: #2a2f57;
  --bong: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 28px rgba(0, 0, 0, .38); }
[data-kieu="hoclieu"] body { font-family: "Be Vietnam Pro", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }

/* Sân khấu: nền tối có hai quầng sáng màu nhấn; chừa dải đáy 72px cho thanh nổi */
[data-kieu="hoclieu"] .san-khau { inset: 0 0 72px 0;
  background: radial-gradient(1000px 760px at 88% -8%, color-mix(in srgb, var(--mau) 24%, transparent), transparent 68%),
    radial-gradient(900px 700px at -6% 108%, color-mix(in srgb, var(--mau-2) 14%, transparent), transparent 66%), var(--nen); }
[data-kieu="hoclieu"] body { background: var(--nen); }
[data-kieu="hoclieu"] .khung { border-radius: 14px; background: var(--nen);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vien) 70%, transparent), 0 40px 90px rgba(0, 0, 0, .38); }

/* Slide: liền nền, quầng sáng trôi chậm ở góc, lưới chấm mờ ở góc trên trái */
[data-kieu="hoclieu"] .khung > section { padding: 112px 104px 92px; line-height: 1.38;
  background: radial-gradient(760px 760px at -8% 112%, color-mix(in srgb, var(--mau-2) 13%, transparent), transparent 68%), var(--nen);
  transform: scale(.965); transition: opacity .42s var(--em), transform .42s var(--em), visibility 0s linear .42s; }
[data-kieu="hoclieu"] .khung > section.hien-tai { transform: none; transition: opacity .3s ease, transform .3s ease, visibility 0s; }
[data-kieu="hoclieu"] .khung > section.hien-tai.tien { animation: hlVaoPhai .6s var(--em); }
[data-kieu="hoclieu"] .khung > section.hien-tai.lui { animation: hlVaoTrai .6s var(--em); }
@keyframes hlVaoPhai { from { opacity: 0; transform: translateX(70px) scale(.99); } to { opacity: 1; transform: none; } }
@keyframes hlVaoTrai { from { opacity: 0; transform: translateX(-70px) scale(.99); } to { opacity: 1; transform: none; } }
[data-kieu="hoclieu"] .khung > section::before { width: auto; inset: 0; right: 50%; bottom: 45%;
  background: radial-gradient(color-mix(in srgb, var(--chu) 14%, transparent) 2px, transparent 2.4px) 0 0 / 40px 40px;
  -webkit-mask-image: linear-gradient(125deg, #000 0%, transparent 55%); mask-image: linear-gradient(125deg, #000 0%, transparent 55%); opacity: .5; pointer-events: none; z-index: 0; }
[data-kieu="hoclieu"] .khung > section::after { right: -360px; top: -470px; width: 940px; height: 940px;
  background: radial-gradient(circle, color-mix(in srgb, var(--mau) 26%, transparent) 0%, transparent 68%); animation: hlTroi 26s ease-in-out infinite alternate; }
@keyframes hlTroi { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-50px, 42px, 0) scale(1.1); } }
[data-kieu="hoclieu"] .khung > section.hien-tai > :not(.dau-slide):not(.ghi-chu):not(.than), [data-kieu="hoclieu"] .khung > section.hien-tai > .than > * {
  animation: hlLen .7s var(--em) both; animation-delay: calc(var(--i, 0) * 80ms + 140ms); }
@keyframes hlLen { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }

/* Dòng đầu: nhãn chữ hoa màu nhấn có chấm tròn (eyebrow) */
[data-kieu="hoclieu"] .dau-slide { left: 104px; right: 104px; top: 40px; font-size: 21px; font-weight: 800; letter-spacing: .16em; color: var(--mau); }
[data-kieu="hoclieu"] .dau-slide span { display: inline-flex; align-items: center; gap: 14px; }
[data-kieu="hoclieu"] .dau-slide span::before { content: ""; width: 14px; height: 14px; border-radius: 50%; flex: none;
  background: linear-gradient(135deg, var(--mau), var(--mau-2)); box-shadow: 0 0 0 6px color-mix(in srgb, var(--mau) 20%, transparent); }
[data-kieu="hoclieu"] .dau-slide b { color: var(--chu-phu); font-weight: 700; letter-spacing: .08em; }

/* Tiêu đề lớn, đậm, vạch nhấn mọc ra */
[data-kieu="hoclieu"] section h1 { font-weight: 900; letter-spacing: -.03em; }
[data-kieu="hoclieu"] section h2 { font-size: 1.72em; line-height: 1.14; font-weight: 800; letter-spacing: -.022em; padding-bottom: .42em; margin-bottom: .55em; text-wrap: balance; }
[data-kieu="hoclieu"] section h2::after { width: 128px; height: 8px; border-radius: 8px; background: linear-gradient(90deg, var(--mau), var(--mau-2)); transform-origin: left center; }
[data-kieu="hoclieu"] .khung > section.hien-tai h2::after { animation: hlMoc .8s var(--em) .45s backwards; }
@keyframes hlMoc { from { transform: scaleX(0); } }
[data-kieu="hoclieu"] section h3 { color: var(--mau-2); }
[data-kieu="hoclieu"] section .phu-de { color: var(--chu-phu); }
[data-kieu="hoclieu"] section strong, [data-kieu="hoclieu"] section b { color: inherit; }
[data-kieu="hoclieu"] section mark { background: linear-gradient(transparent 58%, color-mix(in srgb, var(--mau) 45%, transparent) 58%); }
[data-kieu="hoclieu"] section code { background: color-mix(in srgb, var(--mau) 12%, var(--the)); border-color: color-mix(in srgb, var(--mau) 30%, var(--vien)); color: var(--mau-2); }
[data-kieu="hoclieu"] section .chip { font-size: .58em; padding: .2em .9em; border: 2px solid color-mix(in srgb, var(--mau) 45%, var(--vien));
  background: color-mix(in srgb, var(--mau) 12%, var(--the)); color: var(--mau-2); letter-spacing: .04em; }

/* Danh sách cấp một của thân slide thành thẻ có viền nhấn trái */
[data-kieu="hoclieu"] section > .than > ul, [data-kieu="hoclieu"] section > .than > ol { list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: .36em; counter-reset: hl; }
[data-kieu="hoclieu"] section > .than > ul > li, [data-kieu="hoclieu"] section > .than > ol > li { position: relative; margin: 0; padding: .4em .9em .4em 1.85em; counter-increment: hl;
  background: var(--the); border: 2px solid var(--vien); border-left: 9px solid var(--mau); border-radius: var(--bo); box-shadow: var(--bong); }
[data-kieu="hoclieu"] section > .than > ul > li::before { content: ""; position: absolute; left: .72em; top: .95em; width: .36em; height: .36em; border-radius: 50%;
  background: var(--mau-2); box-shadow: 0 0 0 .16em color-mix(in srgb, var(--mau) 22%, transparent); }
[data-kieu="hoclieu"] section > .than > ol > li { padding-left: 2.3em; }
[data-kieu="hoclieu"] section > .than > ol > li::before { content: counter(hl); position: absolute; left: .45em; top: .36em; width: 1.35em; height: 1.35em; display: grid; place-items: center;
  border-radius: 12px; font-weight: 800; font-size: .9em; background: color-mix(in srgb, var(--mau) 18%, var(--the)); color: var(--mau-2); }
[data-kieu="hoclieu"] section.hai-cot .cot > ul { list-style: none; padding-left: 0; }
[data-kieu="hoclieu"] section.hai-cot .cot > ul > li { position: relative; padding-left: 1.3em; }
[data-kieu="hoclieu"] section.hai-cot .cot > ul > li::before { content: ""; position: absolute; left: .15em; top: .55em; width: .42em; height: .42em; border-radius: 50%;
  background: var(--mau); box-shadow: 0 0 0 .16em color-mix(in srgb, var(--mau) 20%, transparent); }

/* Hiện dần: trượt lên mượt, mục vừa hiện có vòng sáng toả ra */
[data-kieu="hoclieu"] .an-buoc { transform: translateY(28px); transition: opacity .55s var(--em), transform .55s var(--em), visibility 0s linear .55s; }
[data-kieu="hoclieu"] .an-buoc.da-hien, [data-kieu="hoclieu"] body.tat-ca .an-buoc { transform: none; transition: opacity .55s var(--em), transform .55s var(--em); }
[data-kieu="hoclieu"] section > .than > ul > li.an-buoc.da-hien, [data-kieu="hoclieu"] section > .than > ol > li.an-buoc.da-hien { animation: hlToa 1.3s var(--em); }
@keyframes hlToa { from { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mau) 55%, transparent), var(--bong); } 35% { box-shadow: 0 0 0 16px transparent, var(--bong); } }

/* Bìa: dải màu nhấn có vòng tròn trang trí */
[data-kieu="hoclieu"] section.bia { padding: 0 150px; background: linear-gradient(125deg, var(--mau-dam) 0%, var(--mau) 52%, color-mix(in srgb, var(--mau-2) 80%, #38bdf8) 120%); }
[data-kieu="hoclieu"] section.bia::before { inset: auto; left: auto; right: 150px; top: 50%; width: 340px; height: 340px; margin-top: -170px; border-radius: 50%; -webkit-mask-image: none; mask-image: none; opacity: 1;
  background: rgba(255, 255, 255, .1); border: 3px solid rgba(255, 255, 255, .4);
  box-shadow: 0 0 0 70px rgba(255, 255, 255, .05), 0 0 0 140px rgba(255, 255, 255, .035), 0 30px 80px rgba(0, 0, 0, .25); }
[data-kieu="hoclieu"] section.bia::after { right: auto; left: -260px; top: auto; bottom: -420px; width: 900px; height: 900px; animation: none;
  background: radial-gradient(circle, rgba(255, 255, 255, .14), transparent 66%); }
[data-kieu="hoclieu"] section.bia h1 { font-size: 3em; line-height: 1.12; max-width: 940px; text-wrap: balance; }
[data-kieu="hoclieu"] section.bia h1::before { display: none; }
[data-kieu="hoclieu"] section.bia .phu-de { max-width: 900px; font-size: 1.08em; color: rgba(255, 255, 255, .9); }
[data-kieu="hoclieu"] section.bia .chip { border: 2px solid rgba(255, 255, 255, .45); background: rgba(255, 255, 255, .16); color: #fff; font-size: .62em; padding: .35em 1.1em; }
[data-kieu="hoclieu"] section.bia ul, [data-kieu="hoclieu"] section.bia ol { max-width: 1000px; }

/* Chuyển chương / tổng kết */
[data-kieu="hoclieu"] section.chuong { background: radial-gradient(900px 700px at 12% 50%, color-mix(in srgb, var(--mau) 22%, transparent), transparent 70%), var(--nen); }
[data-kieu="hoclieu"] section.chuong h2 { font-size: 2.6em; font-weight: 900; letter-spacing: -.03em; }
[data-kieu="hoclieu"] section.tong-ket { background: radial-gradient(900px 600px at 0% 0%, color-mix(in srgb, var(--mau) 16%, transparent), transparent 70%), var(--nen); }
[data-kieu="hoclieu"] section.tong-ket li { border-radius: var(--bo); border: 2px solid var(--vien); padding: .45em .9em .45em 2.1em; background: var(--the); }
[data-kieu="hoclieu"] section > .than > ul > li::before { z-index: 1; }
[data-kieu="hoclieu"] section.tong-ket li::before, [data-kieu="hoclieu"] section.tong-ket > .than > ul > li::before { content: "✓"; left: .5em; top: 50%; width: 1.15em; height: 1.15em; margin-top: -.575em; display: grid; place-items: center; border-radius: 50%; font-size: .8em;
  background: color-mix(in srgb, var(--mau) 16%, var(--the)); color: var(--mau-2); border: 2px solid var(--mau); box-shadow: none; }
[data-kieu="hoclieu"] section.tong-ket > .than > ul > li { border-left-width: 2px; }

/* Thẻ: bo tròn, viền mảnh, bóng mềm */
[data-kieu="hoclieu"] .dinh-nghia, [data-kieu="hoclieu"] .vi-du, [data-kieu="hoclieu"] .luu-y, [data-kieu="hoclieu"] .canh-bao, [data-kieu="hoclieu"] .meo {
  border-radius: var(--bo); border: 2px solid var(--vien); border-left: 10px solid var(--mau); background: color-mix(in srgb, var(--mau) 9%, var(--the)); box-shadow: var(--bong); }
[data-kieu="hoclieu"] .dinh-nghia::before { color: var(--mau-2); }
[data-kieu="hoclieu"] .vi-du { border-left-color: var(--dung); background: color-mix(in srgb, var(--dung) 9%, var(--the)); }
[data-kieu="hoclieu"] .luu-y { border-left-color: var(--vang); background: color-mix(in srgb, var(--vang) 10%, var(--the)); }
[data-kieu="hoclieu"] .luu-y::before { color: var(--vang); }
[data-kieu="hoclieu"] .canh-bao { border-left-color: var(--sai); background: color-mix(in srgb, var(--sai) 10%, var(--the)); }
[data-kieu="hoclieu"] .meo { border-left-color: var(--mau-2); } [data-kieu="hoclieu"] .meo::before { color: var(--mau-2); }
[data-kieu="hoclieu"] .trac-nghiem, [data-kieu="hoclieu"] .tabs .tab, [data-kieu="hoclieu"] .so-sanh .cot, [data-kieu="hoclieu"] .quy-trinh .buoc, [data-kieu="hoclieu"] .so-lieu,
[data-kieu="hoclieu"] .bam-de-xem { border-radius: calc(var(--bo) + 6px); border-width: 2px; }
[data-kieu="hoclieu"] .trac-nghiem { background: var(--the); border: 2px solid var(--vien); }
[data-kieu="hoclieu"] .trac-nghiem .lc { border-radius: var(--bo); background: var(--the-2); transition: transform .25s var(--em), border-color .2s, background .2s; }
[data-kieu="hoclieu"] .trac-nghiem:not(.da-tra-loi) .lc:hover { transform: translateX(6px); background: color-mix(in srgb, var(--mau) 10%, var(--the-2)); }
[data-kieu="hoclieu"] .trac-nghiem .lc::before { background: color-mix(in srgb, var(--mau) 18%, var(--the)); color: var(--mau-2); }
[data-kieu="hoclieu"] .trac-nghiem .lc.la-dung { background: color-mix(in srgb, var(--dung) 16%, var(--the)); }
[data-kieu="hoclieu"] .trac-nghiem .lc.la-dung::before { background: var(--dung); color: #fff; }
[data-kieu="hoclieu"] .trac-nghiem .lc.la-sai::before { background: var(--sai); color: #fff; }
[data-kieu="hoclieu"] .trac-nghiem .lc.la-sai { background: color-mix(in srgb, var(--sai) 16%, var(--the)); }
[data-kieu="hoclieu"] .trac-nghiem .giai-thich { border-radius: var(--bo); background: color-mix(in srgb, var(--vang) 12%, var(--the)); }
[data-kieu="hoclieu"] .ghep-doi .o { border-radius: var(--bo); background: var(--the); border-width: 2px; }
[data-kieu="hoclieu"] .ghep-doi .o.chon { background: color-mix(in srgb, var(--mau) 16%, var(--the)); }
[data-kieu="hoclieu"] .the-lat .mat-truoc, [data-kieu="hoclieu"] .the-lat .mat-sau { border-radius: calc(var(--bo) + 6px); }
[data-kieu="hoclieu"] .the-lat .mat-truoc { background: linear-gradient(135deg, var(--mau-dam), var(--mau) 60%, var(--mau-2)); }
[data-kieu="hoclieu"] .the-lat .mat-sau { background: var(--the); }
[data-kieu="hoclieu"] .so-sanh .cot { background: var(--the); border-color: var(--vien); }
[data-kieu="hoclieu"] .so-sanh .cot h3 { background: linear-gradient(90deg, color-mix(in srgb, var(--mau) 26%, var(--the)), var(--the)); color: var(--mau-2); border-bottom: 2px solid var(--vien); }
[data-kieu="hoclieu"] .so-sanh .cot:nth-child(2) h3 { background: linear-gradient(90deg, color-mix(in srgb, var(--mau-2) 22%, var(--the)), var(--the)); color: var(--chu); }
[data-kieu="hoclieu"] .so-sanh .cot:nth-child(3) h3 { background: linear-gradient(90deg, color-mix(in srgb, var(--dung) 22%, var(--the)), var(--the)); color: var(--chu); }
[data-kieu="hoclieu"] .quy-trinh .buoc { background: var(--the); }
[data-kieu="hoclieu"] .quy-trinh .buoc::before { border-radius: 16px; }
[data-kieu="hoclieu"] .tab-nut { border-width: 2px; background: var(--the); }
[data-kieu="hoclieu"] .tabs .tab { background: var(--the); padding: 22px 28px; }
[data-kieu="hoclieu"] .tabs .tab > .trac-nghiem { padding: 0; border: 0; background: transparent; box-shadow: none; margin: 0; }
[data-kieu="hoclieu"] section table { margin: 0 0 .6em; border: 2px solid var(--vien); border-radius: var(--bo); background: var(--the); box-shadow: var(--bong); }
[data-kieu="hoclieu"] section th { background: linear-gradient(90deg, var(--mau), color-mix(in srgb, var(--mau) 60%, var(--mau-2))); letter-spacing: .04em; }
[data-kieu="hoclieu"] section tbody tr:nth-child(even) { background: color-mix(in srgb, var(--chu) 3%, transparent); }
[data-kieu="hoclieu"] .bieu-do .thanh { border-radius: 14px; background: var(--the); border: 2px solid var(--vien); }
[data-kieu="hoclieu"] .so-lieu { background: var(--the); border: 2px solid var(--vien); position: relative; overflow: hidden; }
[data-kieu="hoclieu"] .so-lieu::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 10px; background: var(--mau); }
[data-kieu="hoclieu"] pre.ma { border-radius: var(--bo); background: #0a0c18; border: 2px solid var(--vien); }
[data-kieu="hoclieu"] pre.ma code { background: none; border: 0; padding: 0; color: inherit; }

/* Gợi ý "hiện ý tiếp theo": sang góc dưới TRÁI (góc phải dành cho khung người giảng) */
[data-kieu="hoclieu"] .goi-y { right: auto; left: 104px; bottom: 28px; background: color-mix(in srgb, var(--the) 88%, transparent); color: var(--mau-2);
  border: 2px solid color-mix(in srgb, var(--mau) 50%, var(--vien)); font-size: 22px; box-shadow: var(--bong); }

/* Thanh điều khiển: viên thuốc nổi, dồn trái, kính mờ; tiến độ là vạch mảnh ở đáy viên */
[data-kieu="hoclieu"] .thanh-duoi { left: 16px; right: auto; bottom: 12px; height: 50px; width: max-content; max-width: calc(100% - 340px); gap: 4px; padding: 0 10px;
  border: 1px solid var(--vien); border-radius: 999px; background: color-mix(in srgb, var(--the) 90%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .3); overflow: hidden; font-size: 15px; }
[data-kieu="hoclieu"] .thanh-duoi .tien-trinh { top: auto; bottom: 0; left: 0; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--mau), var(--mau-2)); transition: width .45s var(--em); }
[data-kieu="hoclieu"] .thanh-duoi .gian { flex: 0 0 1px; align-self: stretch; margin: 12px 6px; background: var(--vien); }
[data-kieu="hoclieu"] .nut-dk { min-width: 38px; height: 38px; padding: 0 9px; border-radius: 999px; color: var(--chu); transition: background .2s var(--em), transform .2s var(--em), color .2s; }
[data-kieu="hoclieu"] .nut-dk .nhan { display: none; }
[data-kieu="hoclieu"] .nut-dk:hover { background: var(--the-2); }
[data-kieu="hoclieu"] .nut-dk[data-lenh="sau"] { background: var(--mau); color: #fff; }
[data-kieu="hoclieu"] .nut-dk[data-lenh="sau"]:hover { transform: scale(1.08); background: var(--mau); }
[data-kieu="hoclieu"] .nut-dk[aria-pressed="true"] { background: color-mix(in srgb, var(--mau) 18%, var(--the)); color: var(--mau-2); border-color: color-mix(in srgb, var(--mau) 45%, transparent); }
[data-kieu="hoclieu"] .nut-dk:focus-visible { outline: 3px solid color-mix(in srgb, var(--mau) 60%, transparent); outline-offset: 2px; }
[data-kieu="hoclieu"] .thanh-duoi .so-trang { min-width: 64px; color: var(--chu-phu); font-weight: 600; }
[data-kieu="hoclieu"] .thanh-duoi .diem { background: color-mix(in srgb, var(--dung) 18%, var(--the)); color: var(--dung); }
@media (max-width: 900px) { [data-kieu="hoclieu"] .nut-dk[data-lenh="laser"], [data-kieu="hoclieu"] .nut-dk[data-lenh="nen"], [data-kieu="hoclieu"] .nut-dk[data-lenh="tro-giup"] { display: none; } }
@media (max-width: 640px) { [data-kieu="hoclieu"] .thanh-duoi { max-width: calc(100% - 32px); } }

/* Lớp phủ khớp với dải đáy mới */
[data-kieu="hoclieu"] .tong-quan { inset: 0 0 72px 0; }
[data-kieu="hoclieu"] .khay-ghi-chu { left: 16px; right: 340px; bottom: 72px; border-radius: 18px 18px 0 0; border: 1px solid var(--vien); border-top: 3px solid var(--mau); }
[data-kieu="hoclieu"] canvas.but { height: calc(100% - 72px); }
[data-kieu="hoclieu"] .thu { border-radius: 12px; }
[data-kieu="hoclieu"] .thu .trong > section { transform: none; }
[data-kieu="hoclieu"] .tro-giup > div { border-radius: 20px; border: 1px solid var(--vien); }

/* Tiêu đề hiện chữ mượt: quét mặt nạ trái → phải kèm mờ dần (không tách từng từ) */
[data-kieu="hoclieu"] .khung > section.hien-tai > h2:not(.dau-slide):not(.ghi-chu):not(.than),
[data-kieu="hoclieu"] .khung > section.bia.hien-tai > h1:not(.dau-slide):not(.ghi-chu):not(.than) {
  -webkit-mask-image: linear-gradient(90deg, #000 45%, transparent 55%); mask-image: linear-gradient(90deg, #000 45%, transparent 55%);
  -webkit-mask-size: 260% 100%; mask-size: 260% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  animation: hlChu 1s var(--em) both; animation-delay: .08s; }
@keyframes hlChu { from { -webkit-mask-position: 100% 0; mask-position: 100% 0; opacity: .3; transform: translateY(12px); filter: blur(5px); }
  to { -webkit-mask-position: 0 0; mask-position: 0 0; opacity: 1; transform: none; filter: none; } }

/* View Transitions (Chrome/Edge/Safari mới): chỉ .khung trượt, thanh điều khiển đứng yên */
[data-kieu="hoclieu"] .khung { view-transition-name: khung-slide; }
::view-transition-group(khung-slide) { animation-duration: .6s; }
::view-transition-old(khung-slide) { animation: hlVtRa .42s cubic-bezier(.4, 0, .6, 1) both; }
::view-transition-new(khung-slide) { animation: hlVtVao .62s cubic-bezier(.22, 1, .36, 1) both; }
html[data-huong="lui"]::view-transition-old(khung-slide) { animation-name: hlVtRaLui; }
html[data-huong="lui"]::view-transition-new(khung-slide) { animation-name: hlVtVaoLui; }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .2s; }
@keyframes hlVtRa { to { opacity: 0; transform: translateX(-56px) scale(.96); } }
@keyframes hlVtVao { from { opacity: 0; transform: translateX(80px) scale(.99); } }
@keyframes hlVtRaLui { to { opacity: 0; transform: translateX(56px) scale(.96); } }
@keyframes hlVtVaoLui { from { opacity: 0; transform: translateX(-80px) scale(.99); } }
@supports (view-transition-name: a) {
  /* Đã có ảnh chụp trượt nên slide không tự chạy hiệu ứng vào/ra nữa (tránh bóng ma) */
  [data-kieu="hoclieu"] .khung > section, [data-kieu="hoclieu"] .khung > section.hien-tai { transition: none; }
  [data-kieu="hoclieu"] .khung > section.hien-tai.tien, [data-kieu="hoclieu"] .khung > section.hien-tai.lui { animation: none; }
}

[data-kieu="hoclieu"].dang-do .khung > section::before, [data-kieu="hoclieu"].dang-do .khung > section::after,
[data-kieu="hoclieu"].hep .khung > section::after { display: none; }

/* Màn hẹp (html.hep do khung tự đặt): slide rộng 860–1100 px logic, cao theo màn hình, cuộn dọc khi dài */
[data-kieu="hoclieu"].hep .khung { border-radius: 12px; }
[data-kieu="hoclieu"].hep .khung > section { padding: 92px 44px 72px; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
[data-kieu="hoclieu"].hep .dau-slide { left: 44px; right: 44px; top: 34px; font-size: 19px; }
[data-kieu="hoclieu"].hep section h2 { font-size: 1.5em; }
[data-kieu="hoclieu"].hep section.bia { padding: 0 52px; }
[data-kieu="hoclieu"].hep section.bia::before { display: none; }
[data-kieu="hoclieu"].hep section.bia h1 { font-size: 2.1em; max-width: none; }
[data-kieu="hoclieu"].hep section.chuong { padding-left: 52px; }
[data-kieu="hoclieu"].hep section.chuong h2 { font-size: 1.9em; }
[data-kieu="hoclieu"].hep section.hai-cot { display: flex; flex-direction: column; }
[data-kieu="hoclieu"].hep section.hai-cot > .cot + .cot { margin-top: .6em; }
[data-kieu="hoclieu"].hep .quy-trinh { flex-wrap: wrap; gap: 16px; }
[data-kieu="hoclieu"].hep .quy-trinh .buoc { flex: 1 1 300px; min-height: 0; padding: 86px 20px 18px; }
[data-kieu="hoclieu"].hep .quy-trinh .buoc:not(:last-child)::after { display: none; }
[data-kieu="hoclieu"].hep .so-sanh { grid-auto-flow: row; }
[data-kieu="hoclieu"].hep .ghep-doi { gap: 14px 22px; }
[data-kieu="hoclieu"].hep .luoi-the, [data-kieu="hoclieu"].hep .luoi-so { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
[data-kieu="hoclieu"].hep .the-lat { height: 260px; }
[data-kieu="hoclieu"].hep .trac-nghiem { padding: 26px 24px; }
[data-kieu="hoclieu"].hep .goi-y { left: 44px; }
[data-kieu="hoclieu"].hep section > .than > :first-child { margin-top: 0; }
@media (max-width: 480px) { [data-kieu="hoclieu"] .nut-dk[data-lenh="but"], [data-kieu="hoclieu"] .nut-dk[data-lenh="ghi-chu"] { display: none; } }
`;
/* HẾT CSS_HOC_LIEU */

/**
 * anThanhDuoi: trang cha có dải điều khiển riêng (lệnh "nut"/"tien"/"lui"), nên ẩn thanh đáy và cho sân khấu dùng cả chỗ đó.
 * Chỉ giữ vạch tiến độ mảnh ở mép dưới. Phím tắt vẫn chạy. Đặt sau CSS_HOC_LIEU, độ đặc hiệu html[...] để thắng cả hai kiểu.
 */
const CSS_AN_THANH = `
html[data-an-thanh] .san-khau { inset: 0; }
html[data-an-thanh] .khung { border-radius: 0; box-shadow: none; }
/* Trình chiếu toàn khung: slide liền một màu với vùng xung quanh, không viền thẻ và không quầng sáng bị cắt lộ cạnh. */
html[data-an-thanh] .san-khau, html[data-an-thanh] .khung > section { background: var(--nen); }
html[data-an-thanh] .khung > section::before, html[data-an-thanh] .khung > section::after { display: none; }
html[data-an-thanh] .thanh-duoi { left: 0; right: 0; bottom: 0; top: auto; width: auto; max-width: none; height: 3px; padding: 0; border: 0; border-radius: 0;
  background: transparent; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; overflow: visible; pointer-events: none; }
html[data-an-thanh] .thanh-duoi > :not(.tien-trinh) { display: none !important; }
html[data-an-thanh] .thanh-duoi .tien-trinh { top: 0; bottom: auto; height: 3px; border-radius: 0 3px 3px 0; }
html[data-an-thanh] .tong-quan { inset: 0; }
html[data-an-thanh] .khay-ghi-chu { bottom: 0; }
html[data-an-thanh] canvas.but { height: 100%; }
`;

/** Chỉnh nhỏ cho công thức KaTeX trong slide (sau CSS gốc của KaTeX). */
const CSS_KATEX_KHUNG = `
section .katex { font-size: 1.12em; }
section .katex svg { max-width: none; }
section .katex-display { margin: .35em 0 .55em; overflow-x: auto; overflow-y: hidden; }
section .katex-error { font-family: var(--mono); font-size: .8em; }
section .katex-dinh { white-space: nowrap; }
.thu .katex-display { overflow: hidden; }
`;

/* ───────────────────────────── Mã chạy trong iframe ───────────────────────────── */

/**
 * Hàm này được chuyển thành chuỗi (toString) rồi nhúng vào tài liệu iframe, nên PHẢN tự đủ:
 * không được dùng biến ngoài phạm vi hàm.
 */
/* global __T */
function chayKhung() {
  var $ = function (s, g) { return (g || document).querySelector(s); };
  var $$ = function (s, g) { return Array.prototype.slice.call((g || document).querySelectorAll(s)); };
  var khung = $(".khung");
  var dsSlide = $$(".khung > section");
  var n = dsSlide.length;
  var hien = -1;
  var diem = { dung: 0, tong: 0 };
  var tieuDe = document.title || "";
  var gui = function (o) {
    try { parent.postMessage(Object.assign({ smartdocSlide: true }, o), "*"); } catch { /* không có cha */ }
  };
  // Báo sự kiện học tập (trả lời trắc nghiệm, ghép đôi, xem đáp án) lên trang cha. Trang cha kiểm lại lược đồ,
  // tự gắn bài/học phần rồi mới ghi — khung này chỉ nói "điều gì xảy ra ở đâu", không quyết định ai hay bài nào.
  var baoSuKien = function (loai, id, ketQua, chiTiet, ms) {
    try {
      parent.postMessage({ type: "smartdoc-su-kien", loai: loai, doiTuongId: id, ketQua: ketQua, thoiGianMs: ms, chiTiet: chiTiet }, "*");
    } catch (e) { /* không có cha */ }
  };
  var tron = function (a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var phao = function (soLuong) {
    var mau = ["#f2b632", "#2f80ed", "#1f9d62", "#d64545", "#9775fa", "#ff922b"];
    for (var i = 0; i < (soLuong || 36); i++) {
      var d = document.createElement("i");
      d.className = "phao";
      d.style.left = Math.random() * 100 + "vw";
      d.style.background = mau[i % mau.length];
      d.style.animationDelay = Math.random() * 0.5 + "s";
      d.style.animationDuration = 1.4 + Math.random() * 1.3 + "s";
      document.body.appendChild(d);
      setTimeout(function (x) { x.remove(); }, 3600, d);
    }
  };

  /* ── Tô màu mã ── */
  var TU_KHOA = {
    python: "and as assert async await break class continue def del elif else except finally for from global if import in is lambda not or pass raise return try while with yield None True False self",
    js: "async await break case catch class const continue default else export extends finally for function if import in instanceof let new null of return static super switch this throw try typeof undefined var void while yield true false",
    java: "abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while true false",
    c: "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while NULL include define",
    sql: "select from where group by order having insert into values update set delete create table alter drop join inner left right outer on as and or not null in like limit distinct count sum avg min max primary key foreign references index union all case when then else end",
    css: "", html: ""
  };
  var tuoMau = function (ma, nn) {
    nn = (nn || "").toLowerCase();
    if (nn === "javascript" || nn === "ts" || nn === "typescript") nn = "js";
    if (nn === "py") nn = "python";
    if (nn === "cpp" || nn === "c++" || nn === "csharp" || nn === "c#") nn = "java";
    var tk = {};
    (TU_KHOA[nn] || "").split(" ").forEach(function (w) { if (w) tk[nn === "sql" ? w : w] = 1; });
    var loai = nn === "sql";
    var re = nn === "html"
      ? /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[a-zA-Z][\w-]*)|("[^"]*"|'[^']*')|(\b[a-zA-Z-]+(?==))|(&gt;)/g
      : nn === "css"
        ? /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(\b\d[\d.]*(?:px|em|rem|%|vh|vw|s|ms)?\b|#[0-9a-fA-F]{3,8}\b)|([a-z-]+(?=\s*:))|([.#][a-zA-Z_][\w-]*)/g
        : /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`)|(\b\d[\d_.]*\b)|([A-Za-z_]\w*(?=\())|([A-Za-z_]\w*)/g;
    var vao = esc(ma);
    return vao.replace(re, function (m, a, b, c, d, e) {
      if (nn === "html") {
        if (a) return '<span class="tc">' + m + "</span>";
        if (b) return '<span class="tk">' + m + "</span>";
        if (c) return '<span class="ts">' + m + "</span>";
        if (d) return '<span class="tn">' + m + "</span>";
        return m;
      }
      if (nn === "css") {
        if (a) return '<span class="tc">' + m + "</span>";
        if (b) return '<span class="ts">' + m + "</span>";
        if (c) return '<span class="tn">' + m + "</span>";
        if (d) return '<span class="th">' + m + "</span>";
        return '<span class="tk">' + m + "</span>";
      }
      if (a) {
        if (nn === "python" || nn === "sql") { if (m.charAt(0) === "/") return m; }
        if (nn !== "python" && nn !== "sql" && m.charAt(0) === "#" && nn !== "c") return m;
        return '<span class="tc">' + m + "</span>";
      }
      if (b) return '<span class="ts">' + m + "</span>";
      if (c) return '<span class="tn">' + m + "</span>";
      if (d) return tk[loai ? d.toLowerCase() : d] ? '<span class="tk">' + m + "</span>" : '<span class="th">' + m + "</span>";
      if (e) return tk[loai ? e.toLowerCase() : e] ? '<span class="tk">' + m + "</span>" : m;
      return m;
    });
  };

  /* ── Dựng thành phần trong từng slide ── */
  var dungSlide = function (s, k) {
    if (!s.classList.contains("bia")) {
      var dau = document.createElement("div");
      dau.className = "dau-slide";
      dau.innerHTML = "<span>" + esc(tieuDe) + "</span><b>" + (k + 1) + " / " + n + "</b>";
      s.insertBefore(dau, s.firstChild);
    }

    // Thân slide: mọi thứ sau tiêu đề được bọc lại để căn giữa theo chiều dọc
    if (!/\b(bia|chuong|hai-cot)\b/.test(s.className)) {
      var than = document.createElement("div");
      than.className = "than";
      var dung = false;
      Array.prototype.slice.call(s.children).forEach(function (c) {
        if (c.classList.contains("dau-slide")) return;
        if (!dung && (/^H[12]$/.test(c.tagName) || c.classList.contains("phu-de"))) return;
        dung = true;
        than.appendChild(c);
      });
      if (than.children.length) s.appendChild(than);
    }

    var o = 0;
    var dsAnim = [];
    Array.prototype.forEach.call(s.children, function (c) {
      if (c.classList.contains("than")) Array.prototype.forEach.call(c.children, function (x) { dsAnim.push(x); });
      else dsAnim.push(c);
    });
    dsAnim.forEach(function (c) { c.style.setProperty("--i", o++); });

    // Hiện dần
    var ds = [];
    $$(".hien, ul.hien-dan > li, ol.hien-dan > li, .quy-trinh > .buoc, .so-sanh > .cot", s).forEach(function (e) {
      if (ds.indexOf(e) < 0) ds.push(e);
    });
    ds.forEach(function (e) { e.classList.add("an-buoc"); });
    s._b = { ds: ds, da: 0 };

    // Thẻ lật
    $$(".the-lat", s).forEach(function (t) {
      t.setAttribute("tabindex", "0");
      t.setAttribute("role", "button");
      var lat = function () { t.classList.toggle("lat"); };
      t.addEventListener("click", lat);
      t.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.stopPropagation(); lat(); } });
    });

    // Trắc nghiệm
    $$(".trac-nghiem", s).forEach(function (q, qi) {
      var lcs = $$(".lc", q);
      var dung = lcs.filter(function (b) { return b.classList.contains("dung"); })[0];
      // Bọc nội dung nút vào một span: nút là flex, nếu không bọc thì chữ và công thức/thẻ <b> bên trong bị tách thành
      // nhiều mục flex cách nhau 20px.
      lcs.forEach(function (b) {
        if (b.querySelector(":scope > .nd-lc")) return;
        var nd = document.createElement("span");
        nd.className = "nd-lc";
        while (b.firstChild) nd.appendChild(b.firstChild);
        b.appendChild(nd);
      });
      lcs.forEach(function (b) {
        b.addEventListener("click", function () {
          if (q.classList.contains("da-tra-loi")) return;
          q.classList.add("da-tra-loi");
          diem.tong++;
          // Phản hồi riêng của lựa chọn (data-phan-hoi, cả cho nút đúng): hiện ngay dưới câu hỏi.
          var ph = b.getAttribute("data-phan-hoi");
          if (ph) {
            var o = document.createElement("div");
            o.className = "phan-hoi" + (dung ? (b === dung ? " dung" : " sai") : "");
            o.textContent = ph.slice(0, 300);
            var cau = $(".cau", q);
            if (cau && cau.parentNode === q) q.insertBefore(o, cau.nextSibling); else q.insertBefore(o, q.firstChild);
          }
          if (dung) {
            dung.classList.add("la-dung");
            if (b === dung) { diem.dung++; phao(28); } else b.classList.add("la-sai");
            baoSuKien("QUIZ_TRA_LOI", "s" + (k + 1) + "-q" + (qi + 1), b === dung ? "DUNG" : "SAI",
              { chon: lcs.indexOf(b) + 1, gt: b.getAttribute("data-gt") || "",
                // data-kiem đặt ở .trac-nghiem; bộ cũ đặt trên từng nút thì lấy của nút đã chọn, rồi của nút đúng.
                kiem: q.getAttribute("data-kiem") || b.getAttribute("data-kiem") || dung.getAttribute("data-kiem") || "" },
              Date.now() - (s._vao || Date.now()));
          }
          capNhatDiem();
        });
      });
    });

    // Ghép đôi
    $$(".ghep-doi", s).forEach(function (g, gi) {
      var caps = $$(".cap", g).map(function (c) {
        var a = $(".a", c), b = $(".b", c);
        return { a: a ? a.innerHTML : "", b: b ? b.innerHTML : "" };
      });
      if (caps.length < 2) return;
      g.innerHTML = "";
      var xong = 0, nham = 0;
      var mauCap = ["#0b4ea2", "#6741d9", "#0b7a5a", "#d9480f", "#c2255c", "#1c7ed6"];
      var tienDo = document.createElement("div");
      tienDo.className = "tien-do";
      var cotA = document.createElement("div"), cotB = document.createElement("div");
      [cotA, cotB].forEach(function (c) { c.style.display = "grid"; c.style.gap = "14px"; c.style.alignContent = "start"; });
      var oA = [], oB = [];
      caps.forEach(function (c, i) {
        var e = document.createElement("button");
        e.className = "o"; e.innerHTML = c.a; e.dataset.k = i; oA.push(e);
        var f = document.createElement("button");
        f.className = "o"; f.innerHTML = c.b; f.dataset.k = i; oB.push(f);
      });
      oA.forEach(function (e) { cotA.appendChild(e); });
      tron(oB.slice()).forEach(function (e) { cotB.appendChild(e); });
      g.appendChild(cotA); g.appendChild(cotB); g.appendChild(tienDo);
      var capNhat = function () { tienDo.textContent = __T.ghepHuongDan.replace("{a}", xong).replace("{b}", caps.length); };
      capNhat();
      var chonA = null;
      var xuLy = function (e, ben) {
        if (e.classList.contains("xong")) return;
        if (ben === "a") {
          oA.forEach(function (x) { x.classList.remove("chon"); });
          chonA = e; e.classList.add("chon");
          return;
        }
        if (!chonA) { nham++; e.classList.add("sai"); setTimeout(function () { e.classList.remove("sai"); }, 450); return; }
        if (chonA.dataset.k === e.dataset.k) {
          var mau = mauCap[+e.dataset.k % mauCap.length];
          [chonA, e].forEach(function (x) { x.classList.remove("chon"); x.classList.add("xong"); x.style.background = mau; });
          chonA = null; xong++; capNhat();
          if (xong === caps.length) {
            tienDo.textContent = __T.ghepXong; phao(40);
            // Ghép đúng hết ngay lần đầu = DUNG; có nhầm = SAI (số lần nhầm trong chi tiết).
            baoSuKien("GHEP_DOI", "s" + (k + 1) + "-g" + (gi + 1), nham === 0 ? "DUNG" : "SAI",
              { cap: caps.length, nham: nham }, Date.now() - (s._vao || Date.now()));
          }
        } else {
          nham++;
          e.classList.add("sai"); chonA.classList.add("sai");
          var a = chonA; chonA = null;
          setTimeout(function () { e.classList.remove("sai"); a.classList.remove("sai", "chon"); }, 500);
        }
      };
      oA.forEach(function (e) { e.addEventListener("click", function () { xuLy(e, "a"); }); });
      oB.forEach(function (e) { e.addEventListener("click", function () { xuLy(e, "b"); }); });
    });

    // Tab
    $$(".tabs", s).forEach(function (t) {
      var ds2 = $$(":scope > .tab", t);
      if (!ds2.length) return;
      var thanh = document.createElement("div");
      thanh.className = "tab-thanh";
      ds2.forEach(function (p, i) {
        var b = document.createElement("button");
        b.className = "tab-nut"; b.textContent = p.getAttribute("data-ten") || __T.tab + " " + (i + 1);
        b.addEventListener("click", function () {
          ds2.forEach(function (x, j) { x.classList.toggle("dang", i === j); });
          $$(".tab-nut", thanh).forEach(function (x, j) { x.classList.toggle("dang", i === j); });
        });
        thanh.appendChild(b);
      });
      t.insertBefore(thanh, t.firstChild);
      thanh.children[0].click();
    });

    // Bấm để xem
    $$(".bam-de-xem", s).forEach(function (b, bi) {
      var nd = document.createElement("div");
      nd.className = "nd";
      while (b.firstChild) nd.appendChild(b.firstChild);
      b.appendChild(nd);
      var nut = document.createElement("button");
      nut.className = "nut-xem"; nut.textContent = b.getAttribute("data-nhan") || __T.xemDapAn;
      nut.addEventListener("click", function () {
        if (!b.classList.contains("mo")) baoSuKien("SLIDE_XEM", "s" + (k + 1) + "-x" + (bi + 1), "MO", { kieu: "dap-an" }, Date.now() - (s._vao || Date.now()));
        b.classList.add("mo");
      });
      b.appendChild(nut);
    });

    // Biểu đồ
    $$(".bieu-do .thanh", s).forEach(function (t) {
      var v = Math.max(0, Math.min(100, parseFloat(t.getAttribute("data-gia-tri")) || 0));
      t.style.setProperty("--gt", v + "%");
      var em = document.createElement("em");
      em.textContent = v + "%";
      t.appendChild(em);
    });

    // Mã nguồn
    $$("pre.ma", s).forEach(function (p) {
      var code = p.textContent.replace(/^\n+|\s+$/g, "");
      var nn = p.getAttribute("data-ngon-ngu") || "";
      p.innerHTML = '<i class="cham"></i><code>' + tuoMau(code, nn) + "</code>";
      var sao = document.createElement("button");
      sao.className = "sao"; sao.textContent = __T.chep;
      sao.addEventListener("click", function () {
        var xong = function () { sao.textContent = __T.daChep; setTimeout(function () { sao.textContent = __T.chep; }, 1400); };
        try { navigator.clipboard.writeText(code).then(xong, function () { sao.textContent = __T.khongChep; }); } catch { sao.textContent = __T.khongChep; }
      });
      p.appendChild(sao);
    });
  };

  var goc = document.documentElement;
  var laHocLieu = goc.getAttribute("data-kieu") === "hoclieu";
  var giamDong = function () { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  var chiDang = null, datChi = function () {};
  dsSlide.forEach(function (s) {
    s.addEventListener("scroll", function () {
      // Màn hẹp (kiểu hoclieu): slide được cuộn dọc; còn lại khoá cuộn như cũ.
      if (goc.classList.contains("hep")) { s.scrollLeft = 0; if (chiDang) datChi(chiDang); return; }
      s.scrollLeft = 0; s.scrollTop = 0;
    });
  });
  // Co tới cỡ nhỏ nhất mà vẫn tràn (ví dụ trắc nghiệm trong tab sau khi hiện giải thích): cho tab đang mở — hoặc khối cao
  // nhất của thân slide — cuộn bên trong thay vì bị cắt đáy.
  var boCuonTrong = function (s) {
    $$(".cuon-trong", s).forEach(function (e) { e.classList.remove("cuon-trong"); e.style.maxHeight = ""; });
  };
  var cuonTrong = function (s) {
    var du = s.scrollHeight - s.clientHeight;
    if (du <= 2) return;
    var ds = $$(".tab.dang", s);
    if (!ds.length) {
      var than = $(":scope > .than", s) || s, lon = null;
      Array.prototype.forEach.call(than.children, function (c) {
        if (/\b(dau-slide|ghi-chu|than)\b/.test(c.className) || /^H[1-3]$/.test(c.tagName)) return;
        if (!lon || c.offsetHeight > lon.offsetHeight) lon = c;
      });
      if (lon) ds = [lon];
    }
    ds.forEach(function (e) { e.style.maxHeight = Math.max(160, e.offsetHeight - du - 8) + "px"; e.classList.add("cuon-trong"); });
  };
  var vuaKhung = function (s) {
    var co = 36, thapNhat = goc.classList.contains("hep") ? 28 : 20;
    // Kiểu hoclieu: tắt quầng trang trí (::before/::after nằm tràn ra ngoài slide) khi đo, kẻo scrollHeight tính cả chúng
    // và thu nhỏ chữ bìa xuống 20px. (Kiểu mặc định giữ nguyên hành vi cũ.)
    if (laHocLieu) goc.classList.add("dang-do");
    goc.classList.add("dang-co");
    boCuonTrong(s);
    s.style.fontSize = co + "px";
    while (s.scrollHeight > s.clientHeight + 2 && co > thapNhat) { co -= 1; s.style.fontSize = co + "px"; }
    if (!goc.classList.contains("hep")) cuonTrong(s);
    if (laHocLieu) goc.classList.remove("dang-do");
    void s.offsetHeight;
    goc.classList.remove("dang-co");
  };

  // Nội dung của slide có thể dài ra sau tương tác (giải thích trắc nghiệm, phản hồi, đổi tab, gợi ý của thành phần Toán):
  // nếu tràn thì co chữ lại cho vừa, kẻo phần cuối bị cắt mất. Màn hẹp thì đã cho cuộn nên bỏ qua.
  var kiemTran = function () {
    var s = dsSlide[hien];
    if (!s || goc.classList.contains("hep")) return;
    if (s.scrollHeight > s.clientHeight + 2) vuaKhung(s);
  };
  ["click", "keyup", "change"].forEach(function (ten) {
    document.addEventListener(ten, function () { setTimeout(kiemTran, 60); setTimeout(kiemTran, 700); }, true);
  });

  var chay = function (s) {
    $$(".bieu-do .thanh", s).forEach(function (t) { t.classList.remove("chay"); void t.offsetWidth; setTimeout(function () { t.classList.add("chay"); }, 250); });
    $$(".so-lieu b[data-dem]", s).forEach(function (b) {
      var dich = parseFloat(b.getAttribute("data-dem")) || 0;
      var t0 = null;
      var buoc = function (t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / 1100);
        var v = dich * (1 - Math.pow(1 - p, 3));
        b.textContent = (dich % 1 ? v.toFixed(1) : Math.round(v)).toString();
        if (p < 1) requestAnimationFrame(buoc); else b.textContent = b.getAttribute("data-dem");
      };
      requestAnimationFrame(buoc);
    });
  };

  /* ── Điều hướng ── */
  var soTrang = $(".so-trang"), tienTrinh = $(".tien-trinh"), khay = $(".khay-ghi-chu"), nut = {};
  var capNhatDiem = function () {
    var d = $(".diem");
    if (!d) return;
    d.classList.toggle("co", diem.tong > 0);
    d.textContent = "★ " + diem.dung + "/" + diem.tong;
    gui({ loai: "diem", dung: diem.dung, tong: diem.tong });
  };
  var veGhiChu = function () {
    var a = $(".ghi-chu", dsSlide[hien]);
    khay.innerHTML = "<b>" + esc(__T.ghiChuTieuDe) + "</b>" + (a && a.textContent.trim() ? esc(a.textContent.trim()) : "<i>" + esc(__T.chuaGhiChu) + "</i>");
  };
  var xoaBut = function () {
    var cv = $("canvas.but"); cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  };
  var goiY = $(".goi-y");
  var capNhatGoiY = function () {
    var b = dsSlide[hien] && dsSlide[hien]._b;
    goiY.classList.toggle("co", Boolean(b && b.da < b.ds.length));
  };
  // Giao thức với trang cha (docs/demo-toan10/HOP-DONG.md, mục 4): "trang" khi vào slide, "buoc" mỗi khi số bước đã hiện
  // đổi (và ngay sau "trang"), "san-sang" khi dựng xong.
  var buocDaBao = "";
  var baoBuoc = function () {
    var b = dsSlide[hien] && dsSlide[hien]._b;
    if (!b) return;
    var khoa = hien + ":" + b.da;
    if (khoa !== buocDaBao) { boChi(); buocDaBao = khoa; }
    gui({ loai: "buoc", i: hien, b: b.da, nb: b.ds.length });
  };
  var datBuoc = function (b, soBuoc) {
    b.da = Math.max(0, Math.min(b.ds.length, Math.floor(Number(soBuoc)) || 0));
    b.ds.forEach(function (e, i) { e.classList.toggle("da-hien", i < b.da); });
  };
  var den = function (k, huong, hetBuoc, soBuoc) {
    k = Math.max(0, Math.min(n - 1, k));
    if (k === hien) return;
    var dauTien = hien < 0;
    boChi();
    hien = k;
    var s = dsSlide[k];
    s._vao = Date.now();
    var doi = function () {
      dsSlide.forEach(function (x) { if (x !== s) x.classList.remove("hien-tai", "tien", "lui"); });
      s.classList.remove("tien", "lui");
      void s.offsetWidth;
      s.classList.add("hien-tai", huong < 0 ? "lui" : "tien");
    };
    // Kiểu hoclieu: chuyển slide bằng View Transitions khi trình duyệt có (ảnh cũ trượt ra, ảnh mới trượt vào), không thì như cũ.
    if (laHocLieu && !dauTien && typeof document.startViewTransition === "function" && !giamDong() && document.visibilityState === "visible") {
      goc.setAttribute("data-huong", huong < 0 ? "lui" : "tien");
      try {
        var vt = document.startViewTransition(doi);
        // Bấm nhanh liên tiếp thì lượt cũ bị bỏ qua: nuốt các promise bị từ chối cho khỏi báo lỗi "Uncaught (in promise)".
        var nuot = function () { /* bỏ qua */ };
        [vt.ready, vt.finished, vt.updateCallbackDone].forEach(function (p) { if (p && p.catch) p.catch(nuot); });
        // Chốt chặn: khung bị ẩn/tiết kiệm khung hình thì chuyển cảnh có thể treo, để lại hai slide chồng nhau — bỏ qua sau 1,2 giây.
        var xong = false;
        if (vt.finished && vt.finished.then) vt.finished.then(function () { xong = true; }, function () { xong = true; });
        setTimeout(function () { if (!xong && vt.skipTransition) { try { vt.skipTransition(); } catch { /* đã xong */ } } }, 1200);
      } catch { doi(); }
    } else doi();
    // Nội dung có thể đã cao lên sau lần co chữ lúc mở (phông tải muộn, thành phần dựng chậm): đo lại khi vào slide.
    setTimeout(kiemTran, 80); setTimeout(kiemTran, 900);
    // Chốt chặn: nếu dòng thời gian hoạt ảnh bị treo (khung/tab bị ẩn, Chromium tiết kiệm) thì nội dung đứng mãi ở trạng thái
    // "from" (opacity 0) của hiệu ứng vào. Sau 2 giây cho các hiệu ứng vào của khung về trạng thái cuối.
    setTimeout(function () {
      if (hien !== k || !s.getAnimations) return;
      try {
        s.getAnimations({ subtree: true }).forEach(function (a) {
          if (/^(len|hlLen|hlChu|hlMoc|vaoPhai|vaoTrai|hlVaoPhai|hlVaoTrai)$/.test(a.animationName || "")) a.finish();
        });
      } catch { /* trình duyệt cũ */ }
    }, 2000);
    var b = s._b;
    datBuoc(b, typeof soBuoc === "number" ? soBuoc : hetBuoc ? b.ds.length : 0);
    soTrang.textContent = (k + 1) + " / " + n;
    tienTrinh.style.width = (n > 1 ? (k / (n - 1)) * 100 : 100) + "%";
    veGhiChu(); xoaBut(); chay(s); capNhatGoiY();
    gui({ loai: "trang", i: k, n: n, nb: b.ds.length });
    baoBuoc();
    try { history.replaceState(null, "", "#" + (k + 1)); } catch { /* sandbox */ }
  };
  var tien = function () {
    var s = dsSlide[hien], b = s._b;
    if (b.da < b.ds.length) { b.ds[b.da].classList.add("da-hien"); b.da++; capNhatGoiY(); baoBuoc(); return; }
    den(hien + 1, 1, false);
  };
  var lui = function () {
    var s = dsSlide[hien], b = s._b;
    if (b.da > 0) { b.da--; b.ds[b.da].classList.remove("da-hien"); capNhatGoiY(); baoBuoc(); return; }
    den(hien - 1, -1, true);
  };

  /* ── Tổng quan, ghi chú, trợ giúp, bút, laser ── */
  var tongQuan = $(".tong-quan"), troGiup = $(".tro-giup");
  var dungTongQuan = function () {
    var luoi = $(".luoi", tongQuan);
    luoi.innerHTML = "";
    dsSlide.forEach(function (s, k) {
      var t = document.createElement("button");
      t.className = "thu" + (k === hien ? " dang" : "");
      var trong = document.createElement("div");
      trong.className = "trong";
      var ban = s.cloneNode(true);
      ban.classList.add("hien-tai");
      ban.classList.remove("tien", "lui");
      trong.appendChild(ban);
      t.appendChild(trong);
      var so = document.createElement("span"); so.className = "so"; so.textContent = k + 1; t.appendChild(so);
      t.addEventListener("click", function () { batTat("tong-quan", false); den(k, k > hien ? 1 : -1, false); });
      luoi.appendChild(t);
      requestAnimationFrame(function () { trong.style.transform = "scale(" + t.clientWidth / 1600 + ")"; });
    });
    document.body.classList.add("tat-ca");
  };
  // Trạng thái các nút bật/tắt, báo lên trang cha (dải điều khiển của trang thay cho thanh đáy khi anThanhDuoi).
  // "nen" = true khi đang nền tối.
  var nutDaBao = "";
  var baoNut = function (epBuoc) {
    var tt = {
      "tong-quan": tongQuan.classList.contains("mo"), "ghi-chu": khay.classList.contains("mo"),
      but: document.body.classList.contains("dang-but"), laser: document.body.classList.contains("dang-laser"),
      nen: document.documentElement.getAttribute("data-theme") === "toi", "tro-giup": troGiup.classList.contains("mo")
    };
    var khoa = JSON.stringify(tt);
    if (khoa === nutDaBao && !epBuoc) return;
    nutDaBao = khoa;
    gui({ loai: "nut", trangThai: tt });
  };
  var batTat = function (ten, bat) {
    var cac = { "tong-quan": tongQuan, "ghi-chu": khay, "tro-giup": troGiup };
    var e = cac[ten];
    var moi = typeof bat === "boolean" ? bat : !e.classList.contains("mo");
    e.classList.toggle("mo", moi);
    if (nut[ten]) nut[ten].setAttribute("aria-pressed", moi ? "true" : "false");
    if (ten === "tong-quan") { if (moi) dungTongQuan(); else document.body.classList.remove("tat-ca"); }
    baoNut();
  };
  var but = $("canvas.but"), ctx = but.getContext("2d"), ve = false, dangVe = false, tx = 0, ty = 0;
  var canhBut = function () { var r = but.getBoundingClientRect(); but.width = r.width; but.height = r.height; };
  var batBut = function (b) {
    ve = typeof b === "boolean" ? b : !ve;
    document.body.classList.toggle("dang-but", ve);
    nut.but.setAttribute("aria-pressed", ve ? "true" : "false");
    if (ve) { document.body.classList.remove("dang-laser"); nut.laser.setAttribute("aria-pressed", "false"); }
    baoNut();
  };
  but.addEventListener("pointerdown", function (e) { if (!ve) return; dangVe = true; var r = but.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; but.setPointerCapture(e.pointerId); });
  but.addEventListener("pointermove", function (e) {
    if (!dangVe) return;
    var r = but.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    ctx.strokeStyle = "#e8590c"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); tx = x; ty = y;
  });
  but.addEventListener("pointerup", function () { dangVe = false; });
  var laser = $(".laser");
  window.addEventListener("pointermove", function (e) { laser.style.left = e.clientX + "px"; laser.style.top = e.clientY + "px"; });
  var batLaser = function () {
    var b = !document.body.classList.contains("dang-laser");
    document.body.classList.toggle("dang-laser", b);
    nut.laser.setAttribute("aria-pressed", b ? "true" : "false");
    if (b) batBut(false);
    baoNut();
  };
  var doiNen = function () {
    var r = document.documentElement;
    var toi = r.getAttribute("data-theme") !== "toi";
    if (toi) r.setAttribute("data-theme", "toi"); else r.removeAttribute("data-theme");
    nut.nen.setAttribute("aria-pressed", toi ? "true" : "false");
    baoNut();
  };

  /* ── Co giãn sân khấu ── */
  // Kiểu hoclieu trên màn hẹp (điện thoại, máy tính bảng dọc): sân khấu không còn cố định 16:9 mà rộng 860–1100 px logic,
  // cao theo màn hình, chữ ≥ 28px logic (≈ 16px thật trở lên) và cho cuộn dọc — thay vì thu cả slide 1600×900 xuống chữ 9px.
  var kichCu = "", henVua = null;
  var canh = function () {
    var sk = $(".san-khau"), r = sk.getBoundingClientRect();
    var w = r.width - 24, h = r.height - 24, rong = 1600, cao = 900;
    var t = Math.min(w / 1600, h / 900);
    var hep = false;
    if (laHocLieu && w > 0 && h > 0 && (t < 0.45 || h > w)) {
      hep = true;
      // dọc: rộng logic 860 (điện thoại) / 1100 (máy tính bảng) nhưng luôn để tỉ lệ ≥ 0,46 (chữ 36px logic ≈ 16,5px thật)
      if (h > w) { rong = Math.min(w < 600 ? 860 : 1100, w / 0.46); t = w / rong; } else { t = 0.46; rong = Math.max(1200, w / t); }
      cao = Math.max(400, h / t);
    }
    goc.classList.toggle("hep", hep);
    khung.style.width = hep ? rong + "px" : "";
    khung.style.height = hep ? cao + "px" : "";
    khung.style.transform = "translate(" + (-rong / 2 * t) + "px, " + (-cao / 2 * t) + "px) scale(" + t + ")";
    canhBut();
    var kich = Math.round(rong) + "x" + Math.round(cao);
    if (kich !== kichCu) {
      var lanDau = !kichCu;
      kichCu = kich;
      if (!lanDau) { clearTimeout(henVua); henVua = setTimeout(function () { dsSlide.forEach(vuaKhung); if (chiDang) datChi(chiDang); }, 120); }
    }
  };

  /* ── Chỉ vào bảng (lệnh "chi" của trang cha) ── */
  // Vầng sáng màu nhấn quanh phần tử [data-chi="ten"] của slide hiện tại, gạch chân vẽ dần, con trỏ tròn trượt tới rồi
  // lướt theo gạch chân. Gỡ khi ten rỗng hoặc sang bước/slide khác. Lớp phủ nằm trong .khung (toạ độ logic của slide).
  var NS = "http://www.w3.org/2000/svg";
  var chiSang = document.createElement("div");
  chiSang.className = "chi-sang";
  var chiGach = document.createElementNS(NS, "svg");
  chiGach.setAttribute("class", "chi-gach");
  chiGach.setAttribute("aria-hidden", "true");
  var chiDuong = document.createElementNS(NS, "path");
  chiDuong.setAttribute("pathLength", "1");
  chiGach.appendChild(chiDuong);
  var chiTro = document.createElement("div");
  chiTro.className = "chi-tro";
  [chiSang, chiGach, chiTro].forEach(function (x) { khung.appendChild(x); });
  var chiHen = [], chiDiem = null, chiDaDi = false;
  var boChi = function () {
    chiDang = null;
    chiHen.forEach(clearTimeout); chiHen = [];
    khung.classList.remove("dang-chi");
    chiGach.classList.remove("ve");
    chiTro.classList.remove("hien", "di");
  };
  var viTri = function (el) {
    var kr = khung.getBoundingClientRect(), r = el.getBoundingClientRect(), t = kr.width / (khung.offsetWidth || 1600);
    return { x: (r.left - kr.left) / t, y: (r.top - kr.top) / t, w: r.width / t, h: r.height / t };
  };
  var datTro = function (x, y) { chiTro.style.transform = "translate(" + x + "px, " + y + "px)"; };
  datChi = function (el) {
    var p = viTri(el), dem = 12, w = Math.max(24, p.w);
    chiSang.style.left = p.x - dem + "px"; chiSang.style.top = p.y - dem + "px";
    chiSang.style.width = p.w + 2 * dem + "px"; chiSang.style.height = p.h + 2 * dem + "px";
    chiGach.style.left = p.x + "px"; chiGach.style.top = p.y + p.h + 2 + "px"; chiGach.style.width = w + "px";
    chiGach.setAttribute("viewBox", "0 0 " + w + " 16");
    chiDuong.setAttribute("d", "M3 9 Q " + w * 0.25 + " 4, " + w * 0.5 + " 8 T " + (w - 3) + " 7");
    chiDiem = p;
    if (chiDaDi) datTro(p.x + w, p.y + p.h + 9);
    return p;
  };
  var chi = function (ten) {
    var tuCu = chiTro.classList.contains("hien");
    boChi();
    ten = String(ten || "");
    var s = dsSlide[hien];
    if (!ten || !s) return;
    var el = null;
    $$("[data-chi]", s).some(function (x) { if (x.getAttribute("data-chi") === ten) { el = x; return true; } return false; });
    if (!el) return;
    // Phần tử chưa tới bước hiện dần, hoặc đang bị ẩn (tab khác, display:none) thì bỏ qua.
    var an = el.closest(".an-buoc");
    if ((an && !an.classList.contains("da-hien")) || !el.getClientRects().length) return;
    if (goc.classList.contains("hep") && el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest", behavior: giamDong() ? "auto" : "smooth" }); } catch { /* cũ */ } }
    chiDang = el; chiDaDi = false;
    var p = datChi(el);
    if (!tuCu) {
      // Con trỏ xuất hiện ở góc dưới trái slide rồi mới trượt tới (lần đầu hoặc sau khi đã gỡ).
      chiTro.style.transition = "none";
      datTro(60, (khung.offsetHeight || 900) - 70);
      void chiTro.offsetWidth;
      chiTro.style.transition = "";
    }
    chiTro.classList.add("hien");
    khung.classList.add("dang-chi");
    datTro(p.x, p.y + p.h + 9);
    chiHen.push(setTimeout(function () {
      if (chiDang !== el) return;
      chiGach.classList.add("ve");
      chiTro.classList.add("di");
      chiDaDi = true;
      datTro(chiDiem.x + Math.max(24, chiDiem.w), chiDiem.y + chiDiem.h + 9);
    }, giamDong() ? 0 : 420));
    // Phần tử có thể còn đang trượt vào (hiệu ứng vào slide, công thức vừa có phông): đo lại vài lần.
    [250, 700, 1300].forEach(function (ms) { chiHen.push(setTimeout(function () { if (chiDang === el) datChi(el); }, ms)); });
  };

  /* ── Khởi tạo ── */
  dsSlide.forEach(dungSlide);
  var dsNut = $$(".nut-dk[data-lenh]");
  dsNut.forEach(function (b) { nut[b.getAttribute("data-lenh")] = b; });
  var lenh = {
    truoc: lui, sau: tien,
    "tong-quan": function () { batTat("tong-quan"); },
    "ghi-chu": function () { batTat("ghi-chu"); },
    "tro-giup": function () { batTat("tro-giup"); },
    but: function () { batBut(); },
    laser: batLaser,
    nen: doiNen,
    "toan-man": function () { gui({ loai: "toan-man" }); },
    "xoa-but": function () { xoaBut(); }
  };
  dsNut.forEach(function (b) { b.addEventListener("click", function () { lenh[b.getAttribute("data-lenh")](); b.blur(); }); });
  troGiup.addEventListener("click", function () { batTat("tro-giup", false); });

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    var tren = $(".tong-quan.mo");
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "")) return;
    if (k === "Escape") { if (tren) batTat("tong-quan", false); else if (troGiup.classList.contains("mo")) batTat("tro-giup", false); else if (ve) batBut(false); else gui({ loai: "thoat" }); return; }
    if (tren) return;
    if (k === "ArrowRight" || k === "PageDown" || (k === " " && !/^(BUTTON)$/.test((e.target || {}).tagName || ""))) { e.preventDefault(); tien(); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); lui(); }
    else if (k === "ArrowDown") { e.preventDefault(); den(hien + 1, 1, false); }
    else if (k === "ArrowUp") { e.preventDefault(); den(hien - 1, -1, false); }
    else if (k === "Home") den(0, -1, false);
    else if (k === "End") den(n - 1, 1, true);
    else if (k === "o" || k === "O") batTat("tong-quan");
    else if (k === "n" || k === "N") batTat("ghi-chu");
    else if (k === "p" || k === "P") batBut();
    else if (k === "l" || k === "L") batLaser();
    else if (k === "t" || k === "T") doiNen();
    else if (k === "c" || k === "C") xoaBut();
    else if (k === "f" || k === "F") lenh["toan-man"]();
    else if (k === "?") batTat("tro-giup");
  });

  // Vuốt ngang trên màn hình cảm ứng
  var x0 = null;
  khung.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  khung.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) { if (dx < 0) tien(); else lui(); }
  }, { passive: true });

  window.addEventListener("resize", canh);
  // Lệnh từ trang cha. Chỉ nhận từ đúng cửa sổ cha (không nhận từ khung con hay cửa sổ khác).
  // "toi" tới slide i, bước b (kẹp trong [0, nb]); đã ở slide i thì chỉ đặt lại bước, không chạy lại hiệu ứng vào trang.
  // Mỗi lệnh "toi" phát đúng MỘT tin "buoc" phản hồi (cha bỏ qua tin đó để không lặp).
  var sanSang = false, toiCho = null;
  var toi = function (i, soBuoc) {
    i = Math.max(0, Math.min(n - 1, Math.floor(Number(i)) || 0));
    if (i === hien) { datBuoc(dsSlide[hien]._b, soBuoc); capNhatGoiY(); baoBuoc(); }
    else den(i, i > hien ? 1 : -1, false, Math.floor(Number(soBuoc)) || 0);
  };
  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var d = e.data || {};
    if (d.smartdocDieuKhien === true) {
      if (!sanSang) { if (d.lenh === "toi") toiCho = d; return; }
      if (d.lenh === "toi" && d.i !== undefined) toi(d.i, d.b);
      else if (d.lenh === "tien") tien();
      else if (d.lenh === "lui") lui();
      else if (d.lenh === "chi") chi(d.ten);
      // Nút của dải điều khiển trang cha: gọi đúng hàm của nút tương ứng trên thanh đáy.
      else if (d.lenh === "nut" && /^(tong-quan|ghi-chu|but|laser|nen|toan-man|tro-giup|xoa-but)$/.test(String(d.ten))) lenh[d.ten]();
      return;
    }
    if (d.smartdocSlideLenh === "den" && typeof d.i === "number" && sanSang) den(d.i, d.i > hien ? 1 : -1, false);
  });
  // Thành phần Toán (khungToan.js) báo trả lời đúng/sai và xin pháo hoa qua sự kiện của document.
  document.addEventListener("sd-diem", function (e) {
    var d = (e && e.detail) || {};
    diem.tong++;
    if (d.dung) diem.dung++;
    capNhatDiem();
  });
  document.addEventListener("sd-phao", function (e) {
    var d = (e && e.detail) || {};
    phao(Math.max(10, Math.min(80, Number(d.soLuong) || 40)));
  });
  canh();
  var batDau = function () {
    if (sanSang) return;
    dsSlide.forEach(vuaKhung);
    sanSang = true;
    var h = parseInt((location.hash || "").slice(1), 10);
    if (toiCho) toi(toiCho.i, toiCho.b);
    else den(h > 0 && h <= n ? h - 1 : 0, 1, false);
    toiCho = null;
    gui({ loai: "san-sang", n: n });
    baoNut(true);
    window.focus();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(batDau, batDau); else batDau();
  // Phông (Be Vietnam Pro, KaTeX) tải xong sau lần đo đầu thì chữ cao lên: co lại toàn bộ.
  var henPhong = null;
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener("loadingdone", function () {
      clearTimeout(henPhong);
      henPhong = setTimeout(function () { if (sanSang) { dsSlide.forEach(vuaKhung); if (chiDang) datChi(chiDang); } }, 150);
    });
  }
  setTimeout(function () { dsSlide.forEach(vuaKhung); }, 600);
}

/* ───────────────────────────── Dựng tài liệu ───────────────────────────── */

const thoat = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SVG = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  truoc: SVG('<path d="M15 18l-6-6 6-6"/>'),
  sau: SVG('<path d="M9 18l6-6-6-6"/>'),
  tongQuan: SVG('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  ghiChu: SVG('<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  but: SVG('<path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>'),
  laser: SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  nen: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>'),
  toanMan: SVG('<path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>'),
  troGiup: SVG('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/>'),
};

const NUT = (lenh, nhan, tip, phim) =>
  `<button class="nut-dk" data-lenh="${lenh}" aria-pressed="false" title="${tip}${phim ? " (" + phim + ")" : ""}" aria-label="${tip}">${nhan}</button>`;

/**
 * Tài liệu HTML hoàn chỉnh của một bộ slide.
 * @param {{html: string, ghiChu?: string}[]} slides  mỗi html là đúng một thẻ <section> đã được máy chủ lọc
 * @param {{tieuDe?: string, mau?: string, toi?: boolean, sang?: boolean, ngonNgu?: string, kieu?: string, anThanhDuoi?: boolean}} tuyChon
 *   ngonNgu: "vi" | "en" — ngôn ngữ của giáo trình; quyết định chữ trên giao diện khung (không phải chữ của slide).
 *   kieu: "hoclieu" — giao diện trình chiếu kiểu Học liệu AI Research (nền tối, thẻ bo tròn, thanh đáy dồn trái chừa
 *   góc dưới phải cho khung người giảng); bỏ trống là giao diện mặc định như trước.
 *   sang: với kieu "hoclieu", mở bằng nền sáng thay vì tối (phím T vẫn đổi qua lại).
 *   anThanhDuoi: ẩn thanh điều khiển đáy (trang cha tự có dải điều khiển, gửi {lenh:"nut", ten}); sân khấu dùng cả chỗ đó.
 */
export function dungTaiLieuSlide(slides, { tieuDe, mau = "xanh", toi = false, sang = false, ngonNgu = "vi", kieu, anThanhDuoi = false } = {}) {
  const ngon = ngonNgu === "en" ? "en" : "vi";
  const T = TU_DIEN[ngon];
  let soCongThuc = 0;
  const phan = (slides || [])
    .map((s) => {
      const ghi = s.ghiChu ? `<aside class="ghi-chu">${thoat(s.ghiChu)}</aside>` : "";
      // Công thức \(…\) / \[…\] → HTML KaTeX ngay tại đây (trang cha), chỉ trong phần chữ, không đụng thuộc tính.
      const toan = datToanDem(String(s.html || ""));
      soCongThuc += toan.soCongThuc;
      return toan.html.replace(/<\/section>\s*$/i, `${ghi}</section>`);
    })
    .join("\n");
  // CSS KaTeX (kèm phông nhúng ~250 KB) chỉ thêm khi bộ slide thật sự có công thức.
  const cssToan = soCongThuc ? `<style>${CSS_KATEX}\n${CSS_KATEX_KHUNG}</style>\n` : "";
  const kieuHopLe = kieu === "hoclieu" ? "hoclieu" : "";
  const mauHopLe = MAU_SLIDE.some((m) => m.ma === mau) ? mau : "xanh";
  // Từ điển đưa vào trang dưới dạng JSON; thoát "<" để chuỗi không thể đóng thẻ script sớm.
  const tuDienJson = JSON.stringify(T).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${ngon}" data-mau="${mauHopLe}"${toi || (kieuHopLe === "hoclieu" && !sang) ? ' data-theme="toi"' : ""}${kieuHopLe ? ` data-kieu="${kieuHopLe}"` : ""}${anThanhDuoi ? ' data-an-thanh="1"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data:; script-src 'unsafe-inline'">
<title>${thoat(tieuDe || T.tieuDeMacDinh)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
<style>${CSS_KHUNG}
${cssNhan(T)}
${CSS_TOAN}
${CSS_TOAN_MO_RONG}</style>
${cssToan}${kieuHopLe === "hoclieu" ? `<style>${CSS_HOC_LIEU}</style>\n` : ""}${anThanhDuoi ? `<style>${CSS_AN_THANH}</style>\n` : ""}</head>
<body>
<div class="san-khau"><div class="khung">
${phan}
<div class="goi-y">${thoat(T.goiY)}</div>
</div></div>
<canvas class="but"></canvas>
<div class="laser"></div>
<div class="tong-quan"><div class="luoi"></div></div>
<div class="khay-ghi-chu"></div>
<div class="tro-giup"><div><h4>${thoat(T.phimTatTieuDe)}</h4><dl>
<dt><kbd>→</kbd> <kbd>Space</kbd></dt><dd>${thoat(T.phTien)}</dd>
<dt><kbd>←</kbd></dt><dd>${thoat(T.phLui)}</dd>
<dt><kbd>O</kbd></dt><dd>${thoat(T.phTongQuan)}</dd>
<dt><kbd>N</kbd></dt><dd>${thoat(T.phGhiChu)}</dd>
<dt><kbd>P</kbd> / <kbd>C</kbd></dt><dd>${thoat(T.phBut)} / ${thoat(T.phXoa)}</dd>
<dt><kbd>L</kbd></dt><dd>${thoat(T.phLaser)}</dd>
<dt><kbd>T</kbd></dt><dd>${thoat(T.phNen)}</dd>
<dt><kbd>F</kbd></dt><dd>${thoat(T.phToanMan)}</dd>
</dl></div></div>
<div class="thanh-duoi">
<div class="tien-trinh"></div>
${NUT("truoc", ICON.truoc, thoat(T.lui), "←")}
<span class="so-trang">1 / ${(slides || []).length}</span>
${NUT("sau", ICON.sau, thoat(T.tiep), "→")}
<span class="diem"></span>
<span class="gian"></span>
${NUT("tong-quan", ICON.tongQuan + "<span class='nhan'>" + thoat(T.tongQuan) + "</span>", thoat(T.tongQuan), "O")}
${NUT("ghi-chu", ICON.ghiChu + "<span class='nhan'>" + thoat(T.ghiChu) + "</span>", thoat(T.ghiChuTip), "N")}
${NUT("but", ICON.but + "<span class='nhan'>" + thoat(T.but) + "</span>", thoat(T.butTip), "P")}
${NUT("laser", ICON.laser + "<span class='nhan'>" + thoat(T.laser) + "</span>", thoat(T.laserTip), "L")}
${NUT("nen", ICON.nen, thoat(T.nen), "T")}
${NUT("toan-man", ICON.toanMan, thoat(T.toanMan), "F")}
${NUT("tro-giup", ICON.troGiup, thoat(T.troGiup), "?")}
</div>
<script>var __T = ${tuDienJson};</script>
<script>(${chayToan.toString()})();</script>
<script>(${chayToanMoRong.toString()})();</script>
<script>(${chayKhung.toString()})();</script>
</body>
</html>`;
}
