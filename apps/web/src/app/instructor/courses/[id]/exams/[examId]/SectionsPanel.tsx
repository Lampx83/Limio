"use client";

import { useEffect, useState } from "react";

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
          <h2 className="text-base font-semibold">🎲 Sections</h2>
          <p className="text-sm text-faint">
            Chia bài thi thành phần. Phần &ldquo;random từ bank&rdquo; chọn N câu hỏi từ bank
            mỗi lần SV vào thi (mỗi SV 1 bộ đề khác — decision #3/4).
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
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
    </section>
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
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : "Tạo section"}
        </button>
      </div>
    </form>
  );
}
