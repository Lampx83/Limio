/**
 * LANG G5d — ô soạn bảng quy đổi điểm của giảng viên: mỗi dòng "từ-đến: nhãn" (hoặc "điểm: nhãn").
 * Hệ thống không mang sẵn số liệu chính thức; giảng viên tự đối chiếu nguồn rồi nhập.
 */
export interface Band {
  from: number;
  to: number;
  label: string;
}

export type ParseBandsResult = { ok: true; bands: Band[] } | { ok: false; line: number };

const LINE = /^\s*(\d+(?:\.\d+)?)\s*(?:[-–—]\s*(\d+(?:\.\d+)?))?\s*:\s*(.+?)\s*$/;

export function parseScoreBandsText(text: string): ParseBandsResult {
  const bands: Band[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim() === "") continue;
    const m = LINE.exec(raw);
    if (!m) return { ok: false, line: i + 1 };
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    bands.push({ from, to, label: m[3]! });
  }
  return { ok: true, bands };
}

export function formatScoreBands(bands: Band[] | null | undefined): string {
  return (bands ?? []).map((b) => `${b.from === b.to ? b.from : `${b.from}-${b.to}`}: ${b.label}`).join("\n");
}
