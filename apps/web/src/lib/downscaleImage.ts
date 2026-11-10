/**
 * Thu ảnh cho Đoạn văn (đề thi, Bài luyện) trước khi tải: giữ PNG là PNG, cạnh dài 2000 px.
 * Khác `resizeImage.ts` (bảng tương tác: đổi sang JPEG, 1600 px) vì ảnh trong bài đọc có thể là sơ đồ/chữ cần nét và nền trong suốt.
 */

/** Cạnh dài tối đa của ảnh tải lên đoạn văn (px). Lớn hơn thì thu về mức này ở máy người soạn trước khi tải. */
export const IMAGE_MAX_EDGE = 2000;

/** Kích thước sau khi thu: giữ tỉ lệ, cạnh dài không quá `max`; ảnh không lớn hơn thì giữ nguyên (không phóng to). */
export function fitWithin(width: number, height: number, max: number = IMAGE_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * Thu ảnh về cạnh dài tối đa `IMAGE_MAX_EDGE` (JPG/WebP chất lượng 0,85; PNG giữ PNG). GIF (có thể động), ảnh nhỏ hơn mức này, hoặc
 * trình duyệt không xử lý được thì trả nguyên tệp gốc — thu ảnh không bao giờ làm hỏng việc tải lên.
 */
export async function downscaleImage(file: File, max: number = IMAGE_MAX_EDGE): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bmp.width, bmp.height, max);
    if (width === bmp.width && height === bmp.height) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.85));
    if (!blob || blob.size >= file.size) return file; // thu mà không nhẹ hơn thì giữ bản gốc
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
