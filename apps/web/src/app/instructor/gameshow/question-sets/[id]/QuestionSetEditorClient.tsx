"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";

type QuestionType = "mcq" | "true_false";

interface OptionDraft {
  label: string;
  isCorrect: boolean;
}

interface Item {
  id: string;
  type: QuestionType;
  prompt: string;
  timeLimitSec: number;
  orderIndex: number;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
}

const TIME_MIN = 5;
const TIME_MAX = 120;

function emptyOptionsFor(type: QuestionType): OptionDraft[] {
  if (type === "true_false") {
    return [
      { label: "Đúng", isCorrect: true },
      { label: "Sai", isCorrect: false },
    ];
  }
  return [
    { label: "", isCorrect: true },
    { label: "", isCorrect: false },
  ];
}

export default function QuestionSetEditorClient({ setId }: { setId: string }) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch(apiUrl(`/api/gameshow/question-sets/${setId}`));
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = await r.json();
    setTitle(j.title);
    setItems(j.items);
  };

  useEffect(() => {
    load().finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const onAdd = async (draft: QuestionDraft) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/gameshow/question-sets/${setId}/items`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await load();
      setShowAddForm(false);
    } finally {
      setBusy(false);
    }
  };

  const onUpdate = async (itemId: string, draft: QuestionDraft) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/gameshow/question-sets/${setId}/items/${itemId}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await load();
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (itemId: string) => {
    if (!window.confirm("Xoá câu hỏi này?")) return;
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/gameshow/question-sets/${setId}/items/${itemId}`), {
        method: "DELETE",
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onMove = async (itemId: string, direction: "up" | "down") => {
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/gameshow/question-sets/${setId}/items/${itemId}/move`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return <main className="mx-auto max-w-2xl px-4 py-8 text-sm text-faint">Đang tải...</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/instructor/gameshow/question-sets"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Bộ câu hỏi
      </Link>
      <h1 className="mt-2 text-2xl font-bold">📝 {title}</h1>
      <p className="mt-1 text-sm text-faint">{items.length} câu hỏi</p>

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {items.map((it, i) => (
          <div key={it.id} className="rounded border border-default bg-white p-4">
            {editingId === it.id ? (
              <QuestionForm
                initial={it}
                busy={busy}
                onCancel={() => setEditingId(null)}
                onSave={(draft) => onUpdate(it.id, draft)}
              />
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-faint">
                      Câu {i + 1} · {it.type === "mcq" ? "Trắc nghiệm" : "Đúng/Sai"} ·{" "}
                      {it.timeLimitSec}s
                    </span>
                    <p className="mt-1 text-sm font-semibold">{it.prompt}</p>
                    <ul className="mt-2 space-y-1">
                      {it.options.map((o) => (
                        <li
                          key={o.id}
                          className={`text-xs ${o.isCorrect ? "font-semibold text-green-700" : "text-faint"}`}
                        >
                          {o.isCorrect ? "✅" : "◻"} {o.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-none flex-col gap-1">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onMove(it.id, "up")}
                        disabled={busy || i === 0}
                        className="rounded border border-default bg-white px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => onMove(it.id, "down")}
                        disabled={busy || i === items.length - 1}
                        className="rounded border border-default bg-white px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => setEditingId(it.id)}
                      className="rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => onDelete(it.id)}
                      className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddForm ? (
        <div className="mt-4 rounded border border-blue-300 bg-blue-50/40 p-4">
          <QuestionForm busy={busy} onCancel={() => setShowAddForm(false)} onSave={onAdd} />
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 w-full rounded border border-dashed border-blue-400 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          + Thêm câu hỏi
        </button>
      )}
    </main>
  );
}

interface QuestionDraft {
  type: QuestionType;
  prompt: string;
  timeLimitSec: number;
  options: OptionDraft[];
}

function QuestionForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: Item;
  busy: boolean;
  onSave: (draft: QuestionDraft) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? "mcq");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [timeLimitSec, setTimeLimitSec] = useState(initial?.timeLimitSec ?? 20);
  const [options, setOptions] = useState<OptionDraft[]>(
    initial ? initial.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })) : emptyOptionsFor("mcq"),
  );

  const onChangeType = (next: QuestionType) => {
    setType(next);
    setOptions(emptyOptionsFor(next));
  };

  const setCorrect = (index: number) => {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));
  };

  const setLabel = (index: number, label: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, label } : o)));
  };

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { label: "", isCorrect: false }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((o) => o.isCorrect) && next[0]) next[0].isCorrect = true;
      return next;
    });
  };

  const valid =
    prompt.trim().length > 0 &&
    options.every((o) => o.label.trim().length > 0) &&
    options.filter((o) => o.isCorrect).length === 1;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChangeType("mcq")}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            type === "mcq" ? "bg-blue-600 text-white" : "border border-default bg-white"
          }`}
        >
          Trắc nghiệm
        </button>
        <button
          type="button"
          onClick={() => onChangeType("true_false")}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            type === "true_false" ? "bg-blue-600 text-white" : "border border-default bg-white"
          }`}
        >
          Đúng / Sai
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Nội dung câu hỏi"
        className="w-full rounded border border-default px-3 py-2 text-sm"
      />

      <div>
        <label className="block text-xs font-medium text-slate-600">
          Thời gian trả lời: {timeLimitSec}s
        </label>
        <input
          type="range"
          min={TIME_MIN}
          max={TIME_MAX}
          step={5}
          value={timeLimitSec}
          onChange={(e) => setTimeLimitSec(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </div>

      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct-option"
              checked={o.isCorrect}
              onChange={() => setCorrect(i)}
              title="Đánh dấu đáp án đúng"
            />
            <input
              type="text"
              value={o.label}
              onChange={(e) => setLabel(i, e.target.value)}
              disabled={type === "true_false"}
              maxLength={200}
              placeholder={`Đáp án ${i + 1}`}
              className="flex-1 rounded border border-default px-2 py-1.5 text-sm disabled:bg-slate-50"
            />
            {type === "mcq" && options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Xoá
              </button>
            )}
          </div>
        ))}
        {type === "mcq" && options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            + Thêm đáp án
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={() => onSave({ type, prompt: prompt.trim(), timeLimitSec, options })}
          disabled={busy || !valid}
          className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Lưu
        </button>
      </div>
    </div>
  );
}
