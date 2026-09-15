"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown } from "lucide-react";

type Item = {
  id: string;
  bankId: string;
  bankName: string;
  type: string;
  prompt: string;
  points: number;
  difficulty: number;
  status: "draft" | "published" | "archived";
  skillIds: string[];
};

type Bank = { id: string; name: string };

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tất cả loại" },
  { value: "mcq", label: "MCQ" },
  { value: "multi", label: "Multi" },
  { value: "true_false_notgiven", label: "T/F/NG" },
  { value: "gap_fill", label: "Gap fill" },
  { value: "short_answer", label: "Ngắn" },
  { value: "essay", label: "Tự luận" },
];

/** Dropdown lọc chủ đề — chọn nhiều (checkbox), trông như 1 select bình
 *  thường chứ không phải hàng chip rời rạc. Bỏ trống = lấy toàn bộ chủ đề. */
function TopicMultiSelectDropdown({
  topics,
  selected,
  onToggle,
}: {
  topics: string[];
  selected: Set<string>;
  onToggle: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = selected.size === 0 ? "Toàn bộ chủ đề" : `${selected.size} chủ đề đã chọn`;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-default bg-white px-3 py-2 text-sm text-slate-700"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-default bg-white py-1 shadow-lg">
            {topics.map((t) => {
              const checked = selected.has(t);
              return (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(t)}
                    className="h-4 w-4 shrink-0"
                  />
                  {t}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ManualBankPicker({
  examId,
  sectionId,
  doneHref,
}: {
  examId: string;
  courseId: string;
  sectionId: string | null;
  doneHref: string;
}) {
  const router = useRouter();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState("");
  useEffect(() => {
    fetch("/api/question-banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { banks: Bank[] } | null) => {
        if (!j) return;
        setBanks(j.banks);
        if (j.banks.length === 1) setBankId(j.banks[0]!.id);
      });
  }, []);

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Đổi ngân hàng → nạp lại danh sách chủ đề của riêng ngân hàng đó (chủ đề
  // lưu theo BankQuestion.config.topic, không gộp được xuyên ngân hàng).
  useEffect(() => {
    setSelectedTopics(new Set());
    if (!bankId) {
      setTopics([]);
      return;
    }
    fetch(`/api/question-banks/${bankId}/topics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { topics: string[] } | null) => setTopics(j?.topics ?? []));
  }, [bankId]);

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      const p = new URLSearchParams();
      p.append("status", "published");
      if (q.trim()) p.append("q", q.trim());
      if (type) p.append("type", type);
      if (difficulty) p.append("difficulty", difficulty);
      if (bankId) p.append("bank", bankId);
      selectedTopics.forEach((t2) => p.append("topic", t2));
      p.append("limit", "30");
      try {
        const r = await fetch(`/api/bank-questions?${p.toString()}`);
        if (!r.ok) {
          setErr(`HTTP ${r.status}`);
          return;
        }
        const j = (await r.json()) as { items: Item[] };
        setItems(j.items);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, type, difficulty, bankId, selectedTopics]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setErr(null);
    try {
      for (const bankQuestionId of selected) {
        const r = await fetch(`/api/exams/${examId}/questions/from-bank`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bankQuestionId, passageId: null, sectionId }),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          setErr(j?.error ?? `HTTP ${r.status}`);
          return;
        }
      }
      // Thêm vào 1 section có sẵn làm itemCount của nó lệch khỏi "Chia đề
      // thành nhiều phần" cho tới khi có sự kiện này.
      if (sectionId) window.dispatchEvent(new Event("fbm:exam-sections-changed"));
      router.push(doneHref);
      router.refresh();
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {banks.length > 1 && (
        <div className="mt-5">
          <label className="block max-w-md">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-faint">
              Ngân hàng câu hỏi
            </span>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="w-full rounded-lg border border-default bg-white px-4 py-2.5 text-sm font-medium"
            >
              <option value="">Tất cả ngân hàng</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Tìm theo nội dung câu hỏi..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[240px] flex-1 rounded border border-default px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-default px-3 py-2 text-sm"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded border border-default px-3 py-2 text-sm"
        >
          <option value="">Tất cả độ khó</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              ✦ {n}/5
            </option>
          ))}
        </select>
        {topics.length > 0 && (
          <TopicMultiSelectDropdown topics={topics} selected={selectedTopics} onToggle={toggleTopic} />
        )}
      </div>

      <div className="mt-4 rounded-xl border border-default bg-white">
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading && <div className="py-6 text-center text-sm text-faint">Đang tải...</div>}
          {!loading && items.length === 0 && (
            <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
              {q || type || difficulty || bankId || selectedTopics.size > 0
                ? "Không có câu hỏi nào khớp bộ lọc."
                : "Chưa có câu hỏi published nào. Tạo + publish trong tab Question Bank trước."}
            </div>
          )}
          <ul className="space-y-2">
            {items.map((it) => {
              const checked = selected.has(it.id);
              return (
                <li key={it.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded border p-3 hover:bg-slate-50 ${
                      checked ? "border-brand-400 bg-brand-50/40" : "border-default"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(it.id)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-0.5 uppercase text-slate-700">
                          {it.type}
                        </span>
                        <span className="text-faint">
                          {it.points} điểm · ✦{it.difficulty}/5 · {it.skillIds.length} skill
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-faint">
                          <BookOpen className="h-3 w-3 shrink-0" />
                          {it.bankName}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm">{it.prompt}</p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {err && (
          <div className="border-t border-default p-3">
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 rounded-b-xl border-t border-default bg-slate-50 px-4 py-3">
          <span className="text-sm text-faint">
            {selected.size === 0 ? "Chưa chọn câu nào" : `Đã chọn ${selected.size} câu`}
          </span>
          <button
            type="button"
            onClick={() => void addSelected()}
            disabled={selected.size === 0 || adding}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? "Đang thêm…" : `Thêm ${selected.size || ""} câu vào đề`}
          </button>
        </div>
      </div>
    </>
  );
}
