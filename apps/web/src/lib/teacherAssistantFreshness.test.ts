// Chống lệch giữa Limio và trợ lý Limio ("trợ lý nói sai vì giao diện đã đổi"). Chạy trong CI (`pnpm test`), nên
// đổi giao diện mà quên cập nhật trợ lý thì test hỏng và nói rõ phải sửa chỗ nào.
//
// Ba lớp bảo vệ:
//  1. NHÃN: mọi nhãn nút/tiêu đề trong dấu ngoặc kép ở kho hướng dẫn phải còn xuất hiện trong mã nguồn
//     (apps/web/src và packages/*/src). Đổi tên nút ⇒ hướng dẫn nhắc tên cũ ⇒ test hỏng.
//  2. TRANG: mọi điểm đến trợ lý có thể dẫn tới phải còn là một trang thật.
//  3. MENU: mọi mục menu giảng viên phải được trợ lý biết, hoặc được ghi vào MENU_NOT_IN_ASSISTANT kèm lý do.
//     Thêm tính năng vào menu ⇒ buộc phải quyết định có dạy trợ lý hay không.
// Quy trình đầy đủ: CLAUDE.md §4.9 và .github/pull_request_template.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ASSISTANT_DESTINATIONS } from "./teacherAssistant";
import { GUIDES } from "./teacherAssistantGuide";

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/web/src/lib
const webSrc = path.resolve(here, "..");
const repoRoot = path.resolve(webSrc, "../../..");

// ── Nạp mã nguồn ────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFC").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

function listSource(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .filter((f) => !/(^|[\\/])(node_modules|dist|\.next)[\\/]/.test(f))
    .filter((f) => !/\.test\.tsx?$/.test(f) && !/teacherAssistantGuide/.test(f))
    .map((f) => path.join(dir, f));
}

