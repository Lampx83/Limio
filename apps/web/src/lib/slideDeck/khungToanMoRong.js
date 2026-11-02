/**
 * Thành phần Toán mở rộng cho khung slide HTML (bài 2–5 của demo Toán 10: ba đường conic, hệ thức lượng trong tam giác,
 * hệ bất phương trình bậc nhất hai ẩn và tối ưu, xác suất cổ điển). Hợp đồng: docs/demo-toan10/HOP-DONG.md mục 10.
 *
 * `chayToanMoRong` được toString() rồi nhúng vào iframe sandbox (chạy sau chayToan, trước chayKhung) nên phải tự đủ:
 * không dùng biến ngoài hàm, không import. Không dùng eval/Function/innerHTML với dữ liệu từ slide.
 * Viết kiểu ES5 (var, function) để bộ biên dịch không chèn hàm phụ trợ nằm ngoài hàm.
 *
 * `chayToanMoRong({ chiLoi: true })` (Node, kiểm thử) chỉ trả về thư viện tính toán thuần, không đụng DOM.
 * Trong iframe thư viện đó gắn ở `window.__sdToanMoRong`.
 *
 * Thành phần (data-du-lieu là JSON, không TeX):
 *   .conic        {"loai":"elip|hypebol|parabol","a":5,"b":3,"p":2,"keo":["a","b"],"cheDo":"dinh-day|guong|quy-dao|kham-pha",
 *                  "hien":["tieu-diem","truc","tia"],"gioiHan":{"a":[2,8,0.5]},"anTamSai":true}
 *   .mien-nghiem  {"rang":[{"a":1,"b":1,"c":40,"dau":"<="}],"muc":{"p":3,"q":5,"loai":"max|min"},"vung":{"x":[0,60],"y":[0,60]},
 *                  "nhan":{"x":"sản phẩm A","y":"sản phẩm B"},"buocHien":true}   (+ data-kiem: em bấm chọn đỉnh tối ưu)
 *                  Mỗi ràng buộc là một bước hiện dần (class `hien`), hàm mục tiêu là bước cuối.
 *   .tam-giac-do  {"bai":"chieu-cao|qua-song","AB":20,"goc":[35,50],"keo":["A","B","goc","AB"],"donVi":"m","buocHien":true}
 *                  Mỗi dòng tính là một bước hiện dần (tắt bằng "buocHien":false).
 *   .mo-phong-xs  {"loai":"xuc-xac|dong-xu|hai-xuc-xac-tong","soLan":[10,100,1000,10000]}
 *   .hinh-dung    {"vung":{"x":[-1.2,1.2],"y":[-0.2,1.5]},"diem":[…],"net":[["A","B"],{"a":"H","b":"K","lop":"cam","dut":true}],
 *                  "tron":[{"tam":"O","qua":"B"}],"vuong":[["B","D","H"]],"do":[{"nhan":"HK","a":"H","b":"K"}],"tiLe":5,"chu":"…"}
 *                  Hình học dựng theo từng bước, kéo được. Mỗi điểm khai báo một cách dựng (xem L.dungHinh), điểm sau chỉ dùng điểm trước:
 *                  {"ten":"O","x":0,"y":0}, {"ten":"A","tren":["O","B"],"goc":106,"keo":[97,140]} (trên đường tròn tâm O qua B),
 *                  {"ten":"H","chia":["A","B"],"t":0.2,"keo":[0.05,0.28]}, {"ten":"D","chan":["H","B","C"]} (chân đường vuông góc),
 *                  {"ten":"E","giao":[["D","H"],["A","C"]]}, {"ten":"M","giao":[["D","F"],{"qua":"A","vuongGoc":["D","E"]}]},
 *                  {"ten":"F","giaoTron":[["C","H"],"O","B"],"khac":"C"}, {"ten":"I","trungDiem":["A","M"]}. "nhan":[dx,dy] đặt nhãn.
 *                  Vẽ dần theo lời giảng: điểm, net, tron, vuong mang "buoc":k thì chỉ hiện từ bước k của slide (bước 0 là lúc mở slide),
 *                  nét mới được vẽ ra. vuong khi đó viết {"v":["B","D","H"],"buoc":2}. Điểm không dựng đề vẫn tính được nếu "an":true.
 */
export const CSS_TOAN_MO_RONG = `
/* ── Thành phần Toán mở rộng (khungToanMoRong.js) ── */
.conic, .mien-nghiem, .tam-giac-do, .mo-phong-xs, .hinh-dung { --tm-cao: 540px; --tm-cam: #e8590c; --tm-tim: #7048e8; --tm-la: #2b8a3e; --tm-vang: #f08c00; --tm-nen-svg: var(--the); position: relative; }
[data-theme="toi"] .conic, [data-theme="toi"] .mien-nghiem, [data-theme="toi"] .tam-giac-do, [data-theme="toi"] .mo-phong-xs, [data-theme="toi"] .hinh-dung { --tm-cam: #ff8a3d; --tm-tim: #a48bff; --tm-la: #51cf66; --tm-vang: #ffc94d; }
.tm-loi { display: block; margin: .3em 0; padding: .55em .9em; border-radius: 12px; border: 2px dashed var(--sai); background: var(--sai-nhat); color: var(--sai); font-size: 18px; line-height: 1.4; font-family: var(--mono); white-space: pre-wrap; }
.tm-hop { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(0, 1fr); gap: 22px; height: var(--tm-cao); align-items: stretch; margin: .2em 0 .4em; }
.tm-the { position: relative; background: var(--the); border: 1px solid var(--vien); border-radius: 22px; box-shadow: var(--bong); overflow: hidden; min-height: 0; min-width: 0; }
[data-kieu="hoclieu"] .tm-the { border-radius: calc(var(--bo, 18px) + 6px); border-width: 2px; }
.tm-the.tm-toi { background: radial-gradient(120% 90% at 70% 40%, #1b2150 0%, #0b1026 60%, #060918 100%); border-color: #232a5a; }
.tm-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; font-family: var(--font); user-select: none; -webkit-user-select: none; overflow: hidden; }
section svg.tm-svg { max-width: none; height: 100%; }
.tm-svg.tm-tran { overflow: visible; }
.tm-bang { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; font-size: .56em; line-height: 1.3; }
.tm-bang > * { flex: none; }
.tm-tieu-de { font-size: .8em; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--chu-phu); margin: 0; }
.tm-ct { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-size: 1.62em; font-weight: 700; color: var(--mau); background: var(--mau-nhat); border-radius: 16px; padding: .22em .6em; text-align: center; white-space: nowrap; overflow: hidden; }
[data-kieu="hoclieu"] .tm-ct { background: color-mix(in srgb, var(--mau) 14%, var(--the)); color: var(--mau-2); }
.tm-bien { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-style: italic; }
.tm-ps { display: inline-flex; flex-direction: column; align-items: stretch; vertical-align: middle; font-size: .8em; line-height: 1.06; text-align: center; margin: 0 .1em; }
.tm-ps > .tm-tu { border-bottom: 2px solid currentColor; padding: 0 .15em .05em; }
.tm-ps > .tm-mau { padding: .05em .15em 0; }
.tm-tt { display: grid; grid-template-columns: auto minmax(0, 1fr); margin: 0; border: 1px solid var(--vien); border-radius: 16px; overflow: hidden; background: var(--the); }
.tm-tt dt, .tm-tt dd { margin: 0; padding: .28em .7em; border-top: 1px solid var(--vien); }
.tm-tt dt:first-of-type, .tm-tt dt:first-of-type + dd { border-top: 0; }
.tm-tt dt { color: var(--chu-phu); font-weight: 600; background: var(--the-2); white-space: nowrap; }
.tm-tt dd { font-weight: 700; color: var(--chu); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tm-doi { animation: tmNhay .8s ease-out; }
@keyframes tmNhay { from { background: var(--vang-nhat); } to { background: transparent; } }
.tm-noi { position: relative; padding: .45em .8em .45em 1em; border-radius: 16px; background: var(--the-2); border: 1px solid var(--vien); border-left: 8px solid var(--tm-vang); font-weight: 700; }
.tm-noi small { display: block; font-size: .78em; font-weight: 600; color: var(--chu-phu); margin-bottom: .1em; letter-spacing: .02em; }
.tm-noi .tm-lon { font-size: 1.28em; font-variant-numeric: tabular-nums; }
.tm-noi .tm-chip { display: inline-block; margin-left: .35em; padding: .05em .55em; border-radius: 999px; background: var(--tm-vang); color: #1d1300; font-size: .82em; }
.tm-ghi { font-size: .82em; color: var(--chu-phu); margin: 0; }
.tm-ghi > :last-child { margin-bottom: 0; }

/* Thanh trượt + nút */
.tm-cac-truot { display: grid; gap: 6px; padding: 8px 14px; border-radius: 16px; background: var(--the-2); border: 1px solid var(--vien); }
.tm-truot { display: grid; grid-template-columns: 2.1em minmax(0, 1fr) 3.6em; align-items: center; gap: 12px; }
.tm-truot .tm-ten { font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; font-style: italic; font-weight: 700; font-size: 1.2em; color: var(--mau); text-align: center; white-space: nowrap; }
.tm-truot output { font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; padding: .1em .3em; border-radius: 10px; background: var(--mau-nhat); color: var(--mau); white-space: nowrap; }
[data-kieu="hoclieu"] .tm-truot output { background: color-mix(in srgb, var(--mau) 16%, var(--the)); color: var(--mau-2); }
.tm-truot input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; margin: 0; border-radius: 6px; outline: none; cursor: pointer; touch-action: none;
  background: linear-gradient(90deg, var(--mau) 0, var(--mau-2) var(--p, 50%), var(--vien) var(--p, 50%), var(--vien) 100%); }
.tm-truot input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 30px; height: 30px; border-radius: 50%; background: var(--the); border: 6px solid var(--mau); box-shadow: 0 3px 10px rgba(0, 0, 0, .28); cursor: grab; transition: transform .15s; }
.tm-truot input[type=range]:active::-webkit-slider-thumb { transform: scale(1.15); cursor: grabbing; }
.tm-truot input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--the); border: 6px solid var(--mau); cursor: grab; }
.tm-truot input[type=range]:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px var(--vang); }
.tm-hang-nut { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tm-nut { display: inline-flex; align-items: center; gap: .4em; font-size: .92em; font-weight: 800; padding: .42em 1em; border-radius: 999px; border: 2px solid var(--vien); background: var(--the); color: var(--chu); transition: transform .15s, border-color .15s, background .15s, box-shadow .15s; white-space: nowrap; }
.tm-nut:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--mau); }
.tm-nut:disabled { opacity: .45; cursor: default; }
.tm-nut.tm-chinh { border-color: transparent; color: #fff; background: linear-gradient(135deg, var(--mau), var(--mau-2)); box-shadow: 0 8px 20px rgba(0, 0, 0, .18); }
.tm-nut[aria-pressed="true"] { background: var(--mau-nhat); border-color: var(--mau); color: var(--mau); }
.tm-nut svg { width: 1.15em; height: 1.15em; flex: none; }
.tm-noi-hinh { position: absolute; left: 14px; bottom: 12px; display: flex; gap: 8px; z-index: 2; font-size: 18px; }
.tm-noi-hinh .tm-nut:not(.tm-chinh) { background: color-mix(in srgb, var(--the) 88%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.tm-noi-hinh.tm-goc-tren { left: auto; right: 12px; bottom: auto; top: 10px; }
.tm-toi .tm-noi-hinh .tm-nut:not(.tm-chinh) { background: rgba(20, 26, 60, .78); color: #e8ecff; border-color: #343d7a; }
.tm-chu-goc { position: absolute; right: 14px; top: 10px; z-index: 2; font-size: 15px; font-weight: 600; color: var(--chu-phu); background: color-mix(in srgb, var(--the) 80%, transparent); padding: 2px 10px; border-radius: 999px; }
.tm-toi .tm-chu-goc { color: #aab3e6; background: rgba(12, 16, 40, .7); }

/* Hình SVG chung */
.tm-luoi line { stroke: var(--vien); stroke-width: 1.2; }
.tm-truc line { stroke: var(--chu-phu); stroke-width: 2.4; }
.tm-truc path { fill: var(--chu-phu); }
.tm-so { font-size: 15px; fill: var(--chu-phu); font-weight: 600; font-variant-numeric: tabular-nums; }
.tm-ten-truc { font-size: 23px; font-style: italic; font-weight: 700; fill: var(--chu); font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif; }
.tm-svg .tm-nhan { font-size: 21px; font-weight: 800; fill: var(--chu); paint-order: stroke; stroke: var(--tm-nen-svg); stroke-width: 6px; stroke-linejoin: round; }
.tm-svg .tm-nhan-nho { font-size: 17px; font-weight: 700; }
.tm-svg .tm-nhan-cam { fill: var(--tm-cam); }
.tm-svg .tm-nhan-vang { fill: var(--tm-vang); }
.tm-svg .tm-nhan-tim { fill: var(--tm-tim); }
.tm-svg .tm-nhan-mau { fill: var(--mau); }
.tm-cong { fill: none; stroke: var(--mau); stroke-width: 5.5; stroke-linecap: round; stroke-linejoin: round; }
.tm-cong-mo { fill: none; stroke: var(--mau); stroke-width: 2.5; stroke-dasharray: 7 9; opacity: .4; }
.tm-vet { fill: none; stroke: var(--mau); stroke-width: 6.5; stroke-linecap: round; stroke-linejoin: round; }
.tm-phu { fill: none; stroke: var(--chu-phu); stroke-width: 2.2; stroke-dasharray: 9 8; opacity: .75; }
.tm-truc-dam { stroke: var(--mau-2); stroke-width: 9; stroke-linecap: round; opacity: .22; }
.tm-day { fill: none; stroke: var(--tm-vang); stroke-width: 4; stroke-linecap: round; }
.tm-day-2 { stroke: var(--tm-tim); }
.tm-dinh-c { fill: var(--the); stroke: var(--mau); stroke-width: 3.5; }
.tm-tieu { fill: var(--tm-cam); stroke: var(--tm-nen-svg); stroke-width: 3; }
.tm-ghim-bong { fill: #000; opacity: .18; }
.tm-ghim-dau { fill: var(--tm-cam); stroke: rgba(0, 0, 0, .25); stroke-width: 1.5; }
.tm-ghim-sang { fill: #fff; opacity: .7; }
.tm-diem-m { fill: var(--mau); stroke: var(--tm-nen-svg); stroke-width: 4; }
.tm-hop.tm-hop-1 { grid-template-columns: minmax(0, 1fr); }
.tm-hd-net { stroke: var(--chu); stroke-width: 3; stroke-linecap: round; fill: none; }
.tm-hd-nhat { stroke: var(--chu-phu); stroke-width: 2.4; }
.tm-hd-mau { stroke: var(--mau); stroke-width: 4; }
.tm-hd-cam { stroke: var(--tm-cam); stroke-width: 4.5; }
.tm-hd-la { stroke: var(--tm-la); stroke-width: 4; }
.tm-hd-dut { stroke-dasharray: 9 8; }
.tm-hd-vuong { fill: none; stroke: var(--chu); stroke-width: 2; }
.tm-hd-diem { fill: var(--chu); }
.tm-hd-lop { transition: opacity .35s ease; }
.tm-hd-lop.tm-hd-an { opacity: 0; visibility: hidden; }
.tm-hd-ve .tm-hd-net:not(.tm-hd-dut) { stroke-dasharray: 1; animation: tmHdVe .8s cubic-bezier(.4, .1, .2, 1) both; }
@keyframes tmHdVe { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.tm-hd-so { display: flex; justify-content: space-between; gap: .6em; padding: .35em .7em; border: 2px solid var(--vien); border-radius: 14px; background: var(--the); font-size: 1.5em; font-weight: 700; }
.tm-hd-chu { font-size: 1.25em; line-height: 1.4; }
.tm-tay { cursor: grab; touch-action: none; }
.tm-tay:active { cursor: grabbing; }
.tm-tay .tm-vong { fill: var(--tm-cam); fill-opacity: .12; stroke: var(--tm-cam); stroke-width: 2.4; stroke-dasharray: 5 5; transform-box: fill-box; transform-origin: center; animation: tmQuay 7s linear infinite; }
.tm-tay:hover .tm-vong { fill-opacity: .25; }
.tm-tay .tm-trong { fill: transparent; }
@keyframes tmQuay { to { transform: rotate(360deg); } }
.tm-loe { transform-box: fill-box; transform-origin: center; animation: tmLoe .7s ease-out; }
@keyframes tmLoe { 0% { transform: scale(1); } 35% { transform: scale(1.9); } 100% { transform: scale(1); } }
.tm-nhip { transform-box: fill-box; transform-origin: center; animation: tmNhip 2.4s ease-in-out infinite; }
@keyframes tmNhip { 50% { transform: scale(1.12); opacity: .85; } }
.tm-but-than { fill: var(--tm-vang); stroke: rgba(0, 0, 0, .3); stroke-width: 1.2; }
.tm-but-go { fill: #f3d6a4; stroke: rgba(0, 0, 0, .3); stroke-width: 1.2; }
.tm-but-chi { fill: #343a40; }
.tm-but-tay { fill: #f783ac; stroke: rgba(0, 0, 0, .3); stroke-width: 1.2; }
.tm-goc-vuong { fill: none; stroke: var(--tm-tim); stroke-width: 2; }

/* Gương và tia sáng */
.tm-guong { fill: none; stroke: #adb5bd; stroke-width: 11; stroke-linecap: round; }
.tm-guong-sang { fill: none; stroke: #f8f9fa; stroke-width: 2.5; stroke-linecap: round; opacity: .9; }
.tm-guong-gach line { stroke: var(--chu-phu); stroke-width: 2; opacity: .55; }
.tm-tia { fill: none; stroke: var(--tm-vang); stroke-width: 2.6; stroke-dasharray: 10 16; stroke-linejoin: round; opacity: .8; animation: tmChay 1.1s linear infinite; }
@keyframes tmChay { to { stroke-dashoffset: -26; } }
.tm-tia-chinh { fill: none; stroke: var(--tm-vang); stroke-width: 5; stroke-linejoin: round; stroke-linecap: round; }
.tm-tia-chinh-sang { fill: none; stroke: #fff; stroke-width: 1.6; opacity: .7; stroke-linejoin: round; }
.tm-photon { fill: #fff; stroke: var(--tm-vang); stroke-width: 4; filter: drop-shadow(0 0 7px var(--tm-vang)); }
.tm-phap { stroke: var(--tm-tim); stroke-width: 2.2; stroke-dasharray: 6 6; }
.tm-cung { fill: none; stroke: var(--tm-tim); stroke-width: 3; }
.tm-den-than { fill: var(--chu-phu); stroke: var(--tm-nen-svg); stroke-width: 2; }
.tm-den-mat { fill: var(--tm-vang); }
.tm-hao-quang { fill: var(--tm-vang); opacity: .22; }

/* Quỹ đạo */
.tm-vu-tru { --tm-nen-svg: #0b1026; }
.tm-vu-tru .tm-nhan { fill: #e8ecff; }
.tm-vu-tru .tm-nhan-cam { fill: #ffb27a; }
.tm-vu-tru .tm-nhan-vang { fill: #ffd76b; }
.tm-sao-nen { fill: #fff; }
.tm-sao-nhay { animation: tmNhayMat 3.2s ease-in-out infinite; }
@keyframes tmNhayMat { 50% { opacity: .15; } }
.tm-quy-dao { fill: none; stroke: #8ea2ff; stroke-width: 2.2; stroke-dasharray: 3 7; opacity: .7; }
.tm-quat { fill: #74c0fc; fill-opacity: .3; stroke: #a5d8ff; stroke-width: 1.5; }
.tm-quat-2 { fill: #ffd43b; fill-opacity: .26; stroke: #ffe066; }
.tm-quat-cu { transition: opacity .6s; }
.tm-vet-hanh-tinh { fill: none; stroke: #74c0fc; stroke-linecap: round; }
.tm-tieu-trong { fill: none; stroke: #aab3e6; stroke-width: 2; }

/* Miền nghiệm */
.tm-loai-vung { opacity: 0; transition: opacity .8s ease; }
.tm-loai-vung.tm-co { opacity: 1; }
.tm-bien-dt { fill: none; stroke-width: 3.6; stroke-linecap: round; opacity: 0; transition: opacity .3s; }
.tm-bien-dt.tm-co { opacity: 1; }
.tm-bien-dt.tm-ve { stroke-dasharray: 1; stroke-dashoffset: 1; animation: tmVe 1s .1s cubic-bezier(.4, .1, .2, 1) forwards; }
@keyframes tmVe { to { stroke-dashoffset: 0; } }
.tm-mien { fill: var(--mau); fill-opacity: .2; stroke: var(--mau); stroke-width: 3.5; stroke-linejoin: round; opacity: 0; transition: opacity .8s ease, fill-opacity .8s; }
.tm-mien.tm-co { opacity: 1; }
.tm-mien.tm-nhay-mien { animation: tmMien 1.6s ease-out; }
@keyframes tmMien { 0% { fill-opacity: .55; } 100% { fill-opacity: .2; } }
.tm-dinh-mn { opacity: 0; transition: opacity .5s; }
.tm-dinh-mn.tm-co { opacity: 1; }
.tm-dinh-mn circle.tm-dc { fill: var(--the); stroke: var(--mau); stroke-width: 4; transition: fill .3s, stroke .3s; }
.tm-dinh-mn.tm-qua circle.tm-dc { fill: var(--tm-cam); stroke: var(--tm-cam); }
.tm-dinh-mn.tm-tot circle.tm-dc { fill: var(--dung); stroke: var(--tm-nen-svg); }
.tm-dinh-mn.tm-sai-chon circle.tm-dc { fill: var(--sai); }
.tm-dinh-mn .tm-vong-tot { fill: none; stroke: var(--dung); stroke-width: 3; opacity: 0; }
.tm-dinh-mn.tm-tot .tm-vong-tot { opacity: 1; transform-box: fill-box; transform-origin: center; animation: tmToa 1.6s ease-out infinite; }
@keyframes tmToa { from { transform: scale(.6); opacity: .9; } to { transform: scale(2.2); opacity: 0; } }
.tm-chon-duoc { cursor: pointer; }
.tm-chon-duoc:hover circle.tm-dc { stroke-width: 6; }
.tm-duong-muc { opacity: 0; transition: opacity .4s; }
.tm-duong-muc.tm-co { opacity: 1; }
.tm-duong-muc line.tm-dm { stroke: var(--tm-cam); stroke-width: 4.5; stroke-dasharray: 16 9; stroke-linecap: round; }
.tm-duong-muc path { fill: var(--tm-cam); }
.tm-duong-muc line.tm-mui { stroke: var(--tm-cam); stroke-width: 3.5; }
.tm-ds-rang { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
section .tm-ds-rang li, .tm-ds-rang li { display: flex; align-items: center; gap: .55em; margin: 0; padding: .28em .75em; border-radius: 14px; background: var(--the); border: 2px solid var(--vien); border-left: 9px solid var(--tm-m, var(--mau)); font-weight: 700; font-variant-numeric: tabular-nums; }
.tm-ds-rang li .tm-so-thu { flex: none; display: grid; place-items: center; width: 1.55em; height: 1.55em; border-radius: 50%; background: var(--tm-m, var(--mau)); color: #fff; font-size: .8em; }
.tm-ds-rang li.tm-li-muc { border-left-color: var(--tm-cam); background: color-mix(in srgb, var(--tm-cam) 10%, var(--the)); }
.tm-ds-rang li.tm-li-muc .tm-so-thu { background: var(--tm-cam); }
.tm-bang-f { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; border: 1px solid var(--vien); border-radius: 14px; overflow: hidden; background: var(--the); font-variant-numeric: tabular-nums; }
.tm-bang-f.tm-hai-hang { grid-template-columns: auto minmax(0, 1fr); }
.tm-bang-f > span { padding: .2em .7em; border-top: 1px solid var(--vien); }
.tm-bang-f > span.tm-dau { border-top: 0; background: var(--mau); color: #fff; font-weight: 800; font-size: .9em; }
.tm-bang-f > span.tm-hang-tot { background: var(--dung-nhat); color: var(--dung); font-weight: 800; }
.tm-bang-f > span.tm-hang-moi { animation: tmLenNhe .45s both; animation-delay: var(--tre, 0ms); }
@keyframes tmLenNhe { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.tm-ket-qua { padding: .4em .8em; border-radius: 14px; background: var(--dung-nhat); color: var(--dung); font-weight: 800; border-left: 8px solid var(--dung); }
.tm-ket-qua.tm-trung { background: var(--vang-nhat); color: var(--chu); border-left-color: var(--tm-vang); }
.tm-hoi-chon { font-weight: 700; color: var(--mau); }
.tm-phan-hoi-dung { color: var(--dung); font-weight: 800; }
.tm-phan-hoi-sai { color: var(--sai); font-weight: 800; }
.tm-an { display: none !important; }

/* Tam giác đo */
.tm-troi-1 { stop-color: #cfe8ff; } .tm-troi-2 { stop-color: #f4faff; }
[data-theme="toi"] .tm-troi-1 { stop-color: #0d1a3a; } [data-theme="toi"] .tm-troi-2 { stop-color: #1d2f5a; }
.tm-dat { fill: #8fcf7a; } [data-theme="toi"] .tm-dat { fill: #2c5a35; }
.tm-dat-2 { fill: #6fb35c; } [data-theme="toi"] .tm-dat-2 { fill: #234a2b; }
.tm-cat { fill: #ecd9a8; } [data-theme="toi"] .tm-cat { fill: #5b4e2e; }
.tm-nuoc-1 { stop-color: #74c0fc; } .tm-nuoc-2 { stop-color: #339af0; }
[data-theme="toi"] .tm-nuoc-1 { stop-color: #1c4f86; } [data-theme="toi"] .tm-nuoc-2 { stop-color: #123a66; }
.tm-song { fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round; opacity: .45; }
.tm-song-chay { animation: tmSong 6s linear infinite; }
@keyframes tmSong { to { transform: translateX(-120px); } }
.tm-may { fill: #fff; opacity: .85; } [data-theme="toi"] .tm-may { fill: #3b4f7d; opacity: .5; }
.tm-thap-1 { fill: #f1f3f5; stroke: #495057; stroke-width: 2; } .tm-thap-2 { fill: #e03131; }
[data-theme="toi"] .tm-thap-1 { fill: #ced4da; }
.tm-cay-la { fill: #2f9e44; } .tm-cay-la-2 { fill: #40c057; } .tm-cay-than { fill: #8d5a2b; }
.tm-nguoi { fill: none; stroke: var(--chu); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
.tm-nguoi-dau { fill: var(--chu); }
.tm-coc { stroke: #8d5a2b; stroke-width: 4; stroke-linecap: round; }
.tm-co-hieu { fill: var(--sai); }
.tm-tam-giac { fill: var(--mau); fill-opacity: .16; stroke: none; }
.tm-ngam { stroke: var(--mau); stroke-width: 3.2; stroke-linecap: round; }
.tm-ngam-2 { stroke: var(--tm-tim); }
.tm-nen-dat { stroke: var(--chu); stroke-width: 3.2; stroke-linecap: round; }
.tm-kich-thuoc { stroke: var(--chu-phu); stroke-width: 2; }
.tm-kich-thuoc-chu { font-size: 19px; font-weight: 800; fill: var(--chu); paint-order: stroke; stroke: var(--tm-nen-svg); stroke-width: 6px; }
.tm-cao { stroke: var(--tm-cam); stroke-width: 3; stroke-dasharray: 9 7; }
.tm-cung-a { fill: var(--mau); fill-opacity: .18; stroke: var(--mau); stroke-width: 3; }
.tm-cung-b { fill: var(--tm-tim); fill-opacity: .18; stroke: var(--tm-tim); stroke-width: 3; }
.tm-cung-c { fill: var(--tm-cam); fill-opacity: .18; stroke: var(--tm-cam); stroke-width: 3; }
.tm-buoc-tinh { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; counter-reset: tmb; }
section .tm-buoc-tinh > li, .tm-buoc-tinh > li { position: relative; margin: 0; padding: .3em .7em .3em 2.2em; border-radius: 14px; background: var(--the); border: 1px solid var(--vien); counter-increment: tmb; font-variant-numeric: tabular-nums; }
.tm-buoc-tinh > li::before { content: counter(tmb); position: absolute; left: .45em; top: .35em; width: 1.35em; height: 1.35em; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, var(--mau), var(--mau-2)); color: #fff; font-weight: 800; font-size: .82em; }
.tm-buoc-tinh > li b { color: var(--mau); }
.tm-buoc-tinh > li .tm-nho { display: block; font-size: .84em; color: var(--chu-phu); font-weight: 600; }
.tm-buoc-tinh > li.tm-ket { background: var(--dung-nhat); border-color: var(--dung); }
.tm-buoc-tinh > li.tm-ket b { color: var(--dung); }
.tm-du-lieu { display: flex; flex-wrap: wrap; gap: 6px 14px; font-weight: 700; }
.tm-du-lieu span { padding: .08em .6em; border-radius: 999px; background: var(--the-2); border: 1px solid var(--vien); font-variant-numeric: tabular-nums; }

/* Mô phỏng xác suất */
.tm-hop.tm-xs { grid-template-columns: minmax(0, .82fr) minmax(0, 1.25fr); }
.tm-ban { display: flex; flex-direction: column; }
.tm-ban .tm-khay { position: relative; flex: 1; min-height: 0; }
.tm-ban .tm-dk { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 8px; font-size: .56em; border-top: 1px solid var(--vien); background: var(--the-2); }
.tm-dem { font-weight: 800; font-size: 1.15em; font-variant-numeric: tabular-nums; }
.tm-dem b { color: var(--mau); font-size: 1.25em; }
.tm-xs-phai { display: flex; flex-direction: column; }
.tm-xs-phai .tm-o-bd { position: relative; flex: 1.75; min-height: 0; }
.tm-xs-phai .tm-o-ht { position: relative; flex: 1; min-height: 0; border-top: 1px solid var(--vien); }
.tm-xs-phai .tm-tk { padding: 8px 16px; font-size: .5em; border-top: 1px solid var(--vien); background: var(--the-2); font-weight: 600; font-variant-numeric: tabular-nums; min-height: 2.7em; }
.tm-cot { fill: var(--mau); transition: fill .2s; cursor: pointer; }
.tm-cot:hover { fill: var(--mau-2); }
.tm-cot.tm-chon { fill: var(--tm-cam); }
.tm-ly-thuyet { stroke: var(--chu); stroke-width: 3; stroke-dasharray: 7 5; }
.tm-duong-ht { fill: none; stroke: var(--tm-cam); stroke-width: 3.2; stroke-linejoin: round; }
.tm-xuc-xac rect.tm-mat { fill: #fff; stroke: #ced4da; stroke-width: 2.5; }
.tm-xuc-xac rect.tm-mat-ben { fill: #dee2e6; }
.tm-xuc-xac circle { fill: #212529; }
.tm-xuc-xac circle.tm-do { fill: #e03131; }
.tm-lan { transform-box: fill-box; transform-origin: center; animation: tmLan .75s cubic-bezier(.3, .7, .3, 1); }
@keyframes tmLan { 0% { transform: translate(-120px, -60px) rotate(-200deg) scale(.8); } 55% { transform: translate(10px, 8px) rotate(25deg) scale(1.05); } 75% { transform: translate(-4px, -10px) rotate(-8deg); } 100% { transform: none; } }
.tm-dong-xu-mat { stroke: #b07800; stroke-width: 3; }
.tm-dong-xu-vien { fill: none; stroke: #fff3bf; stroke-width: 2; opacity: .8; }
.tm-dong-xu-chu { font-size: 64px; font-weight: 900; fill: #7a4f00; text-anchor: middle; font-family: var(--font); }
.tm-tung { transform-box: fill-box; transform-origin: center; animation: tmTung .8s cubic-bezier(.3, .6, .4, 1); }
@keyframes tmTung { 0% { transform: translateY(0) scaleY(1); } 15% { transform: translateY(-60px) scaleY(-1); } 30% { transform: translateY(-110px) scaleY(1); } 45% { transform: translateY(-130px) scaleY(-1); } 60% { transform: translateY(-100px) scaleY(1); } 75% { transform: translateY(-40px) scaleY(-1); } 100% { transform: none; } }
.tm-bong-ban { fill: #000; opacity: .12; }

/* Hẹp (đặt trong một cột của slide hai-cot, trong tab…): hình ở trên, bảng gọn ở dưới */
.tm-goc { container-type: inline-size; }
@container (max-width: 980px) {
  .tm-hop { display: flex; flex-direction: column; gap: 10px; }
  .tm-hop > .tm-hinh { flex: 1 1 auto; min-height: 170px; }
  .tm-hop > .tm-bang { flex: none; font-size: .5em; gap: 7px; }
  .tm-svg .tm-nhan { font-size: 27px; stroke-width: 7px; }
  .tm-svg .tm-nhan-nho { font-size: 23px; }
  .tm-so { font-size: 19px; }
  .tm-ten-truc { font-size: 29px; }
  .tm-noi-hinh { font-size: 16px; left: 10px; bottom: 8px; gap: 6px; }
  .tm-noi-hinh .tm-nut { padding: .32em .8em; }
  .tm-chu-goc { font-size: 13px; right: 8px; top: 6px; }
  .tm-bang .tm-tieu-de { display: none; }
  .tm-bang-c { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); grid-auto-flow: row dense; align-items: stretch; }
  .tm-bang-c > .tm-tt, .tm-bang-c > .tm-cac-truot, .tm-bang-c > .tm-ghi, .tm-bang-c > .tm-noi-e { grid-column: 1 / -1; }
  .tm-bang-c > .tm-ct { display: flex; align-items: center; justify-content: center; font-size: 1.75em; padding: .1em .4em; }
  .tm-bang-c > .tm-noi { padding: .3em .6em .3em .8em; }
  .tm-bang-c > .tm-noi .tm-lon { font-size: 1.1em; }
  .tm-bang-c > .tm-noi-e { display: none; }
  .tm-tt { grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); }
  .tm-tt dt, .tm-tt dd { padding: .2em .55em; }
  .tm-tt dt:nth-of-type(2), .tm-tt dt:nth-of-type(2) + dd { border-top: 0; }
  .tm-cac-truot { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 4px 18px; padding: 5px 12px; }
  .tm-truot { gap: 8px; }
  .tm-ds-rang { flex-direction: row; flex-wrap: wrap; gap: 6px; }
  section .tm-ds-rang li, .tm-ds-rang li { padding: .18em .6em; border-left-width: 7px; }
  .tm-bang-f { grid-template-columns: none; grid-template-rows: repeat(3, auto); grid-auto-flow: column; grid-auto-columns: auto; justify-content: start; }
  .tm-bang-f.tm-hai-hang { grid-template-columns: none; grid-template-rows: repeat(2, auto); }
  .tm-bang-f > span { border-top: 0; border-left: 1px solid var(--vien); text-align: center; padding: .14em .55em; }
  .tm-bang-f > span.tm-dau { text-align: left; }
  .tm-ket-qua { padding: .25em .7em; }
  .tm-bang-mn > .tm-cac-truot { display: none; }
  .tm-bang-tg { display: grid; grid-template-columns: minmax(0, 1fr); }
  .tm-buoc-tinh { gap: 5px; }
  section .tm-buoc-tinh > li, .tm-buoc-tinh > li { padding: .18em .6em .18em 2em; }
  .tm-hop.tm-xs { display: flex; flex-direction: column; }
  .tm-xs .tm-ban { flex: none; flex-direction: row; height: 136px; }
  .tm-xs .tm-ban .tm-khay { flex: 0 0 32%; }
  .tm-xs .tm-ban .tm-dk { flex: 1 1 auto; border-top: 0; border-left: 1px solid var(--vien); justify-content: center; font-size: .44em; padding: 8px 12px; }
  .tm-xs .tm-xs-phai { flex: 1 1 auto; min-height: 220px; }
  .tm-xs-phai .tm-tk { font-size: .42em; padding: 6px 12px; min-height: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .tm-tia, .tm-tay .tm-vong, .tm-nhip, .tm-loe, .tm-sao-nhay, .tm-song-chay, .tm-lan, .tm-tung, .tm-dinh-mn.tm-tot .tm-vong-tot, .tm-mien.tm-nhay-mien { animation: none !important; }
  .tm-bien-dt.tm-ve { animation: none !important; stroke-dashoffset: 0; }
}
`;

