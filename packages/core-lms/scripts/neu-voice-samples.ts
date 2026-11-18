/**
 * Sinh bản nghe thử: cùng một vài từ/câu tiếng Trung đọc bằng MỌI giọng zh của cổng NEU, ghi ra thư mục cục bộ kèm trang index.html
 * để người duyệt nghe và chọn giọng (không ghi gì vào DB hay kho tải lên của khoá).
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/neu-voice-samples.ts --out <thư-mục> [--voices zf_xiaoxiao,zm_yunxi]
 *
 * Cần NEUTTS_BASE_URL_OVERRIDE (đường hầm) và SECRETS_MASTER_KEY như các script audio khác.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeMp3, parseWav } from "../src/narration/audio";
import { neuSecret } from "./dialogue-audio";
import { createNeuVocabSynth, pickMaleFemale } from "./vocab-audio";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Từ đơn (như thẻ từ mới), cụm có thanh nhẹ/nhi hoá, và một câu hội thoại có dấu phẩy. */
const SAMPLES: Array<{ id: string; label: string; text: string }> = [
  { id: "w1", label: "Từ đơn", text: "钥匙" },
  { id: "w2", label: "Từ có thanh nhẹ", text: "房东" },
  { id: "w3", label: "Từ có nhi hoá", text: "一点儿" },
  { id: "s1", label: "Câu có dấu phẩy", text: "二位好，请进。" },
  { id: "s2", label: "Câu hỏi dài", text: "请问，这套房子一个月房租多少钱？" },
];

async function main() {
  const out = arg("out");
  if (!out) throw new Error("Thiếu --out <thư-mục>");
  mkdirSync(out, { recursive: true });
  const synth = await createNeuVocabSynth(fetch, neuSecret);
  if (!synth?.voicesOf || !synth.synthesizePcm) throw new Error("Chưa dùng được NEU TTS");
  const all = synth.voicesOf("zh");
  const only = arg("voices")?.split(",").filter(Boolean);
  const voices = only?.length ? all.filter((v) => only.includes(v)) : all;
  console.log(`Giọng zh: ${all.join(", ")}`);
  const rows: string[] = [];
  for (const voice of voices) {
    const cells: string[] = [];
    for (const s of SAMPLES) {
      const file = `${voice}-${s.id}.mp3`;
      try {
        const pcm = await synth.synthesizePcm(s.text, voice);
        writeFileSync(join(out, file), encodeMp3(pcm));
        cells.push(`<td><audio controls preload="none" src="${file}"></audio></td>`);
      } catch (e) {
        cells.push(`<td>lỗi: ${(e as Error).message}</td>`);
      }
    }
    const g = /^[a-z]{1,3}([fm])_/i.exec(voice)?.[1]?.toLowerCase() === "f" ? "nữ" : "nam";
    rows.push(`<tr><th scope="row">${voice}<br><small>${g}</small></th>${cells.join("")}</tr>`);
    console.log(`  ✔ ${voice}`);
  }
  const head = SAMPLES.map((s) => `<th>${s.label}<br><small>${s.text}</small></th>`).join("");
  writeFileSync(
    join(out, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Nghe thử giọng NEU (zh)</title><style>body{font:15px system-ui;margin:2rem}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.5rem .7rem;text-align:left;vertical-align:top}small{color:#666}audio{width:200px}</style><h1>Nghe thử giọng tiếng Trung</h1><p>Cùng nội dung, mỗi giọng một hàng. Chọn hai giọng chuẩn nhất (một nam, một nữ).</p><table><tr><th>Giọng</th>${head}</tr>${rows.join("")}</table>`,
  );
  const pair = pickMaleFemale(all);
  console.log(`\nĐã ghi ${voices.length} giọng vào ${out}/index.html (cặp tự chọn hiện tại: ${pair ? `${pair.male} + ${pair.female}` : "không có"}).`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
