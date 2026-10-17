"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";

/**
 * Trọng số (%) của từng Phần trong điểm của bài. Xem core-lms/exam/weighted-score.ts:
 * trọng số thay điểm % chính thức (điểm thang 10 ở trang Kết quả, file xuất, kết
 * quả học viên); điểm thô giữ nguyên. Kiểm tra ở máy chủ; ở đây chỉ hiện tổng
 * và ví dụ để giáo viên thấy ngay con số mình nhập nghĩa là gì.
 */

interface Info {
  sections: Array<{
    id: string;
    title: string;
    weight: number | null;
    maxPoints: number;
    questionCount: number;
    selectionMode: "fixed" | "random_from_bank";
  }>;
  active: boolean;
  reason: string | null;
  weightSum: number;
  orphanQuestionCount: number;
  scoredAttempts: number;
  inProgressAttempts: number;
}

const REASON_TEXT: Record<string, string> = {
  incomplete: "Còn phần chưa có trọng số.",
  sum: "Tổng trọng số chưa bằng 100%.",
  orphans: "Còn câu hỏi chưa thuộc phần nào.",
  not_fixed: "Có phần rút ngẫu nhiên từ ngân hàng.",
  empty_section: "Có phần chưa có câu hỏi.",
  single_section: "Đề mới có một phần.",
};

