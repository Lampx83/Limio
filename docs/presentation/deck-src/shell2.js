/* ============ shell2.js — QR, trang demo thật, công cụ trình bày, demo động ============ */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function lget(k,d){try{return localStorage.getItem(k)||d}catch(e){return d}}
function lset(k,v){try{localStorage.setItem(k,v)}catch(e){}}

/* ---------- địa chỉ hệ thống thật dùng cho nút "Mở trang thật" ---------- */
var PROD=/(^|\.)limio\.vn$|(^|\.)limio\.hust\.edu\.vn$/.test(location.hostname);
var BASE=PROD?location.origin:lget('limio-demo-base','https://limio.vn');
var JUMP=[
 {g:'Giảng viên',l:[
  ['Bảng điều khiển','/instructor/dashboard','Việc cần xử lý gấp, lịch tuần'],
  ['Khoá học của tôi','/instructor/courses','Soạn và quản lý khoá học'],
  ['Limio-Live','/instructor/limio-live','Bài giảng tương tác trực tiếp'],
  ['Công cụ tương tác nhanh','/instructor/teaching-tools','Vote, Word Cloud, Padlet…'],
  ['Kiểm tra đánh giá','/instructor/assessment','Ngân hàng → Đề thi → Tổ chức thi'],
  ['Ngân hàng câu hỏi','/instructor/question-banks',''],
  ['Phòng vấn đáp AI','/instructor/oral-exams','Thi vấn đáp có AI hỗ trợ'],
  ['Chấm bài tự luận','/instructor/grade-essays','AI gợi ý, giảng viên quyết định'],
  ['Giải đấu (Đấu trường)','/instructor/tournaments',''],
  ['Phân tích người học','/instructor/learner-insights','Ai đang hiểu gì, ai đang im lặng']]},
 {g:'Người học',l:[
  ['Không gian người học','/me/dashboard','Khoá học, lịch, tiến độ'],
  ['Kỹ năng của tôi','/me/skills','Mức nắm vững theo chủ đề'],
  ['Huy hiệu','/me/badges',''],
  ['e-Portfolio','/me/portfolio','Hồ sơ năng lực tích luỹ'],
  ['Bảng xếp hạng','/leaderboard',''],
  ['Đấu trường','/tournaments',''],
  ['Catalog khoá học','/catalog','Xem khoá học công khai'],
  ['Cách tính điểm XP','/xp-guide','']]}
];
var SLIDE_LINK={ s03:['/instructor/dashboard','Mở bảng điều khiển'], s04:['/instructor/dashboard','Mở giao diện giảng viên'],
 s06:['/me/skills','Mở trang Kỹ năng'], s09:['/leaderboard','Mở bảng xếp hạng'], s10:['/me/dashboard','Mở không gian người học'],
 s13:['/instructor/dashboard','Bắt đầu demo'], s15:['/instructor/dashboard','Mở bảng điều khiển'], s16:['/instructor/limio-live','Mở Limio-Live'],
 s17:['/me/dashboard','Mở không gian người học'], s20:['/instructor/limio-live','Mở Limio-Live thật'] };
