/**
 * CSV export helpers. RFC 4180 escaping (double-quote fields containing
 * commas/quotes/newlines, escape internal quotes by doubling). UTF-8 BOM at
 * start so Excel opens with Vietnamese diacritics intact.
 *
 * Dates are formatted as dd/MM/yyyy HH:mm (UTC+7 / Vietnam time).
 */

function formatDateVN(d: Date): string {
  // Shift to UTC+7 then format as dd/MM/yyyy HH:mm
  const ms = d.getTime() + 7 * 60 * 60 * 1000;
  const t = new Date(ms);
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = t.getUTCFullYear();
  const HH = String(t.getUTCHours()).padStart(2, "0");
  const MM = String(t.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = formatDateVN(v);
  else if (typeof v === "boolean") s = v ? "Có" : "Không";
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "﻿";
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
