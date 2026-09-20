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
    return <main className="w-full py-4 text-meta">Đang tải...</main>;
  }

  return (
    <main className="w-full py-4">
      <Link
        href="/instructor/gameshow/question-sets"
        className="text-sm font-medium text-[rgb(var(--brand))] hover:underline"
      >
        ← Bộ câu hỏi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="text-meta mt-1.5">{items.length} câu hỏi</p>

      {err && (
        <div className="banner-danger mt-3">
          {err}
        </div>
      )}

      <div className="mt-8 space-y-3">
        {items.map((it, i) => (
          <div key={it.id} className="card !p-4">
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
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))]">
                      <span className="rounded-full bg-[rgb(var(--brand)/0.12)] px-2.5 py-0.5 font-semibold text-[rgb(var(--brand))]">
                        Câu {i + 1}
                      </span>
                      {it.type === "mcq" ? "Trắc nghiệm" : "Đúng/Sai"} · {it.timeLimitSec}s
                    </span>
                    <p className="mt-2 text-sm font-semibold">{it.prompt}</p>
                    <ul className="mt-2 space-y-1">
                      {it.options.map((o) => (
                        <li
                          key={o.id}
                          className={`flex items-center gap-2 text-xs ${o.isCorrect ? "font-semibold text-emerald-600" : "text-[rgb(var(--text-muted))]"}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 flex-none rounded-full ${o.isCorrect ? "bg-emerald-500" : "bg-[rgb(var(--border))]"}`}
                          />
                          {o.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-none flex-col gap-1">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onMove(it.id, "up")}
                        disabled={busy || i === 0}
                        className="btn-secondary btn-sm !px-2.5"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => onMove(it.id, "down")}
                        disabled={busy || i === items.length - 1}
                        className="btn-secondary btn-sm !px-2.5"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => setEditingId(it.id)}
                      className="btn-secondary btn-sm"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => onDelete(it.id)}
                      className="btn-sm btn inline-flex text-[rgb(var(--danger))] hover:bg-[rgb(var(--surface-danger))]"
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
        <div className="mt-4 rounded-xl border border-[rgb(var(--brand)/0.4)] bg-[rgb(var(--brand)/0.05)] p-5">
          <QuestionForm busy={busy} onCancel={() => setShowAddForm(false)} onSave={onAdd} />
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-[rgb(var(--brand)/0.5)] bg-[rgb(var(--brand)/0.05)] px-4 py-3.5 text-sm font-semibold text-[rgb(var(--brand))] transition-colors hover:bg-[rgb(var(--brand)/0.1)]"
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
          className={type === "mcq" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
        >
          Trắc nghiệm
        </button>
        <button
          type="button"
          onClick={() => onChangeType("true_false")}
          className={type === "true_false" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
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
        className="textarea"
      />

      <div>
        <label className="label text-xs">
          Thời gian trả lời: {timeLimitSec}s
        </label>
        <input
          type="range"
          min={TIME_MIN}
          max={TIME_MAX}
          step={5}
          value={timeLimitSec}
          onChange={(e) => setTimeLimitSec(Number(e.target.value))}
          className="mt-2 w-full accent-[rgb(var(--brand))]"
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
              className="h-4 w-4 accent-[rgb(var(--brand))]"
            />
            <input
              type="text"
              value={o.label}
              onChange={(e) => setLabel(i, e.target.value)}
              disabled={type === "true_false"}
              maxLength={200}
              placeholder={`Đáp án ${i + 1}`}
              className="input flex-1 disabled:opacity-60"
            />
            {type === "mcq" && options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-xs font-medium text-[rgb(var(--danger))] hover:underline"
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
            className="text-xs font-semibold text-[rgb(var(--brand))] hover:underline"
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
          className="btn-secondary btn-sm"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={() => onSave({ type, prompt: prompt.trim(), timeLimitSec, options })}
          disabled={busy || !valid}
          className="btn-primary btn-sm"
        >
          Lưu
        </button>
      </div>
    </div>
  );
}
