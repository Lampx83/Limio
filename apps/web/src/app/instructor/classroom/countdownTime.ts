export const MAX_COUNTDOWN_SECONDS = 24 * 3600 - 1;

const pad = (n: number) => String(n).padStart(2, "0");

// "7" = 7 phút, "12:30" = 12 phút 30 giây, "1:05:30" = 1 giờ 5 phút 30 giây.
export function parseTimeInput(raw: string): number | null {
  const v = raw.trim();
  if (!/^\d+(:\d+){0,2}$/.test(v)) return null;
  const [a = 0, b = 0, c = 0] = v.split(":").map(Number);
  const count = v.split(":").length;
  let seconds: number;
  if (count === 1) {
    seconds = a * 60;
  } else if (count === 2) {
    if (b >= 60) return null;
    seconds = a * 60 + b;
  } else {
    if (b >= 60 || c >= 60) return null;
    seconds = a * 3600 + b * 60 + c;
  }
  if (seconds <= 0) return null;
  return Math.min(seconds, MAX_COUNTDOWN_SECONDS);
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// Nhãn ngắn cho chip mẫu: "10 phút", "1 phút 30 giây", "45 giây", "1 giờ".
export function formatDurationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} giờ`);
  if (m) parts.push(`${m} phút`);
  if (sec || parts.length === 0) parts.push(`${sec} giây`);
  return parts.join(" ");
}
