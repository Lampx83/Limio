/**
 * Thành phần Toán cho khung slide HTML: đồ thị hàm số, parabol kéo tham số, sơ đồ động, nhập đáp án có chấm, phân loại.
 * Hợp đồng: docs/demo-toan10/HOP-DONG.md. Tệp này do một agent riêng sở hữu (không sửa từ nơi khác).
 *
 * `chayToan` được toString() rồi nhúng vào iframe sandbox (chạy TRƯỚC chayKhung), nên phải tự đủ:
 * không dùng biến ngoài hàm, không import. Không dùng eval/Function/innerHTML với dữ liệu từ slide.
 * Viết theo kiểu ES5 (var, function) để bộ biên dịch không chèn hàm phụ trợ nằm ngoài hàm.
 *
 * Gọi `chayToan({ chiLoi: true })` (Node, kiểm thử) chỉ trả về thư viện thuần (bộ phân tích biểu thức, chấm đáp án,
 * số hữu tỉ) mà không đụng tới DOM. Trong iframe, thư viện đó cũng gắn ở `window.__sdToan` để kiểm thử.
 *
 * Quy ước hiện dần: mọi phần tử được khung đếm làm bước đều mang class `hien`:
 *   - `.so-do`: mỗi `.nut` (trừ ô `.tieu-de` của ma trận, luôn hiện; `data-hien="khong"` tắt hẳn hiện dần);
 *   - `.do-thi` có `buocHien:true`: mỗi hàm (và điểm có `"hien":true`) là một bước.
 */
export const CSS_TOAN = `
/* ── Thành phần Toán (khungToan.js) ── */
.tq-loi { display: block; margin: .3em 0; padding: .55em .9em; border-radius: 12px; border: 2px dashed var(--sai); background: var(--sai-nhat); color: var(--sai); font-size: 18px; line-height: 1.4; font-family: var(--mono); white-space: pre-wrap; }
.tq-the { background: var(--the); border: 1px solid var(--vien); border-radius: 22px; box-shadow: var(--bong); overflow: hidden; }
/* Chiều cao tối đa tính bằng em: khi khung thu nhỏ chữ của slide cho vừa (vuaKhung), hình cũng thu theo. */
.tq-svg { display: block; width: 100%; height: auto; max-height: 14.4em; overflow: hidden; font-family: var(--font); user-select: none; -webkit-user-select: none; }
.tq-luoi line { stroke: var(--vien); stroke-width: 1.3; }
.tq-truc line { stroke: var(--chu-phu); stroke-width: 2.6; }
.tq-truc path { fill: var(--chu-phu); }
.tq-truc text { fill: var(--chu-phu); font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tq-truc text.tq-ten-truc { fill: var(--chu); font-size: 25px; font-weight: 700; font-style: italic; font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; }
.tq-duong { fill: none; stroke: var(--mau); stroke-width: 5.5; stroke-linecap: round; stroke-linejoin: round; }
.tq-doi-xung { stroke: #e8590c; stroke-width: 2.6; stroke-dasharray: 11 9; opacity: .85; }
.tq-chieu { stroke: var(--chu-phu); stroke-width: 1.8; stroke-dasharray: 6 7; opacity: .7; }
.tq-diem circle { stroke: var(--the); stroke-width: 4; fill: var(--mau); }
.tq-diem.tq-d-dinh circle { fill: #e8590c; }
.tq-diem.tq-d-ox circle { fill: #2b8a3e; }
.tq-diem.tq-d-oy circle { fill: #7048e8; }
.tq-svg text.tq-nhan { font-size: 21px; font-weight: 700; fill: var(--chu); paint-order: stroke; stroke: var(--the); stroke-width: 7px; stroke-linejoin: round; }
.tq-svg text.tq-nhan-xung { fill: #e8590c; font-style: italic; }
.tq-chu-giai rect { fill: var(--the); opacity: .92; stroke: var(--vien); stroke-width: 1.2; }
.tq-chu-giai line { stroke-width: 6; stroke-linecap: round; }
.tq-chu-giai text { font-size: 22px; font-weight: 700; fill: var(--chu); }
@keyframes tqVe { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
@keyframes tqVe2 { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
@keyframes tqNay { 0% { transform: scale(0); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes tqNhay { from { background: var(--vang-nhat); } to { background: transparent; } }
@keyframes tqLac { 20% { transform: translateX(-10px); } 40% { transform: translateX(10px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
@keyframes tqMoc { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.khung > section.hien-tai .tq-duong { animation: tqVe 1.1s .25s cubic-bezier(.4, .1, .2, 1) both; }
.khung > section.hien-tai .an-buoc.da-hien .tq-duong { animation: tqVe2 1.1s cubic-bezier(.4, .1, .2, 1) both; }
.khung > section.hien-tai .tq-diem circle { transform-box: fill-box; transform-origin: center; animation: tqNay .5s .9s both; }

/* Thanh trượt */
.tq-truot { display: grid; grid-template-columns: 1.5em 1.5em minmax(0, 1fr) 1.5em 3.4em; align-items: center; gap: .45em; }
.tq-truot .tq-ten { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-style: italic; font-weight: 700; font-size: 1.35em; color: var(--mau); text-align: center; }
.tq-truot .tq-cong { width: 1.5em; height: 1.5em; padding: 0; border-radius: 50%; border: 2px solid var(--vien); background: var(--the); color: var(--chu-phu); font-weight: 800; line-height: 1; display: grid; place-items: center; transition: border-color .15s, color .15s, transform .15s; }
.tq-truot .tq-cong:hover { border-color: var(--mau); color: var(--mau); transform: scale(1.08); }
.tq-truot output { font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; padding: .12em .3em; border-radius: 10px; background: var(--mau-nhat); color: var(--mau); }
.tq-truot input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: .55em; margin: 0; border-radius: .28em; font-size: inherit; outline: none; cursor: pointer; touch-action: none;
  background: linear-gradient(90deg, var(--mau) 0, var(--mau-2) var(--p, 50%), var(--vien) var(--p, 50%), var(--vien) 100%); }
.tq-truot input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 1.55em; height: 1.55em; border-radius: 50%; background: var(--the); border: .32em solid var(--mau); box-shadow: 0 3px 10px rgba(0, 0, 0, .28); cursor: grab; transition: transform .15s; }
.tq-truot input[type=range]:active::-webkit-slider-thumb { transform: scale(1.18); cursor: grabbing; }
.tq-truot input[type=range]::-moz-range-thumb { width: 1em; height: 1em; border-radius: 50%; background: var(--the); border: .32em solid var(--mau); box-shadow: 0 3px 10px rgba(0, 0, 0, .28); cursor: grab; }
.tq-truot input[type=range]:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px var(--vang); }

/* Parabol */
.parabol { container-type: inline-size; }
.tq-pb { display: grid; grid-template-columns: minmax(0, 1.22fr) minmax(0, 1fr); gap: 26px; align-items: center; }
.tq-pb > .tq-the { padding: 6px; }
.tq-bang { display: flex; flex-direction: column; gap: .55em; font-size: max(.64em, 22px); line-height: 1.3; min-width: 0; }
.tq-ct { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-size: 1.75em; font-weight: 700; color: var(--mau); background: var(--mau-nhat); border-radius: 16px; padding: .25em .6em; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tq-ct .tq-ps { font-size: .7em; }
.tq-bien { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-style: italic; }
.tq-cac-truot { display: grid; gap: .5em; padding: .45em .65em; border-radius: 16px; background: var(--the-2); border: 1px solid var(--vien); }
.tq-tt { display: grid; grid-template-columns: auto minmax(0, 1fr); margin: 0; border: 1px solid var(--vien); border-radius: 16px; overflow: hidden; background: var(--the); }
.tq-tt dt, .tq-tt dd { margin: 0; padding: .32em .7em; border-top: 1px solid var(--vien); }
.tq-tt dt:first-of-type, .tq-tt dt:first-of-type + dd { border-top: 0; }
.tq-tt dt { color: var(--chu-phu); font-weight: 600; background: var(--the-2); white-space: nowrap; }
.tq-tt dd { font-weight: 700; color: var(--chu); font-variant-numeric: tabular-nums; }
.tq-tt dd.tq-doi { animation: tqNhay .9s ease-out; }
.tq-ps { display: inline-flex; flex-direction: column; align-items: stretch; vertical-align: middle; font-size: .78em; line-height: 1.08; text-align: center; margin: 0 .08em; }
.tq-ps > .tq-tu { border-bottom: 2px solid currentColor; padding: 0 .15em .04em; }
.tq-ps > .tq-mau { padding: .04em .15em 0; }
@container (max-width: 860px) {
  .tq-pb { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .tq-pb .tq-svg { max-height: 8em; }
  .tq-bang { font-size: max(.56em, 20px); }
  .tq-tt { grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); }
  .tq-tt dt:nth-of-type(2), .tq-tt dt:nth-of-type(2) + dd { border-top: 0; }
}

/* Đồ thị hàm số */
.do-thi { display: flex; flex-direction: column; gap: 14px; }
.do-thi > .tq-the { padding: 6px; }
.tq-dk { display: flex; flex-wrap: wrap; gap: .45em 1.5em; font-size: max(.64em, 22px); padding: .45em .7em; border-radius: 16px; background: var(--the-2); border: 1px solid var(--vien); }
.tq-dk > .tq-truot { flex: 1 1 380px; }

/* Sơ đồ */
.so-do { position: relative; margin: .35em 0 .6em; }
.so-do .nut { position: relative; min-width: 0; background: var(--the); border: 1px solid var(--vien); border-radius: 20px; padding: .55em .8em; box-shadow: var(--bong); font-size: .8em; line-height: 1.3; }
.so-do .nut > b:first-child, .so-do .nut > strong:first-child { display: block; color: var(--mau); font-size: .78em; letter-spacing: .04em; text-transform: uppercase; margin-bottom: .2em; }
.so-do .nut > :last-child { margin-bottom: 0; }
.so-do[data-loai="flow"], .so-do:not([data-loai]) { display: flex; gap: 66px; align-items: stretch; }
.so-do[data-loai="flow"] .nut, .so-do:not([data-loai]) .nut { flex: 1 1 0; border-top: 7px solid var(--mau); }
.so-do[data-loai="flow"] .nut + .nut::before, .so-do:not([data-loai]) .nut + .nut::before { content: ""; position: absolute; left: -58px; top: 50%; width: 40px; height: 6px; margin-top: -3px; border-radius: 3px; background: var(--mau-vua); transform-origin: left center; }
.so-do[data-loai="flow"] .nut + .nut::after, .so-do:not([data-loai]) .nut + .nut::after { content: ""; position: absolute; left: -22px; top: 50%; margin-top: -12px; width: 0; height: 0; border-left: 16px solid var(--mau-vua); border-top: 12px solid transparent; border-bottom: 12px solid transparent; }
.so-do.tq-nhieu { gap: 46px; }
.so-do.tq-nhieu .nut { font-size: .8em; padding: .55em .6em; }
.so-do.tq-nhieu .nut > b:first-child, .so-do.tq-nhieu .nut > strong:first-child { text-transform: none; letter-spacing: 0; font-size: .9em; }
.so-do[data-loai="flow"] .nut, .so-do:not([data-loai]) .nut { min-height: 4.2em; }
.so-do.tq-nhieu .nut + .nut::before { left: -41px; width: 28px; }
.so-do.tq-nhieu .nut + .nut::after { left: -16px; border-left-width: 13px; border-top-width: 10px; border-bottom-width: 10px; margin-top: -10px; }
.so-do .nut.an-buoc.da-hien::before { animation: tqMoc .45s .1s cubic-bezier(.2, .8, .2, 1) both; }
.so-do[data-loai="timeline"] { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 26px; padding-top: 62px; }
.so-do[data-loai="timeline"]::before { content: ""; position: absolute; left: 0; right: 0; top: 22px; height: 7px; border-radius: 4px; background: linear-gradient(90deg, var(--mau), var(--mau-2)); }
.so-do[data-loai="timeline"] .nut { text-align: center; border-top: 0; }
.so-do[data-loai="timeline"] .nut::before { content: ""; position: absolute; top: -54px; left: 50%; width: 34px; height: 34px; margin-left: -17px; border-radius: 50%; background: var(--the); border: 7px solid var(--mau); box-sizing: border-box; }
.so-do[data-loai="timeline"] .nut::after { content: ""; position: absolute; top: -20px; left: 50%; width: 4px; height: 20px; margin-left: -2px; background: var(--mau-vua); }
.so-do[data-loai="timeline"] .nut.an-buoc.da-hien::before { animation: tqNay .5s both; }
.so-do[data-loai="ma-tran"] { display: grid; grid-template-columns: repeat(var(--cot, 3), minmax(0, 1fr)); gap: 12px; }
.so-do[data-loai="ma-tran"] .nut { font-size: .72em; padding: .45em .7em; box-shadow: none; border-radius: 14px; }
.so-do[data-loai="ma-tran"] .nut.an-buoc { transform: scale(.9); }
.so-do[data-loai="ma-tran"] .nut.an-buoc.da-hien, body.tat-ca .so-do[data-loai="ma-tran"] .nut.an-buoc { transform: none; }
.so-do .tieu-de { background: linear-gradient(135deg, var(--mau), var(--mau-2)); color: #fff; font-weight: 800; border-color: transparent; }
.so-do .tieu-de > b:first-child, .so-do .tieu-de > strong:first-child { color: #fff; }

/* Nhập đáp án */
.nhap-dap-an { background: var(--the-2); border: 1px solid var(--vien); border-radius: 24px; padding: 28px 36px; box-shadow: var(--bong); margin: .4em 0 .6em; }
.nhap-dap-an > .cau { font-weight: 800; font-size: 1em; margin: 0 0 .55em; }
.tq-nhap { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.tq-o { flex: 1 1 360px; min-width: 0; font: inherit; font-size: .88em; font-weight: 600; padding: .32em .7em; border-radius: 16px; border: 3px solid var(--vien); background: var(--the); color: var(--chu); outline: none; transition: border-color .15s, box-shadow .15s, background .15s; }
.tq-o::placeholder { color: var(--chu-phu); opacity: .65; font-weight: 400; }
.tq-o:focus { border-color: var(--mau); box-shadow: 0 0 0 5px var(--mau-nhat); }
.tq-o.tq-lac { animation: tqLac .4s; border-color: var(--sai); }
.nhap-dap-an.tq-dung .tq-o { border-color: var(--dung); background: var(--dung-nhat); }
.nhap-dap-an.tq-het .tq-o { border-color: var(--sai); }
.tq-nut-chinh, .tq-nut-phu { display: inline-flex; align-items: center; gap: .35em; font-size: .7em; font-weight: 800; padding: .55em 1.15em; border-radius: 999px; transition: transform .15s, box-shadow .15s, opacity .15s; }
.tq-nut-chinh { border: 0; color: #fff; background: linear-gradient(135deg, var(--mau), var(--mau-2)); box-shadow: 0 8px 20px rgba(0, 0, 0, .18); }
.tq-nut-phu { border: 2px solid var(--vien); background: var(--the); color: var(--chu-phu); }
.tq-nut-chinh:hover:not(:disabled), .tq-nut-phu:hover:not(:disabled) { transform: translateY(-2px); }
.tq-nut-chinh:disabled, .tq-nut-phu:disabled { opacity: .45; cursor: default; }
.tq-nut-chinh svg, .tq-nut-phu svg, .tq-phan-hoi svg { width: 1.1em; height: 1.1em; flex: none; }
.tq-phan-hoi { display: flex; align-items: center; gap: .4em; min-height: 1.5em; margin-top: .4em; font-size: .7em; font-weight: 700; color: var(--chu-phu); }
.tq-phan-hoi.dung { color: var(--dung); }
.tq-phan-hoi.sai { color: var(--sai); }
.tq-phan-hoi:not(:empty) { animation: len .35s both; }
.nhap-dap-an .go-y, .nhap-dap-an .giai-thich, .nhap-dap-an .loi-sai { display: none; }
.nhap-dap-an .loi-sai.tq-mo { display: block; margin-top: .45em; padding: .55em 1em; border-radius: 14px; background: var(--sai-nhat); border-left: 7px solid var(--sai); font-size: .76em; animation: len .4s both; }
.nhap-dap-an .loi-sai > :last-child { margin-bottom: 0; }
.tq-xem-truoc { display: flex; align-items: baseline; gap: .6em; min-height: 1.5em; margin-top: .3em; padding: 0 .3em; font-size: .78em; }
.tq-xem-truoc .tq-xem-nhan { font-size: .7em; font-weight: 700; color: var(--chu-phu); text-transform: uppercase; letter-spacing: .06em; }
.tq-xem-truoc .tq-xem-bt { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-size: 1.15em; font-weight: 700; color: var(--mau); }
.tq-xem-truoc.loi .tq-xem-nhan { opacity: .6; }
.nhap-dap-an .go-y.tq-mo { display: block; margin-top: .45em; padding: .55em 1em; border-radius: 14px; background: var(--vang-nhat); border-left: 7px solid var(--vang); font-size: .76em; animation: len .4s both; }
.nhap-dap-an .giai-thich.tq-mo { display: block; margin-top: .45em; padding: .6em 1em; border-radius: 14px; background: var(--dung-nhat); border-left: 7px solid var(--dung); font-size: .76em; animation: len .45s both; }
.nhap-dap-an .go-y > :last-child, .nhap-dap-an .giai-thich > :last-child { margin-bottom: 0; }

/* Phân loại */
.phan-loai { display: flex; flex-direction: column; gap: 16px; }
.tq-khay { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: center; min-height: 2.2em; padding: 14px; border: 2px dashed var(--mau-vua); border-radius: 20px; }
.tq-khay:empty::before { content: "✓"; color: var(--dung); font-weight: 800; }
.phan-loai .muc { position: relative; font-size: .76em; line-height: 1.3; padding: .32em .85em; border-radius: 14px; background: var(--the); border: 2px solid var(--vien); box-shadow: var(--bong); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; outline: none;
  transition: border-color .15s, background .15s, box-shadow .15s; }
.phan-loai .muc:hover, .phan-loai .muc:focus-visible { border-color: var(--mau); }
.phan-loai .muc.tq-chon { border-color: var(--mau); background: var(--mau-nhat); box-shadow: 0 0 0 5px var(--mau-vua); }
.phan-loai .muc.tq-keo { pointer-events: none; z-index: 20; cursor: grabbing; transition: none; box-shadow: 0 18px 40px rgba(0, 0, 0, .3); }
.phan-loai .muc.tq-da-xep { cursor: default; font-size: .66em; box-shadow: none; border-color: transparent; background: var(--dung-nhat); }
.phan-loai .muc.tq-lac, .phan-loai .nhom.tq-lac { animation: tqLac .4s; border-color: var(--sai); }
.tq-cac-nhom { display: grid; grid-template-columns: repeat(var(--so-nhom, 3), minmax(0, 1fr)); gap: 18px; }
.phan-loai .nhom { display: flex; flex-direction: column; min-height: 190px; border-radius: 20px; background: var(--the-2); border: 2px solid var(--vien); overflow: hidden; cursor: pointer; outline: none;
  transition: border-color .15s, box-shadow .15s, transform .15s; }
.phan-loai.tq-dang-chon .nhom:hover, .phan-loai .nhom.tq-tro, .phan-loai .nhom:focus-visible { border-color: var(--mau); box-shadow: 0 0 0 5px var(--mau-vua); transform: translateY(-3px); }
.tq-nhom-dau { padding: .4em .8em; color: #fff; font-size: .7em; line-height: 1.3; text-align: center; background: linear-gradient(135deg, var(--mau), var(--mau-2)); }
.phan-loai .nhom:nth-child(4n+2) .tq-nhom-dau { background: linear-gradient(135deg, #7048e8, #9775fa); }
.phan-loai .nhom:nth-child(4n+3) .tq-nhom-dau { background: linear-gradient(135deg, #0b7a5a, #20c997); }
.phan-loai .nhom:nth-child(4n+4) .tq-nhom-dau { background: linear-gradient(135deg, #d9480f, #ff922b); }
.tq-nhom-dau > b { display: block; font-size: 1.02em; }
.tq-nhom-o { flex: 1; display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; justify-content: center; padding: 12px; }
.tq-tien-do { text-align: center; font-size: .54em; color: var(--chu-phu); font-weight: 600; }
.tq-tien-do.xong { color: var(--dung); font-weight: 800; }

/* Chung cho hoạt động mới */
.tq-de { font-size: 1.12em; font-weight: 800; color: var(--chu); line-height: 1.25; }
.tq-meo { font-size: .82em; color: var(--chu-phu); line-height: 1.35; }
.tq-giua { justify-content: center; }
.keo-diem, .nem-bong { container-type: inline-size; }
.keo-diem.tq-dung .tq-ct, .nem-bong .tq-ct { transition: background .3s; }
.keo-diem.tq-dung .tq-ct { background: var(--dung-nhat); color: var(--dung); }

/* Kéo điểm */
.keo-diem .tq-svg { touch-action: none; cursor: crosshair; }
.tq-keo-diem { cursor: grab; outline: none; }
.tq-keo-diem .tq-vong { fill: var(--mau); opacity: .16; transform-box: fill-box; transform-origin: center; animation: tqTho 1.8s ease-in-out infinite; }
.tq-keo-diem .tq-tam { fill: var(--mau); stroke: var(--the); stroke-width: 5; }
.tq-keo-diem.dang-keo { cursor: grabbing; }
.tq-keo-diem.dang-keo .tq-vong { opacity: .3; animation: none; }
.tq-keo-diem:focus-visible .tq-vong { opacity: .4; stroke: var(--vang); stroke-width: 4; }
.tq-keo-trong.tq-lac { animation: tqLac .4s; }
.keo-diem.tq-dung .tq-tam { fill: var(--dung); }
.tq-dich circle { fill: none; stroke: var(--dung); stroke-width: 4; stroke-dasharray: 8 6; }
@keyframes tqTho { 50% { transform: scale(1.25); } }

/* Ném bóng */
/* Cảnh ném bóng lấp phần còn lại của thân slide (flex), bảng điều khiển bên phải, chữ ≥ 22px ở cỡ gốc 36px. */
.khung > section > .than > .nem-bong { flex: 1 1 auto; min-height: 9em; display: flex; flex-direction: column; }
.tq-nb { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 10.6em); gap: 20px; align-items: stretch; flex: 1 1 auto; min-height: 0; }
.tq-nb .tq-bang { font-size: max(.64em, 22px); gap: .5em; justify-content: center; }
.tq-nb .tq-ct { font-size: 1.35em; padding: .2em .4em; }
.tq-nb .tq-tt dt, .tq-nb .tq-tt dd { padding: .28em .55em; }
.tq-nb .tq-nhap { gap: .5em; }
.tq-nb .tq-nhap .tq-meo { font-size: .85em; }
.tq-nb-dan { position: absolute; left: 14px; top: 52px; max-width: 60%; padding: .25em .7em; border-radius: 12px; background: rgba(255, 255, 255, .88); color: #1d2b53; font-size: .56em; font-weight: 800; box-shadow: 0 4px 14px rgba(0, 0, 0, .12); pointer-events: none; }
.tq-nb-tb { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); width: max-content; max-width: 86%; margin: 0; padding: .35em .9em; border-radius: 14px; background: rgba(255, 255, 255, .94); box-shadow: 0 8px 22px rgba(0, 0, 0, .18); font-size: .56em; line-height: 1.3; pointer-events: none; }
.tq-nb-tb:empty { display: none; }
.tq-bong-mo { fill: #f7801e; pointer-events: none; }
.tq-nb > .tq-the-san { padding: 0; border-radius: 22px; }
.tq-nb > .tq-the-san { position: relative; min-height: 0; }
.tq-san { width: 100%; height: 100%; max-height: none; }
.tq-san text.tq-nhan { fill: #1d2b53; stroke: #fff; }
.tq-day-co { fill: none; stroke: #8a94a8; stroke-width: 2; }
.tq-vach-tuong { fill: rgba(11, 78, 162, .14); }
.tq-khan-gia { opacity: .5; }
.tq-lan-can { fill: #9fb3d4; opacity: .55; }
.tq-van-go { stroke: rgba(120, 66, 18, .2); stroke-width: 2; }
.tq-mep-san { stroke: #fff; stroke-width: 5; opacity: .85; }
.tq-thuoc line { stroke: #fff; stroke-width: 3; }
.tq-thuoc text { fill: #6b3a0c; font-size: 18px; font-weight: 700; }
.tq-cot { fill: #5f6f8a; }
.tq-bang-ro { fill: #fff; stroke: #8796b0; stroke-width: 2; }
.tq-vanh { fill: none; stroke: #ff6b1a; stroke-width: 6; stroke-linecap: round; }
.tq-luoi-ro { stroke: #fff; stroke-width: 2.4; fill: none; opacity: .95; transform-box: fill-box; transform-origin: top center; }
.tq-luoi-ro.rung { animation: tqRung .7s ease-out; }
@keyframes tqRung { 30% { transform: scaleY(1.22) scaleX(.9); } 60% { transform: scaleY(.95); } }
.tq-san text.tq-nhan { font-size: 20px; }
.tq-chan { stroke: #1d2b53; stroke-width: 15; stroke-linecap: round; fill: none; }
.tq-giay { fill: #ff4d6d; }
.tq-quan { fill: #1d2b53; }
.tq-ao { fill: var(--mau); stroke: rgba(0, 0, 0, .12); stroke-width: 2; }
.tq-so-ao { fill: #fff; font-size: 24px; font-weight: 800; font-family: var(--font); }
.tq-tay { stroke: #f2c48d; stroke-width: 10; stroke-linecap: round; fill: none; }
.tq-dau { fill: #f2c48d; }
.tq-toc { fill: #3b2416; }
.tq-mat { fill: #3b2416; }
.tq-bong-ke { fill: none; stroke: #7a2c05; stroke-width: 2; opacity: .75; }
.tq-bong-vo { stroke: #a83d08; stroke-width: 1.5; }
.tq-vet { fill: none; stroke: #ff922b; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 2 10; }
.tq-vet.cu { stroke: #8a94a8; opacity: .45; stroke-width: 3.5; }
.tq-du-doan { fill: none; stroke: var(--mau); stroke-width: 3.5; stroke-dasharray: 12 9; opacity: .7; }
.tq-ngam line { stroke: #e8590c; stroke-width: 5; stroke-linecap: round; }
.tq-ngam path { fill: #e8590c; }
.tq-ngam path.tq-cung { fill: none; stroke: #e8590c; stroke-width: 2.5; stroke-dasharray: 5 5; }
.tq-dinh-nb circle { fill: #e8590c; stroke: #fff; stroke-width: 4; }
.tq-dinh-nb line { stroke: #e8590c; opacity: .8; }
.tq-bao-lon { font-size: 64px; font-weight: 900; letter-spacing: .02em; paint-order: stroke; stroke: #fff; stroke-width: 10px; stroke-linejoin: round; opacity: 0; transform-box: fill-box; transform-origin: center; }
.tq-bao-lon.dung { fill: #2b8a3e; } .tq-bao-lon.sai { fill: #e8590c; }
.tq-bao-lon.hien { animation: tqBung .6s cubic-bezier(.2, 1.6, .4, 1) both; }
.tq-bao-lon.hien.tat { animation: tqTat .5s ease both; }
@keyframes tqTat { from { opacity: 1; } to { opacity: 0; } }
@keyframes tqBung { from { opacity: 0; transform: scale(.3); } to { opacity: 1; transform: scale(1); } }
.tq-nut-nem { font-size: 1.25em; padding: .5em 1.6em; background: linear-gradient(135deg, #ff922b, #e8590c); box-shadow: 0 10px 26px rgba(232, 89, 12, .4); }
.tq-nut-nem svg { width: 1.2em; height: 1.2em; }
.tq-nut-nem:not(:disabled) { animation: nhip 2.2s ease-in-out infinite; }
@container (max-width: 980px) {
  .tq-nb { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .tq-nb .tq-san { height: auto; aspect-ratio: 1000 / 520; }
  .tq-nb .tq-bang { font-size: max(.56em, 20px); }
}

/* Sắp xếp */
.sap-xep { display: flex; flex-direction: column; gap: 10px; }
.tq-sx { display: flex; flex-direction: column; gap: 12px; counter-reset: sx; }
.tq-sx-o { position: relative; display: flex; align-items: center; gap: 16px; padding: .32em .5em .32em .45em; border-radius: 18px; background: var(--the); border: 2px solid var(--vien); box-shadow: var(--bong);
  font-size: .82em; line-height: 1.3; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; outline: none; transition: border-color .15s, background .2s; }
.tq-sx-o:hover, .tq-sx-o:focus-visible { border-color: var(--mau); }
.tq-sx-o.tq-keo { z-index: 5; cursor: grabbing; box-shadow: 0 18px 40px rgba(0, 0, 0, .28); border-color: var(--mau); transition: none; }
.tq-sx-o.dung { border-color: var(--dung); background: var(--dung-nhat); }
.tq-sx-o.sai { border-color: var(--sai); background: var(--sai-nhat); }
.tq-sx-so { flex: none; width: 1.7em; height: 1.7em; display: grid; place-items: center; border-radius: 50%; color: #fff; font-weight: 800; font-size: .9em; background: linear-gradient(135deg, var(--mau), var(--mau-2)); }
.tq-sx-o.dung .tq-sx-so { background: var(--dung); }
.tq-sx-o.sai .tq-sx-so { background: var(--sai); }
.tq-sx-nd { flex: 1; min-width: 0; }
.tq-sx-nd > .muc > :last-child { margin-bottom: 0; }
.tq-sx-dk { flex: none; display: flex; flex-direction: column; gap: 4px; }
.tq-sx-nut { width: 40px; height: 30px; padding: 0; border-radius: 9px; border: 1px solid var(--vien); background: var(--the-2); color: var(--chu-phu); display: grid; place-items: center; }
.tq-sx-nut:hover { color: var(--mau); border-color: var(--mau); }
.tq-sx-nut svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.sap-xep.tq-dung .tq-sx-dk, .sap-xep.tq-het .tq-sx-dk { visibility: hidden; }
.sap-xep .tq-phan-hoi { justify-content: center; }

/* Tìm lỗi */
.tim-loi { display: flex; flex-direction: column; gap: 8px; }
.tq-tl { display: flex; flex-direction: column; gap: 8px; }
.tim-loi .dong { position: relative; padding: .3em .8em .3em .5em; border-radius: 14px; border: 2px solid transparent; background: var(--the); box-shadow: var(--bong); font-size: .82em; line-height: 1.35; cursor: pointer; outline: none;
  transition: border-color .15s, background .2s, transform .15s; }
.tim-loi .dong:hover, .tim-loi .dong:focus-visible { border-color: var(--mau); transform: translateX(4px); }
.tq-tl-so { display: inline-block; min-width: 2.2em; font-weight: 800; color: var(--chu-phu); }
.tim-loi .dong.tq-khong-sai { border-color: var(--dung); background: var(--dung-nhat); }
.tim-loi .dong.tq-dang-chon { border-color: var(--vang); background: var(--vang-nhat); }
.tim-loi .dong.tq-da-tim { border-color: var(--sai); background: var(--sai-nhat); cursor: default; transform: none; }
.tim-loi .dong.tq-da-tim .tq-tl-so { color: var(--sai); }
.tim-loi .dong.tq-lac { animation: tqLac .4s; }
.tq-tl-ly-do { margin-top: .3em; padding-top: .3em; border-top: 2px dashed var(--sai); color: var(--sai); font-weight: 700; font-size: .92em; animation: len .4s both; }
.tq-tl-hop { padding: .5em .8em; border-radius: 14px; background: var(--vang-nhat); border: 2px solid var(--vang); font-size: .76em; animation: len .35s both; }
.tq-tl-hoi { font-weight: 800; margin-bottom: .35em; }
.tq-tl-cac { display: flex; flex-wrap: wrap; gap: 8px; }
.tq-tl-nut { text-align: left; padding: .35em .8em; border-radius: 12px; border: 2px solid var(--vien); background: var(--the); font-size: .95em; line-height: 1.3; }
.tq-tl-nut:hover:not(:disabled) { border-color: var(--mau); }
.tq-tl-nut:disabled { opacity: .45; text-decoration: line-through; }
.tq-tl-nut.tq-lac { animation: tqLac .4s; border-color: var(--sai); }

@media (prefers-reduced-motion: reduce) {
  .tq-duong, .tq-diem circle, .so-do .nut::before, .tq-tt dd.tq-doi { animation: none !important; }
  .phan-loai .muc, .tq-sx-o { transition: none !important; }
  .tq-keo-diem .tq-vong, .tq-nut-nem { animation: none !important; }
  /* Khung đặt transition-duration .01ms cho mọi phần tử; với transition-property mặc định «all», Chromium có lúc kẹt
     visibility của nút vừa được dời chỗ ở trạng thái hidden. Thành phần Toán không cần chuyển tiếp nào khi giảm chuyển động. */
  .parabol *, .do-thi *, .nhap-dap-an *, .phan-loai *, .keo-diem *, .nem-bong *, .sap-xep *, .tim-loi * { transition-property: none !important; }
}
`;

