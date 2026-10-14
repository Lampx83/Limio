/* ============ LIMIO DECK — shell.js ============ */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- key visual: quả chanh Limio (vector, chuyển động) ----------
   Deck.kv({mode:'solid'|'ghost', nodes:true|false, packets:true|false}) -> chuỗi SVG */
function kv(o){
  o=o||{};var id='k'+Math.random().toString(36).slice(2,7);
  var ghost=o.mode==='ghost',nodes=o.nodes!==false,packets=o.packets!==false&&nodes&&!reduce;
  var W='',B='',N='',L='',P='';
  var i,a,x,y;
  for(i=0;i<12;i++){a=i*Math.PI/6;
    W+='<line class="wedge" style="--i:'+i+'" x1="200" y1="200" x2="'+(200+150*Math.sin(a)).toFixed(1)+'" y2="'+(200-150*Math.cos(a)).toFixed(1)+'" stroke="'+(ghost?'#BEF264':'#84CC16')+'" stroke-opacity="'+(ghost?'.55':'1')+'" stroke-width="'+(ghost?3:5)+'" stroke-linecap="round" pathLength="160"/>';
    a=(i*30+15)*Math.PI/180;
    B+='<ellipse class="breathe" style="animation-delay:'+(i*0.35).toFixed(2)+'s" cx="'+(200+118*Math.sin(a)).toFixed(1)+'" cy="'+(200-118*Math.cos(a)).toFixed(1)+'" rx="10" ry="5" transform="rotate('+(i*30+15)+' '+(200+118*Math.sin(a)).toFixed(1)+' '+(200-118*Math.cos(a)).toFixed(1)+')" fill="'+(ghost?'#BEF264':'#D9F99D')+'" opacity="'+(ghost?'.28':'.7')+'"/>';
  }
  var pts=[];
  for(i=0;i<12;i++){a=(i*30+15)*Math.PI/180;var r=(i%2?112:76);x=+(200+r*Math.sin(a)).toFixed(1);y=+(200-r*Math.cos(a)).toFixed(1);pts.push([x,y]);
    N+='<circle class="ring" style="animation-delay:'+(i*0.55).toFixed(2)+'s" cx="'+x+'" cy="'+y+'" r="6" fill="none" stroke="url(#'+id+'n)" stroke-width="2"/>'+
       '<circle class="nd" style="animation-delay:'+(i*0.55).toFixed(2)+'s" cx="'+x+'" cy="'+y+'" r="'+(i%3===0?6:4.5)+'" fill="'+(i%4===1?'#EC4899':(ghost?'#BEF264':'#F7FEE7'))+'" stroke="'+(ghost?'#0B1A06':'#3F6212')+'" stroke-width="1.5"/>';
  }
  for(i=0;i<12;i++){var p=pts[i],q=pts[(i+1)%12],c=pts[(i+5)%12];
    L+='<line class="lnk" x1="'+p[0]+'" y1="'+p[1]+'" x2="'+q[0]+'" y2="'+q[1]+'" stroke="url(#'+id+'n)" stroke-width="1.6" opacity=".85"/>';
    if(i%3===0)L+='<line class="lnk" x1="'+p[0]+'" y1="'+p[1]+'" x2="'+c[0]+'" y2="'+c[1]+'" stroke="url(#'+id+'n)" stroke-width="1" opacity=".5"/>';
  }
  if(packets){var d='M'+pts.map(function(p){return p[0]+','+p[1]}).join(' L')+' Z';
    [0,8,16].forEach(function(b,k){P+='<circle r="'+(k?3:4)+'" fill="'+(k===1?'#EC4899':'#BEF264')+'"><animateMotion dur="26s" begin="'+b+'s" repeatCount="indefinite" path="'+d+'"/></circle>'});
  }
  var rind=ghost?'rgba(132,204,22,.22)':'url(#'+id+'r)';
  return '<svg class="kv" viewBox="0 0 400 400" role="img" aria-label="Biểu tượng quả chanh Limio">'+
  '<defs><linearGradient id="'+id+'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4D7C0F"/><stop offset="1" stop-color="#84CC16"/></linearGradient>'+
  '<radialGradient id="'+id+'p"><stop offset="0" stop-color="#F7FEE7"/><stop offset="1" stop-color="#D9F99D"/></radialGradient>'+
  '<linearGradient id="'+id+'n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A3E635"/><stop offset="1" stop-color="#F472B6"/></linearGradient>'+
  '<radialGradient id="'+id+'g"><stop offset=".55" stop-color="#EC4899" stop-opacity="0"/><stop offset="1" stop-color="#EC4899" stop-opacity=".28"/></radialGradient></defs>'+
  (ghost?'':'<circle class="glow" cx="200" cy="200" r="200" fill="url(#'+id+'g)"/>')+
  '<g class="orbit"><circle cx="200" cy="200" r="194" fill="none" stroke="#A3E635" stroke-opacity=".4" stroke-width="1.2" stroke-dasharray="2 9" stroke-linecap="round"/><circle cx="200" cy="6" r="5" fill="#EC4899"/></g>'+
  '<g class="orbit2"><circle cx="200" cy="200" r="186" fill="none" stroke="#BEF264" stroke-opacity=".25" stroke-width="1"/><circle cx="386" cy="200" r="3.5" fill="#BEF264"/></g>'+
  '<g class="spin"><circle cx="200" cy="200" r="178" fill="'+rind+'" '+(ghost?'stroke="#84CC16" stroke-opacity=".45" stroke-width="2"':'')+'/>'+
  '<circle cx="200" cy="200" r="166" fill="'+(ghost?'none':'#3F6212')+'" '+(ghost?'stroke="#BEF264" stroke-opacity=".25"':'')+'/>'+
  '<circle cx="200" cy="200" r="158" fill="'+(ghost?'rgba(190,242,100,.05)':'url(#'+id+'p)')+'"/>'+W+B+'</g>'+
  (nodes?'<g>'+L+N+P+'</g>':'')+
  '<circle class="breathe" cx="200" cy="200" r="9" fill="'+(ghost?'#BEF264':'#84CC16')+'"/></svg>';
}

