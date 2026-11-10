import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * AC8 (docs/tieu-chi/limio-language-bai-luyen-editor.md): đề CÓ CHỦ (`Exam.ownerContentItemId` khác null) là nội dung của
 * một khối Bài luyện, KHÔNG phải đề thi — không được lọt vào bất cứ danh sách/đếm đề thi nào.
 *
 * Test quét mã: mọi lời gọi `.exam.findMany(` / `.count(` / `.findFirst(` / `.groupBy(` phải có trong thân lời gọi hoặc một điều
 * kiện lọc `ownerContentItemId` / `EXCLUDE_OWNED_PRACTICE`, hoặc một ghi chú `owned-practice-ok: <lý do>`. Thêm truy vấn liệt
 * kê đề mới mà quên ⇒ test đỏ; sửa bằng cách thêm điều kiện (đừng nới test).
 */
const ROOT = join(__dirname, "../../../..");
const DIRS = ["packages/core-lms/src", "packages/core-feedback/src", "packages/core-gamification/src", "apps/web/src"];
const CALL = /\.exam\.(findMany|count|findFirst|groupBy|aggregate)\(/g;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === "generated" || name === "__tests__") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("đề có chủ (Bài luyện) không lọt vào danh sách đề thi", () => {
  it("mọi truy vấn liệt kê/đếm exam đều loại đề có chủ hoặc có ghi chú ngoại lệ", () => {
    const bad: string[] = [];
    for (const d of DIRS) {
      for (const file of walk(join(ROOT, d))) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(CALL)) {
          const start = m.index ?? 0;
          // Cửa sổ: từ 400 ký tự trước (chỗ đặt ghi chú) tới 700 ký tự sau (thân lời gọi).
          const win = src.slice(Math.max(0, start - 400), start + 700);
          if (/ownerContentItemId|EXCLUDE_OWNED_PRACTICE|owned-practice-ok/.test(win)) continue;
          const line = src.slice(0, start).split("\n").length;
          bad.push(`${relative(ROOT, file)}:${line}`);
        }
      }
    }
    expect(bad, `Truy vấn exam thiếu điều kiện loại đề có chủ (xem comment đầu test):\n${bad.join("\n")}`).toEqual([]);
  });
});
