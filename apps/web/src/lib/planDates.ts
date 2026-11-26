// Ngày của thuê bao nhập theo lịch giờ Việt Nam; lưu `endsAt` là 00:00 của ngày KẾ TIẾP (loại trừ),
// nên "đến hết 28/02/2027" ứng với endsAt = 01/03/2027 00:00 VN. Một chỗ duy nhất chuyển qua lại.
import { fromDateTimeInputValue, toDayKey } from "./datetime";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" → ISO của 00:00 VN ngày đó (null nếu sai định dạng). */
export function dayToStartsAt(day: string): string | null {
  if (!DAY_RE.test(day)) return null;
  return fromDateTimeInputValue(`${day}T00:00`);
}

/** "YYYY-MM-DD" (ngày cuối còn hiệu lực) → ISO của 00:00 VN ngày kế tiếp. */
export function dayToEndsAt(day: string): string | null {
  const start = dayToStartsAt(day);
  if (!start) return null;
  return new Date(new Date(start).getTime() + DAY_MS).toISOString();
}

/** endsAt (loại trừ) → "YYYY-MM-DD" của ngày cuối còn hiệu lực. */
export function endsAtToLastDay(endsAt: Date | string): string {
  return toDayKey(new Date(new Date(endsAt).getTime() - DAY_MS));
}