function href(p){return BASE.replace(/\/+$/,'')+p}
function buildJump(){
  var b=$('#jump-body');if(!b)return;var h='<div class="pfbox"><button id="pf-run" class="pfbtn">Kiểm tra trước giờ G</button><div id="preflight"></div></div>';
  JUMP.forEach(function(g){h+='<h6>'+g.g+'</h6>';g.l.forEach(function(x){h+='<a class="j" target="_blank" rel="noopener" href="'+href(x[1])+'"><span>'+x[0]+(x[2]?'<small>'+x[2]+'</small>':'')+'</span><svg class="i"><use href="#i-arrow"/></svg></a>'})});
  h+='<h6>Địa chỉ hệ thống</h6><div class="base"><input id="demo-base" value="'+BASE+'" aria-label="Địa chỉ hệ thống"><button id="demo-base-save">Lưu</button></div><p style="font-size:.8rem;color:#9DB090;margin:.5rem 0 0">Mặc định https://limio.vn. Có thể đổi sang limio.hust.edu.vn hoặc máy chủ cục bộ.</p>';
  b.innerHTML=h;
  var pb=$('#pf-run');if(pb){pb.addEventListener('click',preflight)}
  var sv=$('#demo-base-save');sv.addEventListener('click',function(){var v=$('#demo-base').value.trim();if(/^https?:\/\//.test(v)){BASE=v;lset('limio-demo-base',v);buildJump();toast('Đã lưu địa chỉ hệ thống')}else toast('Địa chỉ phải bắt đầu bằng http(s)://')});
  $('#demo-base').addEventListener('keydown',function(e){e.stopPropagation()});
}
function toast(msg){var t=$('#toast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(function(){t.hidden=true},2200)}

/* ---------- QR: <div data-qr="https://…" data-qr-size="128"> hoặc data-qr="@self" ---------- */
function qrs(root){
  $$('[data-qr]',root).forEach(function(el){
    var url=el.getAttribute('data-qr');if(url==='https://limio.vn')url=BASE;if(url==='@self')url=location.origin+location.pathname;
    else if(url.charAt(0)==='/')url=href(url);
    var sz=+(el.getAttribute('data-qr-size')||128);
    if(el.getAttribute('data-qr-done')===url)return;
    el.innerHTML='';el.style.width=sz+'px';el.style.height=sz+'px';
    try{ if(window.QRCode){ new QRCode(el,{text:url,width:sz*2,height:sz*2,colorDark:'#0B1A06',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M}); var cv=el.querySelector('canvas,img'); if(cv){cv.style.width='100%';cv.style.height='100%'} el.setAttribute('data-qr-done',url)} else {el.textContent=url.replace(/^https?:\/\//,'');el.style.fontSize='.8rem'} }catch(e){el.textContent=url}
  });
}

/* ---------- hook theo slide ---------- */
var lk=null;
function hostify(root){var h=BASE.replace(/^https?:\/\//,'').replace(/\/+$/,'');$$('[data-host]',root).forEach(function(e){e.textContent=h});$$('a[data-baselink]',root).forEach(function(a){a.href=BASE})}
function onSlide(el){
  var a=$('#openreal'),m=SLIDE_LINK[el.id];
  if(m){a.href=href(m[0]);a.querySelector('span').textContent=m[1]+' ↗';a.hidden=false}else a.hidden=true;
  qrs(el);hostify(el);clearPen();
}

/* ---------- công cụ trình bày: laser (L), bút (P), tiêu điểm (S), xoá (C) ---------- */
var mode=null,raf=0,mx=0,my=0,pen=null,pctx=null,drawing=false,last=null;
function setMode(m){
  if(mode===m)m=null;mode=m;
  var L=$('#laser'),S=$('#spot'),P=$('#pen');
  L.hidden=m!=='laser';S.hidden=m!=='spot';P.hidden=m!=='pen';
  document.body.classList.toggle('laser-on',m==='laser');
  if(m==='pen')sizePen();
  toast(m==='laser'?'Con trỏ laser — L để tắt':m==='spot'?'Tiêu điểm — S để tắt':m==='pen'?'Bút vẽ — C xoá nét, P để tắt':'Đã tắt công cụ');
}
function sizePen(){pen=$('#pen');var d=window.devicePixelRatio||1;pen.width=innerWidth*d;pen.height=innerHeight*d;pctx=pen.getContext('2d');pctx.scale(d,d);pctx.lineCap='round';pctx.lineJoin='round';pctx.lineWidth=5;pctx.strokeStyle='#F9A8D4';pctx.shadowColor='rgba(244,114,182,.7)';pctx.shadowBlur=8}
function clearPen(){if(pctx){pctx.clearRect(0,0,innerWidth,innerHeight)}}
function frame(){raf=0;
  if(mode==='laser'){var L=$('#laser');L.style.transform='translate3d('+mx+'px,'+my+'px,0)'}
  else if(mode==='spot'){var S=$('#spot');S.style.setProperty('--sx',mx+'px');S.style.setProperty('--sy',my+'px')}
}
window.addEventListener('pointermove',function(e){mx=e.clientX;my=e.clientY;
  if(mode==='laser'||mode==='spot'){if(!raf)raf=requestAnimationFrame(frame)}
  if(mode==='pen'&&drawing&&pctx){pctx.beginPath();pctx.moveTo(last[0],last[1]);pctx.lineTo(e.clientX,e.clientY);pctx.stroke();last=[e.clientX,e.clientY]}
},{passive:true});
window.addEventListener('pointerdown',function(e){if(mode==='pen'&&e.target.id==='pen'){drawing=true;last=[e.clientX,e.clientY]}});
window.addEventListener('pointerup',function(){drawing=false});
window.addEventListener('resize',function(){if(mode==='pen'){sizePen()}});
window.addEventListener('keydown',function(e){
  if(e.metaKey||e.ctrlKey||e.altKey)return;var tg=e.target&&e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
  var k=e.key.toLowerCase();
  if(k==='l')setMode('laser');else if(k==='p')setMode('pen');else if(k==='s')setMode('spot');else if(k==='c'){clearPen()}
  else if(e.key==='Escape'&&mode)setMode(mode);
});

/* ---------- demo động: ảnh giao diện chuyển động như video ----------
   <div class="demo" data-src="img/ui1.jpg" data-url="limio.vn/instructor/dashboard" data-video="video/dashboard.mp4"
        data-steps='[{"x":30,"y":40,"z":2,"cx":28,"cy":38,"click":1,"hl":[10,30,40,20],"t":"Chú thích","d":3600}]'></div>
   x,y = tâm vùng phóng (% theo ảnh); z = độ phóng; cx,cy = vị trí con trỏ (%); hl=[x,y,w,h] vùng nhấn (%). */
var CUR='<svg viewBox="0 0 26 26"><path d="M3 2l17 8-7 2.2L10.2 20z" fill="#fff" stroke="#0B1A06" stroke-width="1.6" stroke-linejoin="round"/></svg>';
function Demo(c,el){
  var self=this;this.c=c;this.el=el;this.i=-1;this.run=false;this.paused=false;this.timer=0;this.destroyed=false;
  var src=el.getAttribute('data-src'),steps=[];try{steps=JSON.parse(el.getAttribute('data-steps')||'[]')}catch(e){}
  this.steps=steps;this.url=el.getAttribute('data-url')||'limio.vn';
  el.innerHTML='<div class="demo-bar"><i></i><i></i><i></i><span></span><b>Demo</b></div><div class="demo-vp"><div class="demo-stage"><img alt="" draggable="false"><div class="demo-hl"></div><div class="demo-cur">'+CUR+'</div><div class="demo-rip"></div></div><div class="demo-cap"></div><div class="demo-dots"></div><button class="demo-zoom" aria-label="Phóng to ảnh"><svg class="i"><use href="#i-full"/></svg></button></div>';
  el.querySelector('.demo-bar span').textContent=this.url;
  this.vp=el.querySelector('.demo-vp');this.stage=el.querySelector('.demo-stage');this.img=el.querySelector('img');
  this.hl=el.querySelector('.demo-hl');this.cur=el.querySelector('.demo-cur');this.rip=el.querySelector('.demo-rip');this.cap=el.querySelector('.demo-cap');
  this.dots=el.querySelector('.demo-dots');
  var alt=el.getAttribute('data-alt')||'';this.img.alt=alt;
  this.img.onload=function(){self.vp.style.setProperty('--ar',(self.img.naturalWidth/self.img.naturalHeight).toFixed(4))};
  this.img.src=src;
  steps.forEach(function(s,k){var b=document.createElement('button');b.setAttribute('aria-label','Bước '+(k+1));b.addEventListener('click',function(e){e.stopPropagation();self.go(k,true)});self.dots.appendChild(b)});
  this.vp.addEventListener('click',function(){self.paused=!self.paused;if(!self.paused)self.next()});
  el.querySelector('.demo-zoom').addEventListener('click',function(e){e.stopPropagation();$('#zoom img').src=self.img.src;$('#zoom').classList.add('open')});
  var vid=el.getAttribute('data-video');
  if(vid&&window.fetch){fetch(vid,{method:'HEAD'}).then(function(r){if(r.ok&&!self.destroyed){var v=document.createElement('video');v.src=vid;v.muted=true;v.loop=true;v.playsInline=true;v.autoplay=true;v.setAttribute('playsinline','');self.vp.appendChild(v);self.stage.style.display='none';self.cap.style.display='none';self.dots.style.display='none';self.isVideo=true;self.stop();v.play&&v.play().catch(function(){})}}).catch(function(){})}
}
Demo.prototype.view=function(x,y,z){
  var W=this.vp.clientWidth,H=this.vp.clientHeight;if(!W)return;
  var tx=Math.min(0,Math.max(W-W*z,W/2-x/100*W*z)),ty=Math.min(0,Math.max(H-H*z,H/2-y/100*H*z));
  this.stage.style.setProperty('--z',z);
  this.stage.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+z+')';
};
Demo.prototype.go=function(k,manual){
  clearTimeout(this.timer);if(!this.run||this.isVideo)return;
  var n=this.steps.length;if(!n)return;
  if(manual)this.paused=true;
  this.i=k;var s=this.steps[k]||{},z=s.z||1;
  var els=[this.cap,this.hl];
  this.view(s.x==null?50:s.x,s.y==null?50:s.y,z);
  if(s.cx!=null){this.cur.style.left=s.cx+'%';this.cur.style.top=s.cy+'%'}
  var self=this;
  this.cap.classList.remove('on');
  if(s.hl){this.hl.style.left=s.hl[0]+'%';this.hl.style.top=s.hl[1]+'%';this.hl.style.width=s.hl[2]+'%';this.hl.style.height=s.hl[3]+'%';this.hl.classList.add('on')}else this.hl.classList.remove('on');
  setTimeout(function(){if(!self.run)return;if(s.t){self.cap.textContent=s.t;self.cap.classList.add('on')}},700);
  if(s.click){setTimeout(function(){if(!self.run)return;self.rip.style.left=s.cx+'%';self.rip.style.top=s.cy+'%';self.rip.classList.remove('go');void self.rip.offsetWidth;self.rip.classList.add('go')},1500)}
  $$('button',this.dots).forEach(function(b,j){b.classList.toggle('on',j===k)});
  if(!this.paused)this.timer=setTimeout(function(){self.next()},(s.d||3600)+1700);
};
Demo.prototype.next=function(){this.go((this.i+1)%this.steps.length)};
Demo.prototype.start=function(){if(this.run)return;this.run=true;this.i=-1;var s0=this.steps[0];
  this.stage.style.transition='none';this.view(50,50,1);void this.stage.offsetWidth;this.stage.style.transition='';
  var self=this;this.timer=setTimeout(function(){self.go(0)},900)};
Demo.prototype.stop=function(){this.run=false;clearTimeout(this.timer);this.hl.classList.remove('on');this.cap.classList.remove('on')};
Demo.prototype.destroy=function(){this.destroyed=true;this.stop()};

var live=[];
function demos(c){
  live.forEach(function(d){d.destroy()});live=[];
  $$('.demo[data-src]',c.root).forEach(function(el){live.push(new Demo(c,el))});
  if(!live.length)return;
  c.interval(function(){
    live.forEach(function(d){
      var vis=d.el.offsetWidth>0&&d.el.offsetParent!==null&&d.vp.clientWidth>0;
      if(vis&&!d.run&&!d.isVideo)d.start();else if(!vis&&d.run)d.stop();
    });
  },500);
  // chạy ngay nếu đã hiển thị
  setTimeout(function(){live.forEach(function(d){if(d.el.offsetWidth>0&&!d.run&&!d.isVideo)d.start()})},300);
}

document.addEventListener('click',function(e){var g=e.target.closest&&e.target.closest('[data-go]');if(g&&!e.target.closest('a,button')){var a=document.createElement('a');a.href=href(g.getAttribute('data-go'));a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}});

/* ---------- Kiểm tra trước giờ G ---------- */
function preflight(){
  var box=$('#preflight');if(!box)return;box.innerHTML='<p style="margin:.2rem 0 .6rem;color:#9DB090;font-size:.85rem">Đang kiểm tra…</p>';
  var rows=[];
  function add(ok,label,hint){rows.push([ok,label,hint])}
  function show(){box.innerHTML=rows.map(function(r){var c=r[0]===true?'#A3E635':r[0]==='warn'?'#F8B324':'#F472B6';return '<div class="pf"><i style="background:'+c+'"></i><span>'+r[1]+(r[2]?'<small>'+r[2]+'</small>':'')+'</span></div>'}).join('')}
  add(navigator.onLine,'Kết nối mạng',navigator.onLine?'':'Mất mạng: các demo động vẫn chạy, trang thật thì không');
  add(innerWidth>=1100&&innerHeight>=600,'Kích thước cửa sổ '+innerWidth+'×'+innerHeight,innerWidth>=1100?'':'Nên dùng cửa sổ lớn hơn / toàn màn hình (F)');
  add(!!document.fullscreenEnabled,'Chế độ toàn màn hình','');
  add(!!window.QRCode,'Thư viện mã QR (nhúng sẵn)','');
  var bc=false;try{bc=!!window.BroadcastChannel}catch(e){}add(bc?true:'warn','Đồng bộ hai tab (ghi chú)',bc?'':'Trình duyệt không hỗ trợ');
  var ls=false;try{localStorage.setItem('x','1');localStorage.removeItem('x');ls=true}catch(e){}add(ls?true:'warn','Lưu lựa chọn đối tượng',ls?'':'Bị chặn, sẽ không nhớ lần sau');
  var f=false;try{f=document.fonts&&document.fonts.check('600 16px Inter')}catch(e){}add(f?true:'warn','Font Inter',f?'':'Chưa tải được, dùng font hệ thống (vẫn đọc tốt)');
  show();
  var done=false;
  var t=setTimeout(function(){if(!done){done=true;rows.push([false,'Truy cập '+BASE,'Không phản hồi sau 5 giây: kiểm tra mạng / VPN / tên miền']);show()}},5000);
  fetch(BASE.replace(/\/+$/,'')+'/favicon.svg?x='+Date.now(),{mode:'no-cors',cache:'no-store'}).then(function(){if(!done){done=true;clearTimeout(t);rows.push([true,'Truy cập '+BASE,'Hệ thống phản hồi']);show()}}).catch(function(){if(!done){done=true;clearTimeout(t);rows.push([false,'Truy cập '+BASE,'Không kết nối được']);show()}});
}

function init(){
  buildJump();
  Deck.base=function(){return BASE};Deck._hook=onSlide;Deck.demos=demos;Deck.qr=qrs;Deck.toast=toast;Deck.toggleJump=function(){};
  var cur=document.querySelector('.slide.active');if(cur)onSlide(cur);
  // chọn đối tượng ngay trên slide mở đầu
  $$('[data-audpick-host]').forEach(function(h){
    h.innerHTML='<span class="lead2">Bạn đang trình bày cho ai?</span>';
    Deck.audiences().forEach(function(a){var b=document.createElement('button');b.setAttribute('data-audpick',a.k);b.className=a.k===Deck.aud()?'on':'';b.innerHTML='<svg class="i"><use href="#i-'+a.i+'"/></svg>'+a.n;b.addEventListener('click',function(){Deck.setAudience(a.k,{advance:true})});h.appendChild(b)});
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0)});else setTimeout(init,0);
})();