/* global __T */
export function chayToan(tuyChon) {
  /* ═══════════════ Thư viện thuần (không DOM) ═══════════════ */
  var L = (function () {
    var HAM = {
      sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
      ln: Math.log, log: function (v) { return Math.log(v) / Math.LN10; }, exp: Math.exp
    };
    var HANG = { pi: Math.PI, e: Math.E };
    var co = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

    var loiToan = function (thongDiep) { var e = new Error(thongDiep); e.laLoiToan = true; return e; };

    /* ── Tách từ tố ── */
    var tachToken = function (src) {
      var s = String(src == null ? "" : src);
      if (s.normalize) s = s.normalize("NFC");
      s = s.replace(/[−–—‒]/g, "-").replace(/[×·⋅]/g, "*").replace(/÷/g, "/")
        .replace(/\*\*/g, "^").replace(/π/g, " pi ").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, " sqrt ");
      var ds = [], i = 0, n = s.length, m;
      while (i < n) {
        var ch = s.charAt(i);
        if (/\s/.test(ch)) { i++; continue; }
        if (/[0-9.]/.test(ch)) {
          m = /^(\d+(\.\d*)?|\.\d+)/.exec(s.slice(i));
          if (!m) throw loiToan("Số viết sai ở «" + s.slice(i, i + 6) + "»");
          ds.push({ t: "so", v: parseFloat(m[0]) }); i += m[0].length; continue;
        }
        if (/[A-Za-z_α-ω]/.test(ch)) {
          m = /^[A-Za-z_α-ω]+/.exec(s.slice(i));
          ds.push({ t: "ten", v: m[0] }); i += m[0].length; continue;
        }
        if ("+-*/^()|".indexOf(ch) >= 0) { ds.push({ t: "op", v: ch }); i++; continue; }
        throw loiToan("Kí tự không dùng được trong biểu thức: «" + ch + "»");
      }
      return ds;
    };

    /* Tách tên ghép ("ax", "xsinx", "2pi") thành biến/hàm/hằng đã biết. */
    var tachTen = function (w, bien, tuDo) {
      if (bien.indexOf(w) >= 0) return [{ t: "bien", v: w }];
      if (co(HAM, w)) return [{ t: "ham", v: w }];
      if (co(HANG, w)) return [{ t: "hang", v: w }];
      var ungVien = [];
      bien.forEach(function (b) { ungVien.push({ t: "bien", v: b }); });
      Object.keys(HAM).forEach(function (h) { ungVien.push({ t: "ham", v: h }); });
      Object.keys(HANG).forEach(function (h) { ungVien.push({ t: "hang", v: h }); });
      ungVien.sort(function (a, b) { return b.v.length - a.v.length || (a.t === "bien" ? -1 : 1); });
      var kq = [], p = 0;
      while (p < w.length) {
        var tim = null;
        for (var k = 0; k < ungVien.length; k++) {
          if (w.substr(p, ungVien[k].v.length) === ungVien[k].v) { tim = ungVien[k]; break; }
        }
        if (!tim && tuDo && /[a-zA-Z]/.test(w.charAt(p))) tim = { t: "bien", v: w.charAt(p) };
        if (!tim) throw loiToan("Không hiểu «" + w + "»" + (bien.length ? " (biến được dùng: " + bien.join(", ") + ")" : ""));
        kq.push({ t: tim.t, v: tim.v });
        p += tim.v.length;
      }
      return kq;
    };

    /**
     * Phân tích biểu thức thành cây: ["n",số] ["v",tên] ["+"|"-"|"*"|"/"|"^",a,b] ["neg",a] ["f",tên,a].
     * tuyChon.bien: danh sách tên biến/tham số; tuyChon.tuDo: chữ cái lạ được coi là biến.
     */
    var phanTich = function (src, tuyChon2) {
      tuyChon2 = tuyChon2 || {};
      var bien = (tuyChon2.bien || ["x"]).filter(function (b) { return typeof b === "string" && /^[A-Za-z_α-ω]+$/.test(b); });
      var tuDo = Boolean(tuyChon2.tuDo);
      var tk = [];
      tachToken(src).forEach(function (t) {
        if (t.t !== "ten") { tk.push(t); return; }
        tachTen(t.v, bien, tuDo).forEach(function (x) { tk.push(x); });
      });
      if (!tk.length) throw loiToan("Biểu thức đang trống");
      var p = 0;
      var la = function (v) { var t = tk[p]; return Boolean(t && t.t === "op" && t.v === v); };
      var dong = function () { if (!la(")")) throw loiToan("Thiếu dấu «)»"); p++; };
      var batDauThuaSo = function () {
        var t = tk[p];
        if (!t) return false;
        return t.t === "so" || t.t === "bien" || t.t === "hang" || t.t === "ham" || (t.t === "op" && t.v === "(");
      };
      var tong, tich, dau, luyThua, nguyenTo;
      tong = function () {
        var a = tich();
        while (la("+") || la("-")) { var o = tk[p++].v; a = [o, a, tich()]; }
        return a;
      };
      tich = function () {
        var a = dau();
        for (;;) {
          if (la("*") || la("/")) { var o = tk[p++].v; a = [o, a, dau()]; } else if (batDauThuaSo()) { a = ["*", a, luyThua()]; } else break;
        }
        return a;
      };
      dau = function () {
        if (la("-")) { p++; return ["neg", dau()]; }
        if (la("+")) { p++; return dau(); }
        return luyThua();
      };
      luyThua = function () {
        var a = nguyenTo();
        if (la("^")) { p++; a = ["^", a, dau()]; }
        return a;
      };
      nguyenTo = function () {
        var t = tk[p];
        if (!t) throw loiToan("Biểu thức bị cụt ở cuối");
        if (t.t === "so") { p++; return ["n", t.v]; }
        if (t.t === "hang") { p++; return ["n", HANG[t.v]]; }
        if (t.t === "bien") { p++; return ["v", t.v]; }
        if (t.t === "ham") {
          p++;
          var doi;
          if (la("(")) { p++; doi = tong(); dong(); } else doi = luyThua();
          return ["f", t.v, doi];
        }
        if (la("(")) { p++; var e = tong(); dong(); return e; }
        if (la("|")) {
          p++;
          var e2 = tong();
          if (!la("|")) throw loiToan("Thiếu dấu «|» đóng giá trị tuyệt đối");
          p++;
          return ["f", "abs", e2];
        }
        throw loiToan("Không mong đợi «" + t.v + "»");
      };
      var kq = tong();
      if (p < tk.length) throw loiToan("Thừa «" + tk[p].v + "» trong biểu thức");
      return kq;
    };

    var tinh = function (a, env) {
      switch (a[0]) {
        case "n": return a[1];
        case "v": return env && co(env, a[1]) && typeof env[a[1]] === "number" ? env[a[1]] : NaN;
        case "+": return tinh(a[1], env) + tinh(a[2], env);
        case "-": return tinh(a[1], env) - tinh(a[2], env);
        case "*": return tinh(a[1], env) * tinh(a[2], env);
        case "/": return tinh(a[1], env) / tinh(a[2], env);
        case "^": return Math.pow(tinh(a[1], env), tinh(a[2], env));
        case "neg": return -tinh(a[1], env);
        case "f": return HAM[a[1]](tinh(a[2], env));
        default: return NaN;
      }
    };

    /** Biên dịch một lần, gọi nhiều lần: f(env) → số. */
    var bienDich = function (src, bien) {
      var ast = phanTich(src, { bien: bien });
      return { ast: ast, f: function (env) { return tinh(ast, env); } };
    };

    var bienTrong = function (a, tap) {
      if (a[0] === "v") tap[a[1]] = 1;
      for (var i = 1; i < a.length; i++) if (Array.isArray(a[i])) bienTrong(a[i], tap);
      return tap;
    };

    /* ── In biểu thức đẹp (Unicode) ── */
    var SO_MU = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    var soDep = function (v) {
      if (typeof v !== "number" || !isFinite(v)) return "?";
      var r = Math.round(v * 100) / 100;
      if (r === 0) r = 0;
      return String(r).replace("-", "−").replace(".", ",");
    };
    var soTrongBieuThuc = function (v) {
      if (v === Math.PI) return "π";
      if (v === Math.E) return "e";
      var r = Math.round(v * 1e6) / 1e6;
      return String(r).replace("-", "−").replace(".", ",");
    };
    var uuTien = function (a) {
      switch (a[0]) {
        case "+": case "-": return 1;
        case "*": case "/": return 2;
        case "neg": return 2.5;
        case "^": return 4;
        default: return 5;
      }
    };
    var inDep = function (a) {
      var boc = function (x, muc) { var s = inDep(x); return uuTien(x) < muc ? "(" + s + ")" : s; };
      switch (a[0]) {
        case "n": return soTrongBieuThuc(a[1]);
        case "v": return a[1];
        case "+":
          if (a[2][0] === "neg") return inDep(a[1]) + " − " + boc(a[2][1], 2);
          return inDep(a[1]) + " + " + boc(a[2], 1);
        case "-": return inDep(a[1]) + " − " + boc(a[2], 2);
        case "*": {
          var l = boc(a[1], 2), r = boc(a[2], 2.5);
          var trai = a[1][0], phai = a[2];
          var goc = phai[0] === "^" ? phai[1] : phai;
          var gon = (trai === "n" && /^[A-Za-zα-ω(√|]/.test(r)) ||
            (trai === "v" && (goc[0] === "v" || (goc[0] === "f" && (goc[1] === "sqrt" || goc[1] === "abs"))) && !/^[0-9]/.test(r)) ||
            r.charAt(0) === "(";
          return l + (gon ? "" : "·") + r;
        }
        case "/": return boc(a[1], 2) + "/" + boc(a[2], 3);
        case "^": {
          var coSo = boc(a[1], 5);
          var mu = a[2];
          if (mu[0] === "n" && mu[1] >= 0 && mu[1] <= 9 && Math.floor(mu[1]) === mu[1]) return coSo + SO_MU.charAt(mu[1]);
          return coSo + "^" + boc(mu, 5);
        }
        case "neg": return "−" + boc(a[1], 2.5);
        case "f":
          if (a[1] === "sqrt") { var t = inDep(a[2]); return "√" + (uuTien(a[2]) >= 5 ? t : "(" + t + ")"); }
          if (a[1] === "abs") return "|" + inDep(a[2]) + "|";
          return a[1] + "(" + inDep(a[2]) + ")";
        default: return "?";
      }
    };

    /* ── Số hữu tỉ ── */
    var ucln = function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; };
    var PS = function (p, q) { if (q < 0) { p = -p; q = -q; } var g = ucln(p, q); return { p: p / g, q: q / g }; };
    var huuTi = function (v) {
      if (typeof v !== "number" || !isFinite(v)) return null;
      for (var q = 1; q <= 1000; q++) {
        var p = Math.round(v * q);
        if (Math.abs(p / q - v) <= 1e-9 * Math.max(1, Math.abs(v))) return PS(p, q);
      }
      return null;
    };
    var psCong = function (a, b) { return PS(a.p * b.q + b.p * a.q, a.q * b.q); };
    var psTru = function (a, b) { return PS(a.p * b.q - b.p * a.q, a.q * b.q); };
    var psNhan = function (a, b) { return PS(a.p * b.p, a.q * b.q); };
    var psChia = function (a, b) { return PS(a.p * b.q, a.q * b.p); };

    /** Mọi đại lượng của y = ax² + bx + c; giá trị chính xác (phân số) khi a, b, c hữu tỉ. */
    var tinhParabol = function (a, b, c) {
      var kq = { a: a, b: b, c: c };
      kq.delta = b * b - 4 * a * c;
      kq.xI = -b / (2 * a);
      kq.yI = -kq.delta / (4 * a);
      if (kq.delta >= 0) {
        var r = Math.sqrt(kq.delta);
        kq.x1 = Math.min((-b - r) / (2 * a), (-b + r) / (2 * a));
        kq.x2 = Math.max((-b - r) / (2 * a), (-b + r) / (2 * a));
      }
      var A = huuTi(a), B = huuTi(b), C = huuTi(c);
      if (A && B && C && A.p !== 0) {
        kq.A = A; kq.B = B; kq.C = C;
        kq.D = psTru(psNhan(B, B), psNhan(PS(4, 1), psNhan(A, C)));
        kq.XI = psChia(PS(-B.p, B.q), psNhan(PS(2, 1), A));
        kq.YI = psChia(PS(-kq.D.p, kq.D.q), psNhan(PS(4, 1), A));
        if (kq.D.p > 0) {
          var n = kq.D.p * kq.D.q;
          if (n <= 1e9) {
            var k = 1, m = n;
            for (var i = 2; i * i <= m; i++) { while (m % (i * i) === 0) { m /= i * i; k *= i; } }
            var S = psChia(PS(k, kq.D.q), PS(2 * Math.abs(A.p), A.q));
            if (m === 1) kq.nghiem = [psTru(kq.XI, S), psCong(kq.XI, S)];
            else kq.can = { r: kq.XI, s: S, m: m };
          }
        } else if (kq.D.p === 0) kq.nghiem = [kq.XI];
      }
      return kq;
    };

    /* ── Chấm đáp án ── */
    var chuan = function (s) {
      s = String(s == null ? "" : s);
      if (s.normalize) s = s.normalize("NFC");
      return s.replace(/[−–—‒]/g, "-").replace(/∞/g, "oo").replace(/∪/g, "U").replace(/ℝ/g, "R")
        .replace(/∅/g, "{}").replace(/\s+/g, "");
    };
    var soTuChuoi = function (s) {
      s = chuan(s).replace(/^[a-zA-Z]\w*=/, "").replace(/(\d),(\d)/g, "$1.$2");
      if (!s) throw loiToan("thiếu số");
      var v = tinh(phanTich(s, { bien: [] }), {});
      if (!isFinite(v)) throw loiToan("«" + s + "» không ra một số");
      return v;
    };
    var tachPhan = function (s) {
      if (s.indexOf(";") >= 0) return s.split(";");
      return s.split(",");
    };
    var docKhoang = function (s0) {
      var s = chuan(s0).toLowerCase().replace(/^x(∈|in|=)/, "");
      if (!s) throw loiToan("thiếu đáp án");
      var phan = s.split("u"), ds = [];
      phan.forEach(function (ph) {
        if (!ph) throw loiToan("dấu hợp «U» thừa");
        if (ph === "r") { ds.push([-Infinity, Infinity, false, false]); return; }
        if (ph === "{}") return;
        if (ph.charAt(0) === "{") {
          if (ph.charAt(ph.length - 1) !== "}") throw loiToan("thiếu «}»");
          tachPhan(ph.slice(1, -1)).forEach(function (x) { var v = soTuChuoi(x); ds.push([v, v, true, true]); });
          return;
        }
        var m = /^([[(\]])(.*)([\])[])$/.exec(ph);
        if (!m) throw loiToan("khoảng phải có dạng (a; b) hoặc [a; b]");
        var hai = tachPhan(m[2]);
        if (hai.length !== 2) throw loiToan("khoảng cần đúng hai đầu mút");
        var dauMut = function (x) {
          if (x === "-oo") return -Infinity;
          if (x === "+oo" || x === "oo") return Infinity;
          return soTuChuoi(x);
        };
        var lo = dauMut(hai[0]), hi = dauMut(hai[1]);
        if (lo > hi) throw loiToan("đầu mút trái lớn hơn đầu mút phải");
        ds.push([lo, hi, m[1] === "[" && isFinite(lo), m[3] === "]" && isFinite(hi)]);
      });
      ds.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      return ds;
    };
    var docTapHop = function (s0) {
      var s = chuan(s0).replace(/^[a-zA-Z]=/, "");
      if (s.charAt(0) === "{") {
        if (s.charAt(s.length - 1) !== "}") throw loiToan("thiếu «}»");
        s = s.slice(1, -1);
      }
      var ds = [];
      if (!s) return ds;
      tachPhan(s).forEach(function (x) {
        if (!x) throw loiToan("có phần tử trống");
        if (x.indexOf("±") >= 0) { ds.push(soTuChuoi(x.replace("±", "+"))); ds.push(soTuChuoi(x.replace("±", "-"))); } else ds.push(soTuChuoi(x));
      });
      ds.sort(function (a, b) { return a - b; });
      return ds;
    };
    var docDiem = function (s0) {
      var s = chuan(s0).replace(/^[a-zA-Z]\w*(?=[([])/, "");
      var m = /^[([](.*)[)\]]$/.exec(s);
      if (m) s = m[1];
      var hai = tachPhan(s);
      if (hai.length !== 2) throw loiToan("toạ độ cần dạng (x; y)");
      return [soTuChuoi(hai[0]), soTuChuoi(hai[1])];
    };
    var docBieuThuc = function (s0) {
      var s = chuan(s0).replace(/(\d),(\d)/g, "$1.$2").replace(/^(y|[a-z]\([a-z]\))=/i, "");
      return phanTich(s, { bien: [], tuDo: true });
    };
    var docGiaTri = function (loai, s) {
      if (loai === "diem") return docDiem(s);
      if (loai === "khoang") return docKhoang(s);
      if (loai === "tap-hop") return docTapHop(s);
      if (loai === "bieu-thuc") return docBieuThuc(s);
      return soTuChuoi(s);
    };
    var gan = function (u, v, e) {
      if (u === v) return true;
      return Math.abs(u - v) <= e + 1e-12;
    };
    var MAU_THU = [-2.37, -1.61, -0.83, -0.29, 0.41, 0.97, 1.53, 2.21, 2.89, 3.67, 4.33, 5.11, 0.13, 1.17, 6.3, -3.4];
    var soSanh = function (loai, u, v, e) {
      if (loai === "diem") return gan(u[0], v[0], e) && gan(u[1], v[1], e);
      if (loai === "tap-hop") {
        if (u.length !== v.length) return false;
        for (var i = 0; i < u.length; i++) if (!gan(u[i], v[i], e)) return false;
        return true;
      }
      if (loai === "khoang") {
        if (u.length !== v.length) return false;
        for (var j = 0; j < u.length; j++) {
          if (!gan(u[j][0], v[j][0], e) || !gan(u[j][1], v[j][1], e) || u[j][2] !== v[j][2] || u[j][3] !== v[j][3]) return false;
        }
        return true;
      }
      if (loai === "bieu-thuc") {
        var ten = Object.keys(bienTrong(v, bienTrong(u, {}))).sort();
        var hopLe = 0;
        for (var k = 0; k < MAU_THU.length; k++) {
          var env = {};
          ten.forEach(function (t, q) { env[t] = MAU_THU[(k + 5 * q) % MAU_THU.length] + 0.013 * q; });
          var a = tinh(u, env), b = tinh(v, env);
          if (!isFinite(a) && !isFinite(b)) continue;
          if (!isFinite(a) || !isFinite(b)) return false;
          if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) return false;
          hopLe++;
        }
        return hopLe >= 8;
      }
      return gan(u, v, e);
    };
    /**
     * Chấm một câu trả lời. dapAn có thể chứa nhiều đáp án chấp nhận, ngăn bằng "|".
     * → { hopLe: false, loi } nếu không đọc được câu trả lời (không tính là một lần sai); { hopLe: true, dung }.
     */
    var chamDapAn = function (loai, nhap, dapAn, saiSo) {
      var e = typeof saiSo === "number" && isFinite(saiSo) && saiSo >= 0 ? saiSo : 0.01;
      var gt;
      try { gt = docGiaTri(loai, nhap); } catch (err) { return { hopLe: false, dung: false, loi: err && err.message ? err.message : String(err) }; }
      var ds = String(dapAn == null ? "" : dapAn).split("|");
      for (var i = 0; i < ds.length; i++) {
        if (!ds[i].trim()) continue;
        try { if (soSanh(loai, gt, docGiaTri(loai, ds[i]), e)) return { hopLe: true, dung: true }; } catch (err2) { /* đáp án ghi sai cú pháp: bỏ qua */ }
      }
      return { hopLe: true, dung: false };
    };

    return {
      phanTich: phanTich, tinh: tinh, bienDich: bienDich, inDep: inDep, bienTrong: bienTrong, soDep: soDep,
      huuTi: huuTi, tinhParabol: tinhParabol, chamDapAn: chamDapAn, chuan: chuan, docGiaTri: docGiaTri, HAM: HAM, HANG: HANG
    };
  })();

  if (tuyChon && tuyChon.chiLoi) return L;
  if (typeof document === "undefined") return L;
  try { window.__sdToan = L; } catch { /* không gắn được */ }

  /* ═══════════════ Phần DOM ═══════════════ */
  var NS = "http://www.w3.org/2000/svg";
  var $$ = function (s, g) { return Array.prototype.slice.call((g || document).querySelectorAll(s)); };
  var tao = function (tag, lop, chu) {
    var e = document.createElement(tag);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };
  var taoS = function (tag, tt) {
    var e = document.createElementNS(NS, tag);
    if (tt) Object.keys(tt).forEach(function (k) { e.setAttribute(k, tt[k]); });
    return e;
  };
  var itDong = false;
  try { itDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* trình duyệt cũ */ }
  var dsSlide = $$(".khung > section");

  var docJson = function (el) {
    var s = el.getAttribute("data-du-lieu");
    if (!s || !s.trim()) return {};
    var o;
    try { o = JSON.parse(s); } catch (e) { throw new Error("data-du-lieu không phải JSON hợp lệ (" + e.message + ")"); }
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("data-du-lieu phải là một đối tượng {…}");
    return o;
  };
  var hopLoi = function (el, ten, e, xoa) {
    if (xoa) el.textContent = "";
    var h = tao("div", "tq-loi", "Không dựng được «" + ten + "»: " + (e && e.message ? e.message : String(e)));
    h.setAttribute("role", "note");
    el.appendChild(h);
    try { console.warn("[khungToan]", ten, e); } catch { /* không có console */ }
  };
  var soLieu = function (v, macDinh) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      var x = L.tinh(L.phanTich(v.replace(/(\d),(\d)/g, "$1.$2"), { bien: [] }), {});
      if (isFinite(x)) return x;
      throw new Error("«" + v + "» không phải một số");
    }
    return macDinh;
  };
  var khoang = function (v, macDinh, ten) {
    if (!Array.isArray(v) || v.length < 2) return macDinh;
    var a = soLieu(v[0], NaN), b = soLieu(v[1], NaN);
    if (!(a < b)) throw new Error(ten + " phải dạng [nhỏ, lớn]");
    return [a, b];
  };
  var mauHopLe = function (m) {
    return typeof m === "string" && (/^#[0-9a-fA-F]{3,8}$/.test(m) || /^[a-zA-Z]{3,20}$/.test(m)) ? m : null;
  };
  var bao = function (el, loai, id, ketQua, chiTiet) {
    var s = el.closest("section");
    var ms = s && s._vao ? Date.now() - s._vao : 0;
    try { parent.postMessage({ type: "smartdoc-su-kien", loai: loai, doiTuongId: id, ketQua: ketQua, thoiGianMs: ms, chiTiet: chiTiet }, "*"); } catch { /* không có cha */ }
  };
  var phatDiem = function (dung) {
    try { document.dispatchEvent(new CustomEvent("sd-diem", { detail: { dung: Boolean(dung) } })); } catch { /* cũ */ }
  };
  // Pháo hoa: phát "sd-phao" cho khung; nếu không ai vẽ (không có .phao mới) thì tự vẽ bằng lớp .phao của khung.
  var phaoHoa = function (soLuong) {
    var truoc = document.querySelectorAll(".phao").length;
    try { document.dispatchEvent(new CustomEvent("sd-phao", { detail: { soLuong: soLuong } })); } catch { /* cũ */ }
    if (document.querySelectorAll(".phao").length > truoc || itDong) return;
    var mau = ["#f2b632", "#2f80ed", "#1f9d62", "#d64545", "#9775fa", "#ff922b"];
    for (var i = 0; i < soLuong; i++) {
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
  var lac = function (e) {
    e.classList.remove("tq-lac");
    void e.offsetWidth;
    e.classList.add("tq-lac");
    setTimeout(function () { e.classList.remove("tq-lac"); }, 450);
  };
  var tiLe = function (el) { var r = el.getBoundingClientRect(); return el.offsetWidth ? r.width / el.offsetWidth : 1; };
  var chanVuot = function (el) { el.addEventListener("touchstart", function (e) { e.stopPropagation(); }, { passive: true }); };
  var ICON = {
    dung: ["M20 6 9 17l-5-5"],
    sai: ["M18 6 6 18", "M6 6l12 12"],
    goiY: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"],
    kiem: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
    nhac: ["M12 8v4", "M12 16h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
    bong: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M2 12h20", "M12 2a14 14 0 0 1 4 10 14 14 0 0 1-4 10", "M12 2a14 14 0 0 0-4 10 14 14 0 0 0 4 10"]
  };
  var icon = function (ten) {
    var s = taoS("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.4", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    ICON[ten].forEach(function (d) { s.appendChild(taoS("path", { d: d })); });
    return s;
  };

  /* ── Chữ giàu (phân số chồng, biến nghiêng) ── */
  var veRich = function (el, arr) {
    el.textContent = "";
    arr.forEach(function (p) {
      if (typeof p === "string") { if (p) el.appendChild(document.createTextNode(p)); return; }
      if (p.tu != null) {
        var s = tao("span", "tq-ps");
        s.appendChild(tao("span", "tq-tu", p.tu));
        s.appendChild(tao("span", "tq-mau", p.mau));
        el.appendChild(s);
      } else if (p.bien) el.appendChild(tao("i", "tq-bien", p.bien));
    });
  };
  var rtChu = function (arr) {
    return arr.map(function (p) {
      if (typeof p === "string") return p;
      if (p.tu != null) return (/^[0-9]+$/.test(p.tu) ? p.tu : "(" + p.tu + ")") + "/" + p.mau;
      return p.bien || "";
    }).join("");
  };
  var rtSo = function (ps, v) {
    if (ps) {
      if (ps.q === 1) return [String(ps.p).replace("-", "−")];
      return [ps.p < 0 ? "−" : "", { tu: String(Math.abs(ps.p)), mau: String(ps.q) }];
    }
    return [L.soDep(v)];
  };

  /* ── Hệ trục SVG ── */
  var buocDep = function (tho) {
    var mu = Math.pow(10, Math.floor(Math.log(tho) / Math.LN10));
    var r = tho / mu;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mu;
  };
  var taoHeTruc = function (vung, W, H, nhanTruc) {
    var x0 = vung.x[0], x1 = vung.x[1], y0 = vung.y[0], y1 = vung.y[1];
    var he = {
      W: W, H: H, x0: x0, x1: x1, y0: y0, y1: y1,
      gx: function (v) { return (v - x0) / (x1 - x0) * W; },
      gy: function (v) { return H - (v - y0) / (y1 - y0) * H; }
    };
    var svg = taoS("svg", { viewBox: "0 0 " + W + " " + H, class: "tq-svg", role: "img", preserveAspectRatio: "xMidYMid meet" });
    var gLuoi = taoS("g", { class: "tq-luoi" }), gTruc = taoS("g", { class: "tq-truc" });
    var bx = buocDep((x1 - x0) / Math.max(4, W / 78)), by = buocDep((y1 - y0) / Math.max(4, H / 62));
    var ax = x0 <= 0 && x1 >= 0 ? he.gx(0) : x0 > 0 ? 0 : W;
    var ay = y0 <= 0 && y1 >= 0 ? he.gy(0) : y0 > 0 ? H : 0;
    var k, v, px, py, t;
    for (k = Math.ceil(x0 / bx); k * bx <= x1 + 1e-9; k++) {
      v = k * bx; px = he.gx(v);
      gLuoi.appendChild(taoS("line", { x1: px.toFixed(1), y1: 0, x2: px.toFixed(1), y2: H }));
      if (Math.abs(v) < bx / 2 && ax === he.gx(0)) continue;
      if (px < 14 || px > W - 14) continue;
      var duoi = ay + 25 <= H - 4;
      t = taoS("text", { x: px.toFixed(1), y: (duoi ? ay + 25 : ay - 10).toFixed(1), "text-anchor": "middle" });
      t.textContent = L.soDep(Math.round(v / bx) * bx);
      gTruc.appendChild(t);
    }
    for (k = Math.ceil(y0 / by); k * by <= y1 + 1e-9; k++) {
      v = k * by; py = he.gy(v);
      gLuoi.appendChild(taoS("line", { x1: 0, y1: py.toFixed(1), x2: W, y2: py.toFixed(1) }));
      if (Math.abs(v) < by / 2 && ay === he.gy(0)) continue;
      if (py < 16 || py > H - 10) continue;
      var trai = ax - 9 >= 34;
      t = taoS("text", { x: (trai ? ax - 9 : ax + 9).toFixed(1), y: (py + 7).toFixed(1), "text-anchor": trai ? "end" : "start" });
      t.textContent = L.soDep(Math.round(v / by) * by);
      gTruc.appendChild(t);
    }
    gTruc.appendChild(taoS("line", { x1: 0, y1: ay.toFixed(1), x2: W - 4, y2: ay.toFixed(1) }));
    gTruc.appendChild(taoS("line", { x1: ax.toFixed(1), y1: H, x2: ax.toFixed(1), y2: 4 }));
    gTruc.appendChild(taoS("path", { d: "M" + W + " " + ay.toFixed(1) + " l-18 -8 v16 z" }));
    gTruc.appendChild(taoS("path", { d: "M" + ax.toFixed(1) + " 0 l-8 18 h16 z" }));
    if (ax === he.gx(0) && ay === he.gy(0)) {
      t = taoS("text", { x: (ax - 9).toFixed(1), y: (ay + 25).toFixed(1), "text-anchor": "end" });
      t.textContent = "O";
      gTruc.appendChild(t);
    }
    var tx = taoS("text", { class: "tq-ten-truc", x: W - 12, y: (ay - 16 < 20 ? ay + 34 : ay - 16).toFixed(1), "text-anchor": "end" });
    tx.textContent = (nhanTruc && nhanTruc[0]) || "x";
    var ty = taoS("text", { class: "tq-ten-truc", x: (ax + 16 > W - 30 ? ax - 16 : ax + 16).toFixed(1), y: 26, "text-anchor": ax + 16 > W - 30 ? "end" : "start" });
    ty.textContent = (nhanTruc && nhanTruc[1]) || "y";
    gTruc.appendChild(tx); gTruc.appendChild(ty);
    svg.appendChild(gLuoi); svg.appendChild(gTruc);
    he.gNoiDung = taoS("g"); he.gDiem = taoS("g");
    svg.appendChild(he.gNoiDung); svg.appendChild(he.gDiem);
    he.svg = svg;
    return he;
  };

  /**
   * Cỡ khung nhìn SVG theo bề rộng thật của chỗ đặt (đo lúc dựng, trước khi khung co giãn sân khấu), để chữ trên hình
   * luôn ~19–21px dù thành phần nằm cả bề ngang slide hay trong một cột. Phần tử đang ẩn (tab chưa mở) thì đoán theo slide.
   */
  var kichThuoc = function (el, kieu) {
    var rong = el.offsetWidth || 0;
    if (rong < 200) { var cha = el.closest(".cot"); rong = (cha && cha.offsetWidth) || 1300; }
    var kep = function (v, a, b) { return Math.round(Math.max(a, Math.min(b, v))); };
    var trongTab = Boolean(el.closest(".tab"));
    if (kieu === "pb") {
      var hep = rong < 860;
      var W = kep(hep ? rong - 14 : (rong - 26) * 1.22 / 2.22 - 14, 380, 1000);
      return { W: W, H: hep ? kep(W * 0.52, 240, 300) : kep(W * 0.68, 300, trongTab ? 380 : 470) };
    }
    var W2 = kep(rong - 14, 380, 1400);
    return { W: W2, H: kep(W2 * 0.6, 260, kieu === "dt-tham" ? 400 : 470) };
  };

  /** Đường cong y = f(x) thành chuỗi "d"; ngắt ở gián đoạn, cắt theo dải [−H, 2H] để toạ độ không phình. */
  var duongCong = function (f, he, N) {
    var tren = -he.H, duoi = 2 * he.H, pts = [], i, x, y;
    for (i = 0; i <= N; i++) {
      x = he.x0 + (he.x1 - he.x0) * i / N;
      y = f(x);
      pts.push(typeof y === "number" && isFinite(y) ? { x: he.gx(x), y: he.gy(y) } : null);
    }
    var d = [], noi = false;
    for (i = 1; i <= N; i++) {
      var p = pts[i - 1], q = pts[i];
      if (!p || !q) { noi = false; continue; }
      if ((p.y < tren && q.y > duoi) || (p.y > duoi && q.y < tren)) { noi = false; continue; }
      var dy = q.y - p.y, t0 = 0, t1 = 1;
      if (dy === 0) { if (p.y < tren || p.y > duoi) { noi = false; continue; } } else {
        var ta = (tren - p.y) / dy, tb = (duoi - p.y) / dy;
        t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.min(1, Math.max(ta, tb));
        if (t0 > t1) { noi = false; continue; }
      }
      if (!noi || t0 > 0) d.push("M" + (p.x + (q.x - p.x) * t0).toFixed(1) + " " + (p.y + dy * t0).toFixed(1));
      d.push("L" + (p.x + (q.x - p.x) * t1).toFixed(1) + " " + (p.y + dy * t1).toFixed(1));
      noi = t1 === 1;
    }
    return d.join("");
  };

  var taoDiem = function (cha, lop) {
    var g = taoS("g", { class: "tq-diem " + (lop || "") });
    var c = taoS("circle", { r: 10 });
    var t = taoS("text", { class: "tq-nhan" });
    g.appendChild(c); g.appendChild(t);
    cha.appendChild(g);
    return {
      g: g,
      dat: function (he, x, y, nhan, dx, dy, neo) {
        var px = he.gx(x), py = he.gy(y);
        var trong = isFinite(px) && isFinite(py) && px >= -5 && px <= he.W + 5 && py >= -5 && py <= he.H + 5;
        g.style.display = trong ? "" : "none";
        if (!trong) return;
        c.setAttribute("cx", px.toFixed(1)); c.setAttribute("cy", py.toFixed(1));
        if (neo === "start" && px + dx + nhan.length * 11 > he.W - 6) { neo = "end"; dx = -Math.abs(dx); }
        if (neo === "end" && px + dx - nhan.length * 11 < 6) { neo = "start"; dx = Math.abs(dx); }
        if (neo === "middle") px = Math.max(nhan.length * 5.5 + 6, Math.min(he.W - nhan.length * 5.5 - 6, px));
        var ty = Math.max(22, Math.min(he.H - 8, py + dy));
        t.setAttribute("x", (px + dx).toFixed(1)); t.setAttribute("y", ty.toFixed(1)); t.setAttribute("text-anchor", neo || "start");
        t.textContent = nhan;
      }
    };
  };

  /** Bộ chuyển động: giá trị hiển thị trôi dần về đích mỗi khung hình (tắt khi người dùng giảm chuyển động). */
  var taoTroi = function (gt, ve) {
    var dich = {}, chay = false;
    Object.keys(gt).forEach(function (k) { dich[k] = gt[k]; });
    var buoc = function () {
      var con = false;
      Object.keys(gt).forEach(function (k) {
        var d = dich[k] - gt[k];
        if (Math.abs(d) > 2e-3 * Math.max(1, Math.abs(dich[k]))) { gt[k] += d * 0.3; con = true; } else gt[k] = dich[k];
      });
      ve(gt);
      if (con) requestAnimationFrame(buoc); else chay = false;
    };
    return function (k, v) {
      dich[k] = v;
      if (itDong) { gt[k] = v; ve(gt); return; }
      if (!chay) { chay = true; requestAnimationFrame(buoc); }
    };
  };

  /* ── Thanh trượt ── */
  var taoThanhTruot = function (ten, min, max, buoc, gt, boQua0, khiDoi) {
    var hang = tao("div", "tq-truot");
    var nhan = tao("span", "tq-ten", ten);
    var tru = tao("button", "tq-cong", "−"); tru.type = "button"; tru.setAttribute("aria-label", "Giảm " + ten);
    var cong = tao("button", "tq-cong", "+"); cong.type = "button"; cong.setAttribute("aria-label", "Tăng " + ten);
    var r = document.createElement("input");
    r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(buoc);
    r.setAttribute("aria-label", "Tham số " + ten);
    var o = document.createElement("output");
    var thapPhan = (String(buoc).split(".")[1] || "").length;
    var cu = gt;
    var lamTron = function (v) {
      v = Math.round((v - min) / buoc) * buoc + min;
      return Math.max(min, Math.min(max, +v.toFixed(Math.min(10, thapPhan + 2))));
    };
    var dat = function (v, im) {
      v = lamTron(v);
      if (boQua0 && Math.abs(v) < buoc / 2) {
        var len = cu < 0 || (cu === 0 && v >= 0);
        v = lamTron(len ? buoc : -buoc);
        if (Math.abs(v) < buoc / 2) v = lamTron(len ? -buoc : buoc);
      }
      cu = v;
      r.value = String(v);
      o.textContent = L.soDep(v);
      r.style.setProperty("--p", ((v - min) / (max - min) * 100).toFixed(2) + "%");
      if (!im) khiDoi(v);
    };
    r.addEventListener("input", function () { dat(parseFloat(r.value)); });
    r.addEventListener("pointerup", function () { r.blur(); });
    tru.addEventListener("click", function () { dat(cu - buoc); });
    cong.addEventListener("click", function () { dat(cu + buoc); });
    hang.appendChild(nhan); hang.appendChild(tru); hang.appendChild(r); hang.appendChild(cong); hang.appendChild(o);
    chanVuot(hang);
    dat(gt, true);
    return { el: hang, dat: dat, giaTri: function () { return cu; } };
  };

  /* ═══════════════ .parabol ═══════════════ */
  var dungParabol = function (el) {
    var d = docJson(el);
    var gt = { a: soLieu(d.a, 1), b: soLieu(d.b, 0), c: soLieu(d.c, 0) };
    if (gt.a === 0) throw new Error("a phải khác 0");
    var keo = (Array.isArray(d.keo) ? d.keo : ["a", "b", "c"]).filter(function (k) { return k === "a" || k === "b" || k === "c"; });
    var gh = d.gioiHan && typeof d.gioiHan === "object" ? d.gioiHan : {};
    var macDinhGH = { a: [-4, 4, 0.5], b: [-8, 8, 1], c: [-8, 8, 1] };
    var hien = Array.isArray(d.hien) ? d.hien : ["dinh", "truc", "giaoOx", "giaoOy"];
    var co = function (k) { return hien.indexOf(k) >= 0; };
    var vung = d.vung && typeof d.vung === "object" ? d.vung : {};
    vung = { x: khoang(vung.x, [-6, 6], "vung.x"), y: khoang(vung.y, [-6, 8], "vung.y") };

    el.textContent = "";
    var bo = tao("div", "tq-pb");
    var the = tao("div", "tq-the");
    var kt = kichThuoc(el, "pb");
    var he = taoHeTruc(vung, kt.W, kt.H, ["x", "y"]);
    he.svg.setAttribute("aria-label", "Đồ thị parabol");
    var truc = taoS("line", { class: "tq-doi-xung", y1: 0, y2: he.H });
    var nhanTruc = taoS("text", { class: "tq-nhan tq-nhan-xung", y: 28 });
    var duong = taoS("path", { class: "tq-duong", pathLength: 1 });
    var gTruc = taoS("g", { "data-chi": "truc" });
    if (co("truc")) { gTruc.appendChild(truc); gTruc.appendChild(nhanTruc); he.gNoiDung.appendChild(gTruc); }
    duong.setAttribute("data-chi", "do-thi");
    he.gNoiDung.appendChild(duong);
    var gOx = taoS("g", { "data-chi": "giao-ox" });
    he.gDiem.appendChild(gOx);
    var dOy = co("giaoOy") ? taoDiem(he.gDiem, "tq-d-oy") : null;
    var dOx1 = co("giaoOx") ? taoDiem(gOx, "tq-d-ox") : null;
    var dOx2 = co("giaoOx") ? taoDiem(gOx, "tq-d-ox") : null;
    var dDinh = co("dinh") ? taoDiem(he.gDiem, "tq-d-dinh") : null;
    if (dOy) dOy.g.setAttribute("data-chi", "giao-oy");
    if (dDinh) dDinh.g.setAttribute("data-chi", "dinh");
    the.appendChild(he.svg);
    bo.appendChild(the);

    var bang = tao("div", "tq-bang");
    var ct = tao("div", "tq-ct");
    ct.setAttribute("aria-live", "polite");
    ct.setAttribute("data-chi", "cong-thuc");
    bang.appendChild(ct);
    var nhanDiem = { dinh: "", ox1: "", ox2: "", oy: "", truc: "" };

    var ve = function (g) {
      var a = g.a, b = g.b, c = g.c;
      duong.setAttribute("d", duongCong(function (x) { return (a * x + b) * x + c; }, he, 320));
      var k = L.tinhParabol(a, b, c);
      if (co("truc")) {
        var px = he.gx(k.xI), thay = isFinite(px) && px > -2 && px < he.W + 2;
        truc.style.display = nhanTruc.style.display = thay ? "" : "none";
        if (thay) {
          truc.setAttribute("x1", px.toFixed(1)); truc.setAttribute("x2", px.toFixed(1));
          var phai = px < he.W - 130;
          nhanTruc.setAttribute("x", (px + (phai ? 10 : -10)).toFixed(1));
          nhanTruc.setAttribute("text-anchor", phai ? "start" : "end");
          nhanTruc.textContent = nhanDiem.truc;
        }
      }
      var len = a > 0;
      if (dDinh) dDinh.dat(he, k.xI, k.yI, nhanDiem.dinh, 0, len ? 38 : -20, "middle");
      if (dOy) dOy.dat(he, 0, c, nhanDiem.oy, 16, len ? -14 : 30, "start");
      if (dOx1) {
        var hai = k.delta > 1e-9;
        dOx1.g.style.display = dOx2.g.style.display = "none";
        if (hai || (k.delta >= -1e-9 && !dDinh)) {
          dOx1.dat(he, k.x1, 0, nhanDiem.ox1, -12, len ? 32 : -16, "end");
          if (hai) dOx2.dat(he, k.x2, 0, nhanDiem.ox2, 12, len ? 32 : -16, "start");
        }
      }
    };
    var troi = taoTroi({ a: gt.a, b: gt.b, c: gt.c }, ve);

    // Bảng thông tin (chữ chính xác theo giá trị đích, không theo giá trị đang trôi)
    var tt = tao("dl", "tq-tt");
    tt.setAttribute("data-chi", "bang-thong-tin");
    var hang = {};
    var themHang = function (ma, nhan) {
      var dt = tao("dt");
      veRich(dt, nhan);
      var dd = tao("dd");
      dd.setAttribute("data-chi", "hang-" + ma);
      tt.appendChild(dt); tt.appendChild(dd);
      hang[ma] = dd;
    };
    themHang("mo", ["Bề lõm"]);
    if (co("giaoOx") || co("dinh") || co("delta")) themHang("delta", ["Δ = ", { bien: "b" }, "² − 4", { bien: "ac" }]);
    if (co("dinh")) themHang("dinh", ["Đỉnh"]);
    if (co("truc")) themHang("truc", ["Trục đối xứng"]);
    if (co("giaoOy")) themHang("oy", ["Giao Oy"]);
    if (co("giaoOx")) themHang("ox", ["Giao Ox"]);
    if (co("dinh") || co("gt")) themHang("gt", ["GTNN"]);
    var cuChu = {};
    var datHang = function (ma, arr, nhanMoi) {
      var dd = hang[ma];
      if (!dd) return;
      var s = rtChu(arr);
      if (nhanMoi) { var dt = dd.previousSibling; if (dt.textContent !== nhanMoi) dt.textContent = nhanMoi; }
      if (cuChu[ma] === s) return;
      var dau = cuChu[ma] === undefined;
      cuChu[ma] = s;
      veRich(dd, arr);
      if (!dau && !itDong) { dd.classList.remove("tq-doi"); void dd.offsetWidth; dd.classList.add("tq-doi"); }
    };
    var capNhatChu = function () {
      var a = gt.a, b = gt.b, c = gt.c;
      var k = L.tinhParabol(a, b, c);
      var A = k.A, B = k.B, C = k.C;
      var ham = [{ bien: "y" }, " = "], dau = true;
      [[A, a, "x²"], [B, b, "x"], [C, c, ""]].forEach(function (t) {
        var v = t[1];
        if (Math.abs(v) < 1e-12) return;
        var am = v < 0, av = Math.abs(v);
        ham.push(dau ? (am ? "−" : "") : (am ? " − " : " + "));
        if (!(t[2] && Math.abs(av - 1) < 1e-12)) ham = ham.concat(rtSo(t[0] ? { p: Math.abs(t[0].p), q: t[0].q } : null, av));
        if (t[2]) ham.push({ bien: t[2] });
        dau = false;
      });
      veRich(ct, ham);
      var xI = rtSo(k.XI, k.xI), yI = rtSo(k.YI, k.yI);
      nhanDiem.dinh = "I(" + rtChu(xI) + "; " + rtChu(yI) + ")";
      nhanDiem.truc = "x = " + rtChu(xI);
      nhanDiem.oy = "(0; " + rtChu(rtSo(C, c)) + ")";
      datHang("mo", a > 0 ? ["quay lên (", { bien: "a" }, " > 0)"] : ["quay xuống (", { bien: "a" }, " < 0)"]);
      datHang("delta", rtSo(k.D, k.delta));
      datHang("dinh", ["I("].concat(xI, ["; "], yI, [")"]));
      datHang("truc", [{ bien: "x" }, " = "].concat(xI));
      datHang("oy", ["(0; "].concat(rtSo(C, c), [")"]));
      var ox;
      if (k.delta < -1e-12) ox = ["không cắt Ox (Δ < 0)"];
      else if (Math.abs(k.delta) <= 1e-12) ox = ["tiếp xúc Ox tại ("].concat(xI, ["; 0)"]);
      else if (k.nghiem && k.nghiem.length === 2) {
        var r1 = rtSo(k.nghiem[0]), r2 = rtSo(k.nghiem[1]);
        ox = ["("].concat(r1, ["; 0) và ("], r2, ["; 0)"]);
        nhanDiem.ox1 = "(" + rtChu(r1) + "; 0)"; nhanDiem.ox2 = "(" + rtChu(r2) + "; 0)";
      } else if (k.can) {
        var s = k.can.s, tu = (s.p === 1 ? "" : String(s.p)) + "√" + k.can.m;
        var phanCan = s.q === 1 ? [tu] : [{ tu: tu, mau: String(s.q) }];
        ox = [{ bien: "x" }, " = "].concat(k.can.r.p === 0 ? ["±"] : rtSo(k.can.r).concat([" ± "]), phanCan,
          ["  (≈ " + L.soDep(k.x1) + " và " + L.soDep(k.x2) + ")"]);
        nhanDiem.ox1 = "x ≈ " + L.soDep(k.x1); nhanDiem.ox2 = "x ≈ " + L.soDep(k.x2);
      } else {
        ox = [{ bien: "x" }, " ≈ " + L.soDep(k.x1) + " và " + L.soDep(k.x2)];
        nhanDiem.ox1 = "x ≈ " + L.soDep(k.x1); nhanDiem.ox2 = "x ≈ " + L.soDep(k.x2);
      }
      if (Math.abs(k.delta) <= 1e-12) { nhanDiem.ox1 = "(" + rtChu(xI) + "; 0)"; }
      datHang("ox", ox);
      datHang("gt", yI.concat([" khi ", { bien: "x" }, " = "], xI), a > 0 ? "GTNN" : "GTLN");
    };

    if (keo.length) {
      var hop = tao("div", "tq-cac-truot");
      keo.forEach(function (ten) {
        var g = Array.isArray(gh[ten]) ? gh[ten] : macDinhGH[ten];
        var mn = soLieu(g[0], macDinhGH[ten][0]), mx = soLieu(g[1], macDinhGH[ten][1]), bu = soLieu(g[2], macDinhGH[ten][2]);
        if (!(bu > 0) || !(mn < mx)) throw new Error("gioiHan." + ten + " phải dạng [min, max, bước]");
        mn = Math.min(mn, gt[ten]); mx = Math.max(mx, gt[ten]);
        var tr = taoThanhTruot(ten, mn, mx, bu, gt[ten], ten === "a", function (v) {
          gt[ten] = v;
          capNhatChu();
          troi(ten, v);
        });
        tr.el.setAttribute("data-chi", "thanh-" + ten);
        hop.appendChild(tr.el);
      });
      bang.appendChild(hop);
    }
    bang.appendChild(tt);
    bo.appendChild(bang);
    el.appendChild(bo);
    capNhatChu();
    ve({ a: gt.a, b: gt.b, c: gt.c });
  };

  /* ═══════════════ .do-thi ═══════════════ */
  var MAU_HAM = ["var(--mau)", "#e8590c", "#2b8a3e", "#ae3ec9"];
  var dungDoThi = function (el) {
    var d = docJson(el);
    var bien = typeof d.bien === "string" && /^[a-zA-Z]$/.test(d.bien) ? d.bien : "x";
    var tham = (Array.isArray(d.tham) ? d.tham : []).filter(function (t) {
      return t && typeof t.ten === "string" && /^[a-zA-Z]{1,4}$/.test(t.ten) && t.ten !== bien && !L.HAM[t.ten] && !L.HANG[t.ten];
    }).slice(0, 4);
    var tenBien = [bien].concat(tham.map(function (t) { return t.ten; }));
    var dsHam = (Array.isArray(d.ham) ? d.ham : []).slice(0, 4);
    if (!dsHam.length) throw new Error("thiếu «ham» (danh sách hàm số cần vẽ)");
    var ham = dsHam.map(function (h, i) {
      if (!h || typeof h.bt !== "string") throw new Error("hàm thứ " + (i + 1) + " thiếu «bt»");
      var bd;
      try { bd = L.bienDich(h.bt, tenBien); } catch (e) { throw new Error("hàm «" + h.bt + "»: " + e.message); }
      return { f: bd.f, ast: bd.ast, nhan: typeof h.nhan === "string" ? h.nhan : "", mau: mauHopLe(h.mau) || MAU_HAM[i % MAU_HAM.length] };
    });
    var vung = d.vung && typeof d.vung === "object" ? d.vung : {};
    vung = { x: khoang(vung.x, [-5, 5], "vung.x"), y: khoang(vung.y, [-5, 5], "vung.y") };
    var buocHien = d.buocHien === true;
    var nhanTruc = Array.isArray(d.truc) ? d.truc.map(String) : [bien, "y"];

    el.textContent = "";
    var the = tao("div", "tq-the");
    var kt = kichThuoc(el, tham.length ? "dt-tham" : "dt");
    var he = taoHeTruc(vung, kt.W, kt.H, nhanTruc);
    he.svg.setAttribute("aria-label", "Đồ thị hàm số");
    var gt = {};
    tham.forEach(function (t) { gt[t.ten] = soLieu(t.gt, soLieu(t.min, 0)); });
    var env = function (g, x) { var e = {}; Object.keys(g).forEach(function (k) { e[k] = g[k]; }); e[bien] = x; return e; };

    // Góc đặt chú giải: chọn góc ít điểm đồ thị nhất
    var hBox = 16 + ham.length * 38, wBox = 0;
    var chuGiai = ham.map(function (h) {
      var s = h.nhan && h.nhan.indexOf("=") >= 0 ? h.nhan : (h.nhan || "y") + " = " + L.inDep(h.ast);
      wBox = Math.max(wBox, 70 + s.length * 11.5);
      return s;
    });
    wBox = Math.min(wBox, he.W - 20);
    var goc = [[12, 12], [he.W - wBox - 12, 12], [12, he.H - hBox - 12], [he.W - wBox - 12, he.H - hBox - 12]];
    var dem = goc.map(function (g) {
      var n = 0;
      ham.forEach(function (h) {
        for (var i = 0; i <= 120; i++) {
          var x = he.x0 + (he.x1 - he.x0) * i / 120, y = h.f(env(gt, x));
          var px = he.gx(x), py = he.gy(y);
          if (px >= g[0] && px <= g[0] + wBox && py >= g[1] && py <= g[1] + hBox) n++;
        }
      });
      return n;
    });
    var gocChon = goc[dem.indexOf(Math.min.apply(null, dem))];

    var nhom = ham.map(function (h, i) {
      var g = taoS("g", { class: "tq-ham" + (buocHien ? " hien" : ""), "data-chi": "ham-" + (i + 1) });
      var p = taoS("path", { class: "tq-duong", pathLength: 1 });
      p.style.stroke = h.mau;
      g.appendChild(p);
      var cg = taoS("g", { class: "tq-chu-giai", transform: "translate(" + gocChon[0].toFixed(1) + " " + (gocChon[1] + 8 + i * 38).toFixed(1) + ")" });
      cg.appendChild(taoS("rect", { x: 0, y: 0, width: wBox.toFixed(1), height: 34, rx: 9 }));
      var ln = taoS("line", { x1: 12, y1: 17, x2: 44, y2: 17 });
      ln.style.stroke = h.mau;
      cg.appendChild(ln);
      var tx = taoS("text", { x: 56, y: 25 });
      tx.textContent = chuGiai[i];
      cg.appendChild(tx);
      g.appendChild(cg);
      he.gNoiDung.appendChild(g);
      return p;
    });

    var dsDiem = (Array.isArray(d.diem) ? d.diem : []).slice(0, 12).map(function (p, j) {
      if (!p || typeof p !== "object") return null;
      var bx = typeof p.x === "string" ? L.bienDich(p.x, tenBien.slice(1)) : null;
      var by = typeof p.y === "string" ? L.bienDich(p.y, tenBien.slice(1)) : null;
      var g = taoS("g", { class: p.hien === true ? "hien" : "", "data-chi": typeof p.chi === "string" && /^[a-z0-9-]{1,30}$/.test(p.chi) ? p.chi : "diem-" + (j + 1) });
      var ch1 = taoS("line", { class: "tq-chieu" }), ch2 = taoS("line", { class: "tq-chieu" });
      g.appendChild(ch1); g.appendChild(ch2);
      he.gDiem.appendChild(g);
      var dm = taoDiem(g, "");
      if (mauHopLe(p.mau)) dm.g.firstChild.style.fill = p.mau;
      return {
        ve: function (gg) {
          var x = bx ? bx.f(gg) : soLieu(p.x, NaN);
          var y = by ? by.f(gg) : typeof p.y === "number" ? p.y : ham[0].f(env(gg, x));
          var nhan = typeof p.nhan === "string" ? p.nhan : "(" + L.soDep(x) + "; " + L.soDep(y) + ")";
          dm.dat(he, x, y, nhan, 14, -14, "start");
          var px = he.gx(x), py = he.gy(y), ax = Math.max(0, Math.min(he.W, he.gx(0))), ay = Math.max(0, Math.min(he.H, he.gy(0)));
          var thay = isFinite(px) && isFinite(py) && p.chieu !== false;
          [ch1, ch2].forEach(function (l) { l.style.display = thay ? "" : "none"; });
          if (!thay) return;
          ch1.setAttribute("x1", px.toFixed(1)); ch1.setAttribute("y1", py.toFixed(1)); ch1.setAttribute("x2", px.toFixed(1)); ch1.setAttribute("y2", ay.toFixed(1));
          ch2.setAttribute("x1", px.toFixed(1)); ch2.setAttribute("y1", py.toFixed(1)); ch2.setAttribute("x2", ax.toFixed(1)); ch2.setAttribute("y2", py.toFixed(1));
        }
      };
    }).filter(Boolean);

    var ve = function (g) {
      ham.forEach(function (h, i) {
        nhom[i].setAttribute("d", duongCong(function (x) { return h.f(env(g, x)); }, he, 480));
      });
      dsDiem.forEach(function (p) { p.ve(g); });
    };
    var hienTai = {};
    Object.keys(gt).forEach(function (k) { hienTai[k] = gt[k]; });
    var troi = taoTroi(hienTai, ve);
    the.appendChild(he.svg);
    el.appendChild(the);
    if (tham.length) {
      var dk = tao("div", "tq-dk");
      tham.forEach(function (t) {
        var mn = soLieu(t.min, -5), mx = soLieu(t.max, 5), bu = soLieu(t.buoc, 0.5);
        if (!(mn < mx) || !(bu > 0)) throw new Error("tham số «" + t.ten + "» cần min < max, buoc > 0");
        mn = Math.min(mn, gt[t.ten]); mx = Math.max(mx, gt[t.ten]);
        var tr = taoThanhTruot(t.ten, mn, mx, bu, gt[t.ten], t.khac0 === true, function (v) { gt[t.ten] = v; troi(t.ten, v); });
        tr.el.setAttribute("data-chi", "thanh-" + t.ten);
        dk.appendChild(tr.el);
      });
      el.appendChild(dk);
    }
    ve(hienTai);
  };

  /* ═══════════════ .so-do ═══════════════ */
  var dungSoDo = function (el) {
    var loai = el.getAttribute("data-loai") || "flow";
    var nut = Array.prototype.filter.call(el.children, function (c) { return c.classList.contains("nut"); });
    var coBuoc = el.getAttribute("data-hien") !== "khong";
    if (loai === "ma-tran") {
      var cot = parseInt(el.getAttribute("data-cot"), 10);
      el.style.setProperty("--cot", String(cot >= 1 && cot <= 8 ? cot : 3));
    }
    if ((loai === "flow" || loai === "timeline") && nut.length >= 5) el.classList.add("tq-nhieu");
    nut.forEach(function (n) {
      if (coBuoc && !n.classList.contains("tieu-de")) n.classList.add("hien");
    });
  };

  /* ═══════════════ .nhap-dap-an ═══════════════ */
  var GOI_Y_NHAP = {
    so: "Nhập một số, ví dụ 1/2 hoặc 0,5",
    diem: "Nhập toạ độ dạng (x; y)",
    khoang: "Ví dụ: (-oo; 2] hoặc (-oo; 1) U (3; +oo)",
    "tap-hop": "Ví dụ: {1; 3}",
    "bieu-thuc": "Ví dụ: x^2 - 4x + 3"
  };
  var dapAnDep = function (s) {
    return String(s).trim().replace(/-/g, "−").replace(/\+?oo/g, function (m) { return m.charAt(0) === "+" ? "+∞" : "∞"; })
      .replace(/\s*U\s*/g, " ∪ ").replace(/\s*;\s*/g, "; ").replace(/\^2/g, "²");
  };
  var dungNhapDapAn = function (el, i, k) {
    var loai = el.getAttribute("data-loai") || "so";
    if (!GOI_Y_NHAP[loai]) loai = "so";
    var dapAn = el.getAttribute("data-dap-an") || "";
    var saiSo = parseFloat(String(el.getAttribute("data-sai-so") || "").replace(",", "."));
    if (!isFinite(saiSo)) saiSo = undefined;
    var kiemId = el.getAttribute("data-kiem") || "";
    var id = kiemId || "s" + (k + 1) + "-n" + (i + 1);
    var cau = el.querySelector(":scope > .cau");
    var dsGoY = $$(":scope > .go-y", el);
    var dsLoiSai = $$(":scope > .loi-sai", el);
    var giai = el.querySelector(":scope > .giai-thich");

    var hang = tao("div", "tq-nhap");
    var o = document.createElement("input");
    o.type = "text"; o.className = "tq-o"; o.autocomplete = "off"; o.spellcheck = false;
    o.setAttribute("autocapitalize", "off");
    o.setAttribute("enterkeyhint", "done");
    o.placeholder = GOI_Y_NHAP[loai];
    o.setAttribute("aria-label", "Đáp án");
    o.setAttribute("data-chi", "o-nhap");
    var nutKT = tao("button", "tq-nut-chinh"); nutKT.type = "button";
    nutKT.appendChild(icon("kiem")); nutKT.appendChild(document.createTextNode("Kiểm tra"));
    nutKT.setAttribute("data-chi", "nut-kiem-tra");
    hang.appendChild(o); hang.appendChild(nutKT);
    var nutGY = null, chuGY = null, bacGoY = 0;
    if (dsGoY.length || giai) {
      nutGY = tao("button", "tq-nut-phu"); nutGY.type = "button";
      nutGY.appendChild(icon("goiY"));
      chuGY = tao("span");
      nutGY.appendChild(chuGY);
      nutGY.setAttribute("data-chi", "nut-goi-y");
      hang.appendChild(nutGY);
    }
    var xemTruoc = null;
    if (loai === "bieu-thuc") {
      xemTruoc = tao("div", "tq-xem-truoc");
      xemTruoc.setAttribute("aria-live", "polite");
    }
    var phanHoi = tao("div", "tq-phan-hoi");
    phanHoi.setAttribute("aria-live", "polite");
    if (cau && cau.nextSibling) el.insertBefore(hang, cau.nextSibling); else if (cau) el.appendChild(hang); else el.insertBefore(hang, el.firstChild);
    var sau = hang;
    if (xemTruoc) { el.insertBefore(xemTruoc, sau.nextSibling); sau = xemTruoc; }
    el.insertBefore(phanHoi, sau.nextSibling);
    dsLoiSai.forEach(function (x) { el.appendChild(x); });
    dsGoY.forEach(function (x, j) { x.setAttribute("data-chi", "goi-y-" + (j + 1)); el.appendChild(x); });
    if (giai) { giai.setAttribute("data-chi", "giai-thich"); el.appendChild(giai); }
    chanVuot(hang);

    var soSai = 0, xong = false;
    var capNhatNutGY = function () {
      if (!nutGY) return;
      if (bacGoY < dsGoY.length) chuGY.textContent = dsGoY.length > 1 ? "Gợi ý " + (bacGoY + 1) + "/" + dsGoY.length : "Gợi ý";
      else if (giai && !xong) chuGY.textContent = "Xem lời giải";
      else { chuGY.textContent = dsGoY.length ? "Đã xem gợi ý" : "Lời giải"; nutGY.disabled = true; }
    };
    capNhatNutGY();
    var noi = function (lop, ic, chu) {
      phanHoi.className = "tq-phan-hoi " + lop;
      phanHoi.textContent = "";
      phanHoi.appendChild(icon(ic));
      phanHoi.appendChild(tao("span", null, chu));
    };
    var ketThuc = function (dung) {
      xong = true;
      o.readOnly = true; nutKT.disabled = true;
      el.classList.add(dung ? "tq-dung" : "tq-het");
      if (giai) giai.classList.add("tq-mo");
      capNhatNutGY();
      phatDiem(dung);
    };
    var baoLan = function (dung, gt) {
      bao(el, "DIEN_KHUYET", id, dung ? "DUNG" : "SAI", { kiem: kiemId, gt: gt, loai: loai, lan: soSai + (dung ? 1 : 0) });
    };
    if (nutGY) {
      nutGY.addEventListener("click", function () {
        if (bacGoY < dsGoY.length) {
          dsGoY[bacGoY].classList.add("tq-mo");
          bacGoY++;
        } else if (giai && !xong) {
          noi("sai", "nhac", "Đáp án: " + dapAnDep(dapAn.split("|")[0]) + " — em đọc kĩ lời giải nhé.");
          baoLan(false, "xem-loi-giai");
          ketThuc(false);
        }
        capNhatNutGY();
      });
    }
    if (xemTruoc) {
      var veXemTruoc = function () {
        var v = o.value.trim();
        xemTruoc.textContent = "";
        xemTruoc.classList.remove("loi");
        if (!v) return;
        try {
          var bt = L.inDep(L.docGiaTri("bieu-thuc", v));
          xemTruoc.appendChild(tao("span", "tq-xem-nhan", "Em đang nhập"));
          xemTruoc.appendChild(tao("span", "tq-xem-bt", (/^\s*(y|[a-z]\([a-z]\))\s*=/i.test(v) ? v.split("=")[0].trim() + " = " : "") + bt));
        } catch (e) {
          xemTruoc.classList.add("loi");
          xemTruoc.appendChild(tao("span", "tq-xem-nhan", "Đang gõ dở…"));
        }
      };
      o.addEventListener("input", veXemTruoc);
    }
    var kiem = function () {
      if (xong) return;
      var v = o.value.trim();
      if (!v) { noi("", "nhac", "Em hãy nhập đáp án trước nhé."); o.focus(); return; }
      var kq = L.chamDapAn(loai, v, dapAn, saiSo);
      if (!kq.hopLe) { noi("sai", "nhac", "Chưa đọc được đáp án: " + kq.loi + ". " + GOI_Y_NHAP[loai] + "."); lac(o); return; }
      dsLoiSai.forEach(function (x) { x.classList.remove("tq-mo"); });
      if (kq.dung) {
        noi("dung", "dung", soSai ? "Chính xác! Em đã sửa đúng rồi." : "Chính xác! Giỏi lắm.");
        baoLan(true, L.chuan(v));
        phaoHoa(28);
        ketThuc(true);
        return;
      }
      // Lỗi sai hay gặp: .loi-sai[data-khi] khớp (sau chuẩn hoá, cùng cách chấm) thì hiện lời phản hồi riêng
      var khop = null;
      for (var j = 0; j < dsLoiSai.length && !khop; j++) {
        var khi = dsLoiSai[j].getAttribute("data-khi") || "";
        if (khi && L.chamDapAn(loai, v, khi, saiSo).dung) khop = dsLoiSai[j];
      }
      soSai++;
      lac(o);
      baoLan(false, khop ? (khop.getAttribute("data-khi") || "").split("|")[0].trim() : L.chuan(v));
      if (khop) khop.classList.add("tq-mo");
      if (soSai >= 3) {
        noi("sai", "sai", "Chưa đúng. Đáp án: " + dapAnDep(dapAn.split("|")[0]) + (giai ? " — xem lời giải bên dưới." : "."));
        ketThuc(false);
      } else {
        noi("sai", "sai", (khop ? "Chưa đúng — xem nhận xét bên dưới" : "Chưa đúng, em thử lại nhé") + " (lần " + soSai + "/3)." +
          (bacGoY < dsGoY.length ? " Bấm «Gợi ý» nếu cần." : ""));
        o.select();
      }
    };
    nutKT.addEventListener("click", kiem);
    o.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); kiem(); } });
  };

  /* ═══════════════ .phan-loai ═══════════════ */
  var dungPhanLoai = function (el, i, k) {
    var dsNhom = Array.prototype.filter.call(el.children, function (c) { return c.classList.contains("nhom"); });
    var dsMuc = Array.prototype.filter.call(el.children, function (c) { return c.classList.contains("muc"); });
    if (dsNhom.length < 2 || !dsMuc.length) throw new Error("cần ít nhất 2 .nhom và 1 .muc");
    var id = el.getAttribute("data-kiem") || "s" + (k + 1) + "-p" + (i + 1);
    var khay = tao("div", "tq-khay"), luoi = tao("div", "tq-cac-nhom"), tienDo = tao("div", "tq-tien-do");
    luoi.style.setProperty("--so-nhom", String(Math.min(dsNhom.length, 4)));
    var o = [];
    dsNhom.forEach(function (g, j) {
      var dau = tao("div", "tq-nhom-dau");
      var ten = g.getAttribute("data-ten");
      if (ten) dau.appendChild(tao("b", null, ten));
      while (g.firstChild) dau.appendChild(g.firstChild);
      g.appendChild(dau);
      var vung = tao("div", "tq-nhom-o");
      g.appendChild(vung);
      o.push(vung);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("data-chi-so", String(j));
      luoi.appendChild(g);
    });
    var tron = dsMuc.slice();
    for (var t = tron.length - 1; t > 0; t--) { var r = Math.floor(Math.random() * (t + 1)); var x = tron[t]; tron[t] = tron[r]; tron[r] = x; }
    tron.forEach(function (m) { m.setAttribute("tabindex", "0"); m.setAttribute("role", "button"); khay.appendChild(m); });
    el.appendChild(khay); el.appendChild(luoi); el.appendChild(tienDo);
    chanVuot(el);

    var chon = null, nham = 0, xong = 0;
    var capNhat = function () {
      if (xong === dsMuc.length) {
        tienDo.textContent = nham === 0 ? "Hoàn thành! Em xếp đúng tất cả ngay lần đầu." : "Hoàn thành! (" + nham + " lần nhầm)";
        tienDo.classList.add("xong");
      } else tienDo.textContent = "Đã xếp " + xong + "/" + dsMuc.length + " — chọn một mục rồi bấm vào nhóm đúng (hoặc kéo thả).";
    };
    capNhat();
    var datChon = function (m) {
      if (chon) chon.classList.remove("tq-chon");
      chon = m;
      if (chon) chon.classList.add("tq-chon");
      el.classList.toggle("tq-dang-chon", Boolean(chon));
    };
    var bay = function (m, dich) {
      var truoc = m.getBoundingClientRect();
      dich.appendChild(m);
      m.style.transform = "";
      if (itDong) return;
      var sau = m.getBoundingClientRect(), tl = tiLe(el) || 1;
      m.style.transition = "none";
      m.style.transform = "translate(" + ((truoc.left - sau.left) / tl).toFixed(1) + "px," + ((truoc.top - sau.top) / tl).toFixed(1) + "px)";
      void m.offsetWidth;
      m.style.transition = "transform .5s cubic-bezier(.2, .8, .2, 1)";
      m.style.transform = "";
      setTimeout(function () { m.style.transition = ""; }, 550);
    };
    var xep = function (m, g) {
      if (!m || m.classList.contains("tq-da-xep")) return;
      var j = +g.getAttribute("data-chi-so");
      if (String(m.getAttribute("data-nhom")).trim() === String(j)) {
        datChon(null);
        m.classList.add("tq-da-xep");
        m.removeAttribute("tabindex");
        bay(m, o[j]);
        xong++;
        capNhat();
        if (xong === dsMuc.length) {
          phaoHoa(40);
          bao(el, "GHEP_DOI", id, nham === 0 ? "DUNG" : "SAI", { kiem: el.getAttribute("data-kiem") || "", gt: "nham-" + nham, kieu: "phan-loai", muc: dsMuc.length, nham: nham });
          phatDiem(nham === 0);
        }
      } else {
        nham++;
        m.style.transform = "";
        lac(m); lac(g);
        datChon(null);
        capNhat();
      }
    };
    dsMuc.forEach(function (m) {
      m.addEventListener("click", function () {
        if (m._boQua) { m._boQua = false; return; }
        if (m.classList.contains("tq-da-xep")) return;
        datChon(chon === m ? null : m);
      });
      m.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); m.click(); } });
      m.addEventListener("pointerdown", function (e) {
        if (m.classList.contains("tq-da-xep") || (e.button !== undefined && e.button !== 0)) return;
        var x0 = e.clientX, y0 = e.clientY, keo = false, tl = tiLe(el) || 1, tro = null;
        var nhomTai = function (ev) {
          var dich = document.elementFromPoint(ev.clientX, ev.clientY);
          return dich ? dich.closest(".phan-loai .nhom") : null;
        };
        var di = function (ev) {
          var dx = (ev.clientX - x0) / tl, dy = (ev.clientY - y0) / tl;
          if (!keo && Math.sqrt(dx * dx + dy * dy) > 8) { keo = true; m.classList.add("tq-keo"); datChon(m); }
          if (!keo) return;
          ev.preventDefault();
          m.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
          var g = nhomTai(ev);
          if (g !== tro) { if (tro) tro.classList.remove("tq-tro"); tro = g && el.contains(g) ? g : null; if (tro) tro.classList.add("tq-tro"); }
        };
        var tha = function (ev) {
          window.removeEventListener("pointermove", di);
          window.removeEventListener("pointerup", tha);
          window.removeEventListener("pointercancel", tha);
          if (tro) tro.classList.remove("tq-tro");
          if (!keo) return;
          m.classList.remove("tq-keo");
          m._boQua = true;
          setTimeout(function () { m._boQua = false; }, 0);
          var g = ev.type === "pointerup" ? nhomTai(ev) : null;
          if (g && el.contains(g)) xep(m, g);
          else {
            m.style.transition = "transform .3s";
            m.style.transform = "";
            setTimeout(function () { m.style.transition = ""; }, 320);
          }
        };
        window.addEventListener("pointermove", di);
        window.addEventListener("pointerup", tha);
        window.addEventListener("pointercancel", tha);
      });
    });
    dsNhom.forEach(function (g) {
      g.addEventListener("click", function () { if (chon) xep(chon, g); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (chon) xep(chon, g); } });
    });
  };

  /* ═══════════════ Tiện ích dùng chung cho các hoạt động mới ═══════════════ */
  var soId = 0;
  var toaDoSvg = function (svg, ev) {
    var m = svg.getScreenCTM && svg.getScreenCTM();
    if (!m) return null;
    var p = svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    return p.matrixTransform(m.inverse());
  };
  var taoNut = function (lop, ic, chu, chi) {
    var b = tao("button", lop);
    b.type = "button";
    if (ic) b.appendChild(icon(ic));
    var sp = tao("span", null, chu);
    b.appendChild(sp);
    if (chi) b.setAttribute("data-chi", chi);
    b._chu = sp;
    return b;
  };
  var taoPhanHoi = function () {
    var ph = tao("div", "tq-phan-hoi");
    ph.setAttribute("aria-live", "polite");
    ph.noi = function (lop, ic, chu) {
      ["dung", "sai"].forEach(function (x) { ph.classList.remove(x); });
      if (lop) ph.classList.add(lop);
      ph.textContent = "";
      if (ic) ph.appendChild(icon(ic));
      ph.appendChild(tao("span", null, chu));
    };
    return ph;
  };
  /** Dịch các phần tử cha từ vị trí cũ tới vị trí mới (FLIP) sau khi đổi thứ tự trong DOM. */
  var flip = function (ds, doi, tl) {
    var truoc = ds.map(function (e) { return e.getBoundingClientRect(); });
    doi();
    if (itDong) return;
    ds.forEach(function (e, j) {
      var sau = e.getBoundingClientRect();
      var dx = (truoc[j].left - sau.left) / tl, dy = (truoc[j].top - sau.top) / tl;
      if (!dx && !dy) return;
      e.style.transition = "none";
      e.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
      void e.offsetWidth;
      e.style.transition = "transform .35s cubic-bezier(.2, .8, .2, 1)";
      e.style.transform = "";
    });
  };

  /* ═══════════════ .keo-diem ═══════════════ */
  var dungKeoDiem = function (el, i, k) {
    var d = docJson(el);
    if (!Array.isArray(d.dich) || d.dich.length < 2) throw new Error("thiếu «dich»: [x, y]");
    var dx = soLieu(d.dich[0], NaN), dy = soLieu(d.dich[1], NaN);
    if (!isFinite(dx) || !isFinite(dy)) throw new Error("«dich» phải là hai số");
    var saiSo = soLieu(d.saiSo, 0.25), buoc = soLieu(d.luoi, 0.5);
    if (!(buoc > 0)) buoc = 0.5;
    var vung = d.vung && typeof d.vung === "object" ? d.vung : {};
    vung = { x: khoang(vung.x, [Math.floor(dx) - 4, Math.ceil(dx) + 4], "vung.x"), y: khoang(vung.y, [Math.floor(dy) - 3, Math.ceil(dy) + 5], "vung.y") };
    var kiemId = el.getAttribute("data-kiem") || "", id = kiemId || "s" + (k + 1) + "-k" + (i + 1);
    var tenTuNhan = typeof d.nhan === "string" && /điểm\s+([A-Z][0-9']?)(?![\w\u00c0-\u1ef9])/.exec(d.nhan);
    var tenDiem = typeof d.ten === "string" && d.ten.length <= 3 ? d.ten : tenTuNhan ? tenTuNhan[1] : "M";
    var f = typeof d.ham === "string" && d.ham.trim() ? L.bienDich(d.ham, ["x"]) : null;

    el.textContent = "";
    var bo = tao("div", "tq-pb");
    var the = tao("div", "tq-the");
    var kt = kichThuoc(el, "pb");
    var he = taoHeTruc(vung, kt.W, kt.H, ["x", "y"]);
    he.svg.setAttribute("aria-label", "Mặt phẳng toạ độ, kéo điểm " + tenDiem);
    if (f) {
      var p = taoS("path", { class: "tq-duong", pathLength: 1, "data-chi": "do-thi" });
      p.setAttribute("d", duongCong(function (x) { return f.f({ x: x }); }, he, 400));
      he.gNoiDung.appendChild(p);
    }
    var gDich = taoS("g", { class: "tq-dich", "data-chi": "dich" });
    gDich.style.display = "none";
    gDich.appendChild(taoS("circle", { r: 20, cx: he.gx(dx).toFixed(1), cy: he.gy(dy).toFixed(1) }));
    var nhanDich = taoS("text", { class: "tq-nhan", x: (he.gx(dx) + 26).toFixed(1), y: (he.gy(dy) + 34).toFixed(1) });
    nhanDich.textContent = "Đáp án (" + L.soDep(dx) + "; " + L.soDep(dy) + ")";
    gDich.appendChild(nhanDich);
    he.gDiem.appendChild(gDich);
    var ch1 = taoS("line", { class: "tq-chieu" }), ch2 = taoS("line", { class: "tq-chieu" });
    he.gDiem.appendChild(ch1); he.gDiem.appendChild(ch2);
    var gKeo = taoS("g", { class: "tq-keo-diem", tabindex: "0", role: "slider", "aria-label": "Điểm " + tenDiem + " (phím mũi tên để dịch)", "data-chi": "diem-keo" });
    var gTrong = taoS("g", { class: "tq-keo-trong" });
    gTrong.appendChild(taoS("circle", { r: 32, class: "tq-vong" }));
    gTrong.appendChild(taoS("circle", { r: 15, class: "tq-tam" }));
    gKeo.appendChild(gTrong);
    var nhan = taoS("text", { class: "tq-nhan" });
    gKeo.appendChild(nhan);
    he.gDiem.appendChild(gKeo);
    the.appendChild(he.svg);
    bo.appendChild(the);

    var bang = tao("div", "tq-bang");
    bang.appendChild(tao("div", "tq-de", typeof d.nhan === "string" ? d.nhan : "Kéo điểm " + tenDiem + " tới đúng vị trí"));
    var doc = tao("div", "tq-ct");
    doc.setAttribute("data-chi", "toa-do");
    bang.appendChild(doc);
    var hangNut = tao("div", "tq-nhap");
    var nutKT = taoNut("tq-nut-chinh", "kiem", "Kiểm tra", "nut-kiem-tra");
    hangNut.appendChild(nutKT);
    bang.appendChild(hangNut);
    var ph = taoPhanHoi();
    bang.appendChild(ph);
    bang.appendChild(tao("div", "tq-meo", "Bấm hoặc kéo trên lưới để đặt điểm; chọn điểm rồi dùng phím mũi tên để nhích. Điểm bám lưới " + L.soDep(buoc) + "."));
    bo.appendChild(bang);
    el.appendChild(bo);
    chanVuot(el);

    var x, y, soSai = 0, xong = false;
    var bam = function (v, lo, hi) {
      v = Math.round(v / buoc) * buoc;
      return +Math.max(Math.ceil(lo / buoc) * buoc, Math.min(Math.floor(hi / buoc) * buoc, v)).toFixed(6);
    };
    var datDiem = function (nx, ny) {
      x = bam(nx, he.x0, he.x1); y = bam(ny, he.y0, he.y1);
      var px = he.gx(x), py = he.gy(y);
      gKeo.setAttribute("transform", "translate(" + px.toFixed(1) + " " + py.toFixed(1) + ")");
      var s = tenDiem + "(" + L.soDep(x) + "; " + L.soDep(y) + ")";
      var trai = px > he.W - 170;
      nhan.setAttribute("x", trai ? -26 : 26);
      nhan.setAttribute("y", py < 50 ? 44 : -24);
      nhan.setAttribute("text-anchor", trai ? "end" : "start");
      nhan.textContent = s;
      veRich(doc, [{ bien: tenDiem }, "(" + L.soDep(x) + "; " + L.soDep(y) + ")"]);
      gKeo.setAttribute("aria-valuetext", s);
      var ax = Math.max(0, Math.min(he.W, he.gx(0))), ay = Math.max(0, Math.min(he.H, he.gy(0)));
      ch1.setAttribute("x1", px.toFixed(1)); ch1.setAttribute("y1", py.toFixed(1)); ch1.setAttribute("x2", px.toFixed(1)); ch1.setAttribute("y2", ay.toFixed(1));
      ch2.setAttribute("x1", px.toFixed(1)); ch2.setAttribute("y1", py.toFixed(1)); ch2.setAttribute("x2", ax.toFixed(1)); ch2.setAttribute("y2", py.toFixed(1));
    };
    var bd = Array.isArray(d.batDau) ? [soLieu(d.batDau[0], 0), soLieu(d.batDau[1], 0)] : null;
    if (!bd) {
      bd = [he.x0 + (he.x1 - he.x0) * 0.15, he.y0 + (he.y1 - he.y0) * 0.85];
      if (Math.abs(bd[0] - dx) < 1.5 && Math.abs(bd[1] - dy) < 1.5) bd = [he.x0 + (he.x1 - he.x0) * 0.85, bd[1]];
    }
    datDiem(bd[0], bd[1]);
    var tuSvg = function (p) { datDiem(he.x0 + p.x / he.W * (he.x1 - he.x0), he.y0 + (he.H - p.y) / he.H * (he.y1 - he.y0)); };
    var keo = false;
    he.svg.addEventListener("pointerdown", function (e) {
      if (xong || (e.button !== undefined && e.button !== 0)) return;
      var p = toaDoSvg(he.svg, e);
      if (!p) return;
      e.preventDefault();
      keo = true;
      try { he.svg.setPointerCapture(e.pointerId); } catch { /* cũ */ }
      gKeo.classList.add("dang-keo");
      try { gKeo.focus({ preventScroll: true }); } catch { /* cũ */ }
      tuSvg(p);
    });
    he.svg.addEventListener("pointermove", function (e) { if (keo) { var p = toaDoSvg(he.svg, e); if (p) tuSvg(p); } });
    var tha = function () { keo = false; gKeo.classList.remove("dang-keo"); };
    he.svg.addEventListener("pointerup", tha);
    he.svg.addEventListener("pointercancel", tha);
    var ketThuc = function (dung) {
      xong = true;
      nutKT.disabled = true;
      el.classList.add(dung ? "tq-dung" : "tq-het");
      phatDiem(dung);
    };
    var kiem = function () {
      if (xong) return;
      var kc = Math.sqrt((x - dx) * (x - dx) + (y - dy) * (y - dy));
      var gt = "(" + x + ";" + y + ")";
      if (kc <= saiSo + 1e-9) {
        ph.noi("dung", "dung", soSai ? "Chính xác! Em đã đặt đúng rồi." : "Chính xác! Đặt đúng ngay lần đầu.");
        bao(el, "DIEN_KHUYET", id, "DUNG", { kiem: kiemId, gt: gt, kieu: "keo-diem", lan: soSai + 1 });
        phaoHoa(30);
        ketThuc(true);
        return;
      }
      soSai++;
      lac(gTrong);
      bao(el, "DIEN_KHUYET", id, "SAI", { kiem: kiemId, gt: gt, kieu: "keo-diem", lan: soSai, khoangCach: Math.round(kc * 100) / 100 });
      if (soSai >= 3) {
        gDich.style.display = "";
        ph.noi("sai", "sai", "Chưa đúng. Vị trí đúng là (" + L.soDep(dx) + "; " + L.soDep(dy) + ") — vòng nét đứt trên hình.");
        ketThuc(false);
        return;
      }
      var gan = kc <= Math.max(1, 3 * saiSo);
      var huong = [];
      if (gan) {
        if (Math.abs(x - dx) > saiSo / 2) huong.push(dx > x ? "sang phải" : "sang trái");
        if (Math.abs(y - dy) > saiSo / 2) huong.push(dy > y ? "lên trên" : "xuống dưới");
      }
      ph.noi("sai", "sai", gan ? "Gần rồi! Nhích " + huong.join(" và ") + " một chút (lần " + soSai + "/3)." :
        "Còn xa quá. Em tính lại toạ độ rồi đặt lại nhé (lần " + soSai + "/3).");
    };
    nutKT.addEventListener("click", kiem);
    gKeo.addEventListener("keydown", function (e) {
      var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (m) {
        e.preventDefault(); e.stopPropagation();
        if (!xong) datDiem(x + m[0] * buoc, y + m[1] * buoc);
      } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); kiem(); }
    });
  };

  /* ═══════════════ .nem-bong ═══════════════ */
  var dungNemBong = function (el, i, k) {
    var d = docJson(el);
    var G = soLieu(d.g, 9.8);
    var nemDL = Array.isArray(d.nem) ? d.nem : [];
    var x0 = soLieu(nemDL[0], 0), h0 = soLieu(nemDL[1], soLieu(d.nguoi && d.nguoi.h, 2));
    var ro = d.ro && typeof d.ro === "object" ? d.ro : {};
    var xr = soLieu(ro.x, 6.75), yr = soLieu(ro.y, 3.05), rong = soLieu(ro.rong, 0.45);
    if (!(xr - x0 >= 2 && xr - x0 <= 20) || !(yr >= 1 && yr <= 8) || !(h0 > 0.5 && h0 < 4) || !(rong > 0.1 && rong < 2)) throw new Error("rổ phải ở trước điểm ném 2–20 m, cao 1–8 m; điểm ném cao 0,5–4 m");
    var vungNB = d.vung && typeof d.vung === "object" ? d.vung : {};
    var vx = khoang(vungNB.x, [x0, xr + 1.5], "vung.x"), vy = khoang(vungNB.y, [0, yr + 1.7], "vung.y");
    var keoDS = Array.isArray(d.keo) ? d.keo : ["v", "goc"];
    var heSo = keoDS.some(function (t) { return t === "a" || t === "b" || t === "c"; });
    var keo = keoDS.filter(function (t) { return heSo ? /^(a|b|c)$/.test(t) : /^(v|goc)$/.test(t); });
    var MD = { v: [4, 14, 0.1], goc: [15, 80, 1], a: [-1.5, -0.05, 0.01], b: [0, 4, 0.05], c: [1, 3, 0.05] };
    var gh = d.gioiHan && typeof d.gioiHan === "object" ? d.gioiHan : {};
    var gt = { v: soLieu(d.v, 8), goc: soLieu(d.goc, 52), a: soLieu(d.a, -0.25), b: soLieu(d.b, 1.2), c: soLieu(d.c, h0) };
    var kiemId = el.getAttribute("data-kiem") || "", id = kiemId || "s" + (k + 1) + "-b" + (i + 1);
    var R = 0.12, RV = 0.17; // bán kính bóng thật (va chạm) và bán kính vẽ (cách điệu cho dễ nhìn)

    // Quỹ đạo h(x) = A·x² + B·x + C (mét, x là hoành độ trên sân, bóng rời tay tại (x0; h0)), bỏ qua sức cản không khí.
    // Chế độ lực/góc: ném xiên với vận tốc v, góc α:
    //   h(x) = −g·(x − x0)² / (2·v²·cos²α) + (x − x0)·tanα + h0   (vận tốc ngang v·cosα không đổi)
    // Chế độ hệ số (keo có a/b/c): học sinh chỉnh thẳng a, b, c; hoạt cảnh chạy với vận tốc ngang 6 m/s.
    // «Vào rổ» — CÙNG tiêu chí với scripts/kiem-toan10/kiem.py: |h(ro.x) − ro.y| ≤ ro.rong/2 (mặc định rong = 0,45 m)
    // VÀ bóng đang đi xuống tại ro.x (h'(ro.x) = 2A·ro.x + B < 0). Không thì «ngan» (thấp hơn khung) hoặc «xa» (cao hơn,
    // hoặc còn đang bay lên khi qua rổ). chiTiet.gt của sự kiện là "vao" | "ngan" | "xa".
    var quyDao = function () {
      if (heSo) return { A: gt.a, B: gt.b, C: gt.c, vx: 6 };
      var al = gt.goc * Math.PI / 180, cs = Math.cos(al), kk = G / (2 * gt.v * gt.v * cs * cs), tn = Math.tan(al);
      return { A: -kk, B: tn + 2 * kk * x0, C: h0 - kk * x0 * x0 - tn * x0, vx: gt.v * cs };
    };

    var W = 1000, H = 520;
    var xMin = Math.min(vx[0], x0 - 1.4), xMax = Math.max(vx[1], xr + 1.6), yMin = -0.36, yMax = Math.max(vy[1], yr + 1.6);
    var s = Math.min(W / (xMax - xMin), H / (yMax - yMin));
    var ox = (W - s * (xMax - xMin)) / 2, oy = (H - s * (yMax - yMin)) / 2;
    var gx = function (x) { return ox + (x - xMin) * s; };
    var gy = function (y) { return H - oy - (y - yMin) * s; };
    var f1 = function (v) { return v.toFixed(1); };
    var ma = "tqnb" + (++soId) + "-" + k + "-" + i;

    el.textContent = "";
    var bo = tao("div", "tq-nb");
    var the = tao("div", "tq-the tq-the-san");
    var svg = taoS("svg", { viewBox: "0 0 " + W + " " + H, class: "tq-svg tq-san", role: "img", "aria-label": "Sân bóng rổ: chỉnh để ném bóng vào rổ" });
    var defs = taoS("defs");
    var gradient = function (ten, kieu, stops, tt) {
      var gr = taoS(kieu, Object.assign({ id: ma + ten }, tt || {}));
      stops.forEach(function (st) { gr.appendChild(taoS("stop", { offset: st[0], "stop-color": st[1] })); });
      defs.appendChild(gr);
      return "url(#" + ma + ten + ")";
    };
    var nenTuong = gradient("t", "linearGradient", [["0", "#cfe2ff"], ["1", "#f4f8ff"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    var nenSan = gradient("s", "linearGradient", [["0", "#f6c983"], ["1", "#dc9a4f"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    var nenBong = gradient("b", "radialGradient", [["0", "#ffc061"], ["0.6", "#f7801e"], ["1", "#c9480b"]], { cx: "0.35", cy: "0.32", r: "0.75" });
    svg.appendChild(defs);
    var san = gy(0);
    // Nền kéo dài ra ngoài viewBox: ô SVG lấp đầy chỗ trống (rộng/cao hơn tỉ lệ khung nhìn) mà không lộ viền đen.
    var XA = 3000;
    svg.appendChild(taoS("rect", { x: -XA, y: -XA, width: W + 2 * XA, height: f1(san + XA), fill: nenTuong }));
    // Dây cờ trang trí
    var mauCo = ["#ff6b6b", "#ffd43b", "#51cf66", "#4dabf7", "#cc5de8", "#ff922b"];
    var day = taoS("path", { d: "M" + -XA + " 10 H0 Q" + W / 2 + " 46 " + W + " 10 H" + (W + XA), class: "tq-day-co" });
    svg.appendChild(day);
    for (var c = -30; c < 52; c++) {
      var tx = 18 + c * (W - 36) / 21, ty = tx < 0 || tx > W ? 10 : 10 + 36 * (1 - Math.pow((tx - W / 2) / (W / 2), 2)) * 0.98;
      var co = taoS("path", { d: "M" + f1(tx - 13) + " " + f1(ty) + " L" + f1(tx + 13) + " " + f1(ty) + " L" + f1(tx) + " " + f1(ty + 26) + " Z" });
      co.style.fill = mauCo[((c % mauCo.length) + mauCo.length) % mauCo.length];
      svg.appendChild(co);
    }
    // Vạch trang trí trên tường và khán đài cách điệu
    svg.appendChild(taoS("rect", { x: -XA, y: f1(gy(1.15)), width: W + 2 * XA, height: 12, class: "tq-vach-tuong" }));
    for (var hg = 0; hg < 3; hg++) {
      for (var cn = -40; cn < 72; cn++) {
        var kx = 10 + cn * 34 + (hg % 2) * 17, ky = gy(0.32 + hg * 0.26);
        var kh = taoS("circle", { cx: f1(kx), cy: f1(ky), r: 9, class: "tq-khan-gia" });
        kh.style.fill = mauCo[(((cn * 7 + hg * 3) % mauCo.length) + mauCo.length) % mauCo.length];
        svg.appendChild(kh);
      }
    }
    svg.appendChild(taoS("rect", { x: -XA, y: f1(gy(0.95)), width: W + 2 * XA, height: f1(gy(0) - gy(0.95)), class: "tq-lan-can" }));
    svg.appendChild(taoS("rect", { x: -XA, y: f1(san), width: W + 2 * XA, height: XA, fill: nenSan }));
    for (var vk = Math.ceil(xMin) - 12; vk <= xMax + 12; vk += 0.8) svg.appendChild(taoS("line", { x1: f1(gx(vk)), y1: f1(san), x2: f1(gx(vk) - 18 * (H + 200 - san) / (H - san)), y2: H + 200, class: "tq-van-go" }));
    svg.appendChild(taoS("line", { x1: -XA, y1: f1(san), x2: W + XA, y2: f1(san), class: "tq-mep-san" }));
    // Thước đo khoảng cách trên sàn (mét)
    var gThuoc = taoS("g", { class: "tq-thuoc", "data-chi": "thuoc" });
    for (var m = Math.ceil(x0); m <= Math.floor(xMax - 0.3); m++) {
      gThuoc.appendChild(taoS("line", { x1: f1(gx(m)), y1: f1(san + 3), x2: f1(gx(m)), y2: f1(san + 13) }));
      var tm = taoS("text", { x: f1(gx(m)), y: f1(Math.min(H - 6, san + 31)), "text-anchor": "middle" });
      tm.textContent = m + (m === 0 ? "" : " m");
      gThuoc.appendChild(tm);
    }
    svg.appendChild(gThuoc);
    // Cột, bảng, vành rổ
    var gRo = taoS("g", { class: "tq-ro", "data-chi": "ro" });
    var xBang = xr + 0.4;
    gRo.appendChild(taoS("rect", { x: f1(gx(xr + 0.95)), y: f1(gy(yr + 0.62)), width: f1(0.16 * s), height: f1(san - gy(yr + 0.62)), rx: 5, class: "tq-cot" }));
    gRo.appendChild(taoS("rect", { x: f1(gx(xr + 0.72)), y: f1(san - 0.12 * s), width: f1(0.62 * s), height: f1(0.12 * s), rx: 4, class: "tq-cot" }));
    gRo.appendChild(taoS("rect", { x: f1(gx(xBang + 0.06)), y: f1(gy(yr + 0.5)), width: f1(gx(xr + 0.97) - gx(xBang + 0.06)), height: f1(0.08 * s), class: "tq-cot" }));
    gRo.appendChild(taoS("rect", { x: f1(gx(xBang)), y: f1(gy(yr + 1.05)), width: f1(Math.max(8, 0.08 * s)), height: f1(1.2 * s), rx: 3, class: "tq-bang-ro" }));
    gRo.appendChild(taoS("line", { x1: f1(gx(xr + 0.22)), y1: f1(gy(yr)), x2: f1(gx(xBang)), y2: f1(gy(yr)), class: "tq-vanh" }));
    gRo.appendChild(taoS("ellipse", { cx: f1(gx(xr)), cy: f1(gy(yr)), rx: f1(0.23 * s), ry: f1(0.06 * s), class: "tq-vanh" }));
    var nhanRo = taoS("text", { x: f1(gx(xr - 0.3)), y: f1(gy(yr) - 14), "text-anchor": "end", class: "tq-nhan" });
    nhanRo.textContent = "Rổ cao " + L.soDep(yr) + " m";
    gRo.appendChild(nhanRo);
    svg.appendChild(gRo);
    // Vệt quỹ đạo, dự đoán, ngắm
    var gVet = taoS("g", { "data-chi": "quy-dao" });
    svg.appendChild(gVet);
    var duDoan = taoS("path", { class: "tq-du-doan" });
    svg.appendChild(duDoan);
    var gNgam = taoS("g", { class: "tq-ngam", "data-chi": "ngam" });
    var ngamDuong = taoS("line", {}), ngamMui = taoS("path", {}), ngamCung = taoS("path", { class: "tq-cung" }), ngamChu = taoS("text", { class: "tq-nhan" });
    gNgam.appendChild(ngamCung); gNgam.appendChild(ngamDuong); gNgam.appendChild(ngamMui); gNgam.appendChild(ngamChu);
    svg.appendChild(gNgam);
    // Người ném (cách điệu, tự vẽ), mặt quay sang phải, tay đưa bóng lên
    var gNguoi = taoS("g", { class: "tq-nguoi", "data-chi": "nguoi-nem" });
    var gxn = function (x) { return gx(x0 + x); };
    var P = function (x, y) { return f1(gxn(x)) + " " + f1(gy(y)); };
    gNguoi.appendChild(taoS("path", { d: "M" + P(-0.42, 0.95) + " L" + P(-0.6, 0.06), class: "tq-chan" }));
    gNguoi.appendChild(taoS("path", { d: "M" + P(-0.36, 0.95) + " L" + P(-0.2, 0.06), class: "tq-chan" }));
    gNguoi.appendChild(taoS("ellipse", { cx: f1(gxn(-0.56)), cy: f1(gy(0.04)), rx: f1(0.13 * s), ry: f1(0.05 * s), class: "tq-giay" }));
    gNguoi.appendChild(taoS("ellipse", { cx: f1(gxn(-0.14)), cy: f1(gy(0.04)), rx: f1(0.13 * s), ry: f1(0.05 * s), class: "tq-giay" }));
    gNguoi.appendChild(taoS("rect", { x: f1(gxn(-0.62)), y: f1(gy(1.12)), width: f1(0.46 * s), height: f1(0.3 * s), rx: 6, class: "tq-quan" }));
    var thanAo = taoS("rect", { x: f1(gxn(-0.64)), y: f1(gy(1.64)), width: f1(0.5 * s), height: f1(0.6 * s), rx: f1(0.14 * s), class: "tq-ao" });
    gNguoi.appendChild(thanAo);
    var soAo = taoS("text", { x: f1(gxn(-0.39)), y: f1(gy(1.26)), "text-anchor": "middle", class: "tq-so-ao" });
    soAo.textContent = "10";
    gNguoi.appendChild(soAo);
    var tay1 = taoS("path", { class: "tq-tay" }), tay2 = taoS("path", { class: "tq-tay" });
    gNguoi.appendChild(tay2);
    gNguoi.appendChild(taoS("circle", { cx: f1(gxn(-0.36)), cy: f1(gy(1.82)), r: f1(0.16 * s), class: "tq-dau" }));
    gNguoi.appendChild(taoS("path", { d: "M" + P(-0.53, 1.84) + " Q" + P(-0.4, 2.08) + " " + P(-0.2, 1.88) + " Q" + P(-0.34, 1.93) + " " + P(-0.53, 1.84) + " Z", class: "tq-toc" }));
    gNguoi.appendChild(taoS("circle", { cx: f1(gxn(-0.27)), cy: f1(gy(1.84)), r: 2.6, class: "tq-mat" }));
    gNguoi.appendChild(tay1);
    svg.appendChild(gNguoi);
    // Đỉnh quỹ đạo (độ cao cực đại)
    var gDinh = taoS("g", { class: "tq-dinh-nb", "data-chi": "dinh" });
    var dinhDoc = taoS("line", { class: "tq-chieu" }), dinhCham = taoS("circle", { r: 9 }), dinhChu = taoS("text", { class: "tq-nhan" });
    gDinh.appendChild(dinhDoc); gDinh.appendChild(dinhCham); gDinh.appendChild(dinhChu);
    gDinh.style.display = "none";
    svg.appendChild(gDinh);
    // Bóng (kèm 4 bóng mờ bám theo cho cảm giác tốc độ)
    var bongMo = [0.34, 0.22, 0.13, 0.07].map(function (op) {
      var c = taoS("circle", { r: f1(RV * s), class: "tq-bong-mo" });
      c.style.opacity = op;
      c.style.display = "none";
      svg.appendChild(c);
      return c;
    });
    var gBong = taoS("g", { class: "tq-bong", "data-chi": "bong" });
    var gXoay = taoS("g");
    var rb = RV * s;
    gXoay.appendChild(taoS("circle", { r: f1(rb), fill: nenBong, class: "tq-bong-vo" }));
    gXoay.appendChild(taoS("path", { d: "M" + f1(-rb) + " 0 H" + f1(rb) + " M0 " + f1(-rb) + " V" + f1(rb) + " M" + f1(-rb * 0.72) + " " + f1(-rb * 0.7) + " Q0 " + f1(-rb * 0.1) + " " + f1(-rb * 0.72) + " " + f1(rb * 0.7) + " M" + f1(rb * 0.72) + " " + f1(-rb * 0.7) + " Q0 " + f1(-rb * 0.1) + " " + f1(rb * 0.72) + " " + f1(rb * 0.7), class: "tq-bong-ke" }));
    gBong.appendChild(gXoay);
    svg.appendChild(gBong);
    // Mặt trước vành + lưới (vẽ sau bóng để bóng chui qua)
    var gLuoiRo = taoS("g", { class: "tq-luoi-ro" });
    var xl = [-0.22, -0.13, -0.04, 0.05, 0.14, 0.22], xd = [-0.13, -0.08, -0.03, 0.03, 0.08, 0.13];
    xl.forEach(function (a, j) { gLuoiRo.appendChild(taoS("line", { x1: f1(gx(xr + a)), y1: f1(gy(yr)), x2: f1(gx(xr + xd[j])), y2: f1(gy(yr - 0.42)) })); });
    [0.14, 0.28].forEach(function (h) {
      var w = 0.22 - (0.22 - 0.13) * h / 0.42, dd = "";
      for (var q = 0; q <= 6; q++) dd += (q ? " L" : "M") + f1(gx(xr - w + 2 * w * q / 6)) + " " + f1(gy(yr - h + (q % 2 ? 0.05 : 0)));
      gLuoiRo.appendChild(taoS("path", { d: dd }));
    });
    svg.appendChild(gLuoiRo);
    svg.appendChild(taoS("path", { d: "M" + f1(gx(xr - 0.23)) + " " + f1(gy(yr)) + " A" + f1(0.23 * s) + " " + f1(0.06 * s) + " 0 0 0 " + f1(gx(xr + 0.23)) + " " + f1(gy(yr)), class: "tq-vanh tq-vanh-truoc" }));
    var bangTB = taoS("text", { x: W / 2, y: Math.round(H * 0.4), "text-anchor": "middle", class: "tq-bao-lon" });
    svg.appendChild(bangTB);
    the.appendChild(svg);
    var loiDan = tao("div", "tq-nb-dan", typeof d.nhan === "string" ? d.nhan : heSo ? "Chỉnh a, b, c để quỹ đạo đi qua rổ rồi bấm «Ném»" : "Chỉnh lực ném và góc ném rồi bấm «Ném»");
    the.appendChild(loiDan);
    var ph = taoPhanHoi();
    ph.classList.add("tq-nb-tb");
    the.appendChild(ph);
    bo.appendChild(the);

    // Bảng điều khiển
    var bang = tao("div", "tq-bang");
    var ct = tao("div", "tq-ct");
    ct.setAttribute("data-chi", "cong-thuc");
    bang.appendChild(ct);
    var hop = tao("div", "tq-cac-truot");
    var NHAN = { v: "v", goc: "α", a: "a", b: "b", c: "c" };
    var thanh = {};
    keo.forEach(function (ten) {
      var g = Array.isArray(gh[ten]) ? gh[ten] : MD[ten];
      var mn = soLieu(g[0], MD[ten][0]), mx = soLieu(g[1], MD[ten][1]), bu = soLieu(g[2], MD[ten][2]);
      if (!(bu > 0) || !(mn < mx)) throw new Error("gioiHan." + ten + " phải dạng [min, max, bước]");
      mn = Math.min(mn, gt[ten]); mx = Math.max(mx, gt[ten]);
      var tr = taoThanhTruot(NHAN[ten], mn, mx, bu, gt[ten], false, function (v) { gt[ten] = v; capNhat(); });
      tr.el.setAttribute("data-chi", "thanh-" + ten);
      tr.el.classList.add("tq-truot-" + ten);
      thanh[ten] = tr;
      hop.appendChild(tr.el);
    });
    if (keo.length) bang.appendChild(hop);
    var tt = tao("dl", "tq-tt");
    tt.setAttribute("data-chi", "bang-thong-tin");
    var hangTT = {};
    [["dinh", "Cao nhất"], ["tai-ro", "Khi tới rổ"]].forEach(function (h) {
      var dt = tao("dt", null, h[1]), dd = tao("dd");
      dd.setAttribute("data-chi", "hang-" + h[0]);
      tt.appendChild(dt); tt.appendChild(dd);
      hangTT[h[0]] = dd;
    });
    bang.appendChild(tt);
    var hangNut = tao("div", "tq-nhap");
    var nutNem = taoNut("tq-nut-chinh tq-nut-nem", "bong", "Ném!", "nut-nem");
    hangNut.appendChild(nutNem);
    bang.appendChild(hangNut);
    var dongLan = tao("span", "tq-meo");
    dongLan.setAttribute("data-chi", "so-lan-nem");
    hangNut.appendChild(dongLan);
    bo.appendChild(bang);
    el.appendChild(bo);
    chanVuot(el);
    var datLan = function (v) { dongLan.textContent = "Số lần ném: " + v; };

    var soGon = function (v) { var r = Math.abs(v) < 0.1 && v !== 0 ? Math.round(v * 1000) / 1000 : Math.round(v * 100) / 100; return String(r).replace("-", "−").replace(".", ","); };
    var yTai = function (q, x) { return (q.A * x + q.B) * x + q.C; };
    var dinhCua = function (q) {
      if (q.A < 0) { var xd = -q.B / (2 * q.A); if (xd > x0) return { x: xd, y: yTai(q, xd) }; }
      return { x: x0, y: yTai(q, x0) };
    };
    var datBong = function (x, y, goc) {
      gBong.setAttribute("transform", "translate(" + f1(gx(x)) + " " + f1(gy(y)) + ")");
      gXoay.setAttribute("transform", "rotate(" + (goc || 0).toFixed(0) + ")");
    };
    var datTay = function (hy) {
      tay1.setAttribute("d", "M" + P(-0.24, 1.56) + " Q" + P(-0.02, (1.56 + hy) / 2 - 0.08) + " " + P(0.02, hy - RV * 0.6));
      tay2.setAttribute("d", "M" + P(-0.5, 1.56) + " Q" + P(-0.22, (1.56 + hy) / 2 - 0.12) + " " + P(-0.1, hy - RV * 0.75));
    };
    var dangNem = false, soNem = 0, soVao = 0, daCong = false;
    var capNhat = function () {
      var q = quyDao();
      var ham = [{ bien: "y" }, " = "], dau = true;
      [[q.A, "x²"], [q.B, "x"], [q.C, ""]].forEach(function (t) {
        if (Math.abs(t[0]) < 1e-9) return;
        var am = t[0] < 0;
        ham.push(dau ? (am ? "−" : "") : (am ? " − " : " + "));
        ham.push(soGon(Math.abs(t[0])));
        if (t[1]) ham.push({ bien: t[1] });
        dau = false;
      });
      veRich(ct, ham);
      var dn = dinhCua(q);
      hangTT.dinh.textContent = L.soDep(dn.y) + " m tại x = " + L.soDep(dn.x);
      hangTT["tai-ro"].textContent = "h(" + L.soDep(xr) + ") \u2248 " + L.soDep(yTai(q, xr)) + " m";
      var hNem = yTai(q, x0);
      if (dangNem) return;
      datBong(x0 + 0.02, hNem, 0);
      datTay(hNem);
      var hienDuDoan = heSo || d.duDoan === true;
      duDoan.style.display = hienDuDoan ? "" : "none";
      if (hienDuDoan) {
        var dd = "";
        for (var x = x0; x <= xMax + 0.01; x += 0.05) {
          var yy = yTai(q, x);
          if (yy < 0 || yy > yMax + 2) break;
          dd += (dd ? " L" : "M") + f1(gx(x)) + " " + f1(gy(yy));
        }
        duDoan.setAttribute("d", dd);
      }
      gNgam.style.display = heSo ? "none" : "";
      if (!heSo) {
        var al = gt.goc * Math.PI / 180, dai = 0.6 + gt.v * 0.11;
        var x2 = x0 + Math.cos(al) * dai, y2 = hNem + Math.sin(al) * dai;
        ngamDuong.setAttribute("x1", f1(gx(x0))); ngamDuong.setAttribute("y1", f1(gy(hNem)));
        ngamDuong.setAttribute("x2", f1(gx(x2))); ngamDuong.setAttribute("y2", f1(gy(y2)));
        var mx2 = gx(x2), my2 = gy(y2), ux = Math.cos(al), uy = -Math.sin(al);
        ngamMui.setAttribute("d", "M" + f1(mx2 + ux * 6) + " " + f1(my2 + uy * 6) + " L" + f1(mx2 - ux * 16 - uy * 9) + " " + f1(my2 - uy * 16 + ux * 9) + " L" + f1(mx2 - ux * 16 + uy * 9) + " " + f1(my2 - uy * 16 - ux * 9) + " Z");
        var rc = 0.55 * s;
        ngamCung.setAttribute("d", "M" + f1(gx(x0) + rc) + " " + f1(gy(hNem)) + " A" + f1(rc) + " " + f1(rc) + " 0 0 0 " + f1(gx(x0) + rc * Math.cos(al)) + " " + f1(gy(hNem) - rc * Math.sin(al)) + " M" + f1(gx(x0)) + " " + f1(gy(hNem)) + " H" + f1(gx(x0) + rc * 1.15));
        ngamChu.setAttribute("x", f1(gx(x0) + rc * 1.2 * Math.cos(al / 2) + 6));
        ngamChu.setAttribute("y", f1(gy(hNem) - rc * 1.2 * Math.sin(al / 2) + 6));
        ngamChu.textContent = Math.round(gt.goc) + "°";
      }
    };
    var hienDinh = function (q) {
      var dn = dinhCua(q);
      gDinh.style.display = "";
      dinhCham.setAttribute("cx", f1(gx(dn.x))); dinhCham.setAttribute("cy", f1(gy(dn.y)));
      dinhDoc.setAttribute("x1", f1(gx(dn.x))); dinhDoc.setAttribute("x2", f1(gx(dn.x)));
      dinhDoc.setAttribute("y1", f1(gy(dn.y))); dinhDoc.setAttribute("y2", f1(san));
      dinhChu.setAttribute("x", f1(gx(dn.x))); dinhChu.setAttribute("y", f1(Math.max(26, gy(dn.y) - 18)));
      dinhChu.setAttribute("text-anchor", "middle");
      dinhChu.textContent = "Cao nhất " + L.soDep(dn.y) + " m";
    };
    var baoLon = function (chu, dung) {
      bangTB.textContent = chu;
      bangTB.setAttribute("class", "tq-bao-lon " + (dung ? "dung" : "sai"));
      void bangTB.getBoundingClientRect();
      bangTB.classList.add("hien");
      clearTimeout(bangTB._hen);
      bangTB._hen = setTimeout(function () { bangTB.classList.add("tat"); }, 2600);
    };
    var nem = function () {
      if (dangNem) return;
      var q = quyDao(), A = q.A, B = q.B, C = q.C, VX = q.vx;
      dangNem = true;
      nutNem.disabled = true;
      bangTB.setAttribute("class", "tq-bao-lon");
      ph.textContent = ""; ph.classList.remove("dung", "sai");
      gDinh.style.display = "none";
      gNgam.style.display = "none";
      // giữ tối đa hai vệt cũ (mờ)
      Array.prototype.slice.call(gVet.children).forEach(function (v, j, ds) { if (ds.length - j > 2) v.remove(); else v.setAttribute("class", "tq-vet cu"); });
      var vet = taoS("path", { class: "tq-vet" });
      gVet.appendChild(vet);
      var gE = -2 * A * VX * VX; // gia tốc rơi tương ứng với quỹ đạo (đúng bằng g ở chế độ lực/góc)
      var hRo = yTai(q, xr), diXuong = 2 * A * xr + B < 0;
      var xb = xBang - R;
      var yb = yTai(q, xb);
      // Tiêu chí khớp kiem.py (xem chú thích ở quyDao)
      var ketQua = Math.abs(hRo - yr) <= rong / 2 && diXuong ? "vao" : hRo < yr - rong / 2 ? "ngan" : "xa";
      var dapBang = ketQua === "xa" && yb >= yr - 0.1 && yb <= yr + 1.05 && xb > x0;
      var D2 = B * B - 4 * A * (C - R);
      var xSan = A < 0 && D2 >= 0 ? (-B - Math.sqrt(D2)) / (2 * A) : xMax + 1;
      var xHet = ketQua === "vao" ? xr : dapBang ? xb : Math.min(xSan, xMax + 1);
      var t1 = (xHet - x0) / VX;
      var y1 = yTai(q, xHet), vy1 = (2 * A * xHet + B) * VX;
      var vx2, vy2, y2a, t2;
      var bayTiep = ketQua !== "vao" && !dapBang;
      if (bayTiep && xSan <= xMax + 0.5 && gE > 0) { vx2 = VX * 0.45; vy2 = Math.abs(vy1) * 0.38; y2a = R; t2 = 2 * vy2 / gE; } else if (bayTiep || gE <= 0) { vx2 = 0; vy2 = 0; y2a = y1; t2 = 0; } else {
        vx2 = ketQua === "vao" ? 0 : -VX * 0.35; vy2 = ketQua === "vao" ? Math.min(vy1, 0) : vy1; y2a = y1;
        var dd2 = vy2 * vy2 + 2 * gE * (y2a - R);
        t2 = (vy2 + Math.sqrt(Math.max(0, dd2))) / gE;
      }
      var viTri = function (t) {
        if (t <= t1) { var x = x0 + VX * t; return { x: x, y: yTai(q, x), pha: 1 }; }
        var tau = Math.min(t - t1, t2);
        return { x: xHet + vx2 * tau, y: Math.max(R, y2a + vy2 * tau - gE * tau * tau / 2), pha: 2 };
      };
      var T = t1 + t2, diem = [], daDinh = false, dn = dinhCua(q), daRung = false;
      var xong = function () {
        dangNem = false;
        nutNem.disabled = false;
        soNem++;
        if (ketQua === "vao") soVao++;
        datLan(soNem + " · vào rổ " + soVao);
        hienDinh(q);
        var thamSo = heSo ? { a: gt.a, b: gt.b, c: gt.c } : { v: gt.v, goc: gt.goc };
        bao(el, "DIEN_KHUYET", id, ketQua === "vao" ? "DUNG" : "SAI", { kiem: kiemId, gt: ketQua, kieu: "nem-bong", thamSo: thamSo, lan: soNem, hTaiRo: Math.round(hRo * 100) / 100, doCao: Math.round(dn.y * 100) / 100 });
        if (ketQua === "vao") {
          baoLon("VÀO RỔ!", true);
          ph.noi("dung", "dung", "Tuyệt! Quỹ đạo parabol đi qua đúng vành rổ. Đỉnh cao " + L.soDep(dn.y) + " m.");
          phaoHoa(50);
          if (!daCong) { daCong = true; phatDiem(true); }
        } else {
          var loi, taiRo = "Tới x = " + L.soDep(xr) + " m bóng cao " + L.soDep(hRo) + " m";
          if (ketQua === "ngan") loi = taiRo + ", thấp hơn vành " + L.soDep(yr) + " m: bóng rơi ngắn. " + (heSo ? "Thử tăng b hoặc cho a bớt âm." : "Ném mạnh hơn hoặc chỉnh góc.");
          else if (!diXuong && Math.abs(hRo - yr) <= rong / 2) loi = taiRo + " nhưng vẫn đang bay lên — đỉnh phải nằm trước rổ. " + (heSo ? "Thử làm a âm hơn." : "Tăng góc ném.");
          else loi = taiRo + ", cao hơn vành " + L.soDep(yr) + " m: bóng bay quá rổ" + (dapBang ? " và đập bảng. " : ". ") + (heSo ? "Thử giảm b hoặc làm a âm hơn." : "Ném nhẹ hơn.");
          baoLon(dapBang ? "Đập bảng!" : ketQua === "ngan" ? "Ngắn rồi!" : "Xa quá!", false);
          ph.noi("sai", "sai", loi);
        }
      };
      if (itDong) {
        for (var tt2 = 0; tt2 <= t1; tt2 += t1 / 60) { var pp = viTri(tt2); diem.push(f1(gx(pp.x)) + " " + f1(gy(pp.y))); }
        vet.setAttribute("d", "M" + diem.join(" L"));
        var pe = viTri(T);
        datBong(pe.x, pe.y, 0);
        xong();
        return;
      }
      var t0 = null, vet2 = [];
      var khung = function (now) {
        if (t0 === null) t0 = now;
        var t = Math.min(T, (now - t0) / 1000);
        var p = viTri(t);
        datBong(p.x, p.y, (p.x * 260) % 360);
        vet2.push([gx(p.x), gy(p.y)]);
        bongMo.forEach(function (c, j) {
          var q2 = vet2[vet2.length - 1 - (j + 1) * 2];
          c.style.display = q2 && t < T ? "" : "none";
          if (q2) { c.setAttribute("cx", f1(q2[0])); c.setAttribute("cy", f1(q2[1])); }
        });
        if (p.pha === 1) {
          diem.push(f1(gx(p.x)) + " " + f1(gy(p.y)));
          vet.setAttribute("d", "M" + diem.join(" L"));
          if (!daDinh && p.x >= dn.x && dn.x > 0) { daDinh = true; hienDinh(q); }
        } else if (ketQua === "vao" && !daRung) {
          daRung = true;
          gLuoiRo.classList.remove("rung"); void gLuoiRo.getBoundingClientRect(); gLuoiRo.classList.add("rung");
        }
        if (t < T) requestAnimationFrame(khung); else xong();
      };
      requestAnimationFrame(khung);
    };
    nutNem.addEventListener("click", nem);
    datLan("0");
    capNhat();
  };

  /* ═══════════════ .sap-xep ═══════════════ */
  var dungSapXep = function (el, i, k) {
    var dsMuc = Array.prototype.filter.call(el.children, function (c) { return c.classList.contains("muc"); });
    if (dsMuc.length < 2) throw new Error("cần ít nhất 2 .muc (viết theo đúng thứ tự)");
    var kiemId = el.getAttribute("data-kiem") || "", id = kiemId || "s" + (k + 1) + "-x" + (i + 1);
    var ds = tao("div", "tq-sx");
    ds.setAttribute("role", "list");
    var o = dsMuc.map(function (m, j) {
      var w = tao("div", "tq-sx-o");
      w.setAttribute("role", "listitem");
      w.setAttribute("tabindex", "0");
      w._dung = j;
      w.appendChild(tao("span", "tq-sx-so"));
      var nd = tao("div", "tq-sx-nd");
      nd.appendChild(m);
      w.appendChild(nd);
      var dk = tao("span", "tq-sx-dk");
      var len = tao("button", "tq-sx-nut"); len.type = "button"; len.setAttribute("aria-label", "Đưa lên");
      var xuong = tao("button", "tq-sx-nut"); xuong.type = "button"; xuong.setAttribute("aria-label", "Đưa xuống");
      len.appendChild(taoS("svg", { viewBox: "0 0 24 24" })).appendChild(taoS("path", { d: "M6 15l6-6 6 6" }));
      xuong.appendChild(taoS("svg", { viewBox: "0 0 24 24" })).appendChild(taoS("path", { d: "M6 9l6 6 6-6" }));
      dk.appendChild(len); dk.appendChild(xuong);
      w.appendChild(dk);
      len.addEventListener("click", function (e) { e.stopPropagation(); doi(w, -1); });
      xuong.addEventListener("click", function (e) { e.stopPropagation(); doi(w, 1); });
      return w;
    });
    var tron = o.slice();
    for (var lap = 0; lap < 20; lap++) {
      for (var t = tron.length - 1; t > 0; t--) { var r = Math.floor(Math.random() * (t + 1)); var x = tron[t]; tron[t] = tron[r]; tron[r] = x; }
      if (tron.some(function (w, j) { return w._dung !== j; })) break;
    }
    tron.forEach(function (w) { ds.appendChild(w); });
    el.appendChild(ds);
    var hangNut = tao("div", "tq-nhap tq-giua");
    var nutKT = taoNut("tq-nut-chinh", "kiem", "Kiểm tra thứ tự", "nut-kiem-tra");
    hangNut.appendChild(nutKT);
    el.appendChild(hangNut);
    var ph = taoPhanHoi();
    ph.classList.add("tq-giua");
    el.appendChild(ph);
    ph.noi("", "nhac", "Kéo thả (hoặc dùng mũi tên) để sắp lại cho đúng thứ tự.");
    chanVuot(el);

    var xong = false, lanKiem = 0;
    var danhSo = function () {
      Array.prototype.forEach.call(ds.children, function (w, j) { w.firstChild.textContent = String(j + 1); });
    };
    danhSo();
    var tl = function () { return tiLe(el) || 1; };
    var boDanhDau = function () { o.forEach(function (w) { w.classList.remove("dung", "sai"); }); };
    var doi = function (w, huong) {
      if (xong) return;
      var ke = huong < 0 ? w.previousElementSibling : w.nextElementSibling;
      if (!ke) return;
      flip([w, ke], function () { if (huong < 0) ds.insertBefore(w, ke); else ds.insertBefore(ke, w); }, tl());
      boDanhDau(); danhSo();
      try { w.focus({ preventScroll: true }); } catch { /* cũ */ }
    };
    o.forEach(function (w) {
      w.addEventListener("keydown", function (e) {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); doi(w, e.key === "ArrowUp" ? -1 : 1); }
      });
      w.addEventListener("pointerdown", function (e) {
        if (xong || (e.button !== undefined && e.button !== 0) || e.target.closest(".tq-sx-nut")) return;
        var y0 = e.clientY, keo = false, bu = 0, t0 = tl();
        var di = function (ev) {
          var dy = (ev.clientY - y0) / t0;
          if (!keo && Math.abs(dy) > 6) { keo = true; w.classList.add("tq-keo"); boDanhDau(); }
          if (!keo) return;
          ev.preventDefault();
          w.style.transform = "translateY(" + (dy - bu).toFixed(1) + "px)";
          var tam = w.getBoundingClientRect(), cy = (tam.top + tam.bottom) / 2;
          var sau = w.nextElementSibling, truoc = w.previousElementSibling;
          var cu = w.offsetTop;
          if (sau) { var rs = sau.getBoundingClientRect(); if (cy > (rs.top + rs.bottom) / 2) { flip([sau], function () { ds.insertBefore(sau, w); }, t0); bu += w.offsetTop - cu; danhSo(); } }
          if (truoc) { var rt = truoc.getBoundingClientRect(); if (cy < (rt.top + rt.bottom) / 2) { flip([truoc], function () { ds.insertBefore(w, truoc); }, t0); bu += w.offsetTop - cu; danhSo(); } }
          w.style.transform = "translateY(" + (dy - bu).toFixed(1) + "px)";
        };
        var tha = function () {
          window.removeEventListener("pointermove", di);
          window.removeEventListener("pointerup", tha);
          window.removeEventListener("pointercancel", tha);
          if (!keo) return;
          w.classList.remove("tq-keo");
          w.style.transition = "transform .25s";
          w.style.transform = "";
          setTimeout(function () { w.style.transition = ""; }, 260);
        };
        window.addEventListener("pointermove", di);
        window.addEventListener("pointerup", tha);
        window.addEventListener("pointercancel", tha);
      });
    });
    nutKT.addEventListener("click", function () {
      if (xong) return;
      lanKiem++;
      var hien = Array.prototype.slice.call(ds.children), dungCho = 0;
      hien.forEach(function (w, j) { var ok = w._dung === j; if (ok) dungCho++; w.classList.toggle("dung", ok); w.classList.toggle("sai", !ok); });
      var gtChu = hien.map(function (w) { return w._dung + 1; }).join("-");
      var het = dungCho === hien.length;
      bao(el, "GHEP_DOI", id, het ? "DUNG" : "SAI", { kiem: kiemId, gt: gtChu, kieu: "sap-xep", lan: lanKiem, dungCho: dungCho });
      if (het) {
        xong = true;
        el.classList.add("tq-dung");
        nutKT.disabled = true;
        ph.noi("dung", "dung", lanKiem === 1 ? "Chính xác ngay lần đầu! Thứ tự hoàn toàn đúng." : "Đúng rồi! Thứ tự đã chuẩn.");
        phaoHoa(36);
        phatDiem(lanKiem === 1);
      } else if (lanKiem >= 3) {
        xong = true;
        el.classList.add("tq-het");
        nutKT.disabled = true;
        ph.noi("sai", "sai", "Đây là thứ tự đúng — em xem lại vì sao từng bước đứng ở vị trí đó nhé.");
        flip(o, function () { o.forEach(function (w) { ds.appendChild(w); }); }, tl());
        o.forEach(function (w) { w.classList.remove("sai"); w.classList.add("dung"); });
        danhSo();
        phatDiem(false);
      } else {
        ph.noi("sai", "sai", "Mới đúng vị trí " + dungCho + "/" + hien.length + " bước (ô đỏ là chưa đúng chỗ). Thử lại nhé (lần " + lanKiem + "/3).");
      }
    });
  };

  /* ═══════════════ .tim-loi ═══════════════ */
  var dungTimLoi = function (el, i, k) {
    var dsDong = Array.prototype.filter.call(el.children, function (c) { return c.classList.contains("dong"); });
    var dsSai = dsDong.filter(function (d) { return d.hasAttribute("data-sai"); });
    if (!dsDong.length || !dsSai.length) throw new Error("cần các .dong, ít nhất một dòng có data-sai=\"lý do\"");
    var kiemId = el.getAttribute("data-kiem") || "", id = kiemId || "s" + (k + 1) + "-l" + (i + 1);
    var lyDo = [];
    dsSai.map(function (d) { return d.getAttribute("data-sai").trim(); })
      .concat((el.getAttribute("data-ly-do") || "").split("|").map(function (x) { return x.trim(); }))
      .forEach(function (x) { if (x && lyDo.indexOf(x) < 0) lyDo.push(x); });
    for (var t = lyDo.length - 1; t > 0; t--) { var r = Math.floor(Math.random() * (t + 1)); var x = lyDo[t]; lyDo[t] = lyDo[r]; lyDo[r] = x; }
    var vo = tao("div", "tq-tl");
    dsDong.forEach(function (d, j) {
      d.classList.add("tq-tl-dong");
      d.setAttribute("tabindex", "0");
      d.setAttribute("role", "button");
      d.setAttribute("data-chi", "dong-" + (j + 1));
      d.insertBefore(tao("span", "tq-tl-so", "(" + (j + 1) + ")"), d.firstChild);
      vo.appendChild(d);
    });
    el.appendChild(vo);
    var ph = taoPhanHoi();
    el.appendChild(ph);
    ph.noi("", "nhac", dsSai.length > 1 ? "Lời giải có " + dsSai.length + " dòng sai. Bấm vào dòng sai." : "Lời giải có một dòng sai. Bấm vào dòng đó.");
    chanVuot(el);
    var nham = 0, timDuoc = 0, hop = null;
    var gtDong = function (d, j) { return d.getAttribute("data-gt") || "dong-" + (j + 1); };
    var xongDong = function (d) {
      d.classList.remove("tq-dang-chon");
      d.classList.add("tq-da-tim");
      var lb = tao("div", "tq-tl-ly-do", "Lỗi: " + d.getAttribute("data-sai"));
      d.appendChild(lb);
      timDuoc++;
      if (timDuoc === dsSai.length) {
        ph.noi("dung", "dung", nham === 0 ? "Xuất sắc! Em tìm đúng lỗi ngay lần đầu." : "Đã tìm ra hết lỗi (" + nham + " lần nhầm).");
        el.classList.add("tq-dung");
        phaoHoa(36);
        phatDiem(nham === 0);
      } else ph.noi("dung", "dung", "Đúng một lỗi rồi! Còn " + (dsSai.length - timDuoc) + " dòng sai nữa.");
    };
    var chonDong = function (d, j) {
      if (el.classList.contains("tq-dung") || d.classList.contains("tq-da-tim")) return;
      if (hop) { hop.remove(); hop = null; dsDong.forEach(function (x) { x.classList.remove("tq-dang-chon"); }); }
      if (!d.hasAttribute("data-sai")) {
        nham++;
        lac(d);
        d.classList.add("tq-khong-sai");
        setTimeout(function () { d.classList.remove("tq-khong-sai"); }, 900);
        ph.noi("sai", "sai", "Dòng (" + (j + 1) + ") đúng rồi, em tìm tiếp nhé.");
        bao(el, "QUIZ_TRA_LOI", id, "SAI", { kiem: kiemId, gt: gtDong(d, j), kieu: "tim-loi" });
        return;
      }
      bao(el, "QUIZ_TRA_LOI", id, "DUNG", { kiem: kiemId, gt: gtDong(d, j), kieu: "tim-loi" });
      if (lyDo.length < 2) { xongDong(d); return; }
      d.classList.add("tq-dang-chon");
      hop = tao("div", "tq-tl-hop");
      hop.appendChild(tao("div", "tq-tl-hoi", "Đúng là dòng (" + (j + 1) + ") sai. Sai ở đâu?"));
      var dsNut = tao("div", "tq-tl-cac");
      lyDo.forEach(function (ly) {
        var b = tao("button", "tq-tl-nut", ly);
        b.type = "button";
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          if (ly === d.getAttribute("data-sai")) { hop.remove(); hop = null; xongDong(d); } else {
            nham++;
            lac(b); b.disabled = true;
            ph.noi("sai", "sai", "Chưa phải lý do đó, em chọn lại nhé.");
            bao(el, "QUIZ_TRA_LOI", id, "SAI", { kiem: kiemId, gt: gtDong(d, j), lyDo: ly.slice(0, 80), kieu: "tim-loi" });
          }
        });
        dsNut.appendChild(b);
      });
      hop.appendChild(dsNut);
      d.parentNode.insertBefore(hop, d.nextSibling);
      ph.noi("", "nhac", "Chọn lý do dòng (" + (j + 1) + ") sai.");
    };
    dsDong.forEach(function (d, j) {
      d.addEventListener("click", function () { chonDong(d, j); });
      d.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); chonDong(d, j); } });
    });
  };

  /* ═══════════════ Khởi tạo ═══════════════ */
  var CAC = [
    [".parabol", "parabol", dungParabol, true],
    [".do-thi", "đồ thị", dungDoThi, true],
    [".so-do", "sơ đồ", dungSoDo, false],
    [".nhap-dap-an", "nhập đáp án", dungNhapDapAn, false],
    [".phan-loai", "phân loại", dungPhanLoai, false],
    [".keo-diem", "kéo điểm", dungKeoDiem, true],
    [".nem-bong", "ném bóng", dungNemBong, true],
    [".sap-xep", "sắp xếp", dungSapXep, false],
    [".tim-loi", "tìm lỗi", dungTimLoi, false]
  ];
  dsSlide.forEach(function (s, k) {
    CAC.forEach(function (c) {
      $$(c[0], s).forEach(function (el, i) {
        if (el.getAttribute("data-tq") === "1") return;
        el.setAttribute("data-tq", "1");
        try { c[2](el, i, k); } catch (e) { hopLoi(el, c[1], e, c[3]); }
      });
    });
  });
}