const parse = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export default function SectionWeightsCard({ examId, onChanged }: { examId: string; onChanged?: () => void }) {
  const url = `/api/exams/${examId}/section-weights`;
  const [info, setInfo] = useState<Info | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(url);
    if (!r.ok) return setErr("Không tải được trọng số.");
    const j = (await r.json()) as Info;
    setInfo(j);
    setVals(Object.fromEntries(j.sections.map((s) => [s.id, s.weight === null ? "" : String(s.weight).replace(".", ",")])));
  }, [url]);
  useEffect(() => {
    void load();
    const again = () => void load();
    window.addEventListener("fbm:exam-sections-changed", again);
    return () => window.removeEventListener("fbm:exam-sections-changed", again);
  }, [load]);

  const nums = useMemo(
    () => (info ? info.sections.map((s) => parse(vals[s.id] ?? "")) : []),
    [info, vals],
  );
  if (!info || info.sections.length < 2) return null;

  const anyEntered = nums.some((n) => n !== null);
  const invalid = nums.some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 100));
  const filled = nums.every((n) => n !== null && !Number.isNaN(n));
  const sum = nums.reduce<number>((s, n) => s + (n !== null && !Number.isNaN(n) ? n : 0), 0);
  const sumOk = filled && Math.abs(sum - 100) < 0.001;
  const hasStored = info.sections.some((s) => s.weight !== null);
  const dirty = info.sections.some((s, i) => (s.weight ?? null) !== (nums[i] ?? null));
  const blockedBy =
    info.inProgressAttempts > 0
      ? `Đang có ${info.inProgressAttempts} thí sinh làm bài. Đợi các em nộp bài xong rồi mới đổi trọng số.`
      : info.orphanQuestionCount > 0
        ? `Còn ${info.orphanQuestionCount} câu hỏi chưa thuộc phần nào. Xếp các câu đó vào một phần trước khi đặt trọng số.`
        : info.sections.some((s) => s.selectionMode !== "fixed")
          ? "Có phần rút ngẫu nhiên từ ngân hàng nên chưa đặt được trọng số."
          : null;

  const sumText = !anyEntered
    ? "Chưa đặt trọng số: điểm tính theo tỉ lệ điểm các câu."
    : filled && sumOk
      ? "Tổng: 100%"
      : filled
        ? `Tổng: ${fmt(sum)}%, ${sum < 100 ? `còn thiếu ${fmt(100 - sum)}%` : `thừa ${fmt(sum - 100)}%`}`
        : `Tổng: ${fmt(sum)}%. Cần nhập trọng số cho mọi phần.`;

  // Ví dụ: đúng hết phần đầu, được nửa số điểm phần hai, các phần còn lại 0.
  const example =
    sumOk && !invalid
      ? ((nums[0] as number) + (nums[1] as number) / 2) / 10
      : null;

  const send = async (weights: Array<{ sectionId: string; weight: number | null }>, verb: "save" | "clear") => {
    setErr(null);
    setSaved(null);
    const changing = verb === "clear" ? hasStored : dirty;
    let confirmRecalc = false;
    if (changing && info.scoredAttempts > 0) {
      if (
        !window.confirm(
          `Sẽ tính lại điểm của ${info.scoredAttempts} bài đã chấm xong. Điểm thô giữ nguyên, chỉ điểm thang 10 thay đổi. Tiếp tục?`,
        )
      )
        return;
      confirmRecalc = true;
    }
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weights, confirmRecalc }),
      });
      const j = (await r.json().catch(() => null)) as
        | { attemptsRecomputed?: number; error?: string; details?: { message?: string } }
        | null;
      if (!r.ok) return setErr(j?.details?.message ?? `Không lưu được (mã lỗi: ${j?.error ?? r.status}).`);
      setSaved(
        verb === "clear"
          ? "Đã bỏ trọng số."
          : `Đã lưu trọng số.${j?.attemptsRecomputed ? ` Đã tính lại điểm ${j.attemptsRecomputed} bài.` : ""}`,
      );
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-default bg-slate-50 p-4" data-testid="section-weights">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Scale className="h-4 w-4 text-slate-500" /> Trọng số điểm theo phần
      </h3>
      <p className="mt-1 text-xs text-faint">
        Trọng số quyết định mỗi phần chiếm bao nhiêu % điểm của bài. Điểm thang 10 ở trang Kết quả, file xuất và
        kết quả học viên xem đều tính theo trọng số. Điểm thô (tổng điểm các câu) giữ nguyên.
      </p>

      {info.active && (
        <p className="mt-2 rounded bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">Trọng số đang áp dụng cho điểm của bài.</p>
      )}
      {hasStored && !info.active && info.reason && info.reason !== "no_weights" && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          Trọng số đã lưu nhưng chưa áp dụng: {REASON_TEXT[info.reason] ?? info.reason} Lưu lại sau khi sửa để tính lại điểm.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {info.sections.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded border border-default bg-white px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-faint">
                {s.questionCount} câu · tối đa {s.maxPoints} điểm
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="sr-only">Trọng số của {s.title}</span>
              <input
                className="input w-20 text-right"
                inputMode="decimal"
                value={vals[s.id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [s.id]: e.target.value }))}
                placeholder="—"
                disabled={busy || blockedBy !== null}
                aria-invalid={nums[i] !== null && Number.isNaN(nums[i] as number)}
              />
              <span className="text-slate-500">%</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-medium ${anyEntered && !sumOk ? "text-amber-800" : sumOk ? "text-emerald-800" : "text-faint"}`}>
          {sumText}
        </span>
        <div className="flex flex-wrap gap-2">
          {hasStored && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy || blockedBy !== null}
              onClick={() => send([], "clear")}
            >
              Bỏ trọng số
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || blockedBy !== null || !dirty || !sumOk || invalid}
            onClick={() => send(info.sections.map((s, i) => ({ sectionId: s.id, weight: nums[i] as number })), "save")}
          >
            {busy ? "Đang lưu…" : "Lưu trọng số"}
          </button>
        </div>
      </div>

      {example !== null && (
        <p className="mt-2 text-xs text-slate-600">
          Ví dụ: đúng hết &ldquo;{info.sections[0]!.title}&rdquo;, được nửa số điểm &ldquo;{info.sections[1]!.title}&rdquo;, các
          phần còn lại 0 điểm ⇒ <b>{fmt(example)} điểm</b> thang 10.
        </p>
      )}
      {blockedBy && <p className="mt-2 text-xs font-medium text-amber-800">{blockedBy}</p>}
      {err && <p className="mt-2 text-sm font-semibold text-red-700">{err}</p>}
      {saved && <p className="mt-2 text-sm text-emerald-800">{saved}</p>}
    </div>
  );
}
