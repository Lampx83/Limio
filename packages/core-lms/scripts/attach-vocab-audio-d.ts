/** Thay audio từ vựng khoá HSK 1 bằng giọng D (Qwen3-TTS clone từ opt_D_nu_cctv), file dựng sẵn từ máy dev.
 *  tsx --env-file=prod.env scripts/attach-vocab-audio-d.ts <plan.json> <mp3dir> <backup.json> [--apply]
 *  Mỗi từ: audioUrl (từ đọc 2 lần), exampleAudioUrl (câu ví dụ), trackStartSec; mỗi khối: audioUrl (audio tổng hợp).
 *  Khớp khối theo id, khớp từ theo `term` (phải trùng thứ tự). Sao lưu payload cũ trước khi ghi. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { updateContentItem } from "../src/courses/contents";
import { lessonAudioStore } from "./vocab-audio";

type PlanItem = { term: string; word: string; example: string; startSec: number };
type Plan = { block: string; track: string; items: PlanItem[] }[];

async function main() {
  const [planFile, dir, backup] = process.argv.slice(2, 5) as [string, string, string];
  const apply = process.argv.includes("--apply");
  const plan: Plan = JSON.parse(readFileSync(planFile, "utf8"));
  const course = await prisma.course.findUnique({ where: { slug: "hsk-1-goc" }, select: { id: true } });
  const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course!.id, role: "owner" }, select: { userId: true } });
  const store = lessonAudioStore(owner!.userId);
  const rows = await prisma.contentItem.findMany({ where: { id: { in: plan.map((p) => p.block) } }, select: { id: true, payload: true } });
  if (rows.length !== plan.length) throw new Error(`thiếu khối: ${rows.length}/${plan.length}`);
  writeFileSync(backup, JSON.stringify(rows, null, 1));
  const cache = new Map<string, string>();
  const up = async (f: string) => {
    let u = cache.get(f);
    if (!u) { u = await store(readFileSync(join(dir, f))); cache.set(f, u); }
    return u;
  };
  let n = 0;
  for (const p of plan) {
    const row = rows.find((r) => r.id === p.block)!;
    const payload = structuredClone(row.payload) as { items: Record<string, unknown>[]; audioUrl?: string };
    if (payload.items.length !== p.items.length) throw new Error(`${p.block}: số từ lệch`);
    if (!apply) { n += p.items.length; continue; }
    for (const [i, it] of p.items.entries()) {
      const cur = payload.items[i]!;
      if (cur.term !== it.term) throw new Error(`${p.block}[${i}]: "${String(cur.term)}" ≠ "${it.term}"`);
      cur.audioUrl = await up(it.word);
      cur.exampleAudioUrl = await up(it.example);
      cur.trackStartSec = it.startSec;
    }
    payload.audioUrl = await up(p.track);
    await updateContentItem(owner!.userId, p.block, { payload }, prisma);
    n += p.items.length;
    console.log("✔", p.block, p.items.length, "từ");
  }
  console.log(apply ? `Đã gắn ${n} từ, ${cache.size} tệp.` : `Dry-run: ${plan.length} khối, ${n} từ khớp.`);
}
main().catch((e) => { console.error("Error", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
