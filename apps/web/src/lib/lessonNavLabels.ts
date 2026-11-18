/**
 * Nhãn của thanh Bài trước / Tiếp (docs/tieu-chi/limio-language-ux-dieu-huong-bai.md): tên ngắn của unit/chủ đề và dòng phụ dưới nút.
 */
export interface NavLinkInfo {
  title: string;
  unitTitle: string;
  /** false khi bấm sẽ sang unit/chủ đề khác. */
  sameUnit: boolean;
}

/** "Chủ đề 2 · 退货这件事 — Mua sắm…" → "Chủ đề 2"; "Unit 1 · Lifestyles" → "Unit 1"; không có dấu ngăn thì giữ nguyên. */
export function unitShort(unitTitle: string): string {
  const cut = unitTitle.split(/\s+[·—–]\s+/)[0] ?? unitTitle;
  return (cut || unitTitle).trim();
}

/** Rút gọn tên bài để vừa thanh điều hướng. */
export function shortTitle(t: string, n = 38): string {
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Dòng phụ dưới nút: tên bài; sang unit khác thì thêm tên ngắn của unit đứng trước. */
export function navSub(link: NavLinkInfo, n = 38): string {
  const title = shortTitle(link.title, n);
  return link.sameUnit ? title : `${unitShort(link.unitTitle)} · ${title}`;
}

/** Dòng trên của nút "Tiếp": "Bài tiếp theo" trong cùng unit; sang unit khác thì tên ngắn của unit đó ("Chủ đề 2"). */
export function nextHeadline(next: NavLinkInfo, nextLabel: string): string {
  return next.sameUnit ? nextLabel : unitShort(next.unitTitle);
}
