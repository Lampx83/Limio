/**
 * CSV export helpers. RFC 4180 escaping (double-quote fields containing
 * commas/quotes/newlines, escape internal quotes by doubling). UTF-8 BOM at
 * start so Excel opens with Vietnamese diacritics intact.
 */

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "﻿";
  // Use first row's keys as header order; merge in any extra keys from later rows.
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  const header = keys.map(escapeCell).join(",");
  const body = rows
    .map((r) => keys.map((k) => escapeCell(r[k])).join(","))
    .join("\n");
  // BOM (﻿) so Excel detects UTF-8.
  return `﻿${header}\n${body}\n`;
}

export function csvResponse(filename: string, rows: Array<Record<string, unknown>>) {
  const csv = rowsToCsv(rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "cache-control": "no-store",
    },
  });
}
