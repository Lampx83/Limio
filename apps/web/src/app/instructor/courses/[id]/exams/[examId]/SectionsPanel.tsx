"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";

type Section = {
  id: string;
  title: string;
  orderIndex: number;
  selectionMode: "fixed" | "random_from_bank";
  resolutionMode: "per_attempt" | "per_publish";
  poolFilter: {
    bankIds?: string[];
    count?: number;
    skillIds?: string[];
    difficulty?: number[];
  } | null;
  itemCount: number;
};

type Bank = { id: string; name: string };

const MODE_LABEL: Record<Section["selectionMode"], string> = {
  fixed: "Cố định",
  random_from_bank: "Random từ bank",
};
const RES_LABEL: Record<Section["resolutionMode"], string> = {
  per_attempt: "Mỗi SV 1 đề khác",
  per_publish: "Đề cố định sau publish",
};

export default function SectionsPanel({ examId }: { examId: string }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewingSectionId, setPreviewingSectionId] = useState<string | null>(null);

  const refresh = async () => {
    setErr(null);
    const [sRes, bRes] = await Promise.all([
      fetch(`/api/exams/${examId}/sections`),
      fetch("/api/question-banks"),
    ]);
    if (sRes.ok) setSections(((await sRes.json()) as { sections: Section[] }).sections);
    if (bRes.ok) setBanks(((await bRes.json()) as { banks: Bank[] }).banks);
  };
  useEffect(() => {
    refresh();
  }, [examId]);

  const onDelete = async (id: string) => {
    if (!window.confirm("Xoá section?")) return;
    const r = await fetch(`/api/exam-sections/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    await refresh();
  };

  return (
    <section
      data-testid="sections-panel"
      className="mt-8 rounded border border-default bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold"><Layers className="h-4 w-4 shrink-0 text-slate-400" /> Sections</h2>
          <p className="text-sm text-faint">
            Chia bài thi thành phần. Phần &ldquo;random từ bank&rdquo; chọn N câu hỏi từ bank
            mỗi lần SV vào thi (mỗi SV 1 bộ đề khác — decision #3/4).
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showAdd ? "Đóng" : "+ Thêm section"}
        </button>
      </div>

      {showAdd && (
        <AddSectionForm
          examId={examId}
          banks={banks}
          onDone={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {sections === null && (
          <li className="text-center text-sm text-faint">Đang tải...</li>
        )}
        {sections && sections.length === 0 && (
          <li className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
            Chưa có section nào.
          </li>
        )}
        {sections?.map((s) => (
          <li
            key={s.id}
            data-testid={`section-row-${s.id}`}
            className="rounded border border-default bg-white p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                #{s.orderIndex + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-xs text-faint">
                  {MODE_LABEL[s.selectionMode]} · {RES_LABEL[s.resolutionMode]} ·{" "}
                  {s.selectionMode === "random_from_bank"
                    ? `pool count=${s.poolFilter?.count ?? "?"}`
                    : `${s.itemCount} câu`}
                </div>
              </div>
              {s.selectionMode === "random_from_bank" && (
                <button
                  onClick={() => setPreviewingSectionId(s.id)}
                  className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 hover:bg-blue-100"
                  title="Xem danh sách câu hỏi sẽ được rút (preview)"
                >
                  Xem {s.poolFilter?.count ?? "?"} câu
                </button>
              )}
              <button
                onClick={() => onDelete(s.id)}
                className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100"
              >
                Xoá
              </button>
            </div>
          </li>
        ))}
      </ul>

      {previewingSectionId && (
        <PreviewPoolModal
          examId={examId}
          sectionId={previewingSectionId}
          onClose={() => setPreviewingSectionId(null)}
          onImported={async () => {
            setPreviewingSectionId(null);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

interface PreviewQuestion {
  id: string;
  code: string | null;
  prompt: string;
  type: string;
  difficulty: number;
  cognitiveLevel: "remember_understand" | "apply" | "analyze_plus";
  topic: string | null;
  correctPreview: string | null;
  bucketIndex: number | null;
}

const COG_LABEL: Record<string, string> = {
  remember_understand: "Nhớ & Hiểu",
  apply: "Vận dụng",
  analyze_plus: "Phân tích+",
};

/**
 * Modal hiện danh sách N câu sẽ được rút cho section random_from_bank.
 * Default seed = "preview:{sectionId}" → deterministic; click "Xem ví dụ khác"
 * để re-sample với seed ngẫu nhiên (instructor verify pool đa dạng).
 */
function PreviewPoolModal({
  examId,
  sectionId,
  onClose,
  onImported,
}: {
  examId: string;
  sectionId: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [data, setData] = useState<{
    totalRequested: number;
    totalSampled: number;
    questions: PreviewQuestion[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reshuffleSeed, setReshuffleSeed] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!data) return;
    const ok = window.confirm(
      `Chốt cứng ${data.totalSampled} câu này vào đề thi?\n\n` +
        "• Section sẽ chuyển từ 'random từ bank' sang 'fixed' — mọi học viên thấy CÙNG bộ câu (không còn rút khác nhau theo người).\n" +
        "• Câu hỏi sẽ xuất hiện ở tab 'Nội dung' để sửa/reorder/xoá từng câu.\n" +
        "• Thao tác không thể tự động hoàn tác — phải xoá section và tạo lại nếu muốn quay về random.",
    );
    if (!ok) return;
    setImporting(true);
    setErr(null);
    try {
      const body = reshuffleSeed ? { reshuffleSeed } : {};
      const r = await fetch(
        `/api/exams/${examId}/sections/${sectionId}/import-preview`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { imported: number; skipped: { reason: string }[] };
      const skipMsg =
        j.skipped.length > 0
          ? ` (${j.skipped.length} bị skip: ${j.skipped[0]?.reason ?? "?"}…)`
          : "";
      alert(`Đã import ${j.imported} câu vào đề thi${skipMsg}.`);
      await onImported();
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const url = reshuffleSeed
      ? `/api/exams/${examId}/sections/${sectionId}/preview-pool?reshuffle=${encodeURIComponent(reshuffleSeed)}`
      : `/api/exams/${examId}/sections/${sectionId}/preview-pool`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          setErr(`HTTP ${r.status}`);
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (!cancelled && j) setData(j);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [examId, sectionId, reshuffleSeed]);

  // Group by bucketIndex để show phân bổ M-level.
  const byBucket = new Map<number | null, PreviewQuestion[]>();
  for (const q of data?.questions ?? []) {
    const arr = byBucket.get(q.bucketIndex) ?? [];
    arr.push(q);
    byBucket.set(q.bucketIndex, arr);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-default px-4 py-3">
          <div>
            <h3 className="text-base font-semibold">Danh sách câu hỏi sẽ rút</h3>
            <p className="mt-0.5 text-xs text-faint">
              Đây là ví dụ deterministic cho seed{" "}
              <code className="font-mono">preview:{sectionId.slice(0, 8)}</code>.
              Mỗi học viên thực tế sẽ thấy bộ khác (per-attempt seed).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-slate-700"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && <p className="text-center text-sm text-faint">Đang sample…</p>}
          {err && <p className="text-center text-sm text-red-700">⚠ {err}</p>}
          {data && (
            <>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Đã sample{" "}
                  <strong className="tabular-nums text-slate-900">
                    {data.totalSampled}
                  </strong>{" "}
                  / {data.totalRequested} câu
                  {data.totalSampled < data.totalRequested && (
                    <span className="ml-2 text-amber-700">
                      ⚠ thiếu {data.totalRequested - data.totalSampled} — pool
                      chưa đủ câu published
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setReshuffleSeed(`${Math.random()}`)}
                  className="rounded border border-default px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  🎲 Xem ví dụ khác
                </button>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="border-b border-default px-2 py-1.5 text-left font-medium text-slate-500 w-10">
                      #
                    </th>
                    <th className="border-b border-default px-2 py-1.5 text-left font-medium text-slate-500 w-24">
                      Mã
                    </th>
                    <th className="border-b border-default px-2 py-1.5 text-left font-medium text-slate-500 w-28">
                      Chủ đề
                    </th>
                    <th className="border-b border-default px-2 py-1.5 text-left font-medium text-slate-500 w-28">
                      Mức · ĐK
                    </th>
                    <th className="border-b border-default px-2 py-1.5 text-left font-medium text-slate-500">
                      Nội dung
                    </th>
                    <th className="border-b border-default px-2 py-1.5 text-center font-medium text-slate-500 w-16">
                      Đáp án
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.questions.map((q, idx) => (
                    <tr key={q.id} className="border-b border-default last:border-b-0">
                      <td className="px-2 py-1.5 text-faint tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-indigo-700">
                        {q.code ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {q.topic ?? <span className="text-faint">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col">
                          <span className="text-slate-700">
                            {COG_LABEL[q.cognitiveLevel] ?? q.cognitiveLevel}
                          </span>
                          <span className="text-[10px] text-faint">
                            ĐK {q.difficulty}/5
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-slate-800">
                        <span className="line-clamp-2">{q.prompt}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {q.correctPreview ? (
                          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                            ✓ {q.correctPreview}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Phân bổ M-level (bucket) — instructor verify pool đúng intent */}
              {byBucket.size > 1 && (
                <div className="mt-4 rounded-md border border-default bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Phân bổ theo bucket
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                    {[...byBucket.entries()].map(([idx, qs]) => (
                      <span
                        key={idx ?? "x"}
                        className="rounded border border-default bg-white px-2 py-0.5"
                      >
                        Bucket {idx === null ? "?" : idx + 1}: <strong>{qs.length}</strong>{" "}
                        câu
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-default bg-slate-50 px-4 py-2">
          <p className="text-[11px] text-faint">
            Import = chốt cứng bộ câu hiện tại vào đề (mất randomization per-attempt).
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-default bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={importing || !data || data.totalSampled === 0}
              className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Chuyển section thành fixed + copy mỗi câu thành ExamQuestion"
            >
              {importing
                ? "Đang import…"
                : `Import ${data?.totalSampled ?? 0} câu vào đề thi`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSectionForm({
  examId,
  banks,
  onDone,
}: {
  examId: string;
  banks: Bank[];
  onDone: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"fixed" | "random_from_bank">("fixed");
  const [bankId, setBankId] = useState<string>("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("");
  const [resolution, setResolution] = useState<"per_attempt" | "per_publish">("per_attempt");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        selectionMode: mode,
        resolutionMode: resolution,
      };
      if (mode === "random_from_bank") {
        if (!bankId) {
          setErr("Chọn bank trước");
          return;
        }
        body.poolFilter = {
          bankIds: [bankId],
          count: Number(count) || 10,
          ...(difficulty.trim()
            ? {
                difficulty: difficulty
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5),
              }
            : {}),
        };
      }
      const r = await fetch(`/api/exams/${examId}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      data-testid="add-section-form"
      className="mt-3 rounded border border-default bg-slate-50 p-3"
    >
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Tiêu đề</span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vd: Phần I — Trắc nghiệm"
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label>
          <span className="block text-xs font-medium text-slate-600">Loại</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as never)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          >
            <option value="fixed">Cố định (instructor pick câu)</option>
            <option value="random_from_bank">Random từ bank</option>
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">Resolution</span>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as never)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          >
            <option value="per_attempt">Mỗi SV 1 đề khác</option>
            <option value="per_publish">Đề cố định sau publish</option>
          </select>
        </label>
      </div>

      {mode === "random_from_bank" && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label>
            <span className="block text-xs font-medium text-slate-600">Bank nguồn</span>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              required
              className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
            >
              <option value="">Chọn bank...</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-600">Số câu</span>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-600">Độ khó (1-5, cách `,`)</span>
            <input
              type="text"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="Vd: 1,3,5"
              className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {err && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "..." : "Tạo section"}
        </button>
      </div>
    </form>
  );
}
