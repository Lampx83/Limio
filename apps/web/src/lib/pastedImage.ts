/**
 * Dán ảnh từ clipboard vào ô nhập chữ thường (trình soạn Đoạn văn) — docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, mục A.
 *
 * Chỉ "cướp" sự kiện dán khi clipboard có ẢNH mà KHÔNG có chữ (ảnh chụp màn hình, "Copy image"). Khi có chữ (kể cả chữ kèm ảnh do
 * Word hoặc trang web đính kèm) thì để trình duyệt dán chữ như bình thường — giống cách `RichTextEditor` đã làm.
 */

/** Cùng danh sách với nút "Tải ảnh" của trình soạn Đoạn văn. */
export const PASTE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export type PastedImage =
  | { kind: "none" } // không có ảnh, hoặc có chữ: để trình duyệt dán như thường
  | { kind: "image"; file: File }
  | { kind: "unsupported"; type: string }; // có ảnh nhưng sai định dạng: chặn dán và báo lỗi

export function pickPastedImage(clip: { files?: ArrayLike<File> | null; text?: string | null }): PastedImage {
  if ((clip.text ?? "").trim() !== "") return { kind: "none" };
  const images = Array.from(clip.files ?? []).filter((f) => f.type.startsWith("image/"));
  if (images.length === 0) return { kind: "none" };
  const ok = images.find((f) => (PASTE_IMAGE_TYPES as readonly string[]).includes(f.type));
  return ok ? { kind: "image", file: ok } : { kind: "unsupported", type: images[0]!.type };
}
