"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import type { AiCapabilitySummaryLine, AiCheckResult } from "@/lib/aiCapabilityCheck";

export interface Report {
  results: AiCheckResult[];
  summary: AiCapabilitySummaryLine[];
}

const SUMMARY_STYLE: Record<AiCapabilitySummaryLine["status"], string> = {
  ok: "banner-success",
  warn: "banner-warning",
  fail: "banner-danger",
};
const SUMMARY_ICON: Record<AiCapabilitySummaryLine["status"], string> = { ok: "✓", warn: "!", fail: "✗" };

/**
 * "Test đầy đủ" cho AI. Nút "Test key" cũ chỉ gọi GET /v1/models nên xanh cả khi key thiếu quyền
 * Whisper/TTS/Embeddings; ở đây thử thật từng khả năng và nói rõ tính năng nào dùng được (xem
 * lib/aiCapabilityCheck.ts). `value` là key đang gõ — rỗng thì thử key đã lưu.
 */
export default function OpenAiFullTest({ value }: { value: string }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/integrations/openai/test-full"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value.trim() ? { value: value.trim() } : {}),
      });
      const j = (await res.json().catch(() => ({}))) as Partial<Report> & { error?: string };
      if (!res.ok || !j.results) {
        setReport(null);
        setError(`Lỗi: ${j.error ?? res.status}`);
      } else {
        setReport({ results: j.results, summary: j.summary ?? [] });
      }
    } catch {
      setReport(null);
      setError("Lỗi: không gọi được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-token pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={busy} className="btn-secondary btn-sm">
          {busy ? "Đang thử 4 khả năng…" : value.trim() ? "Test đầy đủ (key đang gõ)" : "Test đầy đủ"}
        </button>
        <span className="text-xs text-faint">
          Thử thật chat, embeddings, Whisper, TTS · tốn dưới 0,001 USD
        </span>
      </div>

      {error && <p className="mt-3 banner-danger px-3 py-2 text-xs">{error}</p>}

      {report && <FullTestReport report={report} />}
    </div>
  );
}

/** Phần hiển thị kết quả — thuần props để test render được (xem OpenAiFullTest.test.tsx). */
export function FullTestReport({ report }: { report: Report }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-1.5">
        {report.summary.map((s) => (
          <p key={s.label} className={`${SUMMARY_STYLE[s.status]} px-3 py-2 text-xs`}>
            <span className="font-semibold">
              {SUMMARY_ICON[s.status]} {s.label}:
            </span>{" "}
            {s.text}
          </p>
        ))}
      </div>

      <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-token text-xs">
        {report.results.map((r) => (
          <li key={r.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={
                  r.ok ? "font-semibold text-success-700" : r.skipped ? "font-semibold text-faint" : "font-semibold text-danger-700"
                }
              >
                {r.ok ? "✓" : r.skipped ? "–" : "✗"} {r.label}
              </span>
              {!r.skipped && <span className="text-faint">{r.ms} ms</span>}
              {r.detail && <span className="text-muted">{r.skipped ? `Bỏ qua — ${r.detail}` : r.detail}</span>}
            </div>
            {r.error && <p className="mt-1 break-words font-mono text-danger-700">{r.error}</p>}
            {r.hint && <p className="mt-1 text-muted">→ {r.hint}</p>}
            {!r.ok && <p className="mt-1 text-faint">Ảnh hưởng: {r.usedFor}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
