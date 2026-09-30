import { addDaysToKey, mondayOfKey } from "@feedbackme/shared-types";

/** Khoá ngày của mùng 1 tháng chứa `key`. */
export function firstOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Cộng/trừ tháng, giữ mùng 1 (tránh 31/03 − 1 tháng = 03/03). */
export function addMonthsToKey(key: string, months: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + months;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** 7 ngày T2→CN của tuần chứa `key`. */
export function weekDays(key: string): string[] {
  const monday = mondayOfKey(key);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

/**
 * Các hàng tuần (T2→CN) phủ hết tháng chứa `key`: từ thứ Hai của tuần chứa mùng 1
 * đến Chủ Nhật của tuần chứa ngày cuối tháng — 4 đến 6 hàng, không thừa hàng trống.
 */
export function monthGrid(key: string): string[][] {
  const first = firstOfMonthKey(key);
  const lastOfMonth = addDaysToKey(addMonthsToKey(first, 1), -1);
  const rows: string[][] = [];
  let cursor = mondayOfKey(first);
  while (cursor <= lastOfMonth) {
    rows.push(weekDays(cursor));
    cursor = addDaysToKey(cursor, 7);
  }
  return rows;
}
