// Thu nhỏ ảnh ngay trên trình duyệt trước khi tải lên: ảnh chụp từ điện thoại (3–5MB, ~4000px)
// thành ~150–400KB. Giảm thời gian up, và giảm chi phí tải + giải mã khi hiển thị trên board.
//
// Không bao giờ ném lỗi: bất kỳ bước nào hỏng (trình duyệt cũ, ảnh lạ) → trả lại file gốc.

const MAX_EDGE = 1600;
const QUALITY = 0.82;
// Ảnh đã nhỏ sẵn thì không nén lại (tránh làm xấu thêm mà không lợi gì).
const SKIP_BELOW_BYTES = 200 * 1024;

export async function shrinkImageForUpload(file: File): Promise<File> {
  // GIF giữ nguyên (canvas sẽ làm mất hoạt ảnh); PDF/loại khác không đụng.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  try {
    // imageOrientation: ảnh chụp dọc từ điện thoại không bị xoay ngang sau khi vẽ lại.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // JPEG không có nền trong suốt — tô trắng để PNG trong suốt không thành nền đen.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    // Kết quả không nhỏ hơn thì giữ bản gốc.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
