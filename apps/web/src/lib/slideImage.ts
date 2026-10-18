import { liveResourceKey, liveResourceKeyFromFilename } from "./storage-keys";
import { getImageThumb, saveImageWithVariants, type SavedImage, type ThumbWidth } from "./imageVariants";

/**
 * Ảnh riêng ở ô hình của slide Limio-Live (mockup docs/mockup/anh-rieng-o-hinh.html). Tải từ máy hay lấy từ
 * địa chỉ đều qua cùng đường xử lý với ảnh đính kèm board: bản hiển thị ≤1600px đã bỏ EXIF/GPS + thumbnail
 * WebP 480/960, không giữ bản gốc. Lưu chung thư mục tài nguyên slide, phục vụ qua /api/limio-live-resource/.
 * Tên file bắt đầu bằng mã người dùng như các tài nguyên slide khác.
 */

export const SLIDE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function saveSlideImage(userId: string, input: Buffer): Promise<SavedImage | null> {
  return saveImageWithVariants({ prefix: userId, keyFor: liveResourceKey }, input);
}

export function getSlideImageThumb(filename: string, width: ThumbWidth): Promise<Buffer | null> {
  return getImageThumb(filename, width, liveResourceKeyFromFilename);
}
