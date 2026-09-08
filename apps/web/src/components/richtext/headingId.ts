import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * Sinh `id` cho heading trong bài học, cùng quy ước với script import hàng
 * loạt (`packages/core-lms/scripts/import-course.ts`): bỏ dấu, tiền tố
 * "muc-" để không đụng id nào khác của ứng dụng, hậu tố số khi trùng.
 *
 * Tách hàm thuần (không đụng DOM/ProseMirror) ra khỏi extension bên dưới để
 * test được mà không cần dựng cả editor.
 */
export function slugifyHeadingText(raw: string): string {
  const base = raw
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `muc-${base || "phan"}`;
}

/** Trả về `base` nếu chưa dùng, hoặc `base-2`, `base-3`, ... nếu đã có trong `used`. */
export function uniqueHeadingId(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Gán `id` cho mỗi heading (H1-H3) ngay khi giáo viên gõ, để mục lục nổi
 * ("Trong bài này", `LessonSectionNav.tsx`) hoạt động với nội dung soạn qua
 * editor — trước đây chỉ nội dung import bằng script mới có `id` trên
 * heading, nên mục lục lặng lẽ không hiện với bài giáo viên tự soạn.
 *
 * `id` chỉ được sinh MỘT LẦN cho mỗi heading (khi nó còn thiếu id) rồi giữ
 * nguyên kể cả khi sửa lại chữ sau đó — nếu sinh lại theo mỗi lần gõ thì
 * link đã chia sẻ/bookmark sẽ vỡ, và mục "đang đọc" trong mục lục sẽ nhảy
 * liên tục trong lúc gõ.
 */
export const HeadingId = Extension.create({
  name: "headingId",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("id"),
            renderHTML: (attributes: { id?: string | null }) =>
              attributes.id ? { id: attributes.id } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingId"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const used = new Set<string>();
          newState.doc.descendants((node) => {
            if (
              node.type.name === "heading" &&
              typeof node.attrs.id === "string" &&
              node.attrs.id
            ) {
              used.add(node.attrs.id as string);
            }
          });

          let tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "heading" || node.attrs.id) return;
            const text = node.textContent.trim();
            if (!text) return; // heading vừa tạo, chưa gõ chữ — chờ lần transaction sau
            const id = uniqueHeadingId(slugifyHeadingText(text), used);
            used.add(id);
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
            changed = true;
          });

          return changed ? tr : null;
        },
      }),
    ];
  },
});
