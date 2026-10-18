import { boardAttachmentKey, boardAttachmentKeyFromFilename, type StorageKey } from "./storage-keys";
import { getImageThumb, saveImageWithVariants, type SavedImage, type ThumbWidth } from "./imageVariants";

/**
 * Ảnh đính kèm của board (Padlet): ảnh gốc từ điện thoại 3–5MB/4000px mà note chỉ hiển thị ~400px, nên lưu
 * bản hiển thị ≤1600px (đã bỏ EXIF/GPS) + thumbnail WebP 480/960; trang board nạp thumbnail, bấm vào mới mở
 * bản lớn. Phần xử lý nằm ở imageVariants.ts (dùng chung với ảnh slide Limio-Live).
 */

export { THUMB_WIDTHS, sniffImageExt, thumbKeyFor, type ThumbWidth } from "./imageVariants";

export type SavedBoardImage = SavedImage;

/**
 * Kiểm tra, chuẩn hoá và lưu 1 ảnh đính kèm cùng thumbnail. Trả null nếu không phải ảnh hợp lệ (caller trả 415).
 * `keyFor`: nơi lưu (mặc định kho đính kèm của board; Limio-Live nhập PowerPoint dùng kho ảnh slide). `boardId` đứng
 * đầu tên file — truyền mã người dùng thì sổ dung lượng tính file cho người đó.
 */
export function saveBoardImage(
  boardId: string,
  input: Buffer,
  keyFor: (date: Date, filename: string) => StorageKey = boardAttachmentKey,
): Promise<SavedBoardImage | null> {
  return saveImageWithVariants({ prefix: boardId, keyFor }, input);
}

/** Thumbnail theo tên file gốc; chưa có thì sinh rồi lưu lại. null = phục vụ bản gốc. */
export function getBoardThumb(filename: string, width: ThumbWidth): Promise<Buffer | null> {
  return getImageThumb(filename, width, boardAttachmentKeyFromFilename);
}
