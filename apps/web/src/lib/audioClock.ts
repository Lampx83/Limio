/** Định dạng giờ và tỉ lệ cho thanh phát audio tự vẽ (AudioLessonPlayer). */

/** 75 → "1:15". Giá trị chưa biết (NaN, vô hạn, âm) → "0:00". */
export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Phần trăm đã phát, kẹp 0–100; chưa biết độ dài thì 0. */
export function progressPct(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return 0;
  return Math.min(100, Math.max(0, (current / duration) * 100));
}
