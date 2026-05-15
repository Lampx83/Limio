"use client";

import { useState } from "react";

type Status = "draft" | "published" | "archived";
type QuestionType =
  | "mcq"
  | "multi"
  | "true_false_notgiven"
  | "gap_fill"
  | "short_answer"
  | "essay"
  | "matching_heading";

type Item = {
  id: string;
  bankId: string;
  bankName: string;
  type: string;
  prompt: string;
  points: number;
  difficulty: number;
  status: Status;
  skillIds: string[];
  updatedAt: string;
};

type Skill = { id: string; code: string; name: string };

const STATUS_LABEL: Record<Status, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

export default function BankWorkbench({
  bankId,
  initialItems,
  initialCursor,
  suggestedSkills,
}: {
  bankId: string;
  initialItems: Item[];
  initialCursor: string | null;
  suggestedSkills: Skill[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = async (statusFilter?: Status) => {
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    const r = await fetch(`/api/question-banks/${bankId}/questions?${params}`);
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as { items: Item[]; nextCursor: string | null };
    setItems(j.items);
    setCursor(j.nextCursor);
  };

  const flashOk = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3000);
  };

  const visible = filter === "all" ? items : items.filter((i) => i.status === filter);
  const counts = {
    all: items.length,
    draft: items.filter((i) => i.status === "draft").length,
    published: items.filter((i) => i.status === "published").length,
    archived: items.filter((i) => i.status === "archived").length,
  };

  const Pill = ({ k, label }: { k: "all" | Status; label: string }) => (
    <button
      onClick={() => setFilter(k)}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        filter === k
          ? "border-blue-300 bg-blue-100 text-blue-800"
          : "border-default bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label} ({counts[k]})
    </button>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill k="all" label="Tất cả" />
        <Pill k="draft" label="Nháp" />
        <Pill k="published" label="Đã publish" />
        <Pill k="archived" label="Lưu trữ" />
        <button
          onClick={() => setImporting((s) => !s)}
          className="ml-auto rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {importing ? "Đóng" : "Import CSV"}
        </button>
        <button
          onClick={() => setAdding((s) => !s)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {adding ? "Đóng" : "+ Thêm câu hỏi"}
        </button>
      </div>

      {importing && (
        <ImportCsvPanel
          bankId={bankId}
          onDone={async () => {
            setImporting(false);
            await refresh();
            flashOk("Đã import");
          }}
        />
      )}

      {adding && (
        <QuestionForm
          bankId={bankId}
          suggestedSkills={suggestedSkills}
          onDone={async () => {
            setAdding(false);
            await refresh();
            flashOk("Đã tạo câu hỏi");
          }}
        />
      )}

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}
      {flash && <div className="mt-3 text-xs text-emerald-700">{flash}</div>}

      <ul data-testid="question-list" className="mt-4 space-y-2">
        {visible.length === 0 && (
          <li className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
            Không có câu hỏi.
          </li>
        )}
        {visible.map((q) => (
          <li
            key={q.id}
            data-testid={`question-row-${q.id}`}
            className="rounded border border-default bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] ${STATUS_TONE[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase">
                    {q.type}
                  </span>
                  <span className="text-[11px] text-faint">
                    {q.points} điểm · ✦{q.difficulty}/5 · {q.skillIds.length} skill
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm">{q.prompt}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => setEditing(editing === q.id ? null : q.id)}
                  className="rounded border border-default bg-white px-2 py-0.5 text-xs hover:bg-slate-50"
                >
                  {editing === q.id ? "Đóng" : "Sửa"}
                </button>
                <StatusActions
                  q={q}
                  onChange={async () => {
                    await refresh();
                    flashOk("Đã cập nhật");
                  }}
                />
              </div>
            </div>
            {editing === q.id && (
              <QuestionEditPanel
                q={q}
                suggestedSkills={suggestedSkills}
                onDone={async () => {
                  setEditing(null);
                  await refresh();
                  flashOk("Đã lưu");
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {cursor && (
        <div className="mt-4 text-center">
          <button
            onClick={async () => {
              const r = await fetch(
                `/api/question-banks/${bankId}/questions?cursor=${cursor}`,
              );
              const j = (await r.json()) as { items: Item[]; nextCursor: string | null };
              setItems((prev) => [...prev, ...j.items]);
              setCursor(j.nextCursor);
            }}
            className="rounded border border-default bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Tải thêm
          </button>
        </div>
      )}
    </div>
  );
}

function StatusActions({ q, onChange }: { q: Item; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const call = async (path: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/bank-questions/${q.id}/${path}`, { method: "POST" });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {q.status === "draft" && (
        <button
          onClick={() => call("publish")}
          disabled={busy || q.skillIds.length === 0}
          title={q.skillIds.length === 0 ? "Cần ≥1 skill trước khi publish" : "Publish"}
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Publish
        </button>
      )}
      {q.status !== "archived" && q.status !== "draft" && (
        <button
          onClick={() => call("archive")}
          disabled={busy}
          className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
        >
          Lưu trữ
        </button>
      )}
      {err && (
        <span className="text-[10px] text-red-700">{err}</span>
      )}
    </>
  );
}

function QuestionForm({
  bankId,
  suggestedSkills,
  onDone,
}: {
  bankId: string;
  suggestedSkills: Skill[];
  onDone: () => Promise<void>;
}) {
  const [type, setType] = useState<QuestionType>("mcq");
  const [prompt, setPrompt] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [points, setPoints] = useState(1);
  // For MCQ — simple A/B/C/D with isCorrect index.
  const [options, setOptions] = useState<{ label: string; correct: boolean }[]>([
    { label: "", correct: true },
    { label: "", correct: false },
    { label: "", correct: false },
    { label: "", correct: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const config: Record<string, unknown> =
        type === "mcq" || type === "multi"
          ? {
              options: options
                .map((o, i) => ({ id: String.fromCharCode(97 + i), label: o.label.trim(), isCorrect: o.correct }))
                .filter((o) => o.label.length > 0),
            }
          : type === "true_false_notgiven"
            ? { correct: "true" }
            : type === "short_answer"
              ? { acceptedAnswers: [], matchMode: "exact" }
              : type === "essay"
                ? { rubric: "" }
                : {};
      const r = await fetch(`/api/question-banks/${bankId}/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, prompt, config, difficulty, points }),
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
      data-testid="add-question-form"
      className="mt-3 rounded-lg border border-default bg-white p-4 shadow-sm"
    >
      <div className="flex gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Loại</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className="mt-1 rounded border border-default px-3 py-2 text-sm"
          >
            <option value="mcq">MCQ (1 đáp án)</option>
            <option value="multi">Multi (nhiều đáp án)</option>
            <option value="true_false_notgiven">True/False/Not Given</option>
            <option value="gap_fill">Điền từ</option>
            <option value="short_answer">Câu trả lời ngắn</option>
            <option value="essay">Tự luận</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Độ khó (1-5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="mt-1 w-20 rounded border border-default px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Điểm</span>
          <input
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="mt-1 w-20 rounded border border-default px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="block text-xs font-medium text-slate-600">Nội dung câu hỏi</span>
        <textarea
          required
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={10000}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </label>

      {(type === "mcq" || type === "multi") && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-slate-600">Đáp án</div>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === "mcq" ? "radio" : "checkbox"}
                checked={o.correct}
                onChange={(e) => {
                  if (type === "mcq") {
                    setOptions((prev) => prev.map((p, j) => ({ ...p, correct: j === i })));
                  } else {
                    setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, correct: e.target.checked } : p)));
                  }
                }}
              />
              <input
                type="text"
                value={o.label}
                onChange={(e) =>
                  setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
                }
                placeholder={`Phương án ${String.fromCharCode(65 + i)}`}
                className="flex-1 rounded border border-default px-2 py-1 text-sm"
              />
            </div>
          ))}
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
          disabled={busy || !prompt.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : "Tạo (draft)"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-faint">
        Sau khi tạo, gán ≥ 1 skill rồi mới publish được.
      </p>
    </form>
  );
}

function QuestionEditPanel({
  q,
  suggestedSkills,
  onDone,
}: {
  q: Item;
  suggestedSkills: Skill[];
  onDone: () => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(q.prompt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [skillIds, setSkillIds] = useState(q.skillIds);

  const onSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/bank-questions/${q.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  const toggleSkill = async (skillId: string) => {
    const isOn = skillIds.includes(skillId);
    const r = await fetch(`/api/bank-questions/${q.id}/tags`, {
      method: isOn ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    setSkillIds((p) => (isOn ? p.filter((id) => id !== skillId) : [...p, skillId]));
  };

  return (
    <div className="mt-3 rounded border border-default bg-slate-50 p-3">
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Nội dung</span>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        />
      </label>

      {suggestedSkills.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-600">Skill tags (đã dùng trong bank)</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {suggestedSkills.map((s) => {
              const on = skillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSkill(s.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    on
                      ? "border-blue-300 bg-blue-100 text-blue-800"
                      : "border-default bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {err && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}

function ImportCsvPanel({
  bankId,
  onDone,
}: {
  bankId: string;
  onDone: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<{ created: number; failed: number } | null>(null);

  const onImport = async () => {
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setErr("CSV trống hoặc thiếu cột bắt buộc (type, prompt).");
        return;
      }
      let created = 0;
      let failed = 0;
      for (const row of rows) {
        const r = await fetch(`/api/question-banks/${bankId}/questions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(row),
        });
        if (r.ok) created++;
        else failed++;
      }
      setReport({ created, failed });
      if (created > 0) await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded border border-default bg-slate-50 p-3">
      <p className="text-xs text-faint">
        Dán CSV. Header tối thiểu: <code>type,prompt</code>. Hỗ trợ thêm:{" "}
        <code>difficulty,points,optionA,optionB,optionC,optionD,correct</code> (cho MCQ — `correct` = A/B/C/D).
      </p>
      <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-700">
{`type,prompt,difficulty,points,optionA,optionB,optionC,optionD,correct
mcq,1+1=?,1,1,2,3,4,5,A
mcq,Thủ đô VN?,2,1,Hà Nội,TP HCM,Đà Nẵng,Huế,A`}
      </pre>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Dán CSV vào đây..."
        className="mt-2 w-full rounded border border-default bg-white px-3 py-2 font-mono text-xs"
      />
      {err && (
        <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">⚠ {err}</div>
      )}
      {report && (
        <div className="mt-2 text-xs text-emerald-700">
          Tạo thành công {report.created} / lỗi {report.failed}
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button
          onClick={onImport}
          disabled={busy || !text.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : "Import"}
        </button>
      </div>
    </div>
  );
}

function parseCsv(raw: string): Array<{
  type: string;
  prompt: string;
  config: Record<string, unknown>;
  difficulty?: number;
  points?: number;
}> {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0]!.split(",").map((s) => s.trim());
  const idx = (k: string) => head.indexOf(k);
  const iType = idx("type");
  const iPrompt = idx("prompt");
  if (iType < 0 || iPrompt < 0) return [];
  const iDiff = idx("difficulty");
  const iPoints = idx("points");
  const iCorrect = idx("correct");
  const optIdx = ["A", "B", "C", "D"].map((l) => idx(`option${l}`));

  const out: ReturnType<typeof parseCsv> = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r]!.split(",").map((s) => s.trim());
    const type = cells[iType];
    const prompt = cells[iPrompt];
    if (!type || !prompt) continue;
    const config: Record<string, unknown> = {};
    if (type === "mcq" || type === "multi") {
      const options: { id: string; label: string; isCorrect: boolean }[] = [];
      const correctSet = (cells[iCorrect] ?? "")
        .split("|")
        .map((s) => s.trim().toUpperCase());
      for (let i = 0; i < 4; i++) {
        const colIdx = optIdx[i] ?? -1;
        if (colIdx < 0) continue;
        const label = cells[colIdx];
        if (!label) continue;
        const letter = String.fromCharCode(65 + i);
        options.push({
          id: letter.toLowerCase(),
          label,
          isCorrect: correctSet.includes(letter),
        });
      }
      config.options = options;
    }
    out.push({
      type,
      prompt,
      config,
      ...(iDiff >= 0 && cells[iDiff] ? { difficulty: Number(cells[iDiff]) } : {}),
      ...(iPoints >= 0 && cells[iPoints] ? { points: Number(cells[iPoints]) } : {}),
    });
  }
  return out;
}