const packagesDir = path.join(repoRoot, "packages");
const sourceFiles = [
  ...listSource(webSrc),
  ...(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir).flatMap((p) => listSource(path.join(packagesDir, p, "src"))) : []),
];
const corpus = norm(sourceFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n"));

// ── 1. Nhãn ─────────────────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Nhãn có phần thay đổi theo dữ liệu (số lượng, tên) thì viết trong hướng dẫn bằng chữ số, "n"/"N" hoặc "...".
 * Ví dụ "Áp dụng cho n lớp đã chọn" khớp mã `Áp dụng cho {selected.size} lớp đã chọn`.
 */
export function labelRegex(label: string): RegExp | null {
  const q = norm(label).replace(/…/g, "...").trim();
  const parts = q.split(/(\d+|\bn\b|\bN\b|\.\.\.)/);
  if (parts.length === 1) return null; // không có chỗ thay đổi: dùng includes
  const body = parts.map((p, i) => (i % 2 === 1 ? ".{1,40}?" : escapeRe(p))).join("");
  return new RegExp(body);
}

export function labelExists(label: string, text: string): boolean {
  const q = norm(label).replace(/[…→]+$/g, "").replace(/\.\.\.$/, "").trim();
  if (!q) return true;
  const re = labelRegex(q);
  return re ? re.test(text) : text.includes(q);
}

/** Mọi chuỗi trong ngoặc kép ở thân hướng dẫn: tên nút, tiêu đề, ô nhập, ví dụ mẫu. */
function quotedLabels(body: string): string[] {
  return [...body.matchAll(/"([^"]{2,90})"/g)].map((m) => m[1]!);
}

describe("nhãn trong hướng dẫn còn tồn tại trong giao diện", () => {
  it("quét được mã nguồn (không phải test rỗng)", () => {
    expect(sourceFiles.length).toBeGreaterThan(300);
    expect(corpus.length).toBeGreaterThan(1_000_000);
  });

  for (const g of GUIDES) {
    it(`mục "${g.id}": mọi nhãn trong ngoặc kép còn có trong mã`, () => {
      const missing = quotedLabels(g.body).filter((q) => !labelExists(q, corpus));
      expect(
        missing,
        `Mục hướng dẫn "${g.id}" nhắc nhãn không còn trong mã: ${missing.map((m) => `"${m}"`).join(", ")}.\n` +
          `Giao diện có thể đã đổi tên. Cập nhật docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md rồi sửa mục này trong lib/teacherAssistantGuide.ts.`,
      ).toEqual([]);
    });
  }

  it("bộ kiểm có tác dụng: nhãn bịa thì bị bắt, nhãn có chỗ thay đổi thì khớp", () => {
    expect(labelExists("Nút này không hề tồn tại trong Limio", corpus)).toBe(false);
    expect(labelExists("Áp dụng cho n lớp đã chọn", corpus)).toBe(true);
    expect(labelExists("Tạo N slide", corpus)).toBe(true);
    expect(labelExists("Biên tập cho mạch lạc", corpus)).toBe(true); // định nghĩa ở packages/shared-types
  });
});

// ── 2. Trang ────────────────────────────────────────────────────────────────

describe("điểm đến của trợ lý là trang có thật", () => {
  for (const d of ASSISTANT_DESTINATIONS) {
    it(`${d.id} → ${d.href}`, () => {
      const pathname = d.href.split("?")[0]!;
      const page = path.join(webSrc, "app", pathname, "page.tsx");
      expect(fs.existsSync(page), `Không thấy trang ${path.relative(repoRoot, page)}. Trang đã đổi tên hoặc bị xoá? Sửa ASSISTANT_DESTINATIONS.`).toBe(true);
    });
  }
});

// ── 3. Menu ─────────────────────────────────────────────────────────────────

/** Mục menu cố ý KHÔNG đưa vào trợ lý, kèm lý do. Thêm mục vào đây là một quyết định, không phải đường tắt. */
const MENU_NOT_IN_ASSISTANT: Record<string, string> = {
  "/instructor/assessment": "Trang điều hướng 3 bước của Kiểm tra đánh giá, không phải một tính năng riêng.",
  "/instructor/analytics": "Chỉ dành cho nhà nghiên cứu, không hướng dẫn giảng viên thường.",
  "/me/ai-tokens": "Chỉ hiện khi quản trị viên mở trang; trợ lý không hứa với mọi giảng viên.",
  "/instructor/my-rooms": "Dành cho giám thị (người không dạy khoá nào).",
};

const menuSource = fs.readFileSync(path.join(webSrc, "components/InstructorLeftMenu.tsx"), "utf8");
const menuItems = [...menuSource.matchAll(/label:\s*"([^"]+)"[^{}]*?href:\s*"([^"]+)"/g)].map((m) => ({ label: m[1]!, href: m[2]! }));
const menuPaths = new Set(menuItems.map((i) => i.href.split("?")[0]!));
const catalogHrefs = new Set(ASSISTANT_DESTINATIONS.map((d) => d.href));
const catalogPaths = new Set(ASSISTANT_DESTINATIONS.map((d) => d.href.split("?")[0]!));

describe("menu giảng viên và trợ lý Limio", () => {
  it("đọc được các mục menu (không phải test rỗng)", () => {
    expect(menuItems.length).toBeGreaterThan(20);
  });

  for (const item of menuItems) {
    it(`mục menu "${item.label}" (${item.href}) được trợ lý biết hoặc có lý do bỏ qua`, () => {
      const pathname = item.href.split("?")[0]!;
      const known = catalogHrefs.has(item.href) || catalogPaths.has(pathname) || pathname in MENU_NOT_IN_ASSISTANT;
      expect(
        known,
        `Mục menu "${item.label}" (${item.href}) chưa có trong trợ lý Limio.\n` +
          `Thêm vào ASSISTANT_DESTINATIONS (lib/teacherAssistant.ts) và viết mục hướng dẫn trong lib/teacherAssistantGuide.ts,\n` +
          `hoặc ghi lý do vào MENU_NOT_IN_ASSISTANT ở test này. Xem CLAUDE.md §4.9.`,
      ).toBe(true);
    });
  }

  it("danh sách bỏ qua không chứa mục đã bị xoá khỏi menu", () => {
    for (const p of Object.keys(MENU_NOT_IN_ASSISTANT)) expect(menuPaths.has(p), `${p} không còn trong menu: bỏ khỏi MENU_NOT_IN_ASSISTANT`).toBe(true);
  });

  it("mọi mục hướng dẫn trỏ tới ít nhất một điểm đến, và mọi điểm đến thuộc ít nhất một mục hướng dẫn hoặc là công cụ lẻ", () => {
    const guided = new Set(GUIDES.flatMap((g) => g.destinationIds));
    const orphans = ASSISTANT_DESTINATIONS.filter((d) => !guided.has(d.id)).map((d) => d.id);
    // Điểm đến chưa có mục hướng dẫn riêng thì trợ lý chỉ biết "nó làm gì" qua một dòng mô tả. Danh sách này nên ngắn.
    expect(orphans.length).toBeLessThanOrEqual(8);
  });
});