/* ---------- đường lượn nền ("Flow") ---------- */
function flowSvg(){
  return '<svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="fg" x1="0" x2="1"><stop offset="0" stop-color="#84CC16"/><stop offset=".6" stop-color="#A3E635"/><stop offset="1" stop-color="#EC4899"/></linearGradient></defs>'+
  '<g stroke="url(#fg)"><path class="fa" opacity=".22" d="M-100 640 C 200 520, 420 760, 760 640 S 1300 520, 1700 650"/>'+
  '<path class="fb" opacity=".16" d="M-100 700 C 260 600, 460 820, 820 700 S 1340 600, 1700 720"/>'+
  '<path class="fc" opacity=".12" d="M-100 760 C 300 680, 520 860, 880 760 S 1380 680, 1700 790"/>'+
  '<path class="fb" opacity=".1" d="M-100 180 C 300 80, 560 260, 900 150 S 1400 60, 1700 170"/></g></svg>';
}

/* ---------- icon sprite ---------- */
var ICONS={book:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5v-17"/>',
live:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
exam:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
pen:'<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
route:'<path d="M8 19h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/><circle cx="6" cy="19" r="1.5"/><circle cx="18" cy="3" r="1.5"/>',
folder:'<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 21h8M10 17h4"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
server:'<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
building:'<path d="M4 21V5l8-2v18M12 9h8v12M4 21h16M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01"/>',
chart:'<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 4 5"/>',
spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
flow:'<path d="M3 8c3-4 6-4 9 0s6 4 9 0M3 16c3-4 6-4 9 0s6 4 9 0"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
layers:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
cpu:'<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
grad:'<path d="M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>',
msg:'<path d="M4 5h16v11H9l-5 4z"/>',
flask:'<path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3M7.5 15h9"/>',
eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',play:'<path d="M7 4l13 8-13 8z"/>',
left:'<path d="M15 5l-7 7 7 7"/>',right:'<path d="M9 5l7 7-7 7"/>',
notes:'<path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
mobile:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
refresh:'<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
scale:'<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
heart:'<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>'};
function sprite(){
  var s='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>';
  Object.keys(ICONS).forEach(function(k){s+='<symbol id="i-'+k+'" viewBox="0 0 24 24">'+ICONS[k]+'</symbol>'});
  return s+'</defs></svg>';
}
function icon(n,cls){return '<svg class="i '+(cls||'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>'}

/* ---------- engine ---------- */
var all=[],slides=[],aud='all',AUDS=[],idx=-1,handlers={},ctx=null,bc=null,t0=Date.now(),timerEl=null,tickId=null;
var FS=function(){return document.fullscreenElement};

function makeCtx(el,i){
  var timers=[],ints=[],offs=[];
  var c={root:el,index:i,id:el.id,
    timeout:function(fn,ms){var t=setTimeout(function(){if(c.alive)fn()},ms);timers.push(t);return t},
    interval:function(fn,ms){var t=setInterval(function(){if(c.alive)fn()},ms);ints.push(t);return t},
    on:function(target,ev,fn,opt){target.addEventListener(ev,fn,opt);offs.push(function(){target.removeEventListener(ev,fn,opt)})},
    alive:true,
    dispose:function(){c.alive=false;timers.forEach(clearTimeout);ints.forEach(clearInterval);offs.forEach(function(f){f()})}};
  return c;
}

function assignDelays(el){
  var items=$$('.rv',el);
  items.sort(function(a,b){var x=a.getAttribute('data-rv'),y=b.getAttribute('data-rv');
    if(x!==null&&y!==null)return (+x)-(+y);return 0});
  var n=items.length,step=Math.min(.34,5.2/Math.max(n,1));
  items.forEach(function(it,k){
    var o=it.getAttribute('data-rv');var order=(o!==null)?+o:k;
    it.style.setProperty('--rvd',(0.45+order*step).toFixed(2)+'s');
  });
}
function countUps(c){
  $$('[data-count]',c.root).forEach(function(el){
    var to=parseFloat(el.getAttribute('data-count')),dec=+(el.getAttribute('data-decimals')||0),
        pre=el.getAttribute('data-prefix')||'',suf=el.getAttribute('data-suffix')||'',
        delay=parseFloat(getComputedStyle(el).getPropertyValue('--rvd'))||(el.closest('.rv')?parseFloat(el.closest('.rv').style.getPropertyValue('--rvd')):0.6)||0.6;
    el.textContent=pre+(0).toFixed(dec)+suf;
    c.timeout(function(){var s=performance.now(),d=1600;
      (function f(t){if(!c.alive)return;var p=Math.min(1,(t-s)/d),e=1-Math.pow(1-p,3);
        el.textContent=pre+(to*e).toFixed(dec)+suf;if(p<1)requestAnimationFrame(f)})(s)},delay*1000+200);
  });
}
function renderKv(root){$$('[data-kv]',root).forEach(function(h){
  var o={};try{o=JSON.parse(h.getAttribute('data-kv')||'{}')}catch(e){}
  h.innerHTML=kv(o)})}

function show(n,opts){
  opts=opts||{};n=Math.max(0,Math.min(slides.length-1,n));
  if(n===idx)return;
  var prev=idx>=0?slides[idx]:null;
  if(ctx){var pc=ctx;pc.dispose();var h=handlers[prev.id];if(h&&h.leave){try{h.leave(pc)}catch(e){console.error(e)}}}
  if(prev){prev.classList.remove('active');prev.classList.add('leaving');(function(p){setTimeout(function(){p.classList.remove('leaving')},900)})(prev)}
  idx=n;var el=slides[n];
  el.classList.remove('leaving');
  assignDelays(el);renderKv(el);
  ctx=makeCtx(el,n);
  void el.offsetWidth;
  el.classList.add('active');
  el.scrollTop=0;var si=$('.slide-in',el);if(si)si.scrollTop=0;
  var hud=$('.hud'),foot=$('.foot'),light=el.classList.contains('tone-light');
  hud.classList.toggle('on-light',light);foot.classList.toggle('on-light',light);
  hud.classList.toggle('min',el.getAttribute('data-hud')==='min');
  $('.sect').textContent=el.getAttribute('data-section')||'';
  $('.count').textContent=(n+1)+' / '+slides.length;
  $('.progress i').style.width=((n+1)/slides.length*100)+'%';
  $('[data-act=prev]').disabled=n===0;$('[data-act=next]').disabled=n===slides.length-1;
  $$('.dots button').forEach(function(b,k){b.classList.toggle('on',k===n)});
  fillNotes();
  countUps(ctx);
  if(window.Deck){if(Deck._hook)Deck._hook(el);if(Deck.demos)Deck.demos(ctx)}
  var hh=handlers[el.id];if(hh&&hh.enter){try{hh.enter(ctx)}catch(e){console.error(e)}}
  try{history.replaceState(null,'',location.pathname+location.search+'#'+el.id)}catch(e){}
  if(opts.broadcast!==false&&bc){try{bc.postMessage({idx:n})}catch(e){}}
}
function next(){show(idx+1)}function prev(){show(idx-1)}

function fillNotes(){
  var el=slides[idx],nt=$('.notes',el),nx=slides[idx+1];
  $('#notes-body').innerHTML='<h5>'+(el.getAttribute('data-title')||'')+'</h5>'+(nt?nt.innerHTML:'<p>(Chưa có ghi chú)</p>')+
    (nx?'<hr style="border:0;border-top:1px solid rgba(190,242,100,.15);margin:1rem 0"><p style="opacity:.7;font-size:.85rem">Tiếp theo: <b>'+(nx.getAttribute('data-title')||'')+'</b></p>':'');
}
function togglePanel(id,force){
  var el=document.getElementById(id),open=force===undefined?!el.classList.contains('open'):force;
  ['notes','qa','jump'].forEach(function(k){if(k!==id){var e=document.getElementById(k);if(e)e.classList.remove('open')}});
  el.classList.toggle('open',open);
  $('[data-act=notes]').classList.toggle('on',id==='notes'&&open);
  $('[data-act=qa]').classList.toggle('on',id==='qa'&&open);
}
function toggleJump(force){var el=document.getElementById('jump');if(!el)return;var open=force===undefined?!el.classList.contains('open'):force;['notes','qa'].forEach(function(k){document.getElementById(k).classList.remove('open')});el.classList.toggle('open',open);var b=$('[data-act=jump]');if(b)b.classList.toggle('on',open)}
function toggleOverview(force){
  var o=$('#overview'),open=force===undefined?!o.classList.contains('open'):force;
  o.classList.toggle('open',open);
  $$('#overview button.t').forEach(function(b,k){b.classList.toggle('on',k===idx)});
}
function fullscreen(){
  try{if(FS()){document.exitFullscreen()}else{var p=document.documentElement.requestFullscreen();if(p&&p.catch)p.catch(function(){})}}catch(e){}
}

/* tabs: Deck.tabs(ctx, tabsEl, {auto:ms, panelsRoot, onChange}) — tự xoay vòng, người xem bấm là dừng */
function tabs(c,bar,o){
  o=o||{};var btns=$$('[data-tab]',bar),root=o.panelsRoot||c.root,cur=-1,stopped=false;
  var prog=$('.tab-progress',bar);
  function set(i,byUser){
    if(i===cur)return;cur=i;
    btns.forEach(function(b,k){b.classList.toggle('on',k===i)});
    var key=btns[i].getAttribute('data-tab');
    $$('[data-panel]',root).forEach(function(p){p.classList.toggle('on',p.getAttribute('data-panel')===key)});
    if(prog&&btns[i]){prog.style.transition='none';prog.style.width='0';prog.style.left=btns[i].offsetLeft+'px';
      if(!stopped&&o.auto){void prog.offsetWidth;prog.style.transition='width '+o.auto+'ms linear';prog.style.width=btns[i].offsetWidth+'px'}}
    if(o.onChange)o.onChange(i,key,byUser);
  }
  btns.forEach(function(b,k){c.on(b,'click',function(){stopped=true;if(prog)prog.style.width='0';set(k,true)})});
  set(0);
  if(o.auto){c.interval(function(){if(stopped||document.hidden)return;set((cur+1)%btns.length);},o.auto)}
  return {set:function(i){set(i,true)},stop:function(){stopped=true}};
}

function audObj(k){for(var i=0;i<AUDS.length;i++)if(AUDS[i].k===k)return AUDS[i];return AUDS[0]}
function indexById(id){for(var i=0;i<slides.length;i++)if(slides[i].id===id)return i;return -1}
function applyAudience(k){
  aud=k;var a=audObj(k),byId={};all.forEach(function(x){byId[x.id]=x});
  slides=a.o.filter(function(id){return byId[id]}).map(function(id){return byId[id]});
  all.forEach(function(x){if(slides.indexOf(x)<0){x.classList.remove('active','leaving')}});
  var d=$('.dots'),og=$('#overview .grid');d.innerHTML='';og.innerHTML='';
  slides.forEach(function(s,i){
    var b=document.createElement('button');b.setAttribute('aria-label','Slide '+(i+1));b.addEventListener('click',function(){show(i)});d.appendChild(b);
    var t=document.createElement('button');t.className='t';
    t.innerHTML='<span class="n">'+String(i+1).padStart(2,'0')+'</span><span class="tt">'+(s.getAttribute('data-title')||'')+'</span><span class="ss">'+(s.getAttribute('data-section')||'')+'</span>';
    t.addEventListener('click',function(){toggleOverview(false);show(i)});og.appendChild(t);
  });
  try{localStorage.setItem('limio-deck-aud',k)}catch(e){}
}
function setAudience(k,o){
  o=o||{};var cur=idx>=0&&slides[idx]?slides[idx].id:null;
  if(ctx){ctx.dispose();var ph=cur&&handlers[cur];if(ph&&ph.leave){try{ph.leave(ctx)}catch(e){}}ctx=null}
  if(cur){var ce=document.getElementById(cur);ce.classList.remove('active');ce.classList.remove('leaving')}
  applyAudience(k);idx=-1;
  var target=0;
  if(o.advance){target=Math.min(1,slides.length-1)}else if(cur){var j=indexById(cur);target=j>=0?j:0}
  show(target,{broadcast:false});
  if(bc){try{bc.postMessage({aud:k,idx:target})}catch(e){}}
  buildAudUI();updateAudBtn();
  $('#audmodal').classList.remove('open');
  $$('[data-audpick]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-audpick')===k)});
}
function updateAudBtn(){var b=$('[data-act=aud] .lbl');if(b)b.textContent=audObj(aud).n}
function buildAudUI(){
  var g=$('#audmodal .grid');if(!g)return;g.innerHTML='';
  AUDS.forEach(function(a){
    var b=document.createElement('button');b.className='aud'+(a.k===aud?' on':'');
    b.innerHTML='<span class="ico"><svg class="i"><use href="#i-'+a.i+'"/></svg></span><span class="tt">'+a.n+'</span><span class="dd">'+a.d+'</span><span class="cnt">'+audObj(a.k).o.filter(function(id){return all.some(function(x){return x.id===id})}).length+' slide</span>';
    b.addEventListener('click',function(){setAudience(a.k,{advance:idx<=0})});g.appendChild(b);
  });
}
function toggleAud(force){var m=$('#audmodal'),o=force===undefined?!m.classList.contains('open'):force;m.classList.toggle('open',o);if(o)buildAudUI()}

