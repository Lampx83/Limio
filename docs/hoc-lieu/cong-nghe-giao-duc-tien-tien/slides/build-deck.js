const React = require("react");
const RDS = require("react-dom/server");
const fa = require("react-icons/fa6");
const fs = require("fs");
const ic = (name, color, size) => RDS.renderToStaticMarkup(React.createElement(fa[name], { color, size, "aria-hidden": true }));

// Đồng bộ với bài học trên limio: font Inter, nền rgb(250,250,252), chữ slate-900,
// dải màu mục (SECTION_HUES) cho nền nhạt/vạch và bản đậm (SECTION_TEXT_HUES) cho chữ.
const H = {
  blue:   { base: "59,130,246",  text: "40,118,245" },
  violet: { base: "139,92,246",  text: "138,91,246" },
  teal:   { base: "13,148,136",  text: "12,141,129" },
  amber:  { base: "217,150,40",  text: "165,113,29" },
  red:    { base: "220,38,38",   text: "200,34,34" },
};
const TEXT = "rgb(17,24,39)", MUTED = "rgb(100,106,116)", RULE = "rgba(127,127,127,.30)";
const solid = (h) => `rgba(${H[h].base},.88)`;
const tint = (h, a = .10) => `rgba(${H[h].base},${a})`;
const edge = (h, a = .38) => `rgba(${H[h].base},${a})`;
const ink = (h) => `rgb(${H[h].text})`;
const logo = (f) => "data:image/svg+xml;base64," + fs.readFileSync(__dirname + "/logos/" + f).toString("base64");
const CHEGG = logo("chegg.svg"), DUO = logo("duolingo.svg");
const circle = (h, size, iconName, iconSize) =>
  `<div class="dot" style="width:${size}px;height:${size}px;background:${solid(h)}">${ic(iconName, "#fff", iconSize)}</div>`;

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bài 1.6 · Slide mở bài — Chegg và Duolingo</title>
<style>${fs.readFileSync(__dirname + "/fonts/inter-embedded.css", "utf8")}</style>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:rgb(236,238,243);overflow:hidden;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:${TEXT}}
.viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.stage{width:1280px;height:720px;position:relative;transform-origin:center center;flex:none}
.slide{position:absolute;inset:0;padding:60px 76px;display:none;overflow:hidden;border-radius:18px;
  background:rgb(250,250,252);box-shadow:0 1px 3px rgba(17,24,39,.08),0 12px 32px rgba(17,24,39,.08)}
