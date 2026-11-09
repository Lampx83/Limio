// Ghép course.json (khung + module "Start here" + module cuối) với parts/part-{1,2,3}.json và final.json
// thành khoa-mathematical-foundations.json — file manifest cho `pnpm import:course`.
//   node docs/hoc-lieu/mathematical-foundations-for-data-science/build.mjs [--only 1]   (--only: chỉ ghép khung + part đó, để agent tự kiểm)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "khoa-mathematical-foundations.json";

const base = read("course.json");
const m = { course: base.course, misconceptions: [], feedbackTemplates: [], modules: [] };
const add = (frag) => {
  m.modules.push(frag.module);
  m.misconceptions.push(...(frag.misconceptions ?? []));
  m.feedbackTemplates.push(...(frag.feedbackTemplates ?? []));
};
add({ module: base.startModule });
for (const n of [1, 2, 3]) {
  if (only && String(n) !== only) continue;
  const f = `parts/part-${n}.json`;
  if (existsSync(join(dir, f))) add(read(f));
  else console.warn(`(thiếu ${f})`);
}
if (!only && existsSync(join(dir, "final.json"))) add(read("final.json"));

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

writeFileSync(join(dir, out), JSON.stringify(m, null, 2) + "\n");
const nl = m.modules.reduce((a, x) => a + x.lessons.length, 0);
const nq = m.modules.reduce((a, x) => a + x.lessons.reduce((b, l) => b + (l.quiz?.questions.length ?? 0), 0), 0);
console.log(`${out}: ${m.modules.length} module, ${nl} bài, ${nq} câu hỏi, ${m.misconceptions.length} lỗi tư duy`);
