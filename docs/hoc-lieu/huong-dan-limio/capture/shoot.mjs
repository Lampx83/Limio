/**
 * Chụp ảnh giao diện thật cho khoá "Hướng dẫn sử dụng Limio".
 *
 * Dùng Chrome đã cài sẵn, điều khiển qua giao thức gỡ lỗi (không tải thêm gì).
 * Mỗi ảnh khai báo trong shots.mjs; số đánh dấu được vẽ lên đúng phần tử rồi chụp.
 *
 *   DEMO_EMAIL=... DEMO_PASSWORD=... node shoot.mjs [tên-ảnh ...]
 *
 * Mặc định chụp từ http://localhost:3000, lưu vào apps/web/public/huong-dan-limio/.
 * Chỉ chạy với tài khoản MẪU (xem packages/db/src/seed-demo-instructor.ts).
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : resolve(HERE, "../../../../apps/web/public/huong-dan-limio");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PORT = 9300 + Math.floor(Math.random() * 600);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1360, height = 860 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "limio-shot-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${dir}`,
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-gpu",
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const dbg = (m) => process.env.DEBUG && console.log("  ·", m);
  dbg("chrome spawned");
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await sleep(200);
  }
  dbg("targets: " + JSON.stringify((targets || []).map((t) => t.type + ":" + String(t.url).slice(0, 40))));
  const page = targets.find((t) => t.type === "page" && t.url === "about:blank") ?? targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  dbg("ws open");
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable"); dbg("Page.enable ok");
  await send("Runtime.enable"); dbg("Runtime.enable ok");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
  dbg("emulation ok");

  const api = {
    send,
    sleep,
    async eval(expr) {
      if (process.env.DEBUG) console.log("  eval:", expr.replace(/\s+/g, " ").slice(0, 70));
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval lỗi");
      return r.result.value;
    },
    async goto(path) {
      dbg("navigate " + path);
      await send("Page.navigate", { url: path.startsWith("http") ? path : BASE + path });
      dbg("navigate sent");
      await sleep(600);
      for (let i = 0; i < 60; i++) {
        if ((await api.eval("document.readyState")) === "complete") break;
        await sleep(200);
      }
      await sleep(900);
    },
    async resize(w, h) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: false });
      await sleep(300);
    },
    /** Bấm phần tử đầu tiên có chữ khớp (tìm trong button, a, [role=…], div có onclick). */
    async clickText(text, scope = "body", idx = 0) {
      const ok = await api.eval(`(() => {
        const root = document.querySelector(${JSON.stringify(scope)}) || document.body;
        const els = [...root.querySelectorAll('button,a,[role=button],[role=tab],[role=menuitem],label,summary,li,span,div')];
        const t = ${JSON.stringify(text)};
        const exact = els.filter(e => e.children.length < 4 && e.textContent.trim() === t);
        const loose = els.filter(e => e.children.length < 4 && e.textContent.trim().startsWith(t));
        const el = (exact.length ? exact : loose)[${idx} === -1 ? (exact.length ? exact : loose).length - 1 : ${idx}];
        if (!el) return false; el.click(); return true; })()`);
      if (!ok) throw new Error(`không thấy "${text}" để bấm`);
      await sleep(700);
    },
    /** Rê chuột tới giữa phần tử (sel hoặc chữ) để hiện nút chỉ xuất hiện khi hover. */
    async hover(target) {
      const box = await api.eval(`(() => { const t = ${JSON.stringify(target)};
        let e = null; try { e = document.querySelector(t); } catch (_) {} if (!e) { for (const x of document.querySelectorAll('body *')) { if ((x.textContent||'').trim() === t && x.children.length < 3) { e = x; break; } } }
        if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
      if (!box) throw new Error("không thấy để rê: " + target);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
      await sleep(500);
    },
    /** Đổi chữ hiển thị (ví dụ http://localhost:3000 → https://limio.vn) để ảnh không lộ môi trường dev. */
    async rewrite(from, to) {
      await api.eval(`(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) if (n.nodeValue.includes(${JSON.stringify(from)})) n.nodeValue = n.nodeValue.split(${JSON.stringify(from)}).join(${JSON.stringify(to)}); })()`);
    },
    /** Bôi đen một cụm chữ trong đoạn có chứa `needle`, rồi bấm chuột phải ngay trên vùng chọn. */
    async selectAndRightClick(needle, from, len) {
      const pt = await api.eval(`(() => {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { const i = n.nodeValue.indexOf(${JSON.stringify(needle)}); if (i >= 0 && n.parentElement.closest('p,li')) {
          const a = i + ${from}, b = Math.min(n.nodeValue.length, a + ${len});
          const r = document.createRange(); r.setStart(n, a); r.setEnd(n, b);
          n.parentElement.scrollIntoView({ block: 'center' });
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          const rc = r.getBoundingClientRect(); return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 }; } }
        return null; })()`);
      if (!pt) throw new Error("không thấy đoạn để bôi đen: " + needle);
      // CDP không tự sinh sự kiện contextmenu khi không có cửa sổ thật, nên bắn thẳng sự kiện đó lên đúng phần tử.
      // Ứng dụng nghe contextmenu ở cấp document; bắn lên phần tử con thì không tới (đã thử), nên bắn thẳng vào document.
      // Lần đầu có thể tới quá sớm (bộ nghe của ứng dụng gắn sau khi trang nạp xong) nên thử lại tới khi menu hiện.
      for (let k = 0; k < 4; k++) {
        await api.eval(`document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: ${pt.x}, clientY: ${pt.y}, button: 2 }))`);
        await sleep(800);
        if (await api.eval("!!document.querySelector('[role=menu]')")) break;
      }
      return pt;
    },
    async scrollBottom() {
      await api.eval("window.scrollTo(0, document.body.scrollHeight)");
      await sleep(600);
    },
    async clickSel(sel) {
      const ok = await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
      if (!ok) throw new Error(`không thấy ${sel}`);
      await sleep(700);
    },
    /** Điền ô nhập (React) bằng setter gốc để sự kiện input chạy đúng. */
    async fill(sel, value) {
      const ok = await api.eval(`(() => {
        const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
        const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(value)});
        e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
        return true; })()`);
      if (!ok) throw new Error(`không thấy ô ${sel}`);
    },
    /**
     * Vẽ các vòng số lên trang. Mỗi mục: {sel | text, dx, dy, at:'tl'|'tr'|'bl'|'br'|'l'|'r'}.
     * `text` tìm phần tử nhỏ nhất chứa đúng chữ đó; `sel` là CSS selector.
     */
    async marks(list) {
      await api.eval(`(() => {
        document.querySelectorAll('[data-limio-mark]').forEach(e => e.remove());
        const list = ${JSON.stringify(list)};
        const find = (m) => {
          if (m.sel) return document.querySelectorAll(m.sel)[m.idx || 0];
          const hits = [];
          for (const e of document.querySelectorAll('body *')) {
            const t = (e.textContent || '').trim();
            if (t === m.text || (m.starts && t.startsWith(m.text))) {
              // chỉ lấy phần tử "lá" của cụm chữ: bỏ cha nếu con đã khớp
              if (![...e.children].some(c => { const ct = (c.textContent || '').trim(); return m.starts ? ct.startsWith(m.text) : ct === t; })) hits.push(e);
            }
          }
          return (m.idx === -1 ? hits[hits.length - 1] : hits[m.idx || 0]) || null;
        };
        list.forEach((m, i) => {
          let el = m.abs ? { getBoundingClientRect: () => ({ left: m.abs[0], right: m.abs[0], top: m.abs[1], bottom: m.abs[1], width: 0, height: 0 }) } : find(m); if (el && m.closest && !m.abs) el = el.closest(m.closest) || el; if (!el) { console.warn('mark: không thấy', JSON.stringify(m)); return; }
          const r = el.getBoundingClientRect();
          const at = m.at || 'r';
          const x = { tl: r.left, tr: r.right, bl: r.left, br: r.right, l: r.left, r: r.right }[at] + (m.dx || 0);
          const y = { tl: r.top, tr: r.top, bl: r.bottom, br: r.bottom, l: r.top + r.height / 2, r: r.top + r.height / 2 }[at] + (m.dy || 0);
          const d = document.createElement('div'); d.setAttribute('data-limio-mark', '');
          d.textContent = String(i + 1);
          d.style.cssText = 'position:fixed;z-index:2147483647;width:28px;height:28px;border-radius:50%;background:#e11d48;color:#fff;' +
            'font:800 16px/28px -apple-system,Segoe UI,sans-serif;text-align:center;box-shadow:0 0 0 3px #fff,0 2px 8px rgba(0,0,0,.35);' +
            'left:' + (x - 14) + 'px;top:' + (y - 14) + 'px;pointer-events:none';
          document.body.appendChild(d);
          if (m.ring) {
            const o = document.createElement('div'); o.setAttribute('data-limio-mark', '');
            o.style.cssText = 'position:fixed;z-index:2147483646;border:3px solid #e11d48;border-radius:8px;pointer-events:none;' +
              'left:' + (r.left - 4) + 'px;top:' + (r.top - 4) + 'px;width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px';
            document.body.appendChild(o);
          }
        });
      })()`);
    },
    /** Chụp vùng (toạ độ khung nhìn, đơn vị CSS) hoặc cả khung nhìn nếu bỏ clip. */
    async save(name, clip) {
      mkdirSync(OUT, { recursive: true });
      const params = { format: "png", captureBeyondViewport: false };
      if (clip) params.clip = { ...clip, scale: 1 };
      const { data } = await send("Page.captureScreenshot", params);
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
      console.log("✓", name);
    },
    /** Hộp bao của cửa sổ chứa một dòng chữ: leo lên tới phần tử rộng trong [minW, maxW]. */
    async boxOfText(text, minW = 500, maxW = 1000, pad = 12) {
      return api.eval(`(() => { let e = null; for (const x of document.querySelectorAll('body *')) if ((x.textContent||'').trim().startsWith(${JSON.stringify(text)}) && x.children.length < 3) { e = x; break; }
        while (e && e.parentElement) { const r = e.getBoundingClientRect(); if (r.width >= ${minW} && r.width <= ${maxW} && r.height > 300) break; e = e.parentElement; }
        if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - ${pad}), y: Math.max(0, r.top - ${pad}), width: r.width + ${pad * 2}, height: r.height + ${pad * 2} }; })()`);
    },
    /** Hộp bao (CSS px) của phần tử cuối cùng có đúng chữ này. */
    async rectOfText(text) {
      return api.eval(`(() => { const t = [...document.querySelectorAll('body *')].filter(e => (e.textContent||'').trim() === ${JSON.stringify(text)});
        const e = t[t.length - 1]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
    },
    /** Hộp bao (CSS px) của phần tử khớp `sel` — dùng làm clip. */
    async box(sel, pad = 0) {
      return api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
        const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - ${pad}), y: Math.max(0, r.top - ${pad}), width: r.width + ${pad * 2}, height: r.height + ${pad * 2} }; })()`);
    },
    /** Mở khoá theo tên (id đổi sau mỗi lần nạp lại): tìm liên kết trong danh sách khoá của giảng viên. */
    async openCourse(title, tab = "content") {
      await api.goto("/instructor/courses");
      const href = await api.eval(`(() => {
        const t = ${JSON.stringify(title)};
        for (const a of document.querySelectorAll('a[href^="/instructor/courses/"]')) {
          const card = a.closest('div[class*="rounded"], article, li') || a.parentElement;
          if ((card?.textContent || '').includes(t) && new RegExp('^/instructor/courses/[0-9a-f-]{36}').test(a.getAttribute('href'))) return a.getAttribute('href').split('?')[0];
        } return null; })()`);
      if (!href) throw new Error("không thấy khoá: " + title);
      await api.goto(`${href}?tab=${tab}`);
      return href;
    },
    /** Chờ tới khi selector xuất hiện (trang Next dev biên dịch lần đầu có thể chậm). */
    async waitFor(sel, ms = 30000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (await api.eval(`!!document.querySelector(${JSON.stringify(sel)})`)) return;
        await sleep(400);
      }
      throw new Error("chờ quá lâu: " + sel);
    },
    /** Đăng xuất bằng cách xoá cookie rồi đăng nhập tài khoản khác. */
    async relogin(email, password) {
      await send("Network.clearBrowserCookies");
      await api.login(email, password);
    },
    async login(email, password) {
      await api.goto("/signin");
      await api.waitFor('input[type="email"]');
      await api.fill('input[type="email"]', email);
      await api.fill('input[type="password"], input[autocomplete="current-password"]', password);
      await api.clickSel('button[type="submit"]');
      for (let i = 0; i < 40; i++) {
        await sleep(400);
        if (!(await api.eval("location.pathname")).startsWith("/signin")) return;
      }
      throw new Error("đăng nhập không thành công");
    },
    close() {
      try { ws.close(); } catch {}
      proc.kill("SIGKILL");
    },
  };
  return api;
}

// ── chạy ──────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const email = process.env.DEMO_EMAIL;
  // Giảng viên mẫu dùng mật khẩu dev dùng chung (để chip ở màn hình đăng nhập bấm vào được); học viên mẫu dùng DEMO_PASSWORD.
  const password = process.env.DEMO_INSTRUCTOR_PASSWORD ?? "password1234";
  if (!email) throw new Error("thiếu DEMO_EMAIL");
  const { SHOTS } = await import("./shots.mjs");
  const want = process.argv.slice(2);
  const names = want.length ? want : Object.keys(SHOTS);
  const page = await launch();
  try {
    await page.login(email, password);
    for (const n of names) {
      // Thăm dò nhanh: "xu:<đường dẫn>" mở trang; "xc:<chữ tab>" mở khoá Nhập môn Lập trình rồi bấm tab.
      if (n.startsWith("xu:") || n.startsWith("xc:")) {
        try {
          await page.resize(1360, +(process.env.H || 1300));
          if (n.startsWith("xu:")) await page.goto(n.slice(3));
          else { await page.openCourse("Nhập môn Lập trình", "content"); await page.clickText(n.slice(3)); await page.sleep(2500); }
          await page.sleep(1500);
          await page.save("x-" + n.replace(/[^a-z0-9]+/gi, "-").slice(0, 50));
        } catch (e) { console.log("✗", n, "—", e.message); }
        continue;
      }
      if (!SHOTS[n]) { console.log("✗ chưa có cách chụp:", n); continue; }
      try { await SHOTS[n](page); } catch (e) { console.log("✗", n, "—", e.message); }
    }
  } finally {
    page.close();
  }
  process.exit(0);
}