/* global __T */
export function chayToanMoRong(tuyChon) {
  /* ═══════════════ Thư viện thuần (không DOM) ═══════════════ */
  var L = (function () {
    /* ── Phân số chính xác ── */
    var ucln = function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; };
    var PS = function (p, q) {
      if (!q) throw new Error("mẫu số bằng 0");
      if (q < 0) { p = -p; q = -q; }
      var g = ucln(p, q);
      return { p: p / g + 0, q: q / g };
    };
    var tuSo = function (x) {
      if (x && typeof x === "object" && typeof x.p === "number" && typeof x.q === "number") return PS(x.p, x.q);
      if (typeof x === "string") {
        var s = x.trim().replace(/[−–]/g, "-").replace(",", ".");
        var m = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
        if (m) return chia(tuSo(Number(m[1])), tuSo(Number(m[2])));
        if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error("«" + x + "» không phải một số");
        x = Number(s);
      }
      if (typeof x !== "number" || !isFinite(x)) throw new Error("«" + x + "» không phải một số");
      var q = 1;
      while (Math.abs(Math.round(x * q) - x * q) > 1e-9 * Math.max(1, Math.abs(x * q)) && q < 1e6) q *= 10;
      return PS(Math.round(x * q), q);
    };
    var cong = function (a, b) { return PS(a.p * b.q + b.p * a.q, a.q * b.q); };
    var tru = function (a, b) { return PS(a.p * b.q - b.p * a.q, a.q * b.q); };
    var nhan = function (a, b) { return PS(a.p * b.p, a.q * b.q); };
    var chia = function (a, b) { if (!b.p) throw new Error("chia cho 0"); return PS(a.p * b.q, a.q * b.p); };
    var ss = function (a, b) { var v = a.p * b.q - b.p * a.q; return v > 0 ? 1 : v < 0 ? -1 : 0; };
    var gt = function (a) { return a.p / a.q; };
    var chuPS = function (r, ascii) {
      var t = r.q === 1 ? String(r.p) : r.p + "/" + r.q;
      return ascii ? t : t.replace(/-/g, "−");
    };

    /* ── Định dạng số kiểu Việt Nam ── */
    var so = function (x, k) {
      if (k == null) k = 2;
      if (typeof x !== "number" || !isFinite(x)) return "—";
      var m = Math.pow(10, k);
      var r = Math.round(x * m) / m;
      if (r === 0) r = 0;
      var s = r.toFixed(k);
      if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
      if (s === "-0") s = "0";
      return s.replace("-", "−").replace(".", ",");
    };
    var soNhom = function (n) {
      var s = String(Math.round(n)), r = "";
      while (s.length > 3) { r = "\u00a0" + s.slice(-3) + r; s = s.slice(0, -3); }
      return s + r;
    };
    // n = k²·m với m không chứa thừa số chính phương
    var tachChinhPhuong = function (n) {
      var k = 1, m = n;
      if (!(n >= 1) || n > 1e9 || n !== Math.floor(n)) return { k: 1, m: n };
      for (var f = 2; f * f <= m; f++) { while (m % (f * f) === 0) { m /= f * f; k *= f; } }
      return { k: k, m: m };
    };
    // Căn bậc hai để hiển thị: chính xác nếu được, không thì «√v ≈ …»
    var chuCan = function (v) {
      v = Math.round(v * 1e6) / 1e6;
      if (v < 0) return { chinhXac: false, chu: "√(" + so(v) + ")", giaTri: NaN };
      var r = Math.sqrt(v);
      if (Math.abs(r * 100 - Math.round(r * 100)) < 1e-6) return { chinhXac: true, chu: so(r), giaTri: r };
      if (Math.abs(v - Math.round(v)) < 1e-9) {
        var t = tachChinhPhuong(Math.round(v));
        var goc = "√" + Math.round(v);
        var gon = t.k > 1 ? " = " + t.k + "√" + t.m : "";
        return { chinhXac: false, chu: goc + gon + " ≈ " + so(r), giaTri: r, can: t };
      }
      return { chinhXac: false, chu: "√" + so(v) + " ≈ " + so(r), giaTri: r };
    };
    var buocDep = function (v) {
      if (!(v > 0) || !isFinite(v)) return 1;
      var m = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
      var r = v / m;
      return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * m;
    };

    /* ── Ba đường conic (dạng chính tắc, tiêu điểm trên Ox) ── */
    var thongSoConic = function (loai, a, b, p) {
      if (loai === "elip") {
        if (!(a > b && b > 0)) throw new Error("elip cần a > b > 0");
        var c = Math.sqrt(a * a - b * b);
        return { loai: loai, a: a, b: b, c: c, e: c / a, F1: [-c, 0], F2: [c, 0], tongHieu: 2 * a,
          dinh: [[-a, 0], [a, 0], [0, -b], [0, b]] };
      }
      if (loai === "hypebol") {
        if (!(a > 0 && b > 0)) throw new Error("hypebol cần a > 0 và b > 0");
        var ch = Math.sqrt(a * a + b * b);
        return { loai: loai, a: a, b: b, c: ch, e: ch / a, F1: [-ch, 0], F2: [ch, 0], tongHieu: 2 * a,
          dinh: [[-a, 0], [a, 0]], tiemCan: b / a };
      }
      if (!(p > 0)) throw new Error("parabol cần p > 0");
      return { loai: "parabol", p: p, c: p / 2, e: 1, F: [p / 2, 0], duongChuan: -p / 2, dinh: [[0, 0]] };
    };
    var kc = function (A, B) { return Math.sqrt((A[0] - B[0]) * (A[0] - B[0]) + (A[1] - B[1]) * (A[1] - B[1])); };
    // Phản xạ hướng d qua mặt có pháp tuyến n: r = d − 2(d·n)n
    var phanXa = function (dx, dy, nx, ny) {
      var l = Math.sqrt(nx * nx + ny * ny); nx /= l; ny /= l;
      var t = dx * nx + dy * ny;
      return [dx - 2 * t * nx, dy - 2 * t * ny];
    };
    // Tia song song trục (đi theo hướng −Ox) chạm gương y² = 2px tại M có tung độ y0
    var phanXaParabol = function (p, y0) {
      var M = [y0 * y0 / (2 * p), y0];
      return { M: M, r: phanXa(-1, 0, -2 * p, 2 * y0), goc: Math.acos(p / Math.sqrt(p * p + y0 * y0)) };
    };
    // Giao (phía trước) của tia (x0,y0)+s(ux,uy) với elip x²/a² + y²/b² = 1
    var giaoTiaElip = function (a, b, x0, y0, ux, uy) {
      var A = ux * ux / (a * a) + uy * uy / (b * b), B = 2 * (x0 * ux / (a * a) + y0 * uy / (b * b)), C = x0 * x0 / (a * a) + y0 * y0 / (b * b) - 1;
      var D = B * B - 4 * A * C;
      if (D < 0) return null;
      var s = (-B + Math.sqrt(D)) / (2 * A);
      return [x0 + s * ux, y0 + s * uy];
    };
    var phanXaElip = function (a, b, M, dx, dy) { return phanXa(dx, dy, M[0] / (a * a), M[1] / (b * b)); };
    // Phương trình Kepler M = E − e·sin E (Newton)
    var giaiKepler = function (Mtb, e) {
      var E = e < 0.8 ? Mtb : Mtb + (Math.sin(Mtb) >= 0 ? 1 : -1) * e;
      for (var i = 0; i < 60; i++) {
        var f = E - e * Math.sin(E) - Mtb, df = 1 - e * Math.cos(E), dE = f / df;
        E -= dE;
        if (Math.abs(dE) < 1e-14) break;
      }
      return E;
    };
    // Vị trí hành tinh (tâm elip ở gốc, ngôi sao ở F2(c;0)) theo dị thường trung bình Mtb
    var viTriQuyDao = function (a, b, Mtb) {
      var c = Math.sqrt(a * a - b * b), e = c / a, E = giaiKepler(Mtb, e);
      return { x: a * Math.cos(E), y: b * Math.sin(E), E: E, r: a * (1 - e * Math.cos(E)) };
    };
    // Diện tích quét từ tiêu điểm trong khoảng dị thường trung bình [M1; M2] (định luật Kepler II)
    var dienTichQuet = function (a, b, M1, M2) { return a * b * (M2 - M1) / 2; };

    /* ── Hệ bất phương trình bậc nhất hai ẩn ── */
    var DAU = { "<=": "<=", "≤": "<=", "=<": "<=", "<": "<", ">=": ">=", "≥": ">=", "=>": ">=", ">": ">", "=": "=" };
    var KY_HIEU = { "<=": "≤", "<": "<", ">=": "≥", ">": ">", "=": "=" };
    var chuanRang = function (ds) {
      if (!Array.isArray(ds) || !ds.length) throw new Error("rang phải là mảng ràng buộc {a,b,c,dau}");
      return ds.map(function (r, i) {
        if (!r || typeof r !== "object") throw new Error("ràng buộc thứ " + (i + 1) + " không hợp lệ");
        var dau = DAU[String(r.dau || "<=").trim()];
        if (!dau) throw new Error("dấu «" + r.dau + "» không hợp lệ ở ràng buộc " + (i + 1));
        var o = { a: tuSo(r.a == null ? 0 : r.a), b: tuSo(r.b == null ? 0 : r.b), c: tuSo(r.c == null ? 0 : r.c), dau: dau };
        if (!o.a.p && !o.b.p) throw new Error("ràng buộc " + (i + 1) + " có a = b = 0");
        return o;
      });
    };
    var giaTriTrai = function (r, x, y) { return cong(nhan(r.a, x), nhan(r.b, y)); };
    // dong: true → xét bao đóng (dấu chặt coi như không chặt)
    var thoa = function (r, x, y, dong) {
      var s = ss(giaTriTrai(r, x, y), r.c);
      if (r.dau === "=") return s === 0;
      if (r.dau === "<=") return s <= 0;
      if (r.dau === ">=") return s >= 0;
      if (r.dau === "<") return dong ? s <= 0 : s < 0;
      return dong ? s >= 0 : s > 0;
    };
    var giaoHaiDuong = function (r1, r2) {
      var det = tru(nhan(r1.a, r2.b), nhan(r2.a, r1.b));
      if (!det.p) return null;
      return { x: chia(tru(nhan(r1.c, r2.b), nhan(r2.c, r1.b)), det), y: chia(tru(nhan(r1.a, r2.c), nhan(r2.a, r1.c)), det) };
    };
    // Đỉnh của miền nghiệm (bao đóng): giao từng cặp đường biên, giữ điểm thoả mọi ràng buộc; sắp ngược chiều kim đồng hồ.
    var dinhMien = function (rang) {
      var ds = [];
      for (var i = 0; i < rang.length; i++) {
        for (var j = i + 1; j < rang.length; j++) {
          var g = giaoHaiDuong(rang[i], rang[j]);
          if (!g) continue;
          var ok = rang.every(function (r) { return thoa(r, g.x, g.y, true); });
          if (!ok) continue;
          var trung = ds.filter(function (v) { return !ss(v.x, g.x) && !ss(v.y, g.y); })[0];
          if (trung) { if (trung.duong.indexOf(i) < 0) trung.duong.push(i); if (trung.duong.indexOf(j) < 0) trung.duong.push(j); continue; }
          ds.push({ x: g.x, y: g.y, duong: [i, j], thuoc: rang.every(function (r) { return thoa(r, g.x, g.y, false); }) });
        }
      }
      if (ds.length > 1) {
        var cx = 0, cy = 0;
        ds.forEach(function (v) { cx += gt(v.x); cy += gt(v.y); });
        cx /= ds.length; cy /= ds.length;
        ds.sort(function (u, v) { return Math.atan2(gt(u.y) - cy, gt(u.x) - cx) - Math.atan2(gt(v.y) - cy, gt(v.x) - cx); });
      }
      return ds;
    };
    // Hướng d có nằm trong nón lùi xa của miền (mọi ràng buộc vẫn thoả khi đi mãi theo d)?
    var trongNon = function (rang, dx, dy) {
      return rang.every(function (r) {
        var v = gt(r.a) * dx + gt(r.b) * dy, e = 1e-12 * (Math.abs(gt(r.a)) + Math.abs(gt(r.b)));
        if (r.dau === "=") return Math.abs(v) <= e;
        return r.dau === "<=" || r.dau === "<" ? v <= e : v >= -e;
      });
    };
    var biChan = function (rang) {
      for (var i = 0; i < rang.length; i++) {
        var bx = gt(rang[i].b), by = -gt(rang[i].a);
        if (trongNon(rang, bx, by) || trongNon(rang, -bx, -by)) return false;
      }
      return !trongNon(rang, 1, 0) && !trongNon(rang, 0, 1) && !trongNon(rang, -1, 0) && !trongNon(rang, 0, -1);
    };
    // F = px + qy có thể tăng (max) / giảm (min) mãi trên miền?
    var mucKhongBiChan = function (rang, p, q, loai) {
      var h = loai === "min" ? -1 : 1, pp = gt(p), qq = gt(q);
      var ung = [[h * pp, h * qq]];
      rang.forEach(function (r) { ung.push([gt(r.b), -gt(r.a)]); ung.push([-gt(r.b), gt(r.a)]); });
      return ung.some(function (d) {
        if (!d[0] && !d[1]) return false;
        return trongNon(rang, d[0], d[1]) && h * (pp * d[0] + qq * d[1]) > 1e-12;
      });
    };
    var toiUu = function (rang, muc) {
      var dinh = dinhMien(rang);
      var kq = { dinh: dinh, biChan: biChan(rang), tot: [], giaTri: null, khongCo: false, khongDat: false };
      if (!muc) return kq;
      var p = tuSo(muc.p), q = tuSo(muc.q), loai = muc.loai === "min" ? "min" : "max";
      dinh.forEach(function (v) { v.F = cong(nhan(p, v.x), nhan(q, v.y)); });
      kq.loai = loai;
      if (!dinh.length) { kq.khongCo = true; return kq; }
      if (mucKhongBiChan(rang, p, q, loai)) { kq.khongCo = true; return kq; }
      var best = null;
      dinh.forEach(function (v) { if (!best || (loai === "max" ? ss(v.F, best) > 0 : ss(v.F, best) < 0)) best = v.F; });
      dinh.forEach(function (v, i) { if (!ss(v.F, best)) kq.tot.push(i); });
      kq.giaTri = best;
      kq.khongDat = !kq.tot.some(function (i) { return dinh[i].thuoc; });
      return kq;
    };
    // «2x − 3y», «x + 0,5y», «−y»
    var bieuThuc = function (a, b, bx, by) {
      bx = bx || "x"; by = by || "y";
      var phan = [];
      var mot = function (h, bien, dau) {
        if (!h.p) return;
        var am = h.p < 0, tri = { p: Math.abs(h.p), q: h.q };
        var hs = tri.p === tri.q ? "" : tri.q === 1 ? String(tri.p) : so(tri.p / tri.q, 4);
        if (tri.q !== 1 && Math.abs(tri.p / tri.q * 1e4 - Math.round(tri.p / tri.q * 1e4)) > 1e-6) hs = "(" + tri.p + "/" + tri.q + ")";
        phan.push({ am: am, chu: hs + bien, dau: dau });
      };
      mot(a, bx); mot(b, by);
      if (!phan.length) return "0";
      return phan.map(function (t, i) { return i === 0 ? (t.am ? "−" : "") + t.chu : (t.am ? " − " : " + ") + t.chu; }).join("");
    };
    var chuRang = function (r, bx, by) { return bieuThuc(r.a, r.b, bx, by) + " " + KY_HIEU[r.dau] + " " + chuPS(r.c); };
    var chuDiem = function (x, y, ascii) { return ascii ? "(" + chuPS(x, true) + ";" + chuPS(y, true) + ")" : "(" + chuPS(x) + "; " + chuPS(y) + ")"; };

    /* ── Hệ thức lượng: đo chiều cao / khoảng cách qua sông ── */
    var RAD = Math.PI / 180;
    var tamGiacDo = function (bai, AB, al, be) {
      var sA = Math.sin(al * RAD), sB = Math.sin(be * RAD);
      if (!(AB > 0)) throw new Error("AB phải dương");
      if (bai === "qua-song") {
        if (!(al > 0 && be > 0 && al + be < 180)) throw new Error("cần α, β > 0 và α + β < 180°");
        var C = 180 - al - be, sC = Math.sin(C * RAD);
        var AC = AB * sB / sC, BC = AB * sA / sC;
        return { bai: bai, AB: AB, al: al, be: be, C: C, AC: AC, BC: BC, h: AC * sA, hKiem: BC * sB,
          BCcos: Math.sqrt(AB * AB + AC * AC - 2 * AB * AC * Math.cos(al * RAD)) };
      }
      if (!(al > 0 && be > al && be < 90)) throw new Error("cần 0° < α < β < 90°");
      var Cc = be - al, sCc = Math.sin(Cc * RAD);
      var BCc = AB * sA / sCc, ACc = AB * sB / sCc;
      return { bai: "chieu-cao", AB: AB, al: al, be: be, C: Cc, BC: BCc, AC: ACc, h: BCc * sB, hKiem: ACc * sA,
        BH: BCc * Math.cos(be * RAD), ACcos: Math.sqrt(AB * AB + BCc * BCc - 2 * AB * BCc * Math.cos((180 - be) * RAD)) };
    };

    /* ── Xác suất cổ điển ── */
    var xacSuatLyThuyet = function (loai) {
      if (loai === "dong-xu") return [{ nhan: "Sấp", ma: "S", xs: PS(1, 2) }, { nhan: "Ngửa", ma: "N", xs: PS(1, 2) }];
      if (loai === "hai-xuc-xac-tong") {
        var ds = [];
        for (var s = 2; s <= 12; s++) ds.push({ nhan: String(s), ma: String(s), xs: PS(6 - Math.abs(s - 7), 36) });
        return ds;
      }
      return [1, 2, 3, 4, 5, 6].map(function (k) { return { nhan: String(k), ma: String(k), xs: PS(1, 6) }; });
    };
    // Số nguyên đều trong [0; k) từ nguồn 32 bit (loại bỏ phần dư để không lệch)
    var soNgauNhien = function (k, layU32) {
      var gioiHan = Math.floor(4294967296 / k) * k;
      for (var lan = 0; lan < 64; lan++) { var v = layU32(); if (v < gioiHan) return v % k; }
      return Math.floor(Math.random() * k); // nguồn hỏng: không bao giờ quay mãi
    };
    // Một lần thử → chỉ số kết quả trong xacSuatLyThuyet(loai)
    var gieo = function (loai, layU32) {
      if (loai === "dong-xu") return soNgauNhien(2, layU32);
      if (loai === "hai-xuc-xac-tong") { var a = soNgauNhien(6, layU32) + 1, b = soNgauNhien(6, layU32) + 1; return { kq: a + b - 2, mat: [a, b] }; }
      return soNgauNhien(6, layU32);
    };

    /*
     * Toạ độ mọi điểm của một hình dựng theo từng bước (.hinh-dung). `gt` ghi đè tham số của điểm kéo được: góc (độ) với
     * điểm trên đường tròn, t với điểm chia đoạn. Điểm không dựng được (hai đường song song, đường thẳng không cắt đường
     * tròn) là null, và mọi điểm dựng từ nó cũng null.
     */
    var dungHinh = function (ds, gt) {
      var P = {};
      var duong = function (d) {
        if (Array.isArray(d)) {
          var a = P[d[0]], b = P[d[1]];
          return a && b ? { p: a, v: [b[0] - a[0], b[1] - a[1]] } : null;
        }
        var q = P[d.qua], m = d.vuongGoc || d.songSong;
        var u = q && m && P[m[0]], w = q && m && P[m[1]];
        if (!u || !w) return null;
        var vx = w[0] - u[0], vy = w[1] - u[1];
        return { p: q, v: d.vuongGoc ? [-vy, vx] : [vx, vy] };
      };
      ds.forEach(function (d) {
        var g = gt && gt[d.ten] != null ? gt[d.ten] : null, kq = null, a, b, c;
        if (d.tren) {
          a = P[d.tren[0]]; b = P[d.tren[1]];
          if (a && b) {
            var r = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
            var goc = (g != null ? g : d.goc) * Math.PI / 180;
            kq = [a[0] + r * Math.cos(goc), a[1] + r * Math.sin(goc)];
          }
        } else if (d.chia) {
          a = P[d.chia[0]]; b = P[d.chia[1]];
          var t = g != null ? g : d.t;
          if (a && b) kq = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        } else if (d.trungDiem) {
          a = P[d.trungDiem[0]]; b = P[d.trungDiem[1]];
          if (a && b) kq = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        } else if (d.chan) {
          a = P[d.chan[0]]; b = P[d.chan[1]]; c = P[d.chan[2]];
          if (a && b && c) {
            var ux = c[0] - b[0], uy = c[1] - b[1], uu = ux * ux + uy * uy;
            if (uu > 1e-12) {
              var s = ((a[0] - b[0]) * ux + (a[1] - b[1]) * uy) / uu;
              kq = [b[0] + ux * s, b[1] + uy * s];
            }
          }
        } else if (d.giao) {
          var l1 = duong(d.giao[0]), l2 = duong(d.giao[1]);
          if (l1 && l2) {
            var det = l1.v[0] * l2.v[1] - l1.v[1] * l2.v[0];
            if (Math.abs(det) > 1e-9) {
              var h = ((l2.p[0] - l1.p[0]) * l2.v[1] - (l2.p[1] - l1.p[1]) * l2.v[0]) / det;
              kq = [l1.p[0] + l1.v[0] * h, l1.p[1] + l1.v[1] * h];
            }
          }
        } else if (d.giaoTron) {
          var l = duong(d.giaoTron[0]);
          a = P[d.giaoTron[1]]; b = P[d.giaoTron[2]];
          if (l && a && b) {
            var R2 = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]);
            var fx = l.p[0] - a[0], fy = l.p[1] - a[1];
            var A2 = l.v[0] * l.v[0] + l.v[1] * l.v[1], B2 = 2 * (fx * l.v[0] + fy * l.v[1]), C2 = fx * fx + fy * fy - R2;
            var D2 = B2 * B2 - 4 * A2 * C2;
            if (A2 > 1e-12 && D2 >= 0) {
              var cD = Math.sqrt(D2);
              var n1 = [l.p[0] + l.v[0] * (-B2 + cD) / (2 * A2), l.p[1] + l.v[1] * (-B2 + cD) / (2 * A2)];
              var n2 = [l.p[0] + l.v[0] * (-B2 - cD) / (2 * A2), l.p[1] + l.v[1] * (-B2 - cD) / (2 * A2)];
              var kh = d.khac ? P[d.khac] : null;
              var cach = function (n) { return kh ? (n[0] - kh[0]) * (n[0] - kh[0]) + (n[1] - kh[1]) * (n[1] - kh[1]) : 0; };
              kq = cach(n1) >= cach(n2) ? n1 : n2;
            }
          }
        } else if (typeof d.x === "number" && typeof d.y === "number") {
          kq = [d.x, d.y];
        }
        P[d.ten] = kq;
      });
      return P;
    };

    return {
      dungHinh: dungHinh,
      PS: PS, tuSo: tuSo, cong: cong, tru: tru, nhan: nhan, chia: chia, ss: ss, gt: gt, chuPS: chuPS, so: so, soNhom: soNhom,
      chuCan: chuCan, tachChinhPhuong: tachChinhPhuong, buocDep: buocDep, kc: kc,
      thongSoConic: thongSoConic, phanXa: phanXa, phanXaParabol: phanXaParabol, giaoTiaElip: giaoTiaElip, phanXaElip: phanXaElip,
      giaiKepler: giaiKepler, viTriQuyDao: viTriQuyDao, dienTichQuet: dienTichQuet,
      chuanRang: chuanRang, thoa: thoa, giaoHaiDuong: giaoHaiDuong, dinhMien: dinhMien, biChan: biChan, mucKhongBiChan: mucKhongBiChan,
      toiUu: toiUu, bieuThuc: bieuThuc, chuRang: chuRang, chuDiem: chuDiem, KY_HIEU: KY_HIEU,
      tamGiacDo: tamGiacDo, xacSuatLyThuyet: xacSuatLyThuyet, soNgauNhien: soNgauNhien, gieo: gieo
    };
  })();

  if (tuyChon && tuyChon.chiLoi) return L;
  if (typeof document === "undefined") return L;
  try { window.__sdToanMoRong = L; } catch { /* không gắn được */ }

  /* ═══════════════ Phần DOM ═══════════════ */
  var NS = "http://www.w3.org/2000/svg";
  var $$ = function (s, g) { return Array.prototype.slice.call((g || document).querySelectorAll(s)); };
  var tao = function (tag, lop, chu) {
    var e = document.createElement(tag);
    if (lop) e.className = lop;
    if (chu != null) e.textContent = chu;
    return e;
  };
  var taoS = function (tag, tt, cha) {
    var e = document.createElementNS(NS, tag);
    if (tt) Object.keys(tt).forEach(function (k) { if (tt[k] != null) e.setAttribute(k, tt[k]); });
    if (cha) cha.appendChild(e);
    return e;
  };
  var dat = function (e, tt) { Object.keys(tt).forEach(function (k) { e.setAttribute(k, tt[k]); }); return e; };
  var chuS = function (cha, x, y, chu, lop, them) {
    var t = taoS("text", { x: r1(x), y: r1(y), class: lop || "tm-nhan" }, cha);
    if (them) dat(t, them);
    t.textContent = chu;
    return t;
  };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var itDong = false;
  try { itDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* trình duyệt cũ */ }
  var dem = 0;
  var maMoi = function (t) { dem++; return "tm" + t + dem; };
  var docJson = function (el) {
    var s = el.getAttribute("data-du-lieu");
    if (!s || !s.trim()) return {};
    var o;
    try { o = JSON.parse(s); } catch (e) { throw new Error("data-du-lieu không phải JSON hợp lệ (" + e.message + ")"); }
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("data-du-lieu phải là một đối tượng {…}");
    return o;
  };
  var taoHop = function (el, lop) {
    var h = tao("div", "tm-hop" + (lop ? " " + lop : ""));
    el.classList.add("tm-goc");
    el.appendChild(h);
    return h;
  };
  var hopLoi = function (el, ten, e) {
    el.textContent = "";
    var h = tao("div", "tm-loi", "Không dựng được «" + ten + "»: " + (e && e.message ? e.message : String(e)));
    h.setAttribute("role", "note");
    el.appendChild(h);
    try { console.warn("[khungToanMoRong]", ten, e); } catch { /* không có console */ }
  };
  var soLieu = function (v, macDinh) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      var x = Number(v.trim().replace(/[−–]/g, "-").replace(",", "."));
      if (isFinite(x)) return x;
      throw new Error("«" + v + "» không phải một số");
    }
    return macDinh;
  };
  var gioiHanTruot = function (v, macDinh) {
    if (!Array.isArray(v) || v.length < 2) return macDinh;
    var a = soLieu(v[0], NaN), b = soLieu(v[1], NaN), s = soLieu(v[2], macDinh[2]);
    if (!(a < b) || !(s > 0)) return macDinh;
    return [a, b, s];
  };
  var bao = function (el, loai, id, ketQua, chiTiet) {
    var s = el.closest("section");
    var ms = s && s._vao ? Date.now() - s._vao : 0;
    try { parent.postMessage({ type: "smartdoc-su-kien", loai: loai, doiTuongId: id, ketQua: ketQua, thoiGianMs: ms, chiTiet: chiTiet }, "*"); } catch { /* không có cha */ }
  };
  var phatDiem = function (dung) {
    try { document.dispatchEvent(new CustomEvent("sd-diem", { detail: { dung: Boolean(dung) } })); } catch { /* cũ */ }
  };
  var phaoHoa = function (soLuong) {
    try { document.dispatchEvent(new CustomEvent("sd-phao", { detail: { soLuong: soLuong } })); } catch { /* cũ */ }
  };
  var chanVuot = function (el) { el.addEventListener("touchstart", function (e) { e.stopPropagation(); }, { passive: true }); };
  var nhayDoi = function (e) { e.classList.remove("tm-doi"); void e.offsetWidth; e.classList.add("tm-doi"); };

  // Chữ giàu: chuỗi, mảng, {ps:[tử, mẫu]}, {i:"x"} (biến nghiêng), {b:…}, {lop, nd}
  var rich = function (el, parts) {
    el.textContent = "";
    var them = function (cha, p) {
      if (p == null || p === "") return;
      if (typeof p === "string" || typeof p === "number") { cha.appendChild(document.createTextNode(String(p))); return; }
      if (Array.isArray(p)) { p.forEach(function (x) { them(cha, x); }); return; }
      if (p.ps) {
        var s = tao("span", "tm-ps"), t = tao("span", "tm-tu"), m = tao("span", "tm-mau");
        them(t, p.ps[0]); them(m, p.ps[1]);
        s.appendChild(t); s.appendChild(m); cha.appendChild(s);
        return;
      }
      if (p.i) { cha.appendChild(tao("i", "tm-bien", p.i)); return; }
      if (p.b != null) { var b = tao("b", p.lop || ""); them(b, p.b); cha.appendChild(b); return; }
      if (p.nd != null) { var sp = tao("span", p.lop || ""); them(sp, p.nd); cha.appendChild(sp); }
    };
    them(el, parts);
  };

  // Toạ độ con trỏ trong hệ viewBox (svg có preserveAspectRatio mặc định xMidYMid meet, có thể bị khung thu nhỏ)
  var toaDo = function (svg, W, H, e) {
    var r = svg.getBoundingClientRect();
    var s = Math.min(r.width / W, r.height / H) || 1;
    var ox = r.left + (r.width - W * s) / 2, oy = r.top + (r.height - H * s) / 2;
    return { x: (e.clientX - ox) / s, y: (e.clientY - oy) / s };
  };
  var keoTha = function (pt, svg, W, H, o) {
    pt.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      try { pt.setPointerCapture(e.pointerId); } catch { /* cũ */ }
      if (o.bd) o.bd();
      var mv = function (ev) { var q = toaDo(svg, W, H, ev); o.dc(q.x, q.y); };
      var up = function () {
        pt.removeEventListener("pointermove", mv); pt.removeEventListener("pointerup", up); pt.removeEventListener("pointercancel", up);
        if (o.kt) o.kt();
      };
      pt.addEventListener("pointermove", mv); pt.addEventListener("pointerup", up); pt.addEventListener("pointercancel", up);
      mv(e);
    });
    chanVuot(pt);
  };
  // Gọi vao() khi slide chứa el thành slide hiện tại, ra() khi rời đi.
  var theoSlide = function (el, vao, ra) {
    var s = el.closest("section");
    if (!s) { vao(); return; }
    var dang = false;
    var kt = function () {
      var h = s.classList.contains("hien-tai");
      if (h && !dang) { dang = true; vao(); } else if (!h && dang) { dang = false; if (ra) ra(); }
    };
    try { new MutationObserver(kt).observe(s, { attributes: true, attributeFilter: ["class"] }); } catch { vao(); return; }
    kt();
  };
  var theoLop = function (e, cb) {
    try { new MutationObserver(cb).observe(e, { attributes: true, attributeFilter: ["class"] }); } catch { /* cũ */ }
  };
  // Vòng requestAnimationFrame: buoc(dt giây, t ms) trả false để dừng.
  // Vòng hoạt cảnh: buoc(dt giây, t ms) trả false để dừng. Chạy bằng requestAnimationFrame; nếu rAF không tới (khung bị ẩn,
  // pane trình duyệt ẩn, tab nền…) thì một setTimeout dự phòng đẩy bước tiếp, nên việc dở dang (gieo hàng loạt) luôn xong.
  // Mỗi bước bọc try/catch: lỗi thì dừng vòng, không lặp lỗi mãi.
  var vongLap = function (buoc) {
    var raf = 0, hen = 0, chay = false, truoc = 0, the = 0;
    var huy = function () {
      try { if (raf) cancelAnimationFrame(raf); } catch { /* cũ */ }
      if (hen) clearTimeout(hen);
      raf = 0; hen = 0;
    };
    var f = function (t, ve) {
      huy();
      if (!chay) return;
      var bayGio = typeof t === "number" && ve ? t : (typeof performance !== "undefined" ? performance.now() : Date.now());
      var dt = truoc ? Math.min(0.05, Math.max(0, (bayGio - truoc) / 1000)) : 0;
      truoc = bayGio;
      var kq;
      try { kq = buoc(dt, bayGio); } catch (e) { chay = false; try { console.warn("[khungToanMoRong] vòng hoạt cảnh", e); } catch { /* không có console */ } return; }
      if (kq === false) { chay = false; return; }
      hen0();
    };
    var hen0 = function () {
      var luot = ++the;
      try { raf = requestAnimationFrame(function (t) { if (luot === the) f(t, true); }); } catch { raf = 0; }
      hen = setTimeout(function () { if (luot === the) f(0, false); }, 120);
    };
    return {
      chay: function () { if (chay) return; chay = true; truoc = 0; hen0(); },
      dung: function () { chay = false; huy(); the++; },
      dangChay: function () { return chay; }
    };
  };
  var ICON = {
    chay: ["M7 4v16l13-8z"],
    dung: ["M7 4h4v16H7z", "M14 4h4v16h-4z"],
    lai: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
    dao: ["M7 7h13l-3-3", "M17 17H4l3 3"],
    dien: ["M4 20 20 4", "M8 4h12v12"],
    xx: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8.5 8.5h.01", "M15.5 15.5h.01", "M12 12h.01"],
    muc: ["M3 12h18", "M15 6l6 6-6 6"]
  };
  var icon = function (ten) {
    var s = taoS("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.4", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    ICON[ten].forEach(function (d) { taoS("path", { d: d }, s); });
    return s;
  };
  var nut = function (cha, chu, ten, lop, bam) {
    var b = tao("button", "tm-nut" + (lop ? " " + lop : ""));
    b.type = "button";
    if (ten) b.appendChild(icon(ten));
    b.appendChild(document.createTextNode(chu));
    b.addEventListener("click", function (e) { e.stopPropagation(); bam(); b.blur(); });
    cha.appendChild(b);
    return b;
  };
  var truot = function (cha, o) {
    var hang = tao("div", "tm-truot");
    var ten = tao("span", "tm-ten"); rich(ten, o.nhan);
    var vao = tao("input");
    vao.type = "range"; vao.min = String(o.min); vao.max = String(o.max); vao.step = String(o.buoc);
    vao.setAttribute("aria-label", o.ma);
    var ra = tao("output");
    hang.appendChild(ten); hang.appendChild(vao); hang.appendChild(ra);
    cha.appendChild(hang);
    var datGt = function (v, chu) {
      vao.value = String(v);
      ra.textContent = chu != null ? chu : L.so(v, 2) + (o.dv || "");
      vao.style.setProperty("--p", ((v - o.min) / (o.max - o.min) * 100) + "%");
    };
    vao.addEventListener("input", function () { o.doi(parseFloat(vao.value)); });
    chanVuot(hang);
    datGt(o.gt);
    return { dat: datGt, el: hang };
  };
  var dongTT = function (dl, nhan, chi) {
    var dt = tao("dt"); rich(dt, nhan);
    var dd = tao("dd");
    if (chi) { dt.setAttribute("data-chi", chi); dd.setAttribute("data-chi", chi); }
    dl.appendChild(dt); dl.appendChild(dd);
    var cu = null;
    return function (parts, khongNhay) {
      rich(dd, parts);
      var moi = dd.textContent;
      if (cu !== null && moi !== cu && !khongNhay && !itDong) nhayDoi(dd);
      cu = moi;
    };
  };
  var muiTen = function (cha, x1, y1, x2, y2, lop, co) {
    co = co || 14;
    var g = taoS("g", { class: lop || "" }, cha);
    taoS("line", { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2) }, g);
    var a = Math.atan2(y2 - y1, x2 - x1);
    var p1 = [x2 - co * Math.cos(a - 0.42), y2 - co * Math.sin(a - 0.42)], p2 = [x2 - co * Math.cos(a + 0.42), y2 - co * Math.sin(a + 0.42)];
    taoS("path", { d: "M" + r1(x2) + " " + r1(y2) + "L" + r1(p1[0]) + " " + r1(p1[1]) + "L" + r1(p2[0]) + " " + r1(p2[1]) + "Z" }, g);
    return g;
  };
  // Cung tròn tâm (cx,cy) bán kính r giữa hai góc (pixel, radian), đi theo chiều ngắn hơn; quat=true: hình quạt
  var cungTron = function (cx, cy, r, g1, g2, quat) {
    var d = g2 - g1;
    if (!isFinite(d)) d = 0;
    d = ((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    var x1 = cx + r * Math.cos(g1), y1 = cy + r * Math.sin(g1), x2 = cx + r * Math.cos(g1 + d), y2 = cy + r * Math.sin(g1 + d);
    var s = (quat ? "M" + r1(cx) + " " + r1(cy) + "L" : "M") + r1(x1) + " " + r1(y1) + "A" + r + " " + r + " 0 0 " + (d > 0 ? 1 : 0) + " " + r1(x2) + " " + r1(y2) + (quat ? "Z" : "");
    return { d: s, giua: g1 + d / 2 };
  };
  var duongTuDiem = function (ds, dong) {
    if (!ds.length) return "";
    var s = "M" + r1(ds[0][0]) + " " + r1(ds[0][1]);
    for (var i = 1; i < ds.length; i++) s += "L" + r1(ds[i][0]) + " " + r1(ds[i][1]);
    return s + (dong ? "Z" : "");
  };
  var giuNoiDungCu = function (el, cha) {
    var cu = Array.prototype.slice.call(el.childNodes).filter(function (n) { return n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()); });
    el.textContent = "";
    if (!cu.length) return;
    var ghi = tao("div", "tm-ghi");
    cu.forEach(function (n) { ghi.appendChild(n); });
    return function () { cha.appendChild(ghi); };
  };

  /* ═══════════════ .conic ═══════════════ */
  var dungConic = function (el) {
    var d = docJson(el);
    var loai = ["elip", "hypebol", "parabol"].indexOf(d.loai) >= 0 ? d.loai : "elip";
    var cheDo = ["dinh-day", "guong", "quy-dao", "kham-pha"].indexOf(d.cheDo) >= 0 ? d.cheDo : "kham-pha";
    if (cheDo === "quy-dao") loai = "elip";
    if (cheDo === "guong" && loai === "hypebol") cheDo = "kham-pha";
    var st = { a: soLieu(d.a, loai === "hypebol" ? 4 : 5), b: soLieu(d.b, 3), p: soLieu(d.p, 2) };
    var ts = L.thongSoConic(loai, st.a, st.b, st.p);
    var keoDs = Array.isArray(d.keo) ? d.keo.map(String) : cheDo === "kham-pha" ? (loai === "parabol" ? ["p"] : ["a", "b", "c"]) : (loai === "parabol" ? ["p"] : ["a", "b"]);
    var coKeo = function (k) { return keoDs.indexOf(k) >= 0 || (k === "c" && keoDs.indexOf("tieu-diem") >= 0); };
    var hien = Array.isArray(d.hien) ? d.hien.map(String) : ["tieu-diem", "truc", "tia", "tiem-can", "duong-chuan"];
    var coHien = function (k) { return hien.indexOf(k) >= 0; };
    var gh = {
      a: gioiHanTruot(d.gioiHan && d.gioiHan.a, [1, 8, 0.5]),
      b: gioiHanTruot(d.gioiHan && d.gioiHan.b, [0.5, 6, 0.5]),
      p: gioiHanTruot(d.gioiHan && d.gioiHan.p, [0.5, 4, 0.5])
    };
    var W = 900, H = 540;
    var id = maMoi("c");
    var themGhi = giuNoiDungCu(el, null);
    var hop = taoHop(el, "tm-hop-c");
    var the = tao("div", "tm-the tm-hinh" + (cheDo === "quy-dao" ? " tm-toi" : ""));
    var bang = tao("div", "tm-bang tm-bang-c");
    hop.appendChild(the); hop.appendChild(bang);
    var svg = taoS("svg", { class: "tm-svg" + (cheDo === "quy-dao" ? " tm-vu-tru" : ""), viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": (loai === "elip" ? "Elip" : loai === "hypebol" ? "Hypebol" : "Parabol") + " — " + cheDo });
    the.appendChild(svg);
    var defs = taoS("defs", null, svg);
    var cp = taoS("clipPath", { id: id + "k" }, defs);
    taoS("rect", { x: 0, y: 0, width: W, height: H }, cp);
    var gs = taoS("radialGradient", { id: id + "s" }, defs);
    taoS("stop", { offset: "0", "stop-color": "#fffbe6" }, gs);
    taoS("stop", { offset: ".35", "stop-color": "#ffd43b" }, gs);
    taoS("stop", { offset: ".7", "stop-color": "#ff922b", "stop-opacity": ".55" }, gs);
    taoS("stop", { offset: "1", "stop-color": "#ff922b", "stop-opacity": "0" }, gs);
    var gp = taoS("radialGradient", { id: id + "h", cx: ".35", cy: ".35" }, defs);
    taoS("stop", { offset: "0", "stop-color": "#d0ebff" }, gp);
    taoS("stop", { offset: ".55", "stop-color": "#339af0" }, gp);
    taoS("stop", { offset: "1", "stop-color": "#1c3d8f" }, gp);

    var gNen = taoS("g", null, svg);
    var gTinh = taoS("g", { "clip-path": "url(#" + id + "k)", "data-chi": "duong-cong" }, svg);
    var gDong = taoS("g", { "clip-path": "url(#" + id + "k)" }, svg);
    var gDiem = taoS("g", null, svg);

    /* Khung nhìn cố định theo giá trị lớn nhất của thanh trượt (để kéo không làm nhảy tỉ lệ) */
    var aM = Math.max(st.a, coKeo("a") ? gh.a[1] : 0), bM = Math.max(st.b, coKeo("b") ? gh.b[1] : 0), pM = Math.max(st.p, coKeo("p") ? gh.p[1] : 0);
    var hw, ox;
    if (loai === "elip") { hw = Math.max(aM * 1.14, bM * (cheDo === "quy-dao" ? 1.1 : 1.2) / 0.6, aM + 2.2); ox = W / 2; }
    else if (loai === "hypebol") { hw = Math.max(Math.sqrt(aM * aM + bM * bM) * 1.3, aM * 2.1); ox = W / 2; }
    else { hw = Math.max(pM * 2.4, 3.5); ox = W * (cheDo === "guong" ? 0.13 : 0.3); }
    var k = (W / 2) / hw, oy = H / 2;
    var X = function (x) { return ox + x * k; }, Y = function (y) { return oy - y * k; };
    var xMin = -ox / k, xMax = (W - ox) / k, yMax = oy / k;
    var P = function (q) { return [X(q[0]), Y(q[1])]; };

    /* Nền: lưới + trục, hoặc bầu trời sao */
    if (cheDo === "quy-dao") {
      var hat = 7;
      var ngauNhien = function () { hat = (hat * 16807) % 2147483647; return hat / 2147483647; };
      for (var i = 0; i < 90; i++) {
        var c = taoS("circle", { cx: r1(ngauNhien() * W), cy: r1(ngauNhien() * H), r: r1(0.6 + ngauNhien() * 1.6), class: "tm-sao-nen" + (i % 4 === 0 ? " tm-sao-nhay" : "") }, gNen);
        c.style.opacity = String(0.25 + ngauNhien() * 0.6);
        if (i % 4 === 0) c.style.animationDelay = (ngauNhien() * 3).toFixed(2) + "s";
      }
    } else {
      var u = L.buocDep(hw / 6);
      var gL = taoS("g", { class: "tm-luoi" }, gNen);
      var gT = taoS("g", { class: "tm-truc" }, gNen);
      var x0 = Math.ceil(xMin / u) * u, y0 = Math.ceil(-yMax / u) * u;
      for (var gx = x0, gi = 0; gx <= xMax + 1e-9 && gi < 300; gx += u, gi++) {
        taoS("line", { x1: r1(X(gx)), y1: 0, x2: r1(X(gx)), y2: H }, gL);
        if (Math.abs(gx) > 1e-9 && X(gx) > 24 && X(gx) < W - 30) chuS(gT, X(gx), Y(0) + 22, L.so(gx), "tm-so", { "text-anchor": "middle" });
      }
      for (var gy = y0, gj = 0; gy <= yMax + 1e-9 && gj < 300; gy += u, gj++) {
        taoS("line", { x1: 0, y1: r1(Y(gy)), x2: W, y2: r1(Y(gy)) }, gL);
        if (Math.abs(gy) > 1e-9 && Y(gy) > 24 && Y(gy) < H - 14) chuS(gT, X(0) - 9, Y(gy) + 5, L.so(gy), "tm-so", { "text-anchor": "end" });
      }
      muiTen(gT, 0, Y(0), W - 4, Y(0), "", 16);
      muiTen(gT, X(0), H, X(0), 4, "", 16);
      chuS(gT, W - 22, Y(0) - 12, "x", "tm-ten-truc");
      chuS(gT, X(0) + 12, 24, "y", "tm-ten-truc");
      chuS(gT, X(0) - 10, Y(0) + 24, "O", "tm-ten-truc", { "text-anchor": "end" });
    }

    /* Tham số đường cong theo s */
    var Uh = 1, Yp = 1;
    var tinhPhamVi = function () {
      if (loai === "hypebol") Uh = Math.min(acosh(Math.max(1.0001, xMax * 1.04 / st.a)), asinh(yMax * 1.04 / st.b));
      if (loai === "parabol") Yp = Math.min(yMax * 0.98, Math.sqrt(2 * st.p * xMax * 0.98));
    };
    var diemTren = function (s) {
      if (loai === "elip") return [st.a * Math.cos(s), st.b * Math.sin(s)];
      if (loai === "hypebol") {
        var nh = s < 1 ? 1 : -1, w = s < 1 ? s : s - 1, uu = (2 * w - 1) * Uh;
        return [nh * st.a * Math.cosh(uu), nh * st.b * Math.sinh(uu)];
      }
      var y = (2 * s - 1) * Yp;
      return [y * y / (2 * st.p), y];
    };
    var SMAX = loai === "elip" ? 2 * Math.PI : loai === "hypebol" ? 2 : 1;
    var duongCong = function (s0, s1, n) {
      var ds = [], i;
      if (loai === "hypebol" && s0 < 1 && s1 > 1) {
        return duongCong(s0, 0.999999, Math.ceil(n * (1 - s0) / (s1 - s0))) + duongCong(1, s1, Math.ceil(n * (s1 - 1) / (s1 - s0)));
      }
      n = Math.max(2, n);
      for (i = 0; i <= n; i++) ds.push(P(diemTren(s0 + (s1 - s0) * i / n)));
      return duongTuDiem(ds);
    };
    var ganNhat = function (x, y) {
      // tham số s của điểm trên đường cong gần (x, y) (toạ độ toán)
      if (loai === "elip") { var t = Math.atan2(y / st.b, x / st.a); return t < 0 ? t + 2 * Math.PI : t; }
      if (loai === "hypebol") {
        var uu = asinh((x >= 0 ? y : -y) / st.b), w = Math.max(0, Math.min(0.999, (uu / Uh + 1) / 2));
        return x >= 0 ? w : 1 + w;
      }
      return Math.max(0, Math.min(1, (y / Yp + 1) / 2));
    };

    /* ── Bảng bên phải ── */
    var ct = tao("div", "tm-ct"); ct.setAttribute("data-chi", "phuong-trinh");
    bang.appendChild(ct);
    var dl = tao("dl", "tm-tt"); bang.appendChild(dl);
    var hangTT = {};
    if (loai !== "parabol") {
      hangTT.ab = dongTT(dl, [{ i: "a" }, ", ", { i: "b" }]);
      hangTT.c = dongTT(dl, [{ i: "c" }], "c");
      hangTT.F = dongTT(dl, "Tiêu điểm", "tieu-diem");
      if (cheDo === "quy-dao") { hangTT.cv = dongTT(dl, "Cận / viễn điểm"); hangTT.r = dongTT(dl, [{ i: "r" }, " (tới sao)"]); }
      else if (loai === "hypebol") hangTT.tc = dongTT(dl, "Tiệm cận", "tiem-can");
      else hangTT.dinh = dongTT(dl, "Đỉnh trục lớn", "dinh");
    } else {
      hangTT.p = dongTT(dl, [{ i: "p" }]);
      hangTT.F = dongTT(dl, "Tiêu điểm", "tieu-diem");
      hangTT.dc = dongTT(dl, "Đường chuẩn", "duong-chuan");
    }
    // anTamSai: ẩn dòng tâm sai và thước tâm sai (tâm sai thuộc Chuyên đề 10.3, ngoài chương trình chính)
    var anTamSai = d.anTamSai === true;
    hangTT.e = anTamSai ? function () {} : dongTT(dl, ["Tâm sai ", { i: "e" }], "tam-sai");
    var noi = tao("div", "tm-noi"); noi.setAttribute("data-chi", "tinh-chat");
    var noiNhan = tao("small"), noiGt = tao("div", "tm-lon");
    noi.appendChild(noiNhan); noi.appendChild(noiGt);
    bang.appendChild(noi);
    var cacTruot = tao("div", "tm-cac-truot");
    var tr = {};
    var sauDoiThamSo = function () { capNhat(true); };
    var buocLam = function (v, b) { return Math.round(v / b) * b; };
    if (loai !== "parabol" && coKeo("a")) tr.a = truot(cacTruot, { ma: "a", nhan: { i: "a" }, min: gh.a[0], max: gh.a[1], buoc: gh.a[2], gt: st.a, doi: function (v) {
      if (loai === "elip" && v <= st.b + 1e-9) v = st.b + gh.a[2] > gh.a[1] ? st.a : buocLam(st.b, gh.a[2]) + gh.a[2];
      st.a = v; sauDoiThamSo();
    } });
    if (loai !== "parabol" && coKeo("b")) tr.b = truot(cacTruot, { ma: "b", nhan: { i: "b" }, min: gh.b[0], max: gh.b[1], buoc: gh.b[2], gt: st.b, doi: function (v) {
      if (loai === "elip" && v >= st.a - 1e-9) v = Math.max(gh.b[0], st.a - gh.b[2]);
      if (loai === "elip" && v >= st.a) return;
      st.b = v; sauDoiThamSo();
    } });
    if (loai === "parabol" && (coKeo("p") || coKeo("a"))) tr.p = truot(cacTruot, { ma: "p", nhan: { i: "p" }, min: gh.p[0], max: gh.p[1], buoc: gh.p[2], gt: st.p, doi: function (v) {
      st.p = v; sauDoiThamSo();
    } });
    if (cacTruot.children.length) bang.appendChild(cacTruot);
    var gauge = null;
    if (cheDo === "kham-pha" && !anTamSai) {
      gauge = tao("div", "tm-noi tm-noi-e");
      gauge.style.borderLeftColor = "var(--tm-tim)";
      var gn = tao("small", null, "Tâm sai e: elip 0 < e < 1 · parabol e = 1 · hypebol e > 1");
      gauge.appendChild(gn);
      var thanhE = taoS("svg", { viewBox: "0 0 400 34", width: "100%", height: "34", "aria-hidden": "true" });
      taoS("rect", { x: 10, y: 12, width: 190, height: 10, rx: 5, fill: "var(--mau)", opacity: ".55" }, thanhE);
      taoS("rect", { x: 200, y: 12, width: 190, height: 10, rx: 5, fill: "var(--tm-tim)", opacity: ".55" }, thanhE);
      taoS("line", { x1: 200, y1: 6, x2: 200, y2: 28, stroke: "var(--tm-cam)", "stroke-width": 4 }, thanhE);
      chuS(thanhE, 10, 33, "0", "tm-so"); chuS(thanhE, 195, 33, "1", "tm-so"); chuS(thanhE, 378, 33, "2", "tm-so");
      var kim = taoS("path", { d: "M0 0l-8 -10h16z", fill: "var(--chu)" }, thanhE);
      gauge.appendChild(thanhE);
      gauge._kim = kim;
      bang.appendChild(gauge);
    }
    var hangNut = tao("div", "tm-noi-hinh");
    the.appendChild(hangNut);
    if (themGhi) themGhi();
    var chuGoc = tao("div", "tm-chu-goc");
    the.appendChild(chuGoc);

    /* ── Trạng thái hoạt cảnh ── */
    var tg = { s: cheDo === "dinh-day" ? 0 : loai === "elip" ? 0.9 : loai === "hypebol" ? 0.72 : 0.78, xong: false, chieu: 1, chay: !itDong, keo: false,
      ys: 0, dao: false, u: 0, Mtb: 0.3, soSanh: false, loe: 0, th: 1.1 };
    tinhPhamVi();
    tg.ys = 0.58 * Yp;
    if (itDong && cheDo === "dinh-day") { tg.s = SMAX * 0.18; tg.xong = true; }
    var el2 = {};
    var lap;

    /* Vẽ phần phụ thuộc tham số */
    var veTinh = function () {
      gTinh.textContent = ""; gDong.textContent = ""; gDiem.textContent = "";
      el2 = {};
      ts = L.thongSoConic(loai, st.a, st.b, st.p);
      tinhPhamVi();
      if (cheDo === "quy-dao") {
        el2.quyDao = taoS("path", { d: duongCong(0, SMAX, 240) + "Z", class: "tm-quy-dao" }, gTinh);
        el2.quatCu = taoS("path", { class: "tm-quat tm-quat-cu" }, gDong);
        el2.quat = taoS("path", { class: "tm-quat" }, gDong);
        el2.quatSS = taoS("g", { class: tg.soSanh ? "" : "tm-an", "data-chi": "dien-tich" }, gDong);
        el2.vet = [];
        for (var i = 0; i < 14; i++) el2.vet.push(taoS("path", { class: "tm-vet-hanh-tinh", "stroke-width": r1(1 + i * 0.45), opacity: r1((i + 1) / 14 * 0.9 * 100) / 100 }, gDong));
        var F1 = P(ts.F1), F2 = P(ts.F2);
        var gF1 = taoS("g", null, gDiem);
        taoS("line", { x1: F1[0] - 7, y1: F1[1] - 7, x2: F1[0] + 7, y2: F1[1] + 7, class: "tm-tieu-trong" }, gF1);
        taoS("line", { x1: F1[0] - 7, y1: F1[1] + 7, x2: F1[0] + 7, y2: F1[1] - 7, class: "tm-tieu-trong" }, gF1);
        chuS(gDiem, F1[0], F1[1] + 30, "F₁", "tm-nhan tm-nhan-nho", { "text-anchor": "middle" });
        var gSao = taoS("g", { "data-chi": "sao" }, gDiem);
        taoS("circle", { cx: r1(F2[0]), cy: r1(F2[1]), r: 46, fill: "url(#" + id + "s)", class: itDong ? "" : "tm-nhip" }, gSao);
        taoS("circle", { cx: r1(F2[0]), cy: r1(F2[1]), r: 15, fill: "#fff3bf" }, gSao);
        chuS(gDiem, F2[0], F2[1] + 64, "Ngôi sao tại F₂", "tm-nhan tm-nhan-nho tm-nhan-vang", { "text-anchor": "middle" });
        var A2 = P([st.a, 0]), A1 = P([-st.a, 0]);
        taoS("circle", { cx: r1(A2[0]), cy: r1(A2[1]), r: 5, fill: "#ffd76b" }, gDiem);
        taoS("circle", { cx: r1(A1[0]), cy: r1(A1[1]), r: 5, fill: "#ffd76b" }, gDiem);
        chuS(gDiem, A2[0] + 10, A2[1] + 30, "cận điểm", "tm-nhan tm-nhan-nho", { "text-anchor": "start" });
        chuS(gDiem, A1[0] - 10, A1[1] + 30, "viễn điểm", "tm-nhan tm-nhan-nho", { "text-anchor": "end" });
        el2.hanhTinh = taoS("circle", { r: 14, fill: "url(#" + id + "h)", "data-chi": "hanh-tinh" }, gDiem);
        el2.banKinh = taoS("line", { stroke: "#ffe066", "stroke-width": 2, "stroke-dasharray": "5 6", opacity: ".8" }, gDong);
        veSoSanh();
        return;
      }
      // đường phụ: trục đối xứng đậm, tiệm cận, đường chuẩn
      if (coHien("truc") && loai !== "parabol") {
        taoS("line", { x1: X(-st.a), y1: Y(0), x2: X(st.a), y2: Y(0), class: "tm-truc-dam" }, gTinh);
        if (loai === "elip") taoS("line", { x1: X(0), y1: Y(-st.b), x2: X(0), y2: Y(st.b), class: "tm-truc-dam" }, gTinh);
      }
      if (loai === "hypebol" && (coHien("tiem-can") || coHien("truc"))) {
        var m = st.b / st.a, xx = Math.max(Math.abs(xMin), xMax) * 1.1;
        var gTc = taoS("g", { "data-chi": "tiem-can" }, gTinh);
        taoS("line", { x1: X(-xx), y1: Y(-m * xx), x2: X(xx), y2: Y(m * xx), class: "tm-phu" }, gTc);
        taoS("line", { x1: X(-xx), y1: Y(m * xx), x2: X(xx), y2: Y(-m * xx), class: "tm-phu" }, gTc);
        taoS("rect", { x: X(-st.a), y: Y(st.b), width: r1(2 * st.a * k), height: r1(2 * st.b * k), class: "tm-phu", opacity: ".4" }, gTc);
      }
      if (loai === "parabol" && (coHien("duong-chuan") || coHien("truc"))) {
        var gDc = taoS("g", { "data-chi": "duong-chuan" }, gTinh);
        taoS("line", { x1: X(ts.duongChuan), y1: 0, x2: X(ts.duongChuan), y2: H, class: "tm-phu", style: "stroke: var(--tm-tim); opacity: .9" }, gDc);
        var xDc = X(ts.duongChuan), trai = xDc > 170;
        chuS(gDc, trai ? xDc - 8 : xDc + 8, 62, "Δ: x = " + L.so(ts.duongChuan), "tm-nhan tm-nhan-nho tm-nhan-tim", { "text-anchor": trai ? "end" : "start" });
      }
      // đường cong
      var full = loai === "elip" ? duongCong(0, SMAX, 240) + "Z" : duongCong(0, SMAX, 260);
      if (cheDo === "dinh-day") {
        taoS("path", { d: full, class: "tm-cong-mo" }, gTinh);
        el2.vet = taoS("path", { class: "tm-vet" }, gTinh);
      } else if (cheDo === "guong") {
        veGuong(full);
      } else {
        taoS("path", { d: full, class: "tm-cong" }, gTinh);
      }
      // đỉnh
      if (coHien("truc")) {
        ts.dinh.forEach(function (q, j) {
          var pq = P(q);
          taoS("circle", { cx: r1(pq[0]), cy: r1(pq[1]), r: 7, class: "tm-dinh-c" }, gDiem);
          var ten = loai === "parabol" ? "O" : j < 2 ? (j === 0 ? "A₁" : "A₂") : (j === 2 ? "B₁" : "B₂");
          if (loai === "parabol") return;
          var dxl = j === 0 ? -14 : j === 1 ? 14 : 14, dyl = j < 2 ? -14 : j === 2 ? 26 : -12;
          chuS(gDiem, pq[0] + dxl, pq[1] + dyl, ten, "tm-nhan tm-nhan-nho tm-nhan-mau", { "text-anchor": j === 0 ? "end" : "start" });
        });
      }
      // phần động theo chế độ
      if (cheDo === "dinh-day" || cheDo === "kham-pha") {
        var gDay = taoS("g", { "data-chi": "day" }, gDong);
        el2.day1 = taoS("line", { class: "tm-day" }, gDay);
        el2.day2 = taoS("line", { class: "tm-day" + (loai === "parabol" ? " tm-day-2" : "") }, gDay);
        el2.vuong = loai === "parabol" ? taoS("path", { class: "tm-goc-vuong" }, gDay) : null;
        el2.nhan1 = chuS(gDong, 0, 0, "", "tm-nhan tm-nhan-nho tm-nhan-vang", { "text-anchor": "middle" });
        el2.nhan2 = chuS(gDong, 0, 0, "", "tm-nhan tm-nhan-nho " + (loai === "parabol" ? "tm-nhan-tim" : "tm-nhan-vang"), { "text-anchor": "middle" });
      }
      // tiêu điểm
      if (coHien("tieu-diem") || cheDo !== "kham-pha") {
        var dsF = loai === "parabol" ? [[ts.F, "F"]] : [[ts.F1, "F₁"], [ts.F2, "F₂"]];
        el2.F = [];
        dsF.forEach(function (f) {
          var pf = P(f[0]);
          var g = taoS("g", { "data-chi": "tieu-diem" }, gDiem);
          if (cheDo === "dinh-day") {
            taoS("ellipse", { cx: pf[0] + 5, cy: pf[1] + 4, rx: 11, ry: 5, class: "tm-ghim-bong" }, g);
            taoS("line", { x1: pf[0], y1: pf[1], x2: pf[0] - 4, y2: pf[1] - 14, stroke: "#868e96", "stroke-width": 3, "stroke-linecap": "round" }, g);
            taoS("circle", { cx: pf[0] - 5, cy: pf[1] - 18, r: 11, class: "tm-ghim-dau" }, g);
            taoS("circle", { cx: pf[0] - 8, cy: pf[1] - 21, r: 3.5, class: "tm-ghim-sang" }, g);
          } else {
            el2.F.push(taoS("circle", { cx: r1(pf[0]), cy: r1(pf[1]), r: 9, class: "tm-tieu" }, g));
          }
          chuS(g, pf[0] + (cheDo === "dinh-day" ? 10 : 0), pf[1] + 32, f[1], "tm-nhan tm-nhan-cam", { "text-anchor": "middle" });
        });
      }
      if (cheDo === "dinh-day" || cheDo === "kham-pha") {
        var gM = taoS("g", { class: "tm-tay", "data-chi": "diem-m" }, gDiem);
        el2.M = gM;
        if (cheDo === "dinh-day") {
          var but = taoS("g", null, gM);
          el2.but = but;
          taoS("polygon", { points: "0,0 -7,-17 7,-17", class: "tm-but-go" }, but);
          taoS("polygon", { points: "0,0 -2.6,-6.3 2.6,-6.3", class: "tm-but-chi" }, but);
          taoS("rect", { x: -7, y: -66, width: 14, height: 49, class: "tm-but-than" }, but);
          taoS("rect", { x: -7, y: -78, width: 14, height: 12, rx: 3, class: "tm-but-tay" }, but);
          taoS("circle", { r: 22, class: "tm-trong" }, gM);
        } else {
          taoS("circle", { r: 20, class: "tm-vong" }, gM);
          taoS("circle", { r: 8, class: "tm-diem-m" }, gM);
        }
        el2.tenM = chuS(gDiem, 0, 0, "M", "tm-nhan", { "text-anchor": "middle" });
        keoTha(gM, svg, W, H, {
          bd: function () { tg.keo = true; },
          dc: function (px, py) {
            var s = ganNhat((px - ox) / k, (oy - py) / k);
            if (cheDo === "dinh-day" && !tg.xong) {
              // khi đang vẽ: chỉ cho bút đi tới, không lùi qua điểm đầu
              tg.s = Math.max(tg.s, s);
            } else tg.s = s;
            veDong();
          },
          kt: function () { tg.keo = false; }
        });
      }
      if (cheDo === "kham-pha") veTayCam();
    };

    /* Gương: parabol (tia song song → F) hoặc elip (tia từ F₁ → F₂) */
    var veGuong = function (full) {
      if (loai === "parabol") {
        var g = taoS("g", { "data-chi": "guong" }, gTinh);
        var gGach = taoS("g", { class: "tm-guong-gach" }, g);
        var n = 26;
        for (var i = 0; i <= n; i++) {
          var y = (2 * i / n - 1) * Yp * 0.98, x = y * y / (2 * st.p);
          var nx = -st.p, ny = y, l = Math.sqrt(nx * nx + ny * ny);
          var q = P([x, y]);
          taoS("line", { x1: r1(q[0] + nx / l * 6), y1: r1(q[1] - ny / l * 6), x2: r1(q[0] + nx / l * 20 - ny / l * 8), y2: r1(q[1] - ny / l * 20 - nx / l * 8) }, gGach);
        }
        taoS("path", { d: full, class: "tm-guong" }, g);
        taoS("path", { d: full, class: "tm-guong-sang" }, g);
        el2.tia = [];
        var gTia = taoS("g", { "data-chi": "tia" }, gDong);
        [0.22, 0.45, 0.7, 0.9].forEach(function (f) { [-1, 1].forEach(function (sg) { el2.tia.push({ y: sg * f * Yp, p: taoS("path", { class: "tm-tia" }, gTia) }); }); });
      } else {
        taoS("path", { d: full, class: "tm-guong" }, gTinh);
        taoS("path", { d: full, class: "tm-guong-sang" }, gTinh);
        el2.tia = [];
        var gT2 = taoS("g", { "data-chi": "tia" }, gDong);
        for (var j = 0; j < 10; j++) el2.tia.push({ th: 0.31 + j * 2 * Math.PI / 10, p: taoS("path", { class: "tm-tia" }, gT2) });
      }
      el2.tiaChinh = taoS("path", { class: "tm-tia-chinh" }, gDong);
      el2.tiaSang = taoS("path", { class: "tm-tia-chinh-sang" }, gDong);
      el2.phap = taoS("line", { class: "tm-phap" }, gDong);
      el2.cung1 = taoS("path", { class: "tm-cung" }, gDong);
      el2.cung2 = taoS("path", { class: "tm-cung" }, gDong);
      el2.ni = chuS(gDong, 0, 0, "i", "tm-nhan tm-nhan-nho tm-nhan-tim", { "text-anchor": "middle", "font-style": "italic" });
      el2.nr = chuS(gDong, 0, 0, "i′", "tm-nhan tm-nhan-nho tm-nhan-tim", { "text-anchor": "middle", "font-style": "italic" });
      el2.photon = taoS("circle", { r: 7, class: "tm-photon" }, gDong);
      // tay cầm: đèn (parabol) / điểm M trên gương (elip)
      var tay = taoS("g", { class: "tm-tay", "data-chi": "den" }, gDiem);
      el2.tay = tay;
      if (loai === "parabol") {
        el2.den = taoS("g", null, tay);
        taoS("circle", { cx: 0, cy: 0, r: 30, class: "tm-hao-quang" }, el2.den);
        taoS("rect", { x: 4, y: -11, width: 36, height: 22, rx: 6, class: "tm-den-than" }, el2.den);
        taoS("path", { d: "M4 -15 L-10 -20 L-10 20 L4 15 Z", class: "tm-den-than" }, el2.den);
        taoS("rect", { x: -13, y: -17, width: 5, height: 34, rx: 2, class: "tm-den-mat" }, el2.den);
        taoS("circle", { r: 34, class: "tm-trong" }, tay);
        keoTha(tay, svg, W, H, {
          bd: function () { tg.keo = true; },
          dc: function (px, py) { tg.ys = Math.max(-0.95 * Yp, Math.min(0.95 * Yp, (oy - py) / k)); veDong(); },
          kt: function () { tg.keo = false; }
        });
      } else {
        taoS("circle", { r: 20, class: "tm-vong" }, tay);
        taoS("circle", { r: 8, class: "tm-diem-m" }, tay);
        keoTha(tay, svg, W, H, {
          bd: function () { tg.keo = true; },
          dc: function (px, py) { tg.th = ganNhat((px - ox) / k, (oy - py) / k); veDong(); },
          kt: function () { tg.keo = false; }
        });
      }
      el2.bongDen = taoS("g", { class: "tm-an" }, gDiem);
    };

    /* Tay cầm khám phá: kéo tiêu điểm / đỉnh */
    var veTayCam = function () {
      var them = function (q, ten, dc) {
        var pq = P(q);
        var g = taoS("g", { class: "tm-tay", transform: "translate(" + r1(pq[0]) + " " + r1(pq[1]) + ")", "data-chi": "keo-" + ten }, gDiem);
        taoS("circle", { r: 19, class: "tm-vong" }, g);
        taoS("circle", { r: 24, class: "tm-trong" }, g);
        keoTha(g, svg, W, H, {
          dc: function (px, py) { if (dc((px - ox) / k, (oy - py) / k)) { veTinh(); capNhatBang(); veDong(); } },
          kt: function () { dongBoTruot(); }
        });
      };
      if (loai === "parabol") {
        if (coKeo("p") || coKeo("c")) them(ts.F, "F", function (x) {
          var p = Math.max(gh.p[0], Math.min(gh.p[1], Math.round(2 * x * 10) / 10));
          if (p === st.p) return false;
          st.p = p; return true;
        });
        return;
      }
      if (coKeo("c")) them(ts.F2, "F2", function (x) {
        var c = Math.round(x * 10) / 10;
        if (loai === "elip") {
          c = Math.max(0.1, Math.min(st.a - 0.1, c));
          var b2 = Math.round((st.a * st.a - c * c) * 1e6) / 1e6;
          if (Math.abs(Math.sqrt(b2) - st.b) < 1e-9) return false;
          st.b = Math.sqrt(b2);
        } else {
          c = Math.max(st.a + 0.1, Math.min(xMax * 0.95, c));
          var b3 = Math.round((c * c - st.a * st.a) * 1e6) / 1e6;
          if (Math.abs(Math.sqrt(b3) - st.b) < 1e-9) return false;
          st.b = Math.sqrt(b3);
        }
        return true;
      });
      if (coKeo("a")) them([st.a, 0], "a", function (x) {
        var a = Math.max(gh.a[0], Math.min(gh.a[1], Math.round(x / gh.a[2]) * gh.a[2]));
        if (loai === "elip" && a <= st.b + 1e-9) return false;
        if (a === st.a) return false;
        st.a = a; return true;
      });
      if (coKeo("b")) them([0, st.b], "b", function (x, y) {
        var b = Math.max(gh.b[0], Math.min(gh.b[1], Math.round(y / gh.b[2]) * gh.b[2]));
        if (loai === "elip" && b >= st.a - 1e-9) return false;
        if (Math.abs(b - st.b) < 1e-9) return false;
        st.b = b; return true;
      });
    };
    var dongBoTruot = function () {
      if (tr.a) tr.a.dat(st.a);
      if (tr.b) tr.b.dat(Math.round(st.b / gh.b[2]) * gh.b[2], L.so(st.b, 2));
      if (tr.p) tr.p.dat(st.p);
    };

    /* So sánh hai diện tích quét bằng nhau (quỹ đạo) */
    var veSoSanh = function () {
      var g = el2.quatSS;
      g.textContent = "";
      var dM = Math.PI / 6;
      [[-dM / 2, dM / 2, "S₁"], [Math.PI - dM / 2, Math.PI + dM / 2, "S₂"]].forEach(function (z, j) {
        taoS("path", { d: duongQuat(z[0], z[1]), class: "tm-quat" + (j ? " tm-quat-2" : "") }, g);
        var mid = L.viTriQuyDao(st.a, st.b, (z[0] + z[1]) / 2), F2 = ts.F2;
        var q = P([F2[0] + (mid.x - F2[0]) * 0.62, mid.y * 0.62]);
        chuS(g, q[0], q[1] + 7, z[2], "tm-nhan tm-nhan-vang", { "text-anchor": "middle" });
      });
    };
    var duongQuat = function (M1, M2) {
      var E1 = L.giaiKepler(M1, ts.e), E2 = L.giaiKepler(M2, ts.e);
      if (E2 < E1) E2 += 2 * Math.PI;
      var ds = [P(ts.F2)], n = Math.max(4, Math.ceil((E2 - E1) / 0.05));
      for (var i = 0; i <= n; i++) { var E = E1 + (E2 - E1) * i / n; ds.push(P([st.a * Math.cos(E), st.b * Math.sin(E)])); }
      return duongTuDiem(ds, true);
    };

    /* Cập nhật bảng thông tin (chữ Unicode) */
    var capNhatBang = function () {
      if (loai === "elip" || loai === "hypebol") {
        var a2 = Math.round(st.a * st.a * 1e6) / 1e6, b2 = Math.round(st.b * st.b * 1e6) / 1e6;
        rich(ct, [{ ps: [[{ i: "x" }, "²"], L.so(a2)] }, loai === "elip" ? " + " : " − ", { ps: [[{ i: "y" }, "²"], L.so(b2)] }, " = 1"]);
        hangTT.ab([{ i: "a" }, " = " + L.so(st.a) + ", ", { i: "b" }, " = " + (Math.abs(st.b * 100 - Math.round(st.b * 100)) < 1e-6 ? L.so(st.b) : "√" + L.so(b2) + " ≈ " + L.so(st.b))]);
        var c2 = loai === "elip" ? a2 - b2 : a2 + b2;
        var can = L.chuCan(c2);
        hangTT.c([{ i: "c" }, " = √(" + L.so(a2) + (loai === "elip" ? " − " : " + ") + L.so(b2) + ") = " + can.chu]);
        var cTxt = can.chinhXac ? can.chu : L.so(ts.c);
        hangTT.F(["F₁(−" + cTxt + "; 0), F₂(" + cTxt + "; 0)"]);
        if (hangTT.dinh) hangTT.dinh(["A₁(−" + L.so(st.a) + "; 0), A₂(" + L.so(st.a) + "; 0)"]);
        if (hangTT.tc) {
          var hs = Math.abs(st.b * 100 - Math.round(st.b * 100)) < 1e-6 ? (function () { var r = L.chia(L.tuSo(st.b), L.tuSo(st.a)); return r.q === 1 ? String(r.p) : r.p + "/" + r.q; })() : L.so(st.b / st.a);
          hangTT.tc([{ i: "y" }, " = ± " + hs + " ", { i: "x" }]);
        }
        if (hangTT.cv) hangTT.cv([{ i: "a" }, " − ", { i: "c" }, " = " + L.so(st.a - ts.c) + " ; ", { i: "a" }, " + ", { i: "c" }, " = " + L.so(st.a + ts.c)]);
        var eTxt = can.chinhXac ? (function () { var r = L.chia(L.tuSo(Math.round(can.giaTri * 100) / 100), L.tuSo(st.a)); return r.q === 1 ? String(r.p) : L.so(r.p / r.q, 4) === L.so(r.p / r.q, 2) ? L.so(r.p / r.q) : r.p + "/" + r.q + " ≈ " + L.so(r.p / r.q); })() : "≈ " + L.so(ts.e);
        hangTT.e([{ i: "e" }, " = ", { ps: [{ i: "c" }, { i: "a" }] }, " = " + (can.chinhXac ? "" : "") + eTxt]);
        noiNhan.textContent = loai === "elip" ? "Với mọi điểm M trên elip" : "Với mọi điểm M trên hypebol";
        if (cheDo === "quy-dao") noiNhan.textContent = "Định luật Kepler II (minh hoạ): cùng thời gian quét cùng diện tích";
      } else {
        var hai = Math.round(2 * st.p * 1e6) / 1e6;
        rich(ct, [{ i: "y" }, "² = " + (hai === 1 ? "" : L.so(hai)), { i: "x" }]);
        hangTT.p([{ i: "p" }, " = " + L.so(st.p) + "  (2", { i: "p" }, " = " + L.so(hai) + ")"]);
        hangTT.F(["F(", { ps: [{ i: "p" }, "2"] }, "; 0) = (" + L.so(st.p / 2) + "; 0)"]);
        hangTT.dc(["Δ: ", { i: "x" }, " = −", { ps: [{ i: "p" }, "2"] }, " = " + L.so(-st.p / 2)]);
        hangTT.e([{ i: "e" }, " = 1"]);
        noiNhan.textContent = cheDo === "guong" ? "Tia song song với trục Ox phản xạ trên gương" : "Với mọi điểm M trên parabol";
      }
      if (cheDo === "guong") noiNhan.textContent = loai === "parabol" ? (tg.dao ? "Đèn pha: nguồn sáng đặt tại tiêu điểm F" : "Tia song song với trục, phản xạ trên gương parabol") : "Phòng thì thầm: tia từ F₁ phản xạ trên vòm elip";
      if (gauge) gauge._kim.setAttribute("transform", "translate(" + r1(10 + Math.min(2, ts.e) * 190) + " 10)");
      chuGoc.textContent = cheDo === "quy-dao" ? "Minh hoạ — không theo tỉ lệ thật" : cheDo === "dinh-day" ? (loai === "elip" ? "Hai đinh ở F₁, F₂ · sợi dây dài 2a" : "Điểm M chạy trên đường cong") : cheDo === "guong" ? "Kéo " + (loai === "parabol" ? "đèn để dời tia sáng" : "điểm M trên vòm") : "Kéo tiêu điểm, đỉnh hoặc điểm M";
    };

    var lanCapNhatChu = 0;
    /* Vẽ phần chạy theo thời gian */
    var veDong = function (tMs) {
      if (cheDo === "quy-dao") return veQuyDao(tMs);
      if (cheDo === "guong") return veTia(tMs);
      var s = tg.s, M = diemTren(Math.min(s, SMAX * 0.99999)), pM = P(M);
      if (cheDo === "dinh-day" && el2.vet) {
        el2.vet.setAttribute("d", tg.xong ? (loai === "elip" ? duongCong(0, SMAX, 240) + "Z" : duongCong(0, SMAX, 260)) : duongCong(0, Math.max(1e-4, s), Math.max(2, Math.ceil(s / SMAX * 240))));
      }
      if (el2.M) el2.M.setAttribute("transform", "translate(" + r1(pM[0]) + " " + r1(pM[1]) + ")");
      if (el2.but) el2.but.setAttribute("transform", "rotate(" + (M[0] >= 0 ? 24 : -24) + ")");
      var huongNhan = [M[0] >= 0 ? 22 : -22, M[1] >= 0 ? -20 : 34];
      if (el2.tenM) dat(el2.tenM, { x: r1(pM[0] + huongNhan[0] * (cheDo === "dinh-day" ? 1.6 : 1)), y: r1(pM[1] + huongNhan[1]) });
      var d1, d2, A, B;
      if (loai === "parabol") {
        A = P(ts.F); B = P([ts.duongChuan, M[1]]);
        d1 = L.kc(M, ts.F); d2 = M[0] - ts.duongChuan;
        if (el2.vuong) { var sx = 12, sy = M[1] >= 0 ? 12 : -12; el2.vuong.setAttribute("d", "M" + r1(B[0] + sx) + " " + r1(B[1]) + "L" + r1(B[0] + sx) + " " + r1(B[1] + sy) + "L" + r1(B[0]) + " " + r1(B[1] + sy)); }
      } else {
        A = P(ts.F1); B = P(ts.F2);
        d1 = L.kc(M, ts.F1); d2 = L.kc(M, ts.F2);
      }
      if (el2.day1) {
        dat(el2.day1, { x1: r1(A[0]), y1: r1(A[1]), x2: r1(pM[0]), y2: r1(pM[1]) });
        dat(el2.day2, { x1: r1(B[0]), y1: r1(B[1]), x2: r1(pM[0]), y2: r1(pM[1]) });
        var datNhan = function (t, Q, R, v) {
          var mx = (Q[0] + R[0]) / 2, my = (Q[1] + R[1]) / 2, dx = R[0] - Q[0], dy = R[1] - Q[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / l, ny = dx / l;
          if (nx * (mx - X(0)) + ny * (my - Y(0)) < 0) { nx = -nx; ny = -ny; }
          dat(t, { x: r1(mx + nx * 20), y: r1(my + ny * 20 + 7) });
          t.textContent = L.so(v);
        };
        datNhan(el2.nhan1, A, pM, d1); datNhan(el2.nhan2, B, pM, d2);
      }
      var bayGio = tMs || 0;
      if (tMs && bayGio - lanCapNhatChu < 90) return;
      lanCapNhatChu = bayGio;
      if (loai === "elip") rich(noiGt, ["MF₁ + MF₂ = " + L.so(d1) + " + " + L.so(d2) + " = " + L.so(d1 + d2), { nd: "= 2a", lop: "tm-chip" }]);
      else if (loai === "hypebol") rich(noiGt, ["|MF₁ − MF₂| = |" + L.so(d1) + " − " + L.so(d2) + "| = " + L.so(Math.abs(d1 - d2)), { nd: "= 2a", lop: "tm-chip" }]);
      else rich(noiGt, ["MF = " + L.so(d1) + " ; d(M, Δ) = " + L.so(d2), { nd: "bằng nhau", lop: "tm-chip" }]);
    };

    var veTia = function (tMs) {
      var tgTia = (tMs || 0) / 1000;
      var M, F, S, r, dsPath = [];
      if (loai === "parabol") {
        F = P(ts.F);
        el2.tia.forEach(function (t) {
          var q = L.phanXaParabol(st.p, t.y), pM = P(q.M), pS = [W + 10, Y(t.y)];
          t.p.setAttribute("d", tg.dao ? duongTuDiem([F, pM, pS]) : duongTuDiem([pS, pM, F]));
        });
        var qc = L.phanXaParabol(st.p, tg.ys);
        M = P(qc.M); S = [W - 66, Y(tg.ys)];
        dsPath = tg.dao ? [F, M, [W + 10, S[1]]] : [S, M, F];
        el2.tay.setAttribute("transform", "translate(" + r1(S[0]) + " " + r1(S[1]) + ")");
        el2.den.setAttribute("class", tg.dao ? "tm-an" : "");
        r = [st.p, -tg.ys];
      } else {
        var F1 = P(ts.F1); F = P(ts.F2);
        el2.tia.forEach(function (t) {
          var q = L.giaoTiaElip(st.a, st.b, ts.F1[0], 0, Math.cos(t.th), Math.sin(t.th));
          t.p.setAttribute("d", duongTuDiem([F1, P(q), F]));
        });
        var Mt = diemTren(tg.th);
        M = P(Mt); S = F1;
        dsPath = [F1, M, F];
        el2.tay.setAttribute("transform", "translate(" + r1(M[0]) + " " + r1(M[1]) + ")");
        r = [-Mt[0] / (st.a * st.a), -Mt[1] / (st.b * st.b)];
      }
      var dPath = duongTuDiem(dsPath);
      el2.tiaChinh.setAttribute("d", dPath); el2.tiaSang.setAttribute("d", dPath);
      // pháp tuyến hướng vào trong (toạ độ toán → pixel: đảo dấu y)
      var nl = Math.sqrt(r[0] * r[0] + r[1] * r[1]), nx = r[0] / nl, ny = -r[1] / nl;
      dat(el2.phap, { x1: r1(M[0] - nx * 18), y1: r1(M[1] - ny * 18), x2: r1(M[0] + nx * 92), y2: r1(M[1] + ny * 92) });
      var gN = Math.atan2(ny, nx);
      var gToi = Math.atan2(dsPath[0][1] - M[1], dsPath[0][0] - M[0]), gDi = Math.atan2(dsPath[2][1] - M[1], dsPath[2][0] - M[0]);
      var c1 = cungTron(M[0], M[1], 40, gToi, gN), c2 = cungTron(M[0], M[1], 52, gN, gDi);
      el2.cung1.setAttribute("d", c1.d); el2.cung2.setAttribute("d", c2.d);
      dat(el2.ni, { x: r1(M[0] + 62 * Math.cos(c1.giua)), y: r1(M[1] + 62 * Math.sin(c1.giua) + 6) });
      dat(el2.nr, { x: r1(M[0] + 74 * Math.cos(c2.giua)), y: r1(M[1] + 74 * Math.sin(c2.giua) + 6) });
      // photon chạy dọc tia chính
      var l1 = L.kc(dsPath[0], dsPath[1]), l2 = L.kc(dsPath[1], dsPath[2]), tong = l1 + l2;
      var chuKy = tong / 430 + 0.5;
      var f = itDong ? 0.999 : (tgTia % chuKy) / (chuKy - 0.5);
      var vt;
      if (f >= 1) vt = dsPath[2];
      else if (f * tong <= l1) { var a1 = f * tong / l1; vt = [dsPath[0][0] + (dsPath[1][0] - dsPath[0][0]) * a1, dsPath[0][1] + (dsPath[1][1] - dsPath[0][1]) * a1]; }
      else { var a2 = (f * tong - l1) / l2; vt = [dsPath[1][0] + (dsPath[2][0] - dsPath[1][0]) * a2, dsPath[1][1] + (dsPath[2][1] - dsPath[1][1]) * a2]; }
      dat(el2.photon, { cx: r1(vt[0]), cy: r1(vt[1]), opacity: f >= 1 ? 0 : 1 });
      var toiDich = f >= 1 && tg.loe === 0;
      if (f < 1) tg.loe = 0;
      if (toiDich && !(loai === "parabol" && tg.dao)) {
        tg.loe = 1;
        var dich = loai === "parabol" ? el2.F[0] : el2.F[1];
        if (dich && !itDong) { dich.classList.remove("tm-loe"); void dich.getBBox; dich.classList.add("tm-loe"); setTimeout(function () { dich.classList.remove("tm-loe"); }, 750); }
      }
      if (tMs && tMs - lanCapNhatChu < 120) return;
      lanCapNhatChu = tMs || 0;
      var gocI = Math.acos(Math.max(-1, Math.min(1, Math.cos(gToi - gN)))) / Math.PI * 180;
      if (loai === "parabol") rich(noiGt, [tg.dao ? "ló ra song song với trục Ox" : "đều đi qua tiêu điểm F(" + L.so(st.p / 2) + "; 0)", { nd: "i = i′ ≈ " + L.so(gocI, 1) + "°", lop: "tm-chip" }]);
      else rich(noiGt, ["đều dội về tiêu điểm F₂", { nd: "i = i′ ≈ " + L.so(gocI, 1) + "°", lop: "tm-chip" }]);
    };

    var veQuyDao = function (tMs) {
      var Mtb = tg.Mtb, vt = L.viTriQuyDao(st.a, st.b, Mtb), pv = P([vt.x, vt.y]);
      dat(el2.hanhTinh, { cx: r1(pv[0]), cy: r1(pv[1]) });
      var F2 = P(ts.F2);
      dat(el2.banKinh, { x1: r1(F2[0]), y1: r1(F2[1]), x2: r1(pv[0]), y2: r1(pv[1]) });
      // vệt mờ dần phía sau hành tinh
      var dai = 0.9, n = el2.vet.length;
      for (var i = 0; i < n; i++) {
        var ma = Mtb - dai * (n - i) / n, mb = Mtb - dai * (n - i - 1) / n;
        var pa = L.viTriQuyDao(st.a, st.b, ma), pb = L.viTriQuyDao(st.a, st.b, mb);
        var qa = P([pa.x, pa.y]), qb = P([pb.x, pb.y]);
        el2.vet[i].setAttribute("d", "M" + r1(qa[0]) + " " + r1(qa[1]) + "L" + r1(qb[0]) + " " + r1(qb[1]));
      }
      // quạt diện tích của khoảng thời gian hiện tại và khoảng trước
      var buoc = Math.PI / 6, j = Math.floor(Mtb / buoc);
      el2.quat.setAttribute("d", Mtb - j * buoc > 0.004 ? duongQuat(j * buoc, Mtb) : "");
      el2.quat.setAttribute("class", "tm-quat" + (j % 2 ? " tm-quat-2" : ""));
      el2.quatCu.setAttribute("d", duongQuat((j - 1) * buoc, j * buoc));
      el2.quatCu.setAttribute("class", "tm-quat tm-quat-cu" + ((j - 1) % 2 ? " tm-quat-2" : ""));
      el2.quatCu.style.opacity = String(Math.max(0, 1 - (Mtb - j * buoc) / buoc * 1.4));
      if (tMs && tMs - lanCapNhatChu < 100) return;
      lanCapNhatChu = tMs || 0;
      var v = Math.sqrt(2 / vt.r - 1 / st.a), vMin = Math.sqrt(2 / (st.a + ts.c) - 1 / st.a), vMax = Math.sqrt(2 / (st.a - ts.c) - 1 / st.a);
      if (hangTT.r) hangTT.r([{ i: "r" }, " = " + L.so(vt.r)], true);
      var phan = vMax - vMin > 1e-9 ? (v - vMin) / (vMax - vMin) : 0.5;
      var thanh = "▰▰▰▰▰▰▰▰▰▰".slice(0, 1 + Math.round(phan * 9)) + "▱▱▱▱▱▱▱▱▱▱".slice(0, 9 - Math.round(phan * 9));
      rich(noiGt, [tg.soSanh ? "S₁ = S₂ = πab/12 ≈ " + L.so(Math.PI * st.a * st.b / 12) : "Tốc độ " + thanh, { nd: tg.soSanh ? "cùng thời gian" : phan > 0.66 ? "nhanh — gần sao" : phan < 0.34 ? "chậm — xa sao" : "vừa", lop: "tm-chip" }]);
    };

    /* Nút điều khiển */
    var nutChay = null;
    var datNutChay = function () {
      if (!nutChay) return;
      nutChay.textContent = "";
      nutChay.appendChild(icon(tg.chay ? "dung" : "chay"));
      nutChay.appendChild(document.createTextNode(tg.chay ? "Dừng" : "Chạy"));
    };
    nutChay = nut(hangNut, "", null, "", function () {
      tg.chay = !tg.chay; datNutChay();
      if (tg.chay) lap.chay(); else lap.dung();
    });
    datNutChay();
    if (cheDo === "dinh-day") nut(hangNut, "Vẽ lại", "lai", "tm-chinh", function () {
      tg.s = 0; tg.xong = false; tg.chieu = 1; tg.chay = true; datNutChay(); veDong(); lap.chay();
    });
    if (cheDo === "guong" && loai === "parabol") {
      var nDao = nut(hangNut, "Đèn pha", "dao", "", function () {
        tg.dao = !tg.dao; nDao.setAttribute("aria-pressed", tg.dao ? "true" : "false"); capNhatBang(); veDong();
      });
      nDao.setAttribute("aria-pressed", "false");
    }
    if (cheDo === "quy-dao") {
      var nSS = nut(hangNut, "So sánh diện tích", "dien", "", function () {
        tg.soSanh = !tg.soSanh; nSS.setAttribute("aria-pressed", tg.soSanh ? "true" : "false");
        el2.quatSS.setAttribute("class", tg.soSanh ? "" : "tm-an");
        lanCapNhatChu = 0; veDong();
      });
      nSS.setAttribute("aria-pressed", "false");
    }

    var capNhat = function () {
      if (cheDo === "dinh-day") { tg.s = 0; tg.xong = itDong; if (itDong) tg.s = SMAX * 0.18; }
      veTinh(); capNhatBang(); lanCapNhatChu = 0; veDong();
      if (tg.chay && !itDong) lap.chay();
    };
    var tgTong = 0;
    lap = vongLap(function (dt, t) {
      if (!tg.chay) return false;
      tgTong += dt;
      if (!tg.keo) {
        if (cheDo === "dinh-day") {
          var tocDo = SMAX / (loai === "elip" ? 7 : loai === "hypebol" ? 8 : 5);
          if (!tg.xong) { tg.s += dt * tocDo; if (tg.s >= SMAX) { tg.s = loai === "elip" ? 0 : SMAX * 0.999; tg.xong = true; tg.chieu = -1; } }
          else if (loai === "elip") { tg.s = (tg.s + dt * tocDo * 0.5) % SMAX; }
          else { tg.s += tg.chieu * dt * tocDo * 0.4; if (tg.s > SMAX * 0.999) { tg.s = SMAX * 0.999; tg.chieu = -1; } if (tg.s < 0.001) { tg.s = 0.001; tg.chieu = 1; } }
        } else if (cheDo === "kham-pha") {
          if (loai === "elip") tg.s = (tg.s + dt * 2 * Math.PI / 16) % SMAX;
          else {
            var lo = loai === "hypebol" ? 0.1 : 0.08, hi = loai === "hypebol" ? 0.9 : 0.92;
            tg.s += tg.chieu * dt * 0.07;
            if (tg.s > hi) { tg.s = hi; tg.chieu = -1; } if (tg.s < lo) { tg.s = lo; tg.chieu = 1; }
          }
        } else if (cheDo === "quy-dao") {
          tg.Mtb += dt * 2 * Math.PI / 9;
          if (tg.Mtb > 24 * Math.PI) tg.Mtb -= 24 * Math.PI;
        } else if (cheDo === "guong" && loai === "elip") {
          tg.th = (tg.th + dt * 0.12) % SMAX;
        }
      }
      veDong(cheDo === "guong" ? tgTong * 1000 : t);
    });
    // khởi tạo
    veTinh(); capNhatBang(); veDong();
    if (cheDo !== "dinh-day" && cheDo !== "quy-dao") { /* bảng đã đúng */ }
    if (itDong) { tg.chay = false; datNutChay(); }
    theoSlide(el, function () {
      if (cheDo === "dinh-day" && !itDong) { tg.s = 0; tg.xong = false; tg.chieu = 1; veDong(); }
      if (tg.chay) lap.chay();
    }, function () { lap.dung(); });
  };
  var acosh = function (x) { return Math.log(x + Math.sqrt(x * x - 1)); };
  var asinh = function (x) { return Math.log(x + Math.sqrt(x * x + 1)); };

  /* ═══════════════ .mien-nghiem ═══════════════ */
  var MAU_RANG = ["#e8590c", "#7048e8", "#0ca678", "#d6336c", "#1c7ed6", "#f59f00", "#5c940d"];
  var dungMienNghiem = function (el) {
    var d = docJson(el);
    var rang = L.chuanRang(d.rang);
    var muc = d.muc && typeof d.muc === "object" && d.hienMuc !== false ? { p: L.tuSo(d.muc.p == null ? 0 : d.muc.p), q: L.tuSo(d.muc.q == null ? 0 : d.muc.q), loai: d.muc.loai === "min" ? "min" : "max" } : null;
    var bien = Array.isArray(d.bien) && d.bien.length === 2 ? [String(d.bien[0]).slice(0, 3), String(d.bien[1]).slice(0, 3)] : ["x", "y"];
    var nhanTruc = d.nhan && typeof d.nhan === "object" ? d.nhan : {};
    var buocHien = d.buocHien !== false;
    var kiem = el.getAttribute("data-kiem") || "";
    // anKetQua: đường mức vẫn kéo được nhưng không tự trượt, không ghi giá trị tối ưu (để học sinh tự tìm).
    // Có data-kiem (em phải bấm chọn đỉnh) thì cũng giấu cho tới khi em trả lời.
    var anKetQua = d.anKetQua === true || Boolean(kiem && d.muc);
    var kq = L.toiUu(rang, muc);
    var dsDinh = kq.dinh;
    // vùng nhìn
    var vx = d.vung && Array.isArray(d.vung.x) ? [soLieu(d.vung.x[0], 0), soLieu(d.vung.x[1], 10)] : null;
    var vy = d.vung && Array.isArray(d.vung.y) ? [soLieu(d.vung.y[0], 0), soLieu(d.vung.y[1], 10)] : null;
    if (!vx || !vy) {
      var mx = 1, my = 1, nx = 0, ny = 0;
      dsDinh.forEach(function (v) { mx = Math.max(mx, L.gt(v.x)); my = Math.max(my, L.gt(v.y)); nx = Math.min(nx, L.gt(v.x)); ny = Math.min(ny, L.gt(v.y)); });
      vx = vx || [nx < 0 ? nx * 1.25 : 0, mx * 1.25];
      vy = vy || [ny < 0 ? ny * 1.25 : 0, my * 1.25];
    }
    if (!(vx[0] < vx[1]) || !(vy[0] < vy[1])) throw new Error("vung không hợp lệ");
    var W = 900, H = 540, TL = 78, TR = 868, TT = 50, TB = 470;
    var X = function (x) { return TL + (x - vx[0]) / (vx[1] - vx[0]) * (TR - TL); };
    var Y = function (y) { return TB - (y - vy[0]) / (vy[1] - vy[0]) * (TB - TT); };
    var id = maMoi("m");
    var themGhi = giuNoiDungCu(el, null);
    var hop = taoHop(el, "tm-hop-mn");
    var the = tao("div", "tm-the tm-hinh"), bang = tao("div", "tm-bang tm-bang-mn");
    hop.appendChild(the); hop.appendChild(bang);
    var svg = taoS("svg", { class: "tm-svg", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Miền nghiệm của hệ bất phương trình" });
    the.appendChild(svg);
    var defs = taoS("defs", null, svg);
    var cp = taoS("clipPath", { id: id + "k" }, defs);
    taoS("rect", { x: TL, y: TT, width: TR - TL, height: TB - TT }, cp);
    rang.forEach(function (r, i) {
      var pt = taoS("pattern", { id: id + "g" + i, width: 14, height: 14, patternUnits: "userSpaceOnUse", patternTransform: "rotate(" + (35 + i * 50) + ")" }, defs);
      taoS("line", { x1: 0, y1: 0, x2: 0, y2: 14, stroke: MAU_RANG[i % MAU_RANG.length], "stroke-width": 3, opacity: ".55" }, pt);
    });
    // lưới + trục
    var gNen = taoS("g", null, svg);
    var gL = taoS("g", { class: "tm-luoi" }, gNen), gT = taoS("g", { class: "tm-truc" }, gNen);
    var ux = L.buocDep((vx[1] - vx[0]) / 9), uy = L.buocDep((vy[1] - vy[0]) / 7);
    var gx, gy, gi;
    for (gx = Math.ceil(vx[0] / ux) * ux, gi = 0; gx <= vx[1] + 1e-9 && gi < 300; gx += ux, gi++) {
      taoS("line", { x1: r1(X(gx)), y1: TT, x2: r1(X(gx)), y2: TB }, gL);
      chuS(gT, X(gx), TB + 24, L.so(gx), "tm-so", { "text-anchor": "middle" });
    }
    for (gy = Math.ceil(vy[0] / uy) * uy, gi = 0; gy <= vy[1] + 1e-9 && gi < 300; gy += uy, gi++) {
      taoS("line", { x1: TL, y1: r1(Y(gy)), x2: TR, y2: r1(Y(gy)) }, gL);
      chuS(gT, TL - 10, Y(gy) + 5, L.so(gy), "tm-so", { "text-anchor": "end" });
    }
    var xTrucY = vx[0] <= 0 && vx[1] >= 0 ? X(0) : TL, yTrucX = vy[0] <= 0 && vy[1] >= 0 ? Y(0) : TB;
    muiTen(gT, TL, yTrucX, TR + 22, yTrucX, "", 15);
    muiTen(gT, xTrucY, TB, xTrucY, TT - 30, "", 15);
    chuS(gT, TR + 14, yTrucX - 12, bien[0], "tm-ten-truc", { "text-anchor": "end" });
    chuS(gT, xTrucY + 14, TT - 18, bien[1], "tm-ten-truc");
    if (nhanTruc.x) chuS(gT, TR, TB + 54, String(nhanTruc.x).slice(0, 40) + " (" + bien[0] + ")", "tm-so", { "text-anchor": "end", style: "font-size:18px" });
    if (nhanTruc.y) chuS(gT, xTrucY + 40, TT - 20, String(nhanTruc.y).slice(0, 40) + " (" + bien[1] + ")", "tm-so", { "text-anchor": "start", style: "font-size:18px" });

    // hình học thực (số thực) cho phần vẽ
    var hcn = [[vx[0], vy[0]], [vx[1], vy[0]], [vx[1], vy[1]], [vx[0], vy[1]]];
    var cat = function (da, a, b, c, giuNho) {
      // giữ phần a·x + b·y − c ≤ 0 (giuNho) hoặc ≥ 0
      var ra = [];
      var f = function (q) { var v = a * q[0] + b * q[1] - c; return giuNho ? v : -v; };
      for (var i = 0; i < da.length; i++) {
        var P1 = da[i], P2 = da[(i + 1) % da.length], f1 = f(P1), f2 = f(P2);
        if (f1 <= 1e-12) ra.push(P1);
        if ((f1 < -1e-12 && f2 > 1e-12) || (f1 > 1e-12 && f2 < -1e-12)) { var t = f1 / (f1 - f2); ra.push([P1[0] + (P2[0] - P1[0]) * t, P1[1] + (P2[1] - P1[1]) * t]); }
      }
      return ra;
    };
    var giuNho = function (r) { return r.dau === "<=" || r.dau === "<" || r.dau === "="; };
    var px = function (ds) { return duongTuDiem(ds.map(function (q) { return [X(q[0]), Y(q[1])]; }), true); };
    var doanDuong = function (a, b, c) {
      // đoạn của đường a x + b y = c bên trong hình chữ nhật vùng
      var ds = [];
      if (Math.abs(b) > 1e-12) { [vx[0], vx[1]].forEach(function (x) { var y = (c - a * x) / b; if (y >= vy[0] - 1e-9 && y <= vy[1] + 1e-9) ds.push([x, y]); }); }
      if (Math.abs(a) > 1e-12) { [vy[0], vy[1]].forEach(function (y) { var x = (c - b * y) / a; if (x >= vx[0] - 1e-9 && x <= vx[1] + 1e-9) ds.push([x, y]); }); }
      var kq2 = [];
      ds.forEach(function (q) { if (!kq2.some(function (z) { return Math.abs(z[0] - q[0]) < 1e-9 && Math.abs(z[1] - q[1]) < 1e-9; })) kq2.push(q); });
      if (kq2.length < 2) return null;
      kq2.sort(function (u, v) { return u[0] - v[0] || u[1] - v[1]; });
      return [kq2[0], kq2[kq2.length - 1]];
    };
    var gLoai = taoS("g", { "clip-path": "url(#" + id + "k)" }, svg);
    var gMien = taoS("g", { "clip-path": "url(#" + id + "k)" }, svg);
    var gBien = taoS("g", { "clip-path": "url(#" + id + "k)" }, svg);
    var gMuc = taoS("g", { class: "tm-duong-muc", "data-chi": "duong-muc" }, svg);
    var gDinh = taoS("g", { "data-chi": "dinh" }, svg);
    var gNhanBien = taoS("g", null, svg);
    var vungLoai = [], duongBien = [], nhanBien = [];
    var vatCan = dsDinh.map(function (v) { return [X(L.gt(v.x)), Y(L.gt(v.y))]; });
    rang.forEach(function (r, i) {
      var a = L.gt(r.a), b = L.gt(r.b), c = L.gt(r.c), mau = MAU_RANG[i % MAU_RANG.length];
      var loaiBo = r.dau === "=" ? null : cat(hcn, a, b, c, !giuNho(r));
      var g = taoS("g", { class: "tm-loai-vung", "data-chi": "rang-" + (i + 1) }, gLoai);
      if (loaiBo && loaiBo.length > 2) {
        taoS("path", { d: px(loaiBo), fill: mau, "fill-opacity": ".09" }, g);
        taoS("path", { d: px(loaiBo), fill: "url(#" + id + "g" + i + ")" }, g);
      }
      vungLoai.push(g);
      var dd = doanDuong(a, b, c);
      var ln = taoS("path", { class: "tm-bien-dt", stroke: mau, d: dd ? duongTuDiem([[X(dd[0][0]), Y(dd[0][1])], [X(dd[1][0]), Y(dd[1][1])]]) : "", pathLength: "1" }, gBien);
      if (r.dau === "<" || r.dau === ">") ln.setAttribute("stroke-dasharray", ".025 .018");
      duongBien.push(ln);
      var nb = null;
      if (dd) {
        // nhãn d_i đặt dọc đường biên, lệch sang phía bị loại (nếu phía đó còn trong khung), tránh trùng các nhãn trước
        var P1 = [X(dd[0][0]), Y(dd[0][1])], P2 = [X(dd[1][0]), Y(dd[1][1])];
        var vx2 = P2[0] - P1[0], vy2 = P2[1] - P1[1], dl2 = Math.sqrt(vx2 * vx2 + vy2 * vy2) || 1;
        var nx2 = -vy2 / dl2, ny2 = vx2 / dl2;
        // pháp tuyến pixel hướng về phía KHÔNG thoả (phía bị gạch)
        var thu = function (sx, sy) { var xx = vx[0] + (sx - TL) / (TR - TL) * (vx[1] - vx[0]), yy = vy[0] + (TB - sy) / (TB - TT) * (vy[1] - vy[0]); return a * xx + b * yy - c; };
        var mx2 = (P1[0] + P2[0]) / 2, my2 = (P1[1] + P2[1]) / 2;
        var phiaLoai = thu(mx2 + nx2 * 5, my2 + ny2 * 5);
        if (giuNho(r) ? phiaLoai < 0 : phiaLoai > 0) { nx2 = -nx2; ny2 = -ny2; }
        var tx = 0, ty = 0, ok = false;
        [0.8, 0.6, 0.4, 0.9, 0.25].some(function (f) {
          [1, -1].some(function (sg) {
            tx = P1[0] + vx2 * f + sg * nx2 * 24; ty = P1[1] + vy2 * f + sg * ny2 * 24 + 7;
            ok = tx > TL + 16 && tx < TR - 16 && ty > TT + 18 && ty < TB - 8 &&
              nhanBien.every(function (o) { return !o || Math.abs(o._x - tx) > 34 || Math.abs(o._y - ty) > 26; }) &&
              vatCan.every(function (q) { return Math.abs(q[0] - tx) > 80 || Math.abs(q[1] - ty) > 34; });
            return ok;
          });
          return ok;
        });
        nb = chuS(gNhanBien, tx, ty, "d" + "₁₂₃₄₅₆₇₈₉"[i % 9], "tm-nhan", { "text-anchor": "middle", style: "fill:" + mau, opacity: "0" });
        nb._x = tx; nb._y = ty;
      }
      nhanBien.push(nb);
    });
    // miền nghiệm (bao đóng, cắt theo vùng nhìn)
    var mienDa = hcn;
    rang.forEach(function (r) { if (r.dau !== "=") mienDa = cat(mienDa, L.gt(r.a), L.gt(r.b), L.gt(r.c), giuNho(r)); });
    var mien = taoS("path", { class: "tm-mien", d: mienDa.length > 2 ? px(mienDa) : "", "data-chi": "mien" }, gMien);
    // đỉnh
    var tenDinh = [];
    var chu = "ABCDEGHKMNPQ", ki = 0;
    dsDinh.forEach(function (v) {
      if (!v.x.p && !v.y.p) tenDinh.push("O"); else tenDinh.push(chu.charAt(ki++ % chu.length));
    });
    var cx0 = 0, cy0 = 0;
    dsDinh.forEach(function (v) { cx0 += X(L.gt(v.x)); cy0 += Y(L.gt(v.y)); });
    if (dsDinh.length) { cx0 /= dsDinh.length; cy0 /= dsDinh.length; }
    var nutDinh = dsDinh.map(function (v, i) {
      var x = X(L.gt(v.x)), y = Y(L.gt(v.y));
      var g = taoS("g", { class: "tm-dinh-mn", "data-chi": "dinh-" + tenDinh[i] }, gDinh);
      taoS("circle", { cx: r1(x), cy: r1(y), r: 11, class: "tm-vong-tot" }, g);
      taoS("circle", { cx: r1(x), cy: r1(y), r: 9, class: "tm-dc" }, g);
      taoS("circle", { cx: r1(x), cy: r1(y), r: 22, fill: "transparent" }, g);
      var hx = x - cx0, hy = y - cy0, hl = Math.sqrt(hx * hx + hy * hy) || 1;
      var chuD = tenDinh[i] + L.chuDiem(v.x, v.y), rongD = chuD.length * 10.5;
      var lx = x + hx / hl * 18, ly = y + hy / hl * 24 + 7, neo = hx < -4 ? "end" : hx > 4 ? "start" : "middle";
      if (neo === "end" && lx - rongD < TL - 70) { neo = "start"; lx = x + 14; }
      if (neo === "start" && lx + rongD > TR + 26) { neo = "end"; lx = x - 14; }
      if (ly > TB - 8) ly = y - 16;
      if (ly < TT + 14) ly = y + 30;
      chuS(g, lx, ly, chuD, "tm-nhan tm-nhan-nho", { "text-anchor": neo });
      return g;
    });

    // ── Bảng bên phải ──
    bang.appendChild(tao("p", "tm-tieu-de", "Hệ bất phương trình"));
    var ol = tao("ol", "tm-ds-rang");
    bang.appendChild(ol);
    var dsLi = rang.map(function (r, i) {
      var li = tao("li", buocHien ? "hien" : "");
      li.style.setProperty("--tm-m", MAU_RANG[i % MAU_RANG.length]);
      li.setAttribute("data-chi", "rang-" + (i + 1));
      li.appendChild(tao("span", "tm-so-thu", "d" + "₁₂₃₄₅₆₇₈₉"[i % 9]));
      li.appendChild(tao("span", "", L.chuRang(r, bien[0], bien[1])));
      ol.appendChild(li);
      return li;
    });
    var liMuc = null;
    if (muc) {
      liMuc = tao("li", "tm-li-muc" + (buocHien ? " hien" : ""));
      liMuc.setAttribute("data-chi", "muc");
      liMuc.appendChild(tao("span", "tm-so-thu", "F"));
      liMuc.appendChild(tao("span", "", "F = " + L.bieuThuc(muc.p, muc.q, bien[0], bien[1]) + " → " + (muc.loai === "max" ? "lớn nhất" : "nhỏ nhất")));
      ol.appendChild(liMuc);
    }
    var hoi = tao("div", "tm-hoi-chon tm-an");
    bang.appendChild(hoi);
    var bangF = tao("div", "tm-bang-f tm-an"); bangF.setAttribute("data-chi", "bang");
    bang.appendChild(bangF);
    var ketQua = tao("div", "tm-ket-qua tm-an"); ketQua.setAttribute("data-chi", "ket-qua");
    bang.appendChild(ketQua);
    var oTruot = tao("div", "tm-cac-truot tm-an");
    bang.appendChild(oTruot);
    if (themGhi) themGhi();
    var hangNut = tao("div", "tm-noi-hinh tm-goc-tren");
    the.appendChild(hangNut);

    // khoảng giá trị F trên vùng nhìn (cho thanh trượt đường mức)
    var Fv = function (x, y) { return muc ? L.gt(muc.p) * x + L.gt(muc.q) * y : 0; };
    var Fmin = Infinity, Fmax = -Infinity;
    hcn.forEach(function (q) { var v = Fv(q[0], q[1]); Fmin = Math.min(Fmin, v); Fmax = Math.max(Fmax, v); });
    var kMuc = muc ? (muc.loai === "max" ? Math.max(Fmin, Math.min.apply(null, dsDinh.map(function (v) { return L.gt(v.F); }).concat([Fv(0, 0)]))) : Fmax) : 0;
    var lmL = taoS("line", { class: "tm-dm" }, gMuc);
    var lmMui = taoS("g", null, gMuc);
    var lmChu = chuS(gMuc, 0, 0, "", "tm-nhan tm-nhan-cam");
    var veDuongMuc = function (kk) {
      if (!muc) return;
      var dd = doanDuong(L.gt(muc.p), L.gt(muc.q), kk);
      if (!dd) { lmL.setAttribute("opacity", "0"); lmChu.textContent = ""; lmMui.textContent = ""; return; }
      lmL.setAttribute("opacity", "1");
      var A = [X(dd[0][0]), Y(dd[0][1])], B = [X(dd[1][0]), Y(dd[1][1])];
      dat(lmL, { x1: r1(A[0]), y1: r1(A[1]), x2: r1(B[0]), y2: r1(B[1]) });
      // mũi tên hướng F tăng (pháp tuyến trong hệ pixel)
      var gxp = L.gt(muc.p) / ((vx[1] - vx[0]) / (TR - TL)), gyp = -L.gt(muc.q) / ((vy[1] - vy[0]) / (TB - TT));
      var gl = Math.sqrt(gxp * gxp + gyp * gyp) || 1, hx = gxp / gl, hy = gyp / gl;
      var mx = A[0] + (B[0] - A[0]) * 0.55, my = A[1] + (B[1] - A[1]) * 0.55;
      lmMui.textContent = "";
      muiTen(lmMui, mx, my, mx + hx * 52, my + hy * 52, "", 13).querySelector("line").setAttribute("class", "tm-mui");
      var cx = A[0] + (B[0] - A[0]) * 0.86, cy = A[1] + (B[1] - A[1]) * 0.86;
      dat(lmChu, { x: r1(Math.min(TR - 120, Math.max(TL + 6, cx - 40))), y: r1(Math.min(TB - 10, Math.max(TT + 22, cy - 16))) });
      lmChu.textContent = "F = " + L.so(kk);
      // đỉnh đã được đường mức quét qua
      dsDinh.forEach(function (v, i) {
        var qua = muc.loai === "max" ? L.gt(v.F) <= kk + 1e-9 : L.gt(v.F) >= kk - 1e-9;
        nutDinh[i].classList.toggle("tm-qua", qua && trangThai.dinhHien);
      });
    };
    var trTruot = null;
    if (muc) {
      var buocK = L.buocDep((Fmax - Fmin) / 200);
      trTruot = truot(oTruot, { ma: "F", nhan: { i: "F" }, min: Math.floor(Fmin / buocK) * buocK, max: Math.ceil(Fmax / buocK) * buocK, buoc: buocK, gt: kMuc, doi: function (v) {
        lapMuc.dung(); kMuc = v; veDuongMuc(v); trTruot.dat(v);
        datTot(!kq.khongCo && Math.abs(v - L.gt(kq.giaTri)) < buocK / 2 + 1e-9);
      } });
    }
    var datTot = function (bat) {
      kq.tot.forEach(function (i) { nutDinh[i].classList.toggle("tm-tot", bat); });
    };
    // bảng giá trị F tại các đỉnh
    var dungBangF = function () {
      bangF.textContent = "";
      var dau = ["Đỉnh", "(" + bien[0] + "; " + bien[1] + ")", muc ? "F" : ""];
      if (!muc) { bangF.classList.add("tm-hai-hang"); dau.pop(); }
      dau.forEach(function (t) { bangF.appendChild(tao("span", "tm-dau", t)); });
      dsDinh.forEach(function (v, i) {
        var tot = muc && kq.tot.indexOf(i) >= 0 && !kq.khongCo;
        var o = [tenDinh[i], L.chuDiem(v.x, v.y) + (v.thuoc ? "" : " ∉"), muc ? (anKetQua && !trangThai.daTraLoi ? "?" : L.chuPS(v.F)) : null];
        if (anKetQua && !trangThai.daTraLoi) tot = false;
        o.forEach(function (t) {
          if (t == null) return;
          var s = tao("span", "tm-hang-moi" + (tot ? " tm-hang-tot" : ""), t);
          s.style.setProperty("--tre", (i * 90) + "ms");
          bangF.appendChild(s);
        });
      });
      if (muc) {
        ketQua.classList.toggle("tm-trung", kq.khongCo || kq.khongDat);
        if (kq.khongCo) ketQua.textContent = "F không có giá trị " + (muc.loai === "max" ? "lớn nhất" : "nhỏ nhất") + " trên miền này (miền không bị chặn theo hướng đó).";
        else {
          var noiDat = kq.tot.map(function (i) { return tenDinh[i] + L.chuDiem(dsDinh[i].x, dsDinh[i].y); }).join(" và ");
          ketQua.textContent = (muc.loai === "max" ? "F lớn nhất = " : "F nhỏ nhất = ") + L.chuPS(kq.giaTri) + (kq.tot.length > 1 ? ", đạt tại mọi điểm trên đoạn " : ", đạt tại ") + noiDat +
            (kq.khongDat ? " (biên chặt: giá trị không đạt được)" : "");
        }
      } else {
        ketQua.classList.add("tm-trung");
        ketQua.textContent = dsDinh.length ? "Miền nghiệm là đa giác có " + dsDinh.length + " đỉnh" + (kq.biChan ? "." : " (miền không bị chặn).") : "Miền nghiệm không có đỉnh.";
      }
    };

    // ── Trạng thái theo bước hiện dần ──
    var trangThai = { soRang: -1, muc: false, dinhHien: false, daTraLoi: false, daQuet: false };
    var lapMuc = vongLap(function () { return false; });
    var quetMuc = function () {
      if (!muc || kq.khongCo) { veDuongMuc(kMuc); return; }
      var dich = L.gt(kq.giaTri);
      var batDau = muc.loai === "max" ? Math.max(Fmin, Math.min(dich, Math.min.apply(null, dsDinh.map(function (v) { return L.gt(v.F); }).concat([Fv(0, 0)])))) : Math.min(Fmax, Math.max.apply(null, dsDinh.map(function (v) { return L.gt(v.F); })));
      if (itDong) { kMuc = dich; veDuongMuc(dich); datTot(true); if (trTruot) trTruot.dat(dich); return; }
      var t = 0, T = 2.6;
      datTot(false);
      lapMuc.dung();
      lapMuc = vongLap(function (dt) {
        t += dt;
        var f = Math.min(1, t / T), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        kMuc = batDau + (dich - batDau) * e;
        veDuongMuc(kMuc);
        if (trTruot) trTruot.dat(Math.round(kMuc / trTruot._b) * trTruot._b, L.so(kMuc));
        if (f >= 1) { datTot(true); if (trTruot) trTruot.dat(dich, L.so(dich)); return false; }
      });
      lapMuc.chay();
    };
    if (trTruot) trTruot._b = L.buocDep((Fmax - Fmin) / 200);
    var capNhat = function (hoatCanh) {
      var so = 0;
      if (!buocHien) so = rang.length;
      else dsLi.forEach(function (li) { if (li.classList.contains("da-hien")) so++; });
      var coMuc = muc && (!buocHien || (liMuc && liMuc.classList.contains("da-hien")));
      var cu = trangThai.soRang;
      vungLoai.forEach(function (g, i) { g.classList.toggle("tm-co", i < so); });
      duongBien.forEach(function (l, i) {
        var bat = i < so;
        l.classList.toggle("tm-co", bat);
        if (bat && hoatCanh && i >= cu && cu >= 0 && !itDong && !(rang[i].dau === "<" || rang[i].dau === ">")) { l.classList.remove("tm-ve"); void l.getBBox; l.classList.add("tm-ve"); }
        if (!bat) l.classList.remove("tm-ve");
        if (nhanBien[i]) nhanBien[i].setAttribute("opacity", bat ? "1" : "0");
      });
      var du = so >= rang.length;
      mien.classList.toggle("tm-co", du);
      if (du && cu >= 0 && cu < rang.length && hoatCanh && !itDong) { mien.classList.remove("tm-nhay-mien"); void mien.getBBox; mien.classList.add("tm-nhay-mien"); }
      trangThai.dinhHien = du;
      nutDinh.forEach(function (g) { g.classList.toggle("tm-co", du); });
      var choChon = du && kiem && muc && !kq.khongCo && !trangThai.daTraLoi;
      nutDinh.forEach(function (g) { g.classList.toggle("tm-chon-duoc", Boolean(du && kiem && muc)); });
      hoi.classList.toggle("tm-an", !choChon && !trangThai.daTraLoi);
      if (choChon) hoi.textContent = "Em bấm vào đỉnh làm F " + (muc.loai === "max" ? "lớn nhất" : "nhỏ nhất") + ".";
      var hienBang = du && (!muc || coMuc || trangThai.daTraLoi);
      if (hienBang && bangF.classList.contains("tm-an")) dungBangF();
      bangF.classList.toggle("tm-an", !hienBang);
      ketQua.classList.toggle("tm-an", !(du && (!muc ? true : coMuc)) || (anKetQua && !trangThai.daTraLoi));
      oTruot.classList.toggle("tm-an", !coMuc);
      gMuc.classList.toggle("tm-co", Boolean(coMuc));
      if (coMuc && !trangThai.muc && anKetQua) { veDuongMuc(kMuc); if (trTruot) trTruot.dat(kMuc, L.so(kMuc)); }
      else if (coMuc && !trangThai.muc) { if (hoatCanh) quetMuc(); else { kMuc = kq.khongCo ? kMuc : L.gt(kq.giaTri); veDuongMuc(kMuc); datTot(!kq.khongCo); if (trTruot) trTruot.dat(kMuc, L.so(kMuc)); } }
      if (!coMuc) { lapMuc.dung(); datTot(false); nutDinh.forEach(function (g) { g.classList.remove("tm-qua"); }); }
      trangThai.muc = Boolean(coMuc);
      trangThai.soRang = so;
    };
    dsLi.concat(liMuc ? [liMuc] : []).forEach(function (li) { theoLop(li, function () { capNhat(true); }); });
    // em chọn đỉnh tối ưu (khi có data-kiem)
    nutDinh.forEach(function (g, i) {
      g.addEventListener("click", function (e) {
        if (!(trangThai.dinhHien && kiem && muc) || trangThai.daTraLoi || kq.khongCo) return;
        e.stopPropagation();
        trangThai.daTraLoi = true;
        var dung = kq.tot.indexOf(i) >= 0;
        var gtChon = L.chuDiem(dsDinh[i].x, dsDinh[i].y, true);
        hoi.textContent = "";
        hoi.appendChild(tao("span", dung ? "tm-phan-hoi-dung" : "tm-phan-hoi-sai", dung ? "Đúng rồi! " : "Chưa đúng. "));
        hoi.appendChild(document.createTextNode(dung ? "Tại " + tenDinh[i] + " giá trị F lớn nhất trong các đỉnh." .replace("lớn nhất", muc.loai === "max" ? "lớn nhất" : "nhỏ nhất") : "Tại " + tenDinh[i] + ", F = " + L.chuPS(dsDinh[i].F) + ". So sánh F ở mọi đỉnh trong bảng nhé."));
        if (!dung) g.classList.add("tm-sai-chon");
        bao(el, "QUIZ_TRA_LOI", kiem, dung ? "DUNG" : "SAI", { kiem: kiem, gt: gtChon });
        phatDiem(dung);
        if (dung) phaoHoa(40);
        capNhat(false);
        if (anKetQua) dungBangF();
        if (muc) { gMuc.classList.add("tm-co"); oTruot.classList.remove("tm-an"); quetMuc(); }
      });
    });
    var nutQuet = null;
    if (muc) nutQuet = nut(hangNut, "Trượt đường mức", "muc", "tm-chinh", function () {
      if (!trangThai.dinhHien) return;
      gMuc.classList.add("tm-co"); oTruot.classList.remove("tm-an");
      quetMuc();
    });
    var capNhatNut = function () { if (nutQuet) nutQuet.disabled = !trangThai.dinhHien; };
    theoLop(mien, capNhatNut);
    capNhat(false);
    capNhatNut();
    theoSlide(el, function () {
      capNhat(false);
      if (muc && !buocHien && !anKetQua && trangThai.dinhHien && !trangThai.daTraLoi) quetMuc();
    }, function () { lapMuc.dung(); });
  };

  /* ═══════════════ .tam-giac-do ═══════════════ */
  var dungTamGiacDo = function (el) {
    var d = docJson(el);
    var bai = d.bai === "qua-song" ? "qua-song" : "chieu-cao";
    var goc = Array.isArray(d.goc) ? d.goc : bai === "qua-song" ? [60, 70] : [35, 50];
    var st = { AB: soLieu(d.AB, 20), al: soLieu(goc[0], 35), be: soLieu(goc[1], 50) };
    var kq = L.tamGiacDo(bai, st.AB, st.al, st.be);
    var keoDs = Array.isArray(d.keo) ? d.keo.map(String) : ["A", "B", "goc"];
    var coKeo = function (k) { return keoDs.indexOf(k) >= 0; };
    var dv = typeof d.donVi === "string" ? d.donVi.slice(0, 6) : "m";
    var buocHien = d.buocHien === true;
    var W = 900, H = 440;
    var id = maMoi("t");
    var themGhi = giuNoiDungCu(el, null);
    var hop = taoHop(el, "tm-hop-tg");
    var the = tao("div", "tm-the tm-hinh"), bang = tao("div", "tm-bang tm-bang-tg");
    hop.appendChild(the); hop.appendChild(bang);
    var svg = taoS("svg", { class: "tm-svg tm-tran", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": bai === "chieu-cao" ? "Đo chiều cao tháp từ hai điểm A, B" : "Đo bề rộng sông từ hai điểm A, B" });
    the.appendChild(svg);
    var defs = taoS("defs", null, svg);
    var lg = taoS("linearGradient", { id: id + "t", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    taoS("stop", { offset: "0", class: "tm-troi-1" }, lg); taoS("stop", { offset: "1", class: "tm-troi-2" }, lg);
    var ln = taoS("linearGradient", { id: id + "n", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    taoS("stop", { offset: "0", class: "tm-nuoc-1" }, ln); taoS("stop", { offset: "1", class: "tm-nuoc-2" }, ln);
    var gCanh = taoS("g", null, svg), gHinh = taoS("g", { "data-chi": "tam-giac" }, svg), gTay = taoS("g", null, svg);
    // thế giới: chiều cao/vị trí tháp hoặc cây giữ cố định khi kéo A, B
    var the1 = {};
    var k = 10, ox = 0, oy = 0;
    var X = function (x) { return ox + x * k; }, Y = function (y) { return oy - y * k; };
    var tinhTheGioi = function () {
      kq = L.tamGiacDo(bai, st.AB, st.al, st.be);
      if (bai === "chieu-cao") {
        // H ở gốc, B và A bên trái
        the1 = { h: kq.h, xB: -kq.BH, xA: -kq.BH - st.AB };
      } else {
        var Cx = kq.AC * Math.cos(st.al * Math.PI / 180);
        the1 = { h: kq.h, xA: 0, xB: st.AB, xC: Cx };
      }
    };
    var datTiLe = function () {
      if (bai === "chieu-cao") {
        var rong = -the1.xA + 6;
        oy = H - 74;
        k = Math.min(700 / rong, (oy - 64) / the1.h);
        ox = W - 150;
        if (ox + the1.xA * k < 60) ox = 60 - the1.xA * k;
      } else {
        var lo = Math.min(0, the1.xC) - 2, hi = Math.max(st.AB, the1.xC) + 2;
        oy = H - 78;
        k = Math.min(760 / (hi - lo), (oy - 120) / the1.h);
        ox = (W - (hi - lo) * k) / 2 - lo * k;
      }
    };
    tinhTheGioi(); datTiLe();
    var veCanh = function () {
      gCanh.textContent = "";
      taoS("rect", { x: -900, y: -600, width: W + 1800, height: H + 1200, fill: "url(#" + id + "t)" }, gCanh);
      var may = function (x, y, s) {
        var g = taoS("g", { class: "tm-may", transform: "translate(" + x + " " + y + ") scale(" + s + ")" }, gCanh);
        taoS("ellipse", { cx: 0, cy: 0, rx: 40, ry: 16 }, g); taoS("ellipse", { cx: 26, cy: -10, rx: 26, ry: 18 }, g); taoS("ellipse", { cx: -22, cy: -6, rx: 20, ry: 14 }, g);
      };
      if (bai === "chieu-cao") {
        may(150, 70, 1); may(470, 50, 0.8);
        taoS("rect", { x: -900, y: oy, width: W + 1800, height: H - oy + 600, class: "tm-dat" }, gCanh);
        taoS("rect", { x: -900, y: oy, width: W + 1800, height: 8, class: "tm-dat-2" }, gCanh);
        for (var i = 0; i < 16; i++) { var tx = 30 + i * 57; taoS("path", { d: "M" + tx + " " + (oy + 30) + "l6 -12l5 12l5 -9l4 9", fill: "none", stroke: "var(--tm-la)", "stroke-width": 2.5, opacity: ".6" }, gCanh); }
      } else {
        var yGan = Y(0), yXa = Y(the1.h);
        taoS("rect", { x: -900, y: -600, width: W + 1800, height: yXa + 600, class: "tm-dat" }, gCanh);
        taoS("rect", { x: -900, y: yXa, width: W + 1800, height: yGan - yXa, fill: "url(#" + id + "n)" }, gCanh);
        var gs = taoS("g", { class: itDong ? "" : "tm-song-chay" }, gCanh);
        for (var r = 0; r < 4; r++) {
          var yy = yXa + (yGan - yXa) * (r + 0.6) / 4.4, dd = "M-620 " + r1(yy);
          for (var x = -620; x < W + 740; x += 60) dd += "q15 -7 30 0t30 0";
          taoS("path", { d: dd, class: "tm-song" }, gs);
        }
        taoS("rect", { x: -900, y: yGan, width: W + 1800, height: H - yGan + 600, class: "tm-cat" }, gCanh);
        // cây ở bờ xa (cây C vẽ riêng)
        [0.08, 0.22, 0.78, 0.93].forEach(function (f, j) {
          var cxx = f * W, cyy = yXa - 4;
          taoS("rect", { x: cxx - 4, y: cyy - 26, width: 8, height: 26, class: "tm-cay-than" }, gCanh);
          taoS("circle", { cx: cxx, cy: cyy - 40, r: 20 + (j % 2) * 5, class: "tm-cay-la", opacity: ".75" }, gCanh);
        });
      }
    };
    var thap = function (g, x, yDay, yDinh) {
      var w0 = 26, w1 = 15, hgt = yDay - yDinh;
      taoS("polygon", { points: [x - w0, yDay, x - w1, yDinh, x + w1, yDinh, x + w0, yDay].join(" "), class: "tm-thap-1" }, g);
      for (var i = 1; i <= 3; i++) {
        var y1 = yDay - hgt * (i * 0.25 - 0.08), y2 = yDay - hgt * (i * 0.25 + 0.04);
        var wa = w0 + (w1 - w0) * (yDay - y1) / hgt, wb = w0 + (w1 - w0) * (yDay - y2) / hgt;
        taoS("polygon", { points: [x - wa, y1, x - wb, y2, x + wb, y2, x + wa, y1].join(" "), class: "tm-thap-2" }, g);
      }
      taoS("rect", { x: x - w1 - 6, y: yDinh - 2, width: 2 * w1 + 12, height: 6, rx: 2, class: "tm-thap-1" }, g);
      taoS("line", { x1: x, y1: yDinh - 2, x2: x, y2: yDinh - 34, stroke: "var(--chu-phu)", "stroke-width": 2.5 }, g);
      taoS("path", { d: "M" + x + " " + (yDinh - 34) + "l22 7l-22 7z", class: "tm-co-hieu" }, g);
    };
    var nguoi = function (g, x, y, huong) {
      var n = taoS("g", { transform: "translate(" + r1(x) + " " + r1(y) + ")" + (huong < 0 ? " scale(-1 1)" : "") }, g);
      taoS("circle", { cx: -22, cy: -52, r: 7, class: "tm-nguoi-dau" }, n);
      taoS("path", { d: "M-22 -45 L-22 -20 M-22 -20 L-28 0 M-22 -20 L-16 0 M-22 -38 L-10 -44 M-22 -38 L-30 -28", class: "tm-nguoi" }, n);
      return n;
    };
    var cocTieu = function (g, x, y) {
      taoS("line", { x1: x, y1: y, x2: x, y2: y - 40, class: "tm-coc" }, g);
      taoS("path", { d: "M" + x + " " + (y - 40) + "l18 6l-18 6z", class: "tm-co-hieu" }, g);
    };
    var cungGoc = function (g, P0, P1, P2, r, lop, chu, rChu) {
      var g1 = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]), g2 = Math.atan2(P2[1] - P0[1], P2[0] - P0[0]);
      var c = cungTron(P0[0], P0[1], r, g1, g2, true);
      taoS("path", { d: c.d, class: lop }, g);
      var rc = rChu || r + 24;
      chuS(g, P0[0] + rc * Math.cos(c.giua), P0[1] + rc * Math.sin(c.giua) + 7, chu, "tm-nhan tm-nhan-nho", { "text-anchor": "middle" });
    };
    var kichThuoc = function (g, A, B, lech, chu) {
      var dx = B[0] - A[0], dy = B[1] - A[1], l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l * lech, ny = dx / l * lech;
      var a = [A[0] + nx, A[1] + ny], b = [B[0] + nx, B[1] + ny];
      var gg = taoS("g", { class: "tm-kich-thuoc" }, g);
      var m1 = muiTen(gg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[0], a[1], "", 11), m2 = muiTen(gg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, b[0], b[1], "", 11);
      [m1, m2].forEach(function (m) { m.querySelector("path").setAttribute("fill", "var(--chu-phu)"); });
      chuS(g, (a[0] + b[0]) / 2 + nx * 0.9, (a[1] + b[1]) / 2 + ny * 0.9 + 6, chu, "tm-kich-thuoc-chu", { "text-anchor": "middle" });
    };
    var tayA, tayB;
    var veHinh = function () {
      gHinh.textContent = ""; gTay.textContent = "";
      var A, B, C, Hc;
      if (bai === "chieu-cao") {
        A = [X(the1.xA), Y(0)]; B = [X(the1.xB), Y(0)]; Hc = [X(0), Y(0)]; C = [X(0), Y(the1.h)];
        thap(gHinh, Hc[0], Hc[1], C[1]);
        taoS("polygon", { points: [A, B, C].map(function (q) { return r1(q[0]) + "," + r1(q[1]); }).join(" "), class: "tm-tam-giac" }, gHinh);
        taoS("line", { x1: A[0], y1: A[1], x2: Hc[0], y2: Hc[1], class: "tm-nen-dat" }, gHinh);
        taoS("line", { x1: C[0], y1: C[1], x2: Hc[0], y2: Hc[1], class: "tm-cao" }, gHinh);
        taoS("line", { x1: A[0], y1: A[1], x2: C[0], y2: C[1], class: "tm-ngam", "data-chi": "tia-A" }, gHinh);
        taoS("line", { x1: B[0], y1: B[1], x2: C[0], y2: C[1], class: "tm-ngam tm-ngam-2", "data-chi": "tia-B" }, gHinh);
        cungGoc(gHinh, A, Hc, C, 58, "tm-cung-a", "α = " + L.so(st.al, 1) + "°", 86);
        cungGoc(gHinh, B, Hc, C, 46, "tm-cung-b", "β = " + L.so(st.be, 1) + "°", 74);
        cungGoc(gHinh, C, A, B, 52, "tm-cung-c", L.so(kq.C, 1) + "°", 80);
        nguoi(gHinh, A[0], A[1], 1); nguoi(gHinh, B[0], B[1], 1);
        kichThuoc(gHinh, A, B, 30, "AB = " + L.so(st.AB, 1) + " " + dv);
        chuS(gHinh, C[0] + 40, (C[1] + Hc[1]) / 2, "h", "tm-nhan tm-nhan-cam", { "font-style": "italic", style: "font-size:26px" });
        chuS(gHinh, C[0] - 26, C[1] - 8, "C", "tm-nhan", { "text-anchor": "end" });
        chuS(gHinh, Hc[0] + 32, Hc[1] + 30, "H", "tm-nhan");
      } else {
        A = [X(0), Y(0)]; B = [X(st.AB), Y(0)]; C = [X(the1.xC), Y(the1.h)]; Hc = [X(the1.xC), Y(0)];
        // cây C
        taoS("rect", { x: C[0] - 5, y: C[1] - 34, width: 10, height: 34, class: "tm-cay-than" }, gHinh);
        taoS("circle", { cx: C[0], cy: C[1] - 52, r: 24, class: "tm-cay-la" }, gHinh);
        taoS("circle", { cx: C[0] + 12, cy: C[1] - 62, r: 14, class: "tm-cay-la-2" }, gHinh);
        taoS("polygon", { points: [A, B, C].map(function (q) { return r1(q[0]) + "," + r1(q[1]); }).join(" "), class: "tm-tam-giac" }, gHinh);
        var xt = Math.min(A[0], Hc[0]) - 30, xp = Math.max(B[0], Hc[0]) + 30;
        taoS("line", { x1: xt, y1: A[1], x2: xp, y2: A[1], class: "tm-phu" }, gHinh);
        taoS("line", { x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: "tm-nen-dat" }, gHinh);
        taoS("line", { x1: C[0], y1: C[1], x2: Hc[0], y2: Hc[1], class: "tm-cao" }, gHinh);
        var sg = Hc[0] > A[0] ? -1 : 1;
        taoS("path", { d: "M" + (Hc[0] + sg * 14) + " " + Hc[1] + "v-14h" + (-sg * 14), class: "tm-goc-vuong", style: "stroke: var(--tm-cam)" }, gHinh);
        taoS("line", { x1: A[0], y1: A[1], x2: C[0], y2: C[1], class: "tm-ngam", "data-chi": "tia-A" }, gHinh);
        taoS("line", { x1: B[0], y1: B[1], x2: C[0], y2: C[1], class: "tm-ngam tm-ngam-2", "data-chi": "tia-B" }, gHinh);
        cungGoc(gHinh, A, B, C, 50, "tm-cung-a", "α = " + L.so(st.al, 1) + "°", 80);
        cungGoc(gHinh, B, A, C, 44, "tm-cung-b", "β = " + L.so(st.be, 1) + "°", 76);
        cungGoc(gHinh, C, A, B, 38, "tm-cung-c", L.so(kq.C, 1) + "°", 62);
        cocTieu(gHinh, A[0], A[1]); cocTieu(gHinh, B[0], B[1]);
        kichThuoc(gHinh, A, B, 34, "AB = " + L.so(st.AB, 1) + " " + dv);
        chuS(gHinh, Hc[0] + 14, (C[1] + Hc[1]) / 2, "d", "tm-nhan tm-nhan-cam", { "font-style": "italic", style: "font-size:26px" });
        chuS(gHinh, C[0] + 30, C[1] + 6, "C", "tm-nhan");
        chuS(gHinh, Hc[0] + (Hc[0] < A[0] || Hc[0] > B[0] ? 0 : 12), Hc[1] + 28, "H", "tm-nhan tm-nhan-nho");
      }
      chuS(gHinh, A[0] - 10, A[1] + 30, "A", "tm-nhan", { "text-anchor": "end" });
      chuS(gHinh, B[0] + 10, B[1] + 30, "B", "tm-nhan");
      taoS("circle", { cx: r1(C[0]), cy: r1(C[1]), r: 7, class: "tm-tieu" }, gHinh);
      var tay = function (P0, ten) {
        var g = taoS("g", { class: "tm-tay", transform: "translate(" + r1(P0[0]) + " " + r1(P0[1]) + ")", "data-chi": "diem-" + ten }, gTay);
        taoS("circle", { r: 17, class: "tm-vong" }, g);
        taoS("circle", { r: 7, fill: "var(--chu)" }, g);
        taoS("circle", { r: 26, class: "tm-trong" }, g);
        return g;
      };
      if (coKeo("A")) tayA = tay(A, "A"); else taoS("circle", { cx: A[0], cy: A[1], r: 7, fill: "var(--chu)" }, gHinh);
      if (coKeo("B")) tayB = tay(B, "B"); else taoS("circle", { cx: B[0], cy: B[1], r: 7, fill: "var(--chu)" }, gHinh);
      if (tayA) keoTha(tayA, svg, W, H, { dc: function (px) { keoDiem("A", (px - ox) / k); } });
      if (tayB) keoTha(tayB, svg, W, H, { dc: function (px) { keoDiem("B", (px - ox) / k); } });
    };
    // Kéo A hoặc B: tháp/cây đứng yên. AB bắt về bội 0,5 (dời điểm đang kéo cho đúng), góc tính chính xác từ hình
    // (hiện 1 chữ số thập phân) ⇒ chiều cao/bề rộng tính ra không đổi: đứng đâu cũng đo được cùng một tháp.
    var keoDiem = function (ten, x) {
      var deg = 180 / Math.PI, xA, xB, AB;
      if (bai === "chieu-cao") {
        var xBcu = the1.xB, xAcu = the1.xA;
        if (ten === "A") { xB = xBcu; AB = Math.round((xBcu - Math.min(xBcu - 2, Math.max((60 - ox) / k, x))) * 2) / 2; xA = xB - AB; }
        else { xA = xAcu; AB = Math.round((Math.min(-the1.h / Math.tan(85 / deg), Math.max(xAcu + 2, x)) - xAcu) * 2) / 2; xB = xA + AB; }
        var al = Math.atan2(the1.h, -xA) * deg, be = Math.atan2(the1.h, -xB) * deg;
        if (!(AB > 0 && be > al + 0.5 && be < 89)) return;
        if (Math.abs(AB - st.AB) < 1e-9 && Math.abs(al - st.al) < 1e-9 && Math.abs(be - st.be) < 1e-9) return;
        st.AB = AB; st.al = al; st.be = be;
        kq = L.tamGiacDo(bai, AB, al, be);
        the1.xA = xA; the1.xB = xB;
      } else {
        var xC = the1.xC, h = the1.h;
        if (ten === "A") { xB = st.AB; AB = Math.round((xB - Math.max((40 - ox) / k, Math.min(xB - 2, x))) * 2) / 2; xA = xB - AB; }
        else { xA = 0; AB = Math.round((Math.min((W - 40 - ox) / k, Math.max(2, x)) - xA) * 2) / 2; xB = xA + AB; }
        var al2 = Math.atan2(h, xC - xA) * deg, be2 = Math.atan2(h, xB - xC) * deg;
        if (!(AB > 0 && al2 + be2 < 179)) return;
        if (Math.abs(AB - st.AB) < 1e-9 && Math.abs(al2 - st.al) < 1e-9 && Math.abs(be2 - st.be) < 1e-9) return;
        st.AB = AB; st.al = al2; st.be = be2;
        kq = L.tamGiacDo(bai, AB, al2, be2);
        // A làm gốc mới: dời hệ để cây giữ chỗ trên màn hình
        ox += xA * k;
        the1 = { h: h, xA: 0, xB: AB, xC: xC - xA };
      }
      veHinh(); capNhatBuoc(); dongBo();
    };
    // ── Bảng các bước tính ──
    var duLieu = tao("div", "tm-du-lieu"); duLieu.setAttribute("data-chi", "du-lieu");
    bang.appendChild(duLieu);
    var cacTruot = tao("div", "tm-cac-truot");
    var tr = {};
    var doiThamSo = function () {
      try { L.tamGiacDo(bai, st.AB, st.al, st.be); } catch { return false; }
      tinhTheGioi(); datTiLe(); veCanh(); veHinh(); capNhatBuoc(); dongBo();
      return true;
    };
    if (coKeo("goc")) {
      tr.al = truot(cacTruot, { ma: "alpha", nhan: "α", min: 5, max: bai === "qua-song" ? 120 : 80, buoc: 1, gt: st.al, dv: "°", doi: function (v) { var cu = st.al; st.al = v; if (!doiThamSo()) { st.al = cu; dongBo(); } } });
      tr.be = truot(cacTruot, { ma: "beta", nhan: "β", min: bai === "qua-song" ? 5 : 10, max: bai === "qua-song" ? 120 : 85, buoc: 1, gt: st.be, dv: "°", doi: function (v) { var cu = st.be; st.be = v; if (!doiThamSo()) { st.be = cu; dongBo(); } } });
    }
    if (coKeo("AB")) tr.AB = truot(cacTruot, { ma: "AB", nhan: "AB", min: 5, max: 60, buoc: 1, gt: st.AB, dv: " " + dv, doi: function (v) { st.AB = v; doiThamSo(); } });
    var dongBo = function () {
      if (tr.al) tr.al.dat(st.al, L.so(st.al, 1) + "°");
      if (tr.be) tr.be.dat(st.be, L.so(st.be, 1) + "°");
      if (tr.AB) tr.AB.dat(st.AB, L.so(st.AB, 1) + " " + dv);
    };
    if (cacTruot.children.length) { bang.appendChild(cacTruot); duLieu.classList.add("tm-an"); }
    var ol = tao("ol", "tm-buoc-tinh"); ol.setAttribute("data-chi", "cac-buoc");
    bang.appendChild(ol);
    var dsBuoc = [];
    for (var i = 0; i < 4; i++) {
      var li = tao("li", (buocHien ? "hien" : "") + (i === 3 ? " tm-ket" : ""));
      li.setAttribute("data-chi", "buoc-" + (i + 1));
      ol.appendChild(li); dsBuoc.push(li);
    }
    if (themGhi) themGhi();
    var cu = [];
    var capNhatBuoc = function () {
      var s2 = function (x) { return L.so(x, 2); }, g1 = function (x) { return L.so(x, 1) + "°"; };
      rich(duLieu, [{ nd: ["AB = " + L.so(st.AB, 1) + " " + dv], lop: "" }, { nd: ["α = " + g1(st.al)], lop: "" }, { nd: ["β = " + g1(st.be)], lop: "" }]);
      var noiDung;
      if (bai === "chieu-cao") {
        noiDung = [
          [{ b: "Góc ở đỉnh C: " }, "∠ACB = β − α = " + g1(st.be) + " − " + g1(st.al) + " = " + g1(kq.C)],
          [{ b: "Định lý sin (△ABC): " }, { ps: ["BC", "sin α"] }, " = ", { ps: ["AB", "sin C"] }, { nd: ["BC = " + L.so(st.AB, 1) + " · sin " + g1(st.al) + " : sin " + g1(kq.C) + " ≈ " + s2(kq.BC) + " " + dv], lop: "tm-nho" }],
          [{ b: "△BCH vuông tại H: " }, "h = BC · sin β ≈ " + s2(kq.BC) + " · sin " + g1(st.be), { nd: ["Kiểm tra bằng định lý côsin: AC² = AB² + BC² − 2·AB·BC·cos " + g1(180 - st.be) + " ⇒ AC ≈ " + s2(kq.ACcos) + ", AC·sin α ≈ " + s2(kq.ACcos * Math.sin(st.al * Math.PI / 180)) + " ✓"], lop: "tm-nho" }],
          [{ b: "Chiều cao tháp: h ≈ " + s2(kq.h) + " " + dv }]
        ];
      } else {
        noiDung = [
          [{ b: "Góc ở C: " }, "∠ACB = 180° − α − β = " + g1(kq.C)],
          [{ b: "Định lý sin (△ABC): " }, { ps: ["AC", "sin β"] }, " = ", { ps: ["AB", "sin C"] }, { nd: ["AC = " + L.so(st.AB, 1) + " · sin " + g1(st.be) + " : sin " + g1(kq.C) + " ≈ " + s2(kq.AC) + " " + dv], lop: "tm-nho" }],
          [{ b: "△ACH vuông tại H: " }, "d = AC · sin α ≈ " + s2(kq.AC) + " · sin " + g1(st.al), { nd: ["Kiểm tra bằng định lý côsin: BC² = AB² + AC² − 2·AB·AC·cos α ⇒ BC ≈ " + s2(kq.BCcos) + ", BC·sin β ≈ " + s2(kq.BCcos * Math.sin(st.be * Math.PI / 180)) + " ✓"], lop: "tm-nho" }],
          [{ b: "Bề rộng sông: d ≈ " + s2(kq.h) + " " + dv }]
        ];
      }
      noiDung.forEach(function (nd, j) {
        rich(dsBuoc[j], nd);
        var t = dsBuoc[j].textContent;
        if (cu[j] != null && cu[j] !== t && !itDong) nhayDoi(dsBuoc[j]);
        cu[j] = t;
      });
    };
    veCanh(); veHinh(); capNhatBuoc(); dongBo();
  };

  /* ═══════════════ .mo-phong-xs ═══════════════ */
  var dungMoPhongXs = function (el) {
    var d = docJson(el);
    var loai = ["xuc-xac", "dong-xu", "hai-xuc-xac-tong"].indexOf(d.loai) >= 0 ? d.loai : "xuc-xac";
    var dsLan = (Array.isArray(d.soLan) ? d.soLan : [10, 100, 1000, 10000]).map(function (v) { return Math.floor(soLieu(v, 0)); }).filter(function (v) { return v > 0 && v <= 100000; }).slice(0, 5);
    var kqLT = L.xacSuatLyThuyet(loai), K = kqLT.length;
    var demKQ = [], n = 0, lichSu = [], chon = loai === "dong-xu" ? 0 : loai === "xuc-xac" ? 5 : 5, matCuoi = loai === "hai-xuc-xac-tong" ? [3, 4] : [6];
    for (var i = 0; i < K; i++) demKQ.push(0);
    // nguồn ngẫu nhiên mật mã
    var bo = new Uint32Array(1024), viTri = 1024;
    var layU32 = function () {
      if (viTri >= bo.length) {
        try { crypto.getRandomValues(bo); } catch { for (var j = 0; j < bo.length; j++) bo[j] = Math.floor(Math.random() * 4294967296); }
        viTri = 0;
      }
      return bo[viTri++];
    };
    var gieoMot = function () {
      var r = L.gieo(loai, layU32);
      if (loai === "hai-xuc-xac-tong") { demKQ[r.kq]++; matCuoi = r.mat; } else { demKQ[r]++; matCuoi = [loai === "dong-xu" ? r : r + 1]; }
      n++;
    };
    var ghiLichSu = function () {
      var cuoi = lichSu[lichSu.length - 1];
      if (!cuoi || n >= cuoi.n * 1.04 || n - cuoi.n >= 1 && n < 30) lichSu.push({ n: n, dem: demKQ.slice() });
    };
    var themGhi = giuNoiDungCu(el, null);
    var hop = taoHop(el, "tm-xs");
    var trai = tao("div", "tm-the tm-ban"), phai = tao("div", "tm-the tm-xs-phai");
    hop.appendChild(trai); hop.appendChild(phai);
    var khay = tao("div", "tm-khay"); khay.setAttribute("data-chi", "ban-gieo");
    trai.appendChild(khay);
    var WB = 440, HB = 300;
    var svgB = taoS("svg", { class: "tm-svg", viewBox: "0 0 " + WB + " " + HB, role: "img", "aria-label": loai === "dong-xu" ? "Đồng xu" : "Xúc xắc" });
    khay.appendChild(svgB);
    var id = maMoi("x");
    var defs = taoS("defs", null, svgB);
    var gx = taoS("radialGradient", { id: id + "v", cx: ".4", cy: ".35" }, defs);
    taoS("stop", { offset: "0", "stop-color": "#fff3bf" }, gx); taoS("stop", { offset: ".55", "stop-color": "#fcc419" }, gx); taoS("stop", { offset: "1", "stop-color": "#e8a400" }, gx);
    taoS("ellipse", { cx: WB / 2, cy: HB - 50, rx: 170, ry: 22, class: "tm-bong-ban" }, svgB);
    var gVat = taoS("g", null, svgB);
    var dk = tao("div", "tm-dk");
    trai.appendChild(dk);
    var demChu = tao("div", "tm-dem");
    dk.appendChild(demChu);
    var hn = tao("div", "tm-hang-nut"); hn.setAttribute("data-chi", "nut-gieo");
    dk.appendChild(hn);
    var cacNut = [];
    cacNut.push(nut(hn, loai === "dong-xu" ? "Tung 1 lần" : "Gieo 1 lần", "xx", "tm-chinh", function () { chayLo(1); }));
    dsLan.forEach(function (v) { cacNut.push(nut(hn, "+" + L.soNhom(v), null, "", function () { chayLo(v); })); });
    nut(hn, "Đặt lại", "lai", "", function () {
      lap.dung(); dangChay = false; cacNut.forEach(function (b) { b.disabled = false; });
      for (var j = 0; j < K; j++) demKQ[j] = 0;
      n = 0; lichSu = []; veVat(false); veBieuDo(true);
    });
    // biểu đồ
    var oBD = tao("div", "tm-o-bd"), oHT = tao("div", "tm-o-ht"), tk = tao("div", "tm-tk");
    oBD.setAttribute("data-chi", "bieu-do"); oHT.setAttribute("data-chi", "hoi-tu"); tk.setAttribute("data-chi", "thong-ke");
    phai.appendChild(oBD); phai.appendChild(oHT); phai.appendChild(tk);
    if (themGhi) themGhi();
    // Hai biểu đồ vẽ theo đúng kích thước ô (px) để chữ không bị co khi ô hẹp/thấp; đổi cỡ (đổi tab, thu nhỏ) thì vẽ lại.
    var co = function (o, w, h) { return { w: Math.max(280, Math.round(o.clientWidth || w)), h: Math.max(110, Math.round(o.clientHeight || h)) }; };
    var svgC = taoS("svg", { class: "tm-svg", viewBox: "0 0 780 300", role: "img", "aria-label": "Biểu đồ tần suất tương đối" });
    oBD.appendChild(svgC);
    var gLuoi = taoS("g", { class: "tm-luoi" }, svgC), gSoY = taoS("g", null, svgC), gCot = taoS("g", null, svgC), gLT = taoS("g", null, svgC), gNhan = taoS("g", null, svgC);
    var tdC = chuS(svgC, 14, 24, "Tần suất tương đối", "tm-so", { style: "font-size:16px;font-weight:800" });
    var chuGiai = taoS("g", null, svgC);
    taoS("line", { x1: 0, y1: 0, x2: 28, y2: 0, class: "tm-ly-thuyet" }, chuGiai);
    chuS(chuGiai, 36, 6, "xác suất lý thuyết", "tm-so", { style: "font-size:16px" });
    var cot = [], vachLT = [], nhanCot = [], nhanX = [];
    kqLT.forEach(function (o, j) {
      var c = taoS("rect", { y: 0, height: 0, rx: 6, class: "tm-cot" + (j === chon ? " tm-chon" : "") }, gCot);
      c.addEventListener("click", function () { chon = j; cot.forEach(function (z, t) { z.classList.toggle("tm-chon", t === chon); }); veBieuDo(true); });
      cot.push(c);
      vachLT.push(taoS("line", { class: "tm-ly-thuyet" }, gLT));
      nhanCot.push(chuS(gNhan, 0, 0, "", "tm-so", { "text-anchor": "middle", style: "font-size:" + (K > 6 ? 14 : 16) + "px;font-weight:800;fill:var(--chu)" }));
      nhanX.push(chuS(gNhan, 0, 0, o.nhan, "tm-so", { "text-anchor": "middle", style: "font-size:" + (K > 6 ? 17 : 19) + "px;font-weight:800;fill:var(--chu)" }));
    });
    var dayC = taoS("line", { stroke: "var(--chu-phu)", "stroke-width": 2.4 }, svgC);
    var tenX = chuS(svgC, 0, 0, loai === "dong-xu" ? "Mặt xuất hiện" : loai === "xuc-xac" ? "Số chấm xuất hiện" : "Tổng số chấm của hai xúc xắc", "tm-so", { "text-anchor": "middle", style: "font-size:15px" });
    // biểu đồ hội tụ
    var svgH = taoS("svg", { class: "tm-svg", viewBox: "0 0 780 170", role: "img", "aria-label": "Tần suất hội tụ về xác suất" });
    oHT.appendChild(svgH);
    var gHL = taoS("g", null, svgH);
    var duongHT = taoS("path", { class: "tm-duong-ht" }, svgH);
    var vachHT = taoS("line", { class: "tm-ly-thuyet" }, svgH);
    var yMaxHien = 0.5, yMaxDich = 0.5;
    var veBieuDo = function (heTruc) {
      // ô thấp (ví dụ trong tab của slide hai cột): bỏ biểu đồ hội tụ để biểu đồ tần suất đủ lớn
      if (phai.clientHeight) oHT.classList.toggle("tm-an", phai.clientHeight < 330);
      var kc1 = co(oBD, 780, 300), WC = kc1.w, HC = kc1.h, CL = 62, CR = WC - 16, CT = 44, CB = HC - 46;
      svgC.setAttribute("viewBox", "0 0 " + WC + " " + HC);
      dat(chuGiai, { transform: "translate(" + (CR - 186) + " 18)" });
      dat(tdC, { x: 14 });
      var slot = (CR - CL) / K, rongCot = Math.min(80, slot * 0.62);
      var fmax = 0, pmax = 0;
      for (var j = 0; j < K; j++) { fmax = Math.max(fmax, n ? demKQ[j] / n : 0); pmax = Math.max(pmax, L.gt(kqLT[j].xs)); }
      yMaxDich = Math.min(1, Math.max(pmax * 1.6, Math.ceil(fmax * 10 + 0.3) / 10));
      if (heTruc || itDong) yMaxHien = yMaxDich; else yMaxHien += (yMaxDich - yMaxHien) * 0.2;
      var Yc = function (v) { return CB - v / yMaxHien * (CB - CT); };
      gLuoi.textContent = ""; gSoY.textContent = "";
      var u = L.buocDep(yMaxHien / Math.max(2, Math.min(5, Math.floor((CB - CT) / 34))));
      if (!(yMaxHien > 0) || !isFinite(yMaxHien)) yMaxHien = yMaxDich > 0 ? yMaxDich : 1;
      for (var v = 0, vi = 0; v <= yMaxHien + 1e-9 && vi < 40; v += u, vi++) {
        taoS("line", { x1: CL, y1: r1(Yc(v)), x2: CR, y2: r1(Yc(v)) }, gLuoi);
        chuS(gSoY, CL - 10, Yc(v) + 5, L.so(v, 2), "tm-so", { "text-anchor": "end" });
      }
      for (var t = 0; t < K; t++) {
        var f = n ? demKQ[t] / n : 0, p = L.gt(kqLT[t].xs), x = CL + slot * (t + 0.5);
        var y = Yc(f);
        dat(cot[t], { x: r1(x - rongCot / 2), width: r1(rongCot), y: r1(y), height: r1(Math.max(0, CB - y)) });
        dat(vachLT[t], { x1: r1(x - slot * 0.46), x2: r1(x + slot * 0.46), y1: r1(Yc(p)), y2: r1(Yc(p)) });
        dat(nhanCot[t], { x: r1(x), y: r1(Math.min(y, Yc(p)) - 9) });
        dat(nhanX[t], { x: r1(x), y: r1(CB + 24) });
        nhanCot[t].textContent = n ? L.so(f, K > 6 ? 2 : 3) : "";
      }
      dat(dayC, { x1: CL, y1: CB, x2: CR, y2: CB });
      dat(tenX, { x: r1((CL + CR) / 2), y: HC - 6 });
      var kc2 = co(oHT, 780, 170), WH = kc2.w, HH = kc2.h, HL = 62, HR = WH - 16, HT = 34, HBt = HH - 40;
      svgH.setAttribute("viewBox", "0 0 " + WH + " " + HH);
      // hội tụ
      var pc = L.gt(kqLT[chon].xs);
      var ymH = Math.min(1, Math.max(pc * 2, 0.05));
      lichSu.forEach(function (h) { ymH = Math.max(ymH, h.dem[chon] / h.n); });
      ymH = Math.min(1, Math.ceil(ymH * 10) / 10);
      var nMax = Math.max(10, n), lx = Math.log(nMax) / Math.LN10;
      var Xh = function (m) { return HL + Math.log(m) / Math.LN10 / lx * (HR - HL); }, Yh = function (v) { return HBt - v / ymH * (HBt - HT); };
      gHL.textContent = "";
      var gl = taoS("g", { class: "tm-luoi" }, gHL);
      for (var e = 0; e <= Math.ceil(lx); e++) {
        var m = Math.pow(10, e);
        if (m > nMax * 1.0001) break;
        taoS("line", { x1: r1(Xh(m)), y1: HT, x2: r1(Xh(m)), y2: HBt }, gl);
        chuS(gHL, Xh(m), HBt + 20, L.soNhom(m), "tm-so", { "text-anchor": "middle" });
      }
      taoS("line", { x1: HL, y1: HBt, x2: HR, y2: HBt, stroke: "var(--chu-phu)", "stroke-width": 2 }, gHL);
      chuS(gHL, HL - 10, Yh(0) + 5, "0", "tm-so", { "text-anchor": "end" });
      chuS(gHL, HL - 10, Yh(ymH) + 10, L.so(ymH, 1), "tm-so", { "text-anchor": "end" });
      chuS(gHL, HR, HH - 4, "số lần thử n (thang log)", "tm-so", { "text-anchor": "end", style: "font-size:14px" });
      dat(vachHT, { x1: HL, x2: HR, y1: r1(Yh(pc)), y2: r1(Yh(pc)) });
      duongHT.setAttribute("d", duongTuDiem(lichSu.map(function (h) { return [Xh(h.n), Yh(h.dem[chon] / h.n)]; })));
      chuS(gHL, 14, 22, "Tần suất của «" + kqLT[chon].nhan + "» theo số lần thử → tiến về " + L.chuPS(kqLT[chon].xs), "tm-so", { style: "font-size:16px;font-weight:800;fill:var(--chu)" });
      // thống kê
      var lech = 0;
      for (var q = 0; q < K; q++) lech = Math.max(lech, n ? Math.abs(demKQ[q] / n - L.gt(kqLT[q].xs)) : 0);
      var fc = n ? demKQ[chon] / n : 0;
      rich(tk, n ? ["«" + kqLT[chon].nhan + "»: " + L.soNhom(demKQ[chon]) + "/" + L.soNhom(n) + " ≈ " + L.so(fc, 3) + "  ·  P = " + L.chuPS(kqLT[chon].xs) + " ≈ " + L.so(pc, 3) + "  ·  độ lệch lớn nhất ", { b: L.so(lech, 3) }] :
        ["Bấm «" + (loai === "dong-xu" ? "Tung" : "Gieo") + "» để bắt đầu. Bấm vào một cột để theo dõi kết quả đó."]);
      rich(demChu, ["Số lần " + (loai === "dong-xu" ? "tung" : "gieo") + ": ", { b: L.soNhom(n) }]);
    };
    // vật gieo: xúc xắc / đồng xu
    var CHAM = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
    var veXucXac = function (g, cx, cy, mat, lan, tre) {
      var x = taoS("g", { class: "tm-xuc-xac" + (lan ? " tm-lan" : ""), transform: "translate(" + cx + " " + cy + ")" }, g);
      var trong = taoS("g", { class: lan ? "tm-lan" : "" }, x);
      if (lan && tre) trong.style.animationDelay = tre + "ms";
      x.setAttribute("class", "tm-xuc-xac");
      taoS("rect", { x: -54, y: -48, width: 112, height: 112, rx: 22, class: "tm-mat-ben" }, trong);
      taoS("rect", { x: -58, y: -58, width: 112, height: 112, rx: 22, class: "tm-mat" }, trong);
      CHAM[mat].forEach(function (c) { taoS("circle", { cx: -2 + c[0] * 28, cy: -2 + c[1] * 28, r: mat === 1 ? 14 : 10, class: mat === 1 ? "tm-do" : "" }, trong); });
      return trong;
    };
    var veVat = function (lan) {
      gVat.textContent = "";
      if (loai === "dong-xu") {
        var g = taoS("g", { class: lan && !itDong ? "tm-tung" : "", transform: "translate(" + WB / 2 + " " + (HB / 2 - 10) + ")" }, gVat);
        var trong = taoS("g", { class: lan && !itDong ? "tm-tung" : "" }, g);
        taoS("circle", { r: 92, fill: "url(#" + id + "v)", class: "tm-dong-xu-mat" }, trong);
        taoS("circle", { r: 76, class: "tm-dong-xu-vien" }, trong);
        var sap = matCuoi[0] === 0;
        chuS(trong, 0, 18, sap ? "S" : "N", "tm-dong-xu-chu");
        chuS(trong, 0, 56, sap ? "SẤP" : "NGỬA", "tm-dong-xu-chu", { style: "font-size:17px;letter-spacing:.2em" });
        g.setAttribute("class", "");
        if (!n) { trong.setAttribute("opacity", ".55"); }
        return;
      }
      if (loai === "xuc-xac") veXucXac(gVat, WB / 2, HB / 2 - 14, matCuoi[0], lan && !itDong);
      else { veXucXac(gVat, WB / 2 - 82, HB / 2 - 14, matCuoi[0], lan && !itDong); veXucXac(gVat, WB / 2 + 82, HB / 2 - 4, matCuoi[1], lan && !itDong, 90); }
      if (loai === "hai-xuc-xac-tong" && n) chuS(gVat, WB / 2, HB - 14, "Tổng: " + (matCuoi[0] + matCuoi[1]), "tm-nhan", { "text-anchor": "middle", style: "font-size:26px" });
      if (!n) gVat.setAttribute("opacity", ".55"); else gVat.removeAttribute("opacity");
    };
    var dangChay = false;
    var lap = vongLap(function () { return false; });
    var chayLo = function (soLan) {
      if (dangChay) return;
      if (soLan === 1) {
        gieoMot(); ghiLichSu(); veVat(true); veBieuDo(false);
        if (!itDong) { var dem2 = 0; lap.dung(); lap = vongLap(function () { veBieuDo(false); return ++dem2 < 30; }); lap.chay(); }
        return;
      }
      if (itDong) { for (var j = 0; j < soLan; j++) { gieoMot(); if (j % 7 === 0) ghiLichSu(); } ghiLichSu(); veVat(false); veBieuDo(true); return; }
      dangChay = true;
      cacNut.forEach(function (b) { b.disabled = true; });
      var conLai = soLan, T = Math.min(2.2, 0.5 + 0.45 * Math.log(soLan) / Math.LN10), t = 0, lanVe = 0;
      var tong = soLan;
      lap.dung();
      lap = vongLap(function (dt) {
        t += dt;
        var muc = Math.min(1, t / T), canCo = Math.round(tong * (1 - Math.pow(1 - muc, 2)));
        var lam = Math.min(conLai, canCo - (tong - conLai));
        for (var j = 0; j < lam; j++) { gieoMot(); if (j % 3 === 0) ghiLichSu(); }
        conLai -= lam;
        ghiLichSu();
        lanVe += dt;
        if (lanVe > 0.09) { lanVe = 0; veVat(false); }
        veBieuDo(false);
        if (conLai <= 0 && muc >= 1) {
          veVat(true);
          dangChay = false; cacNut.forEach(function (b) { b.disabled = false; });
          var them2 = 0;
          lap = vongLap(function () { veBieuDo(false); return ++them2 < 30; }); lap.chay();
          return false;
        }
      });
      lap.chay();
    };
    veVat(false); veBieuDo(true);
    var coCu = "";
    var hoanVe = 0;
    try {
      new ResizeObserver(function () {
        var moi = oBD.clientWidth + "x" + oBD.clientHeight + "/" + phai.clientHeight;
        if (moi === coCu || hoanVe) return;
        coCu = moi;
        // vẽ lại ở lượt sau, không ngay trong callback (tránh vòng đo ↔ vẽ)
        hoanVe = setTimeout(function () { hoanVe = 0; veBieuDo(true); }, 30);
      }).observe(oBD);
    } catch { /* cũ */ }
    theoSlide(el, function () { veBieuDo(true); }, function () { if (!dangChay) lap.dung(); });
  };

  /* ═══════════════ .hinh-dung ═══════════════ */
  var dungHinhDung = function (el) {
    var d = docJson(el);
    var dsDiem = Array.isArray(d.diem) ? d.diem : [];
    var vung = d.vung || { x: [-1.2, 1.2], y: [-1.2, 1.2] };
    var W = 900, k = W / (vung.x[1] - vung.x[0]), H = Math.round((vung.y[1] - vung.y[0]) * k);
    var X = function (x) { return (x - vung.x[0]) * k; }, Y = function (y) { return (vung.y[1] - y) * k; };
    var dsDo = Array.isArray(d.do) ? d.do : [];
    var coBang = dsDo.length > 0 || typeof d.chu === "string";
    var themGhi = giuNoiDungCu(el, null);
    var hop = taoHop(el, coBang ? "tm-hop-hd" : "tm-hop-hd tm-hop-1");
    var the = tao("div", "tm-the tm-hinh");
    hop.appendChild(the);
    var svg = taoS("svg", { class: "tm-svg", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": typeof d.moTa === "string" ? d.moTa : "Hình học kéo được" });
    the.appendChild(svg);
    var buocCua = function (x) { return x && typeof x.buoc === "number" && x.buoc > 0 ? x.buoc : 0; };
    var soLop = 1;
    [dsDiem, d.net || [], d.tron || [], d.vuong || []].forEach(function (ds) { ds.forEach(function (x) { soLop = Math.max(soLop, buocCua(x) + 1); }); });
    // Mỗi lớp là một bước của lời giảng. Nét nằm dưới chữ, chữ nằm dưới tay kéo, nên mỗi lớp có hai nhóm.
    var lopNetG = [], lopChuG = [], k2;
    for (k2 = 0; k2 < soLop; k2++) lopNetG.push(taoS("g", { class: "tm-hd-lop" }, svg));
    for (k2 = 0; k2 < soLop; k2++) lopChuG.push(taoS("g", { class: "tm-hd-lop" }, svg));
    var gTay = taoS("g", null, svg);
    var gt = {}, P = {};
    var dsSo = [];
    if (coBang) {
      var bang = tao("div", "tm-bang");
      hop.appendChild(bang);
      if (typeof d.chu === "string") bang.appendChild(tao("div", "tm-hd-chu", d.chu));
      dsDo.forEach(function (m) {
        var o = tao("div", "tm-hd-so");
        o.setAttribute("data-chi", "do-" + m.nhan);
        o.appendChild(tao("span", "", m.nhan));
        var v = tao("span", "");
        o.appendChild(v);
        bang.appendChild(o);
        dsSo.push({ m: m, v: v });
      });
    }
    var tiLe = soLieu(d.tiLe, 1);
    var lopNet = function (n) {
      var lop = "tm-hd-net";
      if (n.lop === "cam" || n.lop === "mau" || n.lop === "la" || n.lop === "nhat") lop += " tm-hd-" + n.lop;
      if (n.dut) lop += " tm-hd-dut";
      return lop;
    };
    var ve = function () {
      P = L.dungHinh(dsDiem, gt);
      lopNetG.concat(lopChuG).forEach(function (g) { g.textContent = ""; });
      // pathLength để nét mới vẽ ra được từ đầu tới cuối; nét đứt giữ nguyên mẫu đứt nên chỉ hiện dần.
      var veDuoc = function (n) { return n.dut ? {} : { pathLength: 1 }; };
      (d.tron || []).forEach(function (c) {
        var tam = P[c.tam], qua = P[c.qua];
        var tam2 = c.duongKinh ? P[c.duongKinh[0]] : null, dk2 = c.duongKinh ? P[c.duongKinh[1]] : null;
        if (tam2 && dk2) { tam = [(tam2[0] + dk2[0]) / 2, (tam2[1] + dk2[1]) / 2]; qua = dk2; }
        if (!tam || !qua) return;
        var dx = qua[0] - tam[0], dy = qua[1] - tam[1];
        var vong = taoS("circle", { cx: r1(X(tam[0])), cy: r1(Y(tam[1])), r: r1(Math.sqrt(dx * dx + dy * dy) * k), class: lopNet(c) }, lopNetG[buocCua(c)]);
        dat(vong, veDuoc(c));
      });
      (d.net || []).forEach(function (n) {
        var a = P[Array.isArray(n) ? n[0] : n.a], b = P[Array.isArray(n) ? n[1] : n.b];
        if (!a || !b) return;
        var kieu = Array.isArray(n) ? {} : n;
        var net = taoS("line", { x1: r1(X(a[0])), y1: r1(Y(a[1])), x2: r1(X(b[0])), y2: r1(Y(b[1])), class: lopNet(kieu) }, lopNetG[buocCua(kieu)]);
        dat(net, veDuoc(kieu));
      });
      (d.vuong || []).forEach(function (mv) {
        var v = Array.isArray(mv) ? mv : mv.v;
        var a = P[v[0]], o = P[v[1]], b = P[v[2]];
        if (!a || !o || !b) return;
        var dv = function (q) {
          var x = X(q[0]) - X(o[0]), y = Y(q[1]) - Y(o[1]), l = Math.sqrt(x * x + y * y) || 1;
          return [x / l * 15, y / l * 15];
        };
        var u = dv(a), w = dv(b), ox = X(o[0]), oy = Y(o[1]);
        taoS("polyline", { points: [ox + u[0], oy + u[1], ox + u[0] + w[0], oy + u[1] + w[1], ox + w[0], oy + w[1]].map(r1).join(" "), class: "tm-hd-vuong" }, lopNetG[buocCua(mv)]);
      });
      dsDiem.forEach(function (m) {
        var q = P[m.ten];
        if (!q || m.an) return;
        var n = Array.isArray(m.nhan) ? m.nhan : [14, -12];
        var gChu = lopChuG[buocCua(m)];
        if (!m.keo) taoS("circle", { cx: r1(X(q[0])), cy: r1(Y(q[1])), r: 6, class: "tm-hd-diem" }, gChu);
        chuS(gChu, X(q[0]) + n[0], Y(q[1]) + n[1], m.ten, "tm-nhan" + (m.lop === "cam" ? " tm-nhan-cam" : ""), { "text-anchor": "middle" });
      });
      dsTay.forEach(function (t) {
        var q = P[t.ten];
        if (q) t.g.setAttribute("transform", "translate(" + r1(X(q[0])) + " " + r1(Y(q[1])) + ")");
      });
      dsSo.forEach(function (s) {
        var a = P[s.m.a], b = P[s.m.b];
        if (!a || !b) { s.v.textContent = "—"; return; }
        var dx = a[0] - b[0], dy = a[1] - b[1];
        s.v.textContent = L.so(Math.sqrt(dx * dx + dy * dy) * tiLe, 2);
      });
    };
    var dsTay = [];
    dsDiem.forEach(function (m) {
      if (!Array.isArray(m.keo) || !(m.tren || m.chia)) return;
      var g = taoS("g", { class: "tm-tay", "data-chi": "diem-" + m.ten }, gTay);
      taoS("circle", { r: 19, class: "tm-vong" }, g);
      taoS("circle", { r: 7, fill: "var(--chu)" }, g);
      taoS("circle", { r: 28, class: "tm-trong" }, g);
      dsTay.push({ ten: m.ten, g: g, buoc: buocCua(m) });
      keoTha(g, svg, W, H, {
        dc: function (px, py) {
          var x = vung.x[0] + px / k, y = vung.y[1] - py / k, moi;
          if (m.tren) {
            var tam = P[m.tren[0]];
            moi = Math.atan2(y - tam[1], x - tam[0]) * 180 / Math.PI;
            if (moi < 0) moi += 360;
          } else {
            var a = P[m.chia[0]], b = P[m.chia[1]], ux = b[0] - a[0], uy = b[1] - a[1];
            moi = ((x - a[0]) * ux + (y - a[1]) * uy) / ((ux * ux + uy * uy) || 1);
          }
          gt[m.ten] = Math.min(m.keo[1], Math.max(m.keo[0], moi));
          ve();
        }
      });
    });
    ve();
    // Vẽ dần: theo bước của slide (khung ghi ở section._b, đổi class da-hien của các phần hiện dần). Đang in (body.tat-ca) thì hiện hết.
    if (soLop > 1) {
      var sec = el.closest("section"), daThay = 0;
      var theoBuoc = function () {
        var hetCa = document.body.classList.contains("tat-ca");
        var da = hetCa ? soLop : sec && sec._b ? sec._b.da : 0;
        for (var i = 0; i < soLop; i++) {
          var an = i > da;
          lopNetG[i].classList.toggle("tm-hd-an", an);
          lopChuG[i].classList.toggle("tm-hd-an", an);
          if (!an && i > daThay && !itDong) {
            (function (g) {
              g.classList.add("tm-hd-ve");
              setTimeout(function () { g.classList.remove("tm-hd-ve"); }, 900);
            })(lopNetG[i]);
          }
        }
        dsTay.forEach(function (t) { t.g.style.visibility = t.buoc > da ? "hidden" : ""; });
        daThay = da;
      };
      theoBuoc();
      if (sec) {
        try {
          // Chỉ theo các phần hiện dần: nét vẽ lại khi kéo không được đánh thức bộ theo dõi này.
          new MutationObserver(theoBuoc).observe(sec, { attributes: true, attributeFilter: ["class"], subtree: true });
        } catch { /* cũ */ }
        setTimeout(theoBuoc, 0);
      }
    }
  };

  /* ═══════════════ Dựng tất cả ═══════════════ */
  var BANG = [[".conic", "conic", dungConic], [".mien-nghiem", "mien-nghiem", dungMienNghiem], [".tam-giac-do", "tam-giac-do", dungTamGiacDo], [".mo-phong-xs", "mo-phong-xs", dungMoPhongXs], [".hinh-dung", "hinh-dung", dungHinhDung]];
  BANG.forEach(function (m) {
    $$(".khung > section " + m[0] + ", .khung > section" + m[0]).forEach(function (el) {
      if (el._tmXong) return;
      el._tmXong = true;
      try { m[2](el); } catch (e) { hopLoi(el, m[1], e); }
    });
  });

  // Vừa chiều cao: nếu slide bị tràn (chữ, phụ đề quanh thành phần) thì thu thành phần lại trước khi khung phải thu nhỏ cỡ chữ
  // cả slide (vuaKhung của chayKhung). Trong một cột còn chỗ thì giãn ra hết cột, vì hình luôn là phần chính của cột đó.
  var CAO_MAC_DINH = 540, CAO_TRONG_COT = 660, CAO_THAP_NHAT = 330;
  var vuaCao = function () {
    var hep = document.documentElement.classList.contains("hep");
    $$(".khung > section").forEach(function (s) {
      var hops = $$(".tm-hop", s);
      var hien = hops.filter(function (h) { return h.getClientRects().length; });
      if (!hien.length) return;
      var cs = getComputedStyle(s);
      var tl = s.getBoundingClientRect().height / (s.offsetHeight || 1) || 1;
      var lePhu = /\b(bia|chuong|hai-cot)\b/.test(s.className) ? 0 : 28;
      var r = s.getBoundingClientRect(), gioiHan = r.bottom - (parseFloat(cs.paddingBottom) + lePhu) * tl, day = -Infinity;
      // chỉ đo cột chứa thành phần (cột bên kia tràn là việc của nội dung, không thu thành phần vì nó)
      var cot = hien[0].closest(".cot");
      var dsCon = cot && s.contains(cot) ? $$(":scope > *", cot) : $$(":scope > *, :scope > .than > *", s);
      dsCon.forEach(function (c) {
        if (c.classList.contains("dau-slide") || c.classList.contains("ghi-chu") || c.classList.contains("than") || c.classList.contains("cot")) return;
        var b = c.getBoundingClientRect();
        if (b.height) day = Math.max(day, b.bottom);
      });
      var du = (day - gioiHan) / tl;
      var cao = hien[0].getBoundingClientRect().height / tl;
      var tran = cot && !hep ? CAO_TRONG_COT : CAO_MAC_DINH;
      var moi = Math.min(tran, Math.max(CAO_THAP_NHAT, Math.floor(cao - du - 4)));
      if (Math.abs(moi - cao) < 1) return;
      hops.forEach(function (h) { h.style.setProperty("--tm-cao", moi + "px"); });
    });
  };
  try { vuaCao(); } catch (e) { /* không đo được */ }
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { try { vuaCao(); } catch (e) { /* bỏ qua */ } }); } catch (e) { /* cũ */ }
  // Khung nạp ở cỡ nhỏ (trong trang bài học) rồi mới vào toàn màn hình: phải đo lại, kẻo hình giữ mãi cỡ đã thu.
  // Chạy trước vuaKhung (120 ms sau resize, chỉ khi cỡ logic đổi) và bỏ cỡ chữ cũ để vuaKhung đo đúng theo cỡ mới.
  var khungDo = document.querySelector(".khung"), kichDo = "", henDo = 0;
  window.addEventListener("resize", function () {
    clearTimeout(henDo);
    henDo = setTimeout(function () {
      var kich = khungDo ? khungDo.offsetWidth + "x" + khungDo.offsetHeight : "";
      if (kich === kichDo) return;
      kichDo = kich;
      $$(".khung > section").forEach(function (s) { if ($$(".tm-hop", s).length) s.style.fontSize = ""; });
      try { vuaCao(); } catch (e) { /* không đo được */ }
    }, 60);
  });
}
