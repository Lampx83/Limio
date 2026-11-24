// Ghép course.json (khung + module "Start here") với parts/part-{1..5}.json và final.json
// thành khoa-prompt-engineering.json — file manifest cho `pnpm import:course`.
//   node docs/hoc-lieu/prompt-engineering/build.mjs [--only 3] [--out file.json]
//   --only: chỉ ghép khung + part đó (để agent tự kiểm phần mình)
//
// Phần mở rộng so với importer: khối ```prompt Tiêu đề … ``` trong body/sections/outro được đổi thành
// khối ```html có khung màu (nhãn + <pre>), để viết prompt mẫu mà không phải gõ HTML.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "khoa-prompt-engineering.json";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const BOX = "background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto";
const LBL = "font-size:.8rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:rgba(127,127,127,.95);margin:0 0 .25rem";
const PRE = "margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.95rem;line-height:1.6;white-space:pre-wrap";
const expandPrompt = (s) =>
  typeof s !== "string"
    ? s
    : s.replace(/```prompt[ \t]*([^\n]*)\n([\s\S]*?)\n```/g, (_, title, code) =>
        "```html\n" +
        `<div style="${BOX}"><div style="${LBL}">${esc(title.trim() || "Prompt")}</div><pre style="${PRE}">${esc(code)}</pre></div>\n` +
        "```");
const walk = (v) => (Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : expandPrompt(v));

const base = read("course.json");
const m = { course: base.course, misconceptions: [], feedbackTemplates: [], modules: [] };
const add = (frag) => {
  m.modules.push(frag.module);
  m.misconceptions.push(...(frag.misconceptions ?? []));
  m.feedbackTemplates.push(...(frag.feedbackTemplates ?? []));
};
if (!only || only === "start") {
  const sf = "start.json";
  if (existsSync(join(dir, sf))) add(read(sf));
  else if (base.startModule.lessons.length) add({ module: base.startModule });
  else console.warn(`(thiếu ${sf})`);
}
for (const n of [1, 2, 3, 4, 5]) {
  if (only && String(n) !== only) continue;
  const f = `parts/part-${n}.json`;
  if (existsSync(join(dir, f))) add(read(f));
  else console.warn(`(thiếu ${f})`);
}
if ((!only || only === "final") && existsSync(join(dir, "final.json"))) add(read("final.json"));

// Mã lỗi tư duy và khoá câu hỏi phải duy nhất toàn khoá.
const seen = new Set();
for (const x of m.misconceptions) { if (seen.has(x.code)) throw new Error(`trùng misconception code: ${x.code}`); seen.add(x.code); }
const keys = new Set();
for (const mod of m.modules) for (const l of mod.lessons) for (const q of l.quiz?.questions ?? []) {
  if (!q.key) continue;
  if (keys.has(q.key)) throw new Error(`trùng question key: ${q.key}`);
  keys.add(q.key);
}
for (const t of m.feedbackTemplates) if (t.misconception && !seen.has(t.misconception)) throw new Error(`template trỏ misconception không có: ${t.misconception}`);
for (const mod of m.modules) for (const l of mod.lessons) for (const q of l.quiz?.questions ?? []) for (const o of q.options ?? [])
  if (o.misconception && !seen.has(o.misconception)) throw new Error(`${q.key}: misconception không khai báo: ${o.misconception}`);
// Mỗi lỗi tư duy phải có ít nhất một mẫu phản hồi.
const withTpl = new Set(m.feedbackTemplates.map((t) => t.misconception));
for (const x of m.misconceptions) if (!withTpl.has(x.code)) console.warn(`(lỗi tư duy chưa có mẫu phản hồi: ${x.code})`);

const final = walk(m);
writeFileSync(resolve(dir, out), JSON.stringify(final, null, 2) + "\n");
const nl = final.modules.reduce((a, x) => a + x.lessons.length, 0);
const nq = final.modules.reduce((a, x) => a + x.lessons.reduce((b, l) => b + (l.quiz?.questions.length ?? 0), 0), 0);
console.log(`${out}: ${final.modules.length} module, ${nl} bài, ${nq} câu hỏi, ${final.misconceptions.length} lỗi tư duy, ${final.feedbackTemplates.length} mẫu phản hồi`);