function init(){
  document.body.insertAdjacentHTML('afterbegin',sprite());
  all=$$('.slide');
  all.forEach(function(s){
    var f=document.createElement('div');f.className='flow';f.innerHTML=flowSvg();s.insertBefore(f,s.firstChild);
  });
  AUDS=[
   {k:'all',n:'Tổng quan đầy đủ',d:'Bản chung cho mọi người nghe',i:'layers',o:['s01','s07','s02','s03','s04','s05','s06','s08','s09','s10','s11','s12','s20','s13','s14']},
   {k:'lead',n:'Lãnh đạo nhà trường',d:'Giá trị, dữ liệu, triển khai',i:'building',o:['s01','s02','s03','s15','s04','s20','s05','s11','s12','s13','s14']},
   {k:'teacher',n:'Giảng viên',d:'Dạy, tương tác, thi, chấm',i:'grad',o:['s01','s02','s16','s04','s20','s06','s10','s09','s13','s14']},
   {k:'student',n:'Sinh viên',d:'Học, phản hồi, lộ trình',i:'user',o:['s01','s17','s10','s06','s09','s20','s13','s14']},
   {k:'investor',n:'Nhà đầu tư, đối tác',d:'Khác biệt, hiện trạng, hợp tác',i:'chart',o:['s01','s02','s03','s18','s04','s05','s19','s13','s14']},
   {k:'scientist',n:'Nhà khoa học',d:'Mô hình, cơ sở khoa học, đo lường',i:'flask',o:['s01','s07','s02','s04','s05','s06','s08','s09','s12','s13','s14']}
  ];
  var saved='';try{saved=localStorage.getItem('limio-deck-aud')||''}catch(e){}
  applyAudience(AUDS.some(function(a){return a.k===saved})?saved:'all');
  $('.brand .kv-slot').innerHTML=kv({nodes:false});
  document.documentElement.classList.add('deck-ready');
  // controls
  document.addEventListener('click',function(e){
    var a=e.target.closest('[data-act]');
    if(a){var k=a.getAttribute('data-act');
      if(k==='next')next();else if(k==='prev')prev();else if(k==='notes')togglePanel('notes');else if(k==='qa')togglePanel('qa');
      else if(k==='overview')toggleOverview();else if(k==='aud')toggleAud();else if(k==='jump')toggleJump();else if(k==='full')fullscreen();else if(k==='close')a.closest('.drawer')&&a.closest('.drawer').classList.remove('open');
      $$('.tools button').forEach(function(b){b.blur()});return}
    var im=e.target.closest('img[data-zoom],.frame img');
    if(im){$('#zoom img').src=im.src;$('#zoom').classList.add('open');return}
    if(e.target.closest('#zoom')){$('#zoom').classList.remove('open')}
  });
  document.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    var tg=e.target&&e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
    var k=e.key;
    if(k==='Escape'){toggleAud(false);toggleOverview(false);toggleJump(false);togglePanel('notes',false);togglePanel('qa',false);$('#zoom').classList.remove('open');return}
    if(k==='ArrowRight'||k==='PageDown'||k===' '&&tg!=='BUTTON'){e.preventDefault();next()}
    else if(k==='ArrowLeft'||k==='PageUp'){e.preventDefault();prev()}
    else if(k==='Home')show(0);else if(k==='End')show(slides.length-1);
    else if(k==='n'||k==='N')togglePanel('notes');else if(k==='q'||k==='Q')togglePanel('qa');
    else if(k==='o'||k==='O')toggleOverview();else if(k==='a'||k==='A')toggleAud();else if(k==='j'||k==='J')toggleJump();else if(k==='f'||k==='F')fullscreen();
  });
  var sx=0,sy=0;
  document.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
  document.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){dx<0?next():prev()}},{passive:true});
  // đồng bộ giữa hai tab (một tab chiếu, một tab xem ghi chú)
  try{bc=new BroadcastChannel('limio-deck');bc.onmessage=function(m){if(m.data&&m.data.aud&&m.data.aud!==aud){applyAudience(m.data.aud);idx=-1;show(m.data.idx||0,{broadcast:false});buildAudUI();updateAudBtn()}else if(m.data&&typeof m.data.idx==='number')show(m.data.idx,{broadcast:false})}}catch(e){bc=null}
  // bộ đếm thời gian
  timerEl=$('#timer');
  tickId=setInterval(function(){var s=Math.floor((Date.now()-t0)/1000);timerEl.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000);
  $('#timer-reset').addEventListener('click',function(){t0=Date.now()});
  var h=(location.hash||'').replace('#',''),start=0;
  var hi=indexById(h);
  if(hi<0&&all.some(function(x){return x.id===h})){applyAudience('all');hi=indexById(h)}
  if(hi>=0)start=hi;
  show(start,{broadcast:false});
  buildAudUI();updateAudBtn();
}

window.Deck={kv:kv,icon:icon,tabs:tabs,aud:function(){return aud},audiences:function(){return AUDS},setAudience:setAudience,toggleAud:toggleAud,
  on:function(id,h){handlers[id]=h; if(ctx&&ctx.id===id&&h.enter){try{h.enter(ctx)}catch(e){console.error(e)}}},
  next:next,prev:prev,go:show,reduce:reduce};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
