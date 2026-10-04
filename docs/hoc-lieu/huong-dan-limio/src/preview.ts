/**
 * Dựng trang xem trước các bài của khoá bằng đúng bộ render của importer —
 * cùng đường đi với `pnpm import:course`, nên thấy gì ở đây thì học viên thấy nấy.
 *
 *   pnpm --filter @feedbackme/core-lms exec tsx \
 *     ../../docs/hoc-lieu/huong-dan-limio/src/preview.ts <manifest.json> <thư mục ra> [theme=light|dark]
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSpec, renderLessonBlocks } from "../../../../packages/core-lms/scripts/import-course";

const [, , manifestPath, outDir = "preview", theme = "light"] = process.argv;
if (!manifestPath) throw new Error("thiếu đường dẫn manifest");
const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
mkdirSync(resolve(outDir), { recursive: true });

const dark = theme === "dark";
const css = `body{max-width:860px;margin:auto;padding:1rem 1.2rem 4rem;font-family:-apple-system,'Segoe UI',sans-serif;
background:${dark ? "#14171c" : "#fff"};color:${dark ? "#e6e8eb" : "#1b1f24"};font-size:16px}
h1.t{font-size:1.5rem;margin:1.5rem 0 .2rem}.m{opacity:.6;font-size:.95rem;margin-bottom:1rem}
nav a{display:block;padding:.2rem 0}`;

const pages: string[] = [];
let i = 0;
for (const mod of manifest.modules) {
  for (const l of mod.lessons) {
    const blocks = renderLessonBlocks(LessonSpec.parse(l));
    const file = `bai-${++i}.html`;
    writeFileSync(
      resolve(outDir, file),
      `<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>${css}</style><body>` +
        `<div class=m>${mod.title}</div><h1 class=t>${l.title}</h1>${blocks.join("\n")}</body>`,
    );
    pages.push(`<a href="${file}">${l.title}</a>`);
  }
}
writeFileSync(resolve(outDir, "index.html"), `<meta charset=utf-8><style>${css}</style><body><nav>${pages.join("")}</nav></body>`);
console.log(`${i} trang → ${resolve(outDir)}`);
