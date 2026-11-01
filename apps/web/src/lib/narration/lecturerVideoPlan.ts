/**
 * Kế hoạch dựng video giảng viên nói (docs/tieu-chi/trinh-chieu-giang-vien.md, AC7). Hàm thuần, không phụ thuộc gì để cả
 * script dựng (chạy bằng tsx trên máy dev) lẫn trình phát dùng chung.
 *
 * Video tắt tiếng, dài đúng bằng tệp giọng, 25 hình/giây; hình thứ k hiện ở giây k / 25 của giọng. Mỗi đoạn giảng
 * (`segments`) được đọc thành một clip riêng; khoảng lặng giữa hai đoạn giữ nguyên hình cuối của clip trước. Ranh giới
 * tính bằng SỐ HÌNH tuyệt đối từ mốc giây, nên không trôi dần qua 50 đoạn của một bài.
 */

export const LECTURER_VIDEO_FPS = 25;

export interface PlanSegment {
  anchor: string;
  startSec: number;
  endSec: number;
}

export interface ClipPlan {
  index: number;
  anchor: string;
  startSec: number;
  endSec: number;
  /** Hình đầu tiên (tính từ 0) của clip trong video cả bài. Đoạn đầu luôn 0: phần trước mốc đầu giữ hình đầu. */
  startFrame: number;
  /** Số hình clip chiếm tới hết khoảng lặng sau nó (clip ngắn hơn thì giữ hình cuối cho đủ). */
  frames: number;
}

export function planClips(segments: PlanSegment[], durationSec: number, fps = LECTURER_VIDEO_FPS): ClipPlan[] {
  if (!(durationSec > 0)) throw new Error("durationSec phải > 0");
  const total = Math.round(durationSec * fps);
  const sorted = segments.slice().sort((a, b) => a.startSec - b.startSec);
  const plan: ClipPlan[] = [];
  let prevEnd = -Infinity;
  sorted.forEach((s, i) => {
    if (!(s.endSec > s.startSec)) throw new Error(`đoạn ${s.anchor}: endSec phải lớn hơn startSec`);
    if (s.startSec < prevEnd - 0.001) throw new Error(`đoạn ${s.anchor} chồng lên đoạn trước`);
    prevEnd = s.endSec;
    const startFrame = i === 0 ? 0 : Math.min(total, Math.round(s.startSec * fps));
    const next = sorted[i + 1];
    const endFrame = next ? Math.min(total, Math.round(next.startSec * fps)) : total;
    plan.push({ index: i, anchor: s.anchor, startSec: s.startSec, endSec: s.endSec, startFrame, frames: Math.max(1, endFrame - startFrame) });
  });
  return plan;
}

/** Tổng số hình của video cả bài (bằng tổng `frames` của kế hoạch). */
export const totalFrames = (durationSec: number, fps = LECTURER_VIDEO_FPS): number => Math.round(durationSec * fps);

/** Khoá cache một clip: ảnh + âm thanh đoạn + cỡ + kiểu. Đổi giọng, ảnh hay cỡ thì dựng lại đúng clip đó. */
export function clipCacheKey(photoSha: string, wavSha: string, size: number, style = "real"): string {
  return `${photoSha.slice(0, 12)}-${wavSha.slice(0, 16)}-${style}-${size}`;
}

/** Bản video theo bề rộng khung hiển thị: dưới 640 px (hoặc bật tiết kiệm dữ liệu) dùng bản nhỏ, ≈ 1/3 dung lượng. */
export type LecturerVideoRendition = "lg" | "sm";
export function pickRendition(viewportWidth: number, saveData = false): LecturerVideoRendition {
  return saveData || viewportWidth < 640 ? "sm" : "lg";
}

/**
 * Giờ video nên đứng ở đâu khi âm thanh đang ở `audioTime`. Trả `null` nếu đã đủ gần (không cần tua), để trình phát
 * chỉ tua khi lệch quá `tolerance` giây.
 */
export function videoSeekTarget(audioTime: number, videoTime: number, tolerance = 0.25): number | null {
  if (!Number.isFinite(audioTime) || !Number.isFinite(videoTime)) return null;
  return Math.abs(audioTime - videoTime) > tolerance ? Math.max(0, audioTime) : null;
}
