"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

/**
 * A5.1 — "Add from bank" picker. Searches visible banks, lets instructor pick
 * a published question to copy into the current exam. Server-side handles
 * versioning + skill tag copy + ExamQuestionFromBank link.
 */
export default function FromBankModal({
  examId,
  passageId,
  onClose,
}: {
  examId: string;
  passageId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      const p = new URLSearchParams();
      p.append("status", "published");
      if (q.trim()) p.append("q", q.trim());
      if (type) p.append("type", type);
      if (difficulty) p.append("difficulty", difficulty);
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
  }, [q, type, difficulty]);

  const onPick = async (qid: string) => {
    setBusy(qid);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/questions/from-bank`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bankQuestionId: qid, passageId }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setFlash("Đã copy. Refresh trang để thấy câu hỏi mới.");
      // Refresh server-rendered page so the new question appears.
      router.refresh();
      setTimeout(() => {
        setFlash(null);
        onClose();
      }, 1500);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      data-testid="from-bank-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-default p-4">
          <h3 className="text-base font-semibold">📚 Chọn câu hỏi từ bank</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            ✕
          </button>
        </div>

        <div className="border-b border-default p-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Tìm theo nội dung..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded border border-default px-3 py-2 text-sm"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded border border-default px-3 py-2 text-sm"
            >
              <option value="">Tất cả loại</option>
              <option value="mcq">MCQ</option>
              <option value="multi">Multi</option>
              <option value="true_false_notgiven">T/F/NG</option>
              <option value="gap_fill">Gap fill</option>
              <option value="short_answer">Ngắn</option>
              <option value="essay">Tự luận</option>
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && <div className="text-center text-sm text-faint">Đang tải...</div>}
          {!loading && items.length === 0 && (
            <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
              {q || type || difficulty
                ? "Không có câu hỏi nào khớp bộ lọc."
                : "Chưa có câu hỏi published nào. Tạo + publish trong tab Question Bank trước."}
            </div>
          )}
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                data-testid={`bank-pick-${it.id}`}
                className="flex items-start gap-3 rounded border border-default p-3 hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded bg-slate-100 px-2 py-0.5 uppercase text-slate-700">
                      {it.type}
                    </span>
                    <span className="text-faint">
                      {it.points} điểm · ✦{it.difficulty}/5 · {it.skillIds.length} skill
                    </span>
                    <span className="ml-auto text-faint">📚 {it.bankName}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{it.prompt}</p>
                </div>
                <button
                  onClick={() => onPick(it.id)}
                  disabled={busy !== null}
                  className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy === it.id ? "..." : "Copy"}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {(err || flash) && (
          <div className="border-t border-default p-3">
            {err && (
              <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>
            )}
            {flash && <div className="text-sm text-emerald-700">{flash}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