.slide.on{display:block;animation:in .3s ease}
@keyframes in{from{opacity:0}to{opacity:1}}
/* Nhãn nhỏ viết hoa — cùng kiểu chú thích sơ đồ trong bài */
.label{font-size:17px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65}
/* Tiêu đề — cùng kiểu tiêu đề mục trong bài: chữ màu mục, vạch trái */
.title{font-size:48px;font-weight:800;line-height:1.15;letter-spacing:-.01em;padding-left:20px;border-left:6px solid}
.logo{display:block;width:auto}
.logobox{background:#fff;border:1.5px solid ${RULE};border-radius:14px;height:76px;padding:0 22px;display:flex;align-items:center;flex:none}
.dot{border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
.card{border-radius:16px;border:1.5px solid ${RULE};background:#fff}
.num{font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.muted{color:${MUTED}}
.src{position:absolute;left:76px;bottom:30px;font-size:15px;color:${MUTED}}
/* Slide 1 */
.pair{display:flex;gap:64px;margin-top:44px;position:relative}
.pair .card{flex:1;padding:38px 42px;height:326px}
.pair .name{font-size:54px;font-weight:800;margin-top:24px;letter-spacing:-.01em}
.pair .line{font-size:24px;margin-top:40px;line-height:1.45;color:${TEXT}}
.and{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:86px;height:86px;font-weight:800;font-size:22px;color:#fff;background:${solid("amber")};box-shadow:0 0 0 8px rgb(250,250,252)}
/* Slide 2 */
.stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-top:48px}
.stats4 .card{padding:36px 16px;text-align:center;height:268px;background:${tint("red", .07)};border-color:${edge("red", .30)}}
.stats4 .card.hot{background:${tint("red", .14)};border-color:${edge("red", .50)}}
.stats4 .num{font-size:64px;color:${ink("red")}}
.stats4 .lab{font-size:23px;font-weight:700;margin-top:26px}
.stats4 .sub{font-size:18px;color:${MUTED};margin-top:10px;line-height:1.45}
.take{font-size:30px;margin-top:38px;line-height:1.35}
/* Slide 3 */
.hero{display:grid;grid-template-columns:1.35fr 1fr;gap:26px;margin-top:44px}
.hero .main{padding:44px 46px;height:330px;background:${tint("teal", .10)};border-color:${edge("teal", .40)}}
.hero .main .num{font-size:88px;color:${ink("teal")}}
.hero .side{display:flex;flex-direction:column;gap:22px}
.hero .side .card{padding:24px 28px;display:flex;align-items:center;gap:22px;flex:1}
.hero .side .num{font-size:44px;color:${ink("teal")}}
/* Slide 4 */
.why{display:grid;grid-template-columns:1.12fr .88fr;gap:44px}
.why .lines{font-size:30px;line-height:1.55;margin-top:20px;color:${TEXT}}
.why .q{font-size:128px;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin-top:14px;color:${ink("amber")}}
.task{padding:34px 34px;display:flex;flex-direction:column;height:600px;background:${tint("amber", .08)};border-color:${edge("amber", .45)}}
.task .row{display:flex;gap:18px;align-items:center;margin-top:22px}
.task .row b{font-size:24px;display:block;font-weight:700}
.task .row span{font-size:17px;color:${MUTED}}
.stem{font-size:21px;margin-top:26px;line-height:1.45;font-weight:500}
.timer{margin-top:auto;display:flex;align-items:center;gap:14px;background:#fff;border:1.5px solid ${edge("amber", .45)};border-radius:14px;padding:14px 18px}
.timer .t{font-size:46px;font-weight:800;color:${ink("amber")};min-width:118px;font-variant-numeric:tabular-nums}
.timer .t.low{color:${ink("red")}}
.timer button{font:inherit;font-size:17px;font-weight:700;border:0;border-radius:10px;padding:10px 14px;cursor:pointer;background:${ink("amber")};color:#fff;white-space:nowrap}
.timer button.ghost{background:transparent;color:${TEXT};border:1.5px solid ${RULE}}
.keep{position:absolute;left:76px;bottom:54px;font-size:21px;color:${MUTED};max-width:600px;line-height:1.45}
/* Slide 5 */
.flow{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-top:42px}
.flow .card{padding:30px 12px 22px;text-align:center;height:314px}
.flow .t{font-size:21px;font-weight:700;margin-top:22px;line-height:1.25}
.flow .d{font-size:17px;color:${MUTED};margin-top:12px;line-height:1.45}
/* Hộp chuyển ý — cùng kiểu hộp chú giải trong bài */
.callout{margin-top:28px;border-left:5px solid ${edge("amber", .6)};background:${tint("amber", .08)};border-radius:0 14px 14px 0;padding:18px 26px}
.callout .label{color:${ink("amber")};opacity:1;font-size:15px;font-weight:700}
.callout .body{font-size:25px;font-weight:600;margin-top:6px}
/* Điều khiển */
.hud{position:fixed;right:16px;bottom:12px;display:flex;align-items:center;gap:12px;z-index:5;opacity:.35;transition:opacity .25s}
.hud:hover{opacity:1}
.hud button{background:#fff;color:${TEXT};border:1px solid ${RULE};border-radius:999px;width:36px;height:36px;cursor:pointer;font-size:18px}
.dots{display:flex;gap:8px}
.dots i{width:10px;height:10px;border-radius:50%;background:rgba(127,127,127,.35);cursor:pointer;display:block}
.dots i.on{background:${solid("blue")}}
.hint{color:${MUTED};font-size:13px}
</style></head><body>
<div class="viewport"><div class="stage" id="stage">

<section class="slide on" data-n="1">
  <div class="label">Bài 1.6 · Toàn cảnh thị trường EdTech</div>
  <div class="title" style="margin-top:14px;color:${ink("blue")};border-color:${edge("blue", .55)}">Hai công ty, cùng một làn sóng</div>
  <div class="pair">
    <div class="card" style="background:${tint("red", .06)};border-color:${edge("red", .30)}"><img class="logo" src="${CHEGG}" alt="Chegg" style="height:84px;margin-top:14px"><div class="line">Sinh viên trả tiền thuê bao<br>để xem lời giải bài tập</div></div>
    <div class="dot and">và</div>
    <div class="card" style="background:${tint("teal", .06)};border-color:${edge("teal", .35)}"><img class="logo" src="${DUO}" alt="Duolingo" style="height:64px;margin-top:24px"><div class="line">Ứng dụng học ngoại ngữ<br>mỗi ngày một ít</div></div>
  </div>
  <div class="muted" style="font-size:25px;margin-top:34px">Cả hai đều bán thẳng cho người học.</div>
  <div class="src">Logo: Wikimedia Commons (Chegg logo.svg · Duolingo logo (2019).svg). Nhãn hiệu thuộc Chegg, Inc. và Duolingo, Inc.</div>
</section>

<section class="slide" data-n="2">
  <div style="display:flex;align-items:center;gap:22px"><div class="logobox"><img class="logo" src="${CHEGG}" alt="Chegg" style="height:46px"></div>
    <div class="title" style="color:${ink("red")};border-color:${edge("red", .55)}">Chegg · năm 2025</div></div>
  <div class="stats4">
    <div class="card"><div class="num">−31%</div><div class="lab">người đăng ký</div><div class="sub">quý 1/2025,<br>còn 3,2 triệu</div></div>
    <div class="card"><div class="num">−22%</div><div class="lab">nhân sự</div><div class="sub">đợt cắt<br>tháng 5/2025</div></div>
    <div class="card"><div class="num">−45%</div><div class="lab">nhân sự</div><div class="sub">đợt cắt<br>tháng 10/2025</div></div>
    <div class="card hot"><div class="num" style="font-size:54px">≈ −99%</div><div class="lab">giá cổ phiếu</div><div class="sub">so với đỉnh<br>năm 2021</div></div>
  </div>
  <div class="take"><b style="color:${ink("red")}">Hơn một nửa nhân sự</b> mất việc trong chưa đầy sáu tháng.</div>
  <div class="src">Nguồn: CNBC (10/2025); Higher Ed Dive (2025); Forbes (10/2025).</div>
</section>

<section class="slide" data-n="3">
  <div style="display:flex;align-items:center;gap:22px"><div class="logobox"><img class="logo" src="${DUO}" alt="Duolingo" style="height:36px"></div>
    <div class="title" style="color:${ink("teal")};border-color:${edge("teal", .55)}">Duolingo · cũng năm 2025</div></div>
  <div class="hero">
    <div class="card main"><div class="num">1,04 tỷ USD</div>
      <div style="font-size:31px;font-weight:700;margin-top:26px">doanh thu cả năm</div>
      <div class="muted" style="font-size:22px;margin-top:12px">tăng 39% · lần đầu tiên vượt mốc 1 tỷ USD</div></div>
    <div class="side">
      <div class="card">${circle("teal", 64, "FaUsers", 30)}
        <div><div class="num">52,7 triệu</div><div class="muted" style="font-size:18px;margin-top:8px">người học mỗi ngày (quý 4/2025)</div></div></div>
      <div class="card">${circle("teal", 64, "FaDollarSign", 28)}
        <div><div class="num">12,2 triệu</div><div class="muted" style="font-size:18px;margin-top:8px">thuê bao trả phí</div></div></div>
    </div>
  </div>
  <div class="take" style="font-size:28px;margin-top:32px"><b style="color:${ink("teal")}">Giữa đúng làn sóng AI ấy</b> — năm tăng trưởng mạnh nhất trong lịch sử công ty.</div>
  <div class="src">Nguồn: Duolingo, báo cáo kết quả quý 4 và cả năm 2025 (2/2026).</div>
</section>

<section class="slide" data-n="4">
  <div class="why">
    <div>
      <div class="label">Câu hỏi mở bài</div>
      <div style="display:flex;align-items:center;gap:18px;margin-top:18px">
        <div class="logobox" style="height:64px"><img class="logo" src="${CHEGG}" alt="Chegg" style="height:38px"></div>
        <span class="muted" style="font-size:22px;font-weight:600">và</span>
        <div class="logobox" style="height:64px"><img class="logo" src="${DUO}" alt="Duolingo" style="height:30px"></div>
      </div>
      <div class="lines">Cùng bán cho người học.<br>Cùng gặp AI tạo sinh.<br>Một bên sụp đổ, một bên tăng trưởng.</div>
      <div class="q">Vì sao?</div>
    </div>
    <div class="card task">
      <div class="label" style="color:${ink("amber")};opacity:1">Nhiệm vụ nhóm</div>
      <div class="row">${circle("amber", 58, "FaRegLightbulb", 28)}<div><b>3 giả thuyết</b><span>mỗi giả thuyết một dòng</span></div></div>
      <div class="row">${circle("amber", 58, "FaPeopleGroup", 28)}<div><b>Nhóm 4–5 người</b><span>viết chung một tờ giấy</span></div></div>
      <div class="row">${circle("amber", 58, "FaMobileScreenButton", 26)}<div><b>Không tra điện thoại</b><span>nghĩ trước khi biết số liệu</span></div></div>
      <div class="stem">Mẫu câu: <em>Chegg sụp còn Duolingo trụ được là vì…</em></div>
      <div class="timer">
        <div class="t" id="tval">4:00</div>
        <button id="tgo">Bắt đầu</button>
        <button class="ghost" id="treset">Đặt lại</button>
      </div>
    </div>
  </div>
  <div class="keep">Gấp tờ giấy lại, giữ cẩn thận — cuối buổi chúng ta mở ra kiểm.</div>
</section>

<section class="slide" data-n="5">
  <div class="title" style="color:${ink("violet")};border-color:${edge("violet", .55)}">Hôm nay: bốn chặng, hai lần làm nhóm</div>
  <div class="flow">
    ${[
      ["1", "Ba con số", "thị trường thế giới", false],
      ["2", "Năm câu chuyện", "Chegg, Duolingo và ba công ty khác", false],
      ["", "Làm nhóm", "mổ xẻ một mô hình EdTech", true],
      ["3", "Việt Nam", "dòng vốn và luật chơi mới", false],
      ["", "Làm nhóm", "bản ghi nhớ đầu tư", true],
      ["4", "Đọc số liệu", "và mở lại tờ giả thuyết", false],
    ].map(([k, t, d, g]) => {
      const h = g ? "teal" : "blue";
      const mark = g ? ic("FaPeopleGroup", "#fff", 36) : `<span style="font-size:30px;font-weight:800;color:#fff">${k}</span>`;
      return `<div class="card" style="background:${tint(h, .07)};border-color:${edge(h, .32)}">
        <div class="dot" style="width:74px;height:74px;margin:0 auto;background:${solid(h)}">${mark}</div>
        <div class="t" style="color:${ink(h)}">${t}</div><div class="d">${d}</div></div>`;
    }).join("")}
  </div>
  <div class="callout"><div class="label">Chuyển ý</div>
    <div class="body">Câu hỏi đầu tiên: thị trường công nghệ giáo dục thế giới lớn cỡ nào?</div></div>
</section>

</div></div>
<div class="hud" id="hud">
  <span class="hint">← → chuyển slide · F toàn màn hình</span>
  <button id="prev" aria-label="Slide trước">‹</button>
  <div class="dots" id="dots"></div>
  <button id="next" aria-label="Slide sau">›</button>
</div>
<script>
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide')), cur=0, stage=document.getElementById('stage');
  var dots=document.getElementById('dots');
  slides.forEach(function(_,i){var d=document.createElement('i');d.title='Slide '+(i+1);d.onclick=function(e){e.stopPropagation();go(i)};dots.appendChild(d)});
  function fit(){var s=Math.min(window.innerWidth/1320,window.innerHeight/760);stage.style.transform='scale('+s+')'}
  function go(i){cur=Math.max(0,Math.min(slides.length-1,i));slides.forEach(function(s,k){s.classList.toggle('on',k===cur)});
    [].forEach.call(dots.children,function(d,k){d.classList.toggle('on',k===cur)});
    try{history.replaceState(null,'','#'+(cur+1))}catch(e){}}
  window.addEventListener('resize',fit);fit();
  var start=parseInt((location.hash||'').slice(1),10);go(isNaN(start)?0:start-1);
  document.getElementById('prev').onclick=function(e){e.stopPropagation();this.blur();go(cur-1)};
  document.getElementById('next').onclick=function(e){e.stopPropagation();this.blur();go(cur+1)};
  document.addEventListener('keydown',function(e){
    // Nút vừa bấm vẫn giữ focus: phím cách/Enter sẽ vừa bấm lại nút vừa chuyển slide. Bỏ focus trước.
    if(document.activeElement&&document.activeElement.tagName==='BUTTON')document.activeElement.blur();
    if(['ArrowRight','PageDown',' ','Enter'].indexOf(e.key)>=0){e.preventDefault();go(cur+1)}
    else if(['ArrowLeft','PageUp','Backspace'].indexOf(e.key)>=0){e.preventDefault();go(cur-1)}
    else if(e.key==='Home')go(0); else if(e.key==='End')go(slides.length-1);
    else if(e.key==='f'||e.key==='F'){try{if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen()}catch(err){}}
  });
  document.querySelector('.viewport').addEventListener('click',function(e){
    if(e.target.closest('button,.timer,.hud'))return; go(e.clientX>window.innerWidth/2?cur+1:cur-1)});
  var left=240,timer=null,tv=document.getElementById('tval'),go_=document.getElementById('tgo');
  function draw(){var m=Math.floor(left/60),s=left%60;tv.textContent=left>0?m+':'+(s<10?'0':'')+s:'Hết giờ';tv.classList.toggle('low',left<=30)}
  function stop(){clearInterval(timer);timer=null;go_.textContent=left>0?'Tiếp tục':'Bắt đầu'}
  go_.onclick=function(e){e.stopPropagation();this.blur();if(timer){stop();return}if(left<=0)left=240;
    go_.textContent='Tạm dừng';timer=setInterval(function(){left--;draw();if(left<=0)stop()},1000)};
  document.getElementById('treset').onclick=function(e){e.stopPropagation();this.blur();stop();left=240;go_.textContent='Bắt đầu';draw()};
  draw();
})();
</script>
</body></html>`;
fs.writeFileSync(process.argv[2], html);
console.log("written", (html.length / 1024).toFixed(1) + " KB");
