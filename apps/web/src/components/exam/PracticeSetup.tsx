"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import {
  buildPracticeRequest,
  countInScope,
  type PracticeFilter,
  type PracticeSectionInfo,
} from "@/lib/practiceSetup";

const SKILL_LABEL: Record<string, string> = { listening: "Nghe", speaking: "Nói", reading: "Đọc", writing: "Viết" };

const FILTERS: { value: PracticeFilter; label: string; hint: string }[] = [
  { value: "all", label: "Tất cả câu", hint: "Mọi câu trong phạm vi đã chọn" },
  { value: "unanswered", label: "Chỉ câu chưa làm", hint: "Các câu bạn chưa từng trả lời khi luyện" },
  { value: "wrong", label: "Chỉ câu từng sai", hint: "Các câu lần luyện gần nhất của bạn bị sai" },
];

/**
 * LANG G5e.1 — chọn phạm vi luyện đề: kỹ năng, từng phần hoặc cả đề; lọc câu chưa làm / từng sai;
 * bật "Kiểm tra từng câu" và "Bấm giờ". Đang có buổi dở thì mời tiếp tục (một buổi dở mỗi đề).
 */
export default function PracticeSetup({
  slug,
  examId,
  title,
  sections,
  inProgress,
}: {
  slug: string;
  examId: string;
  title: string;
  sections: PracticeSectionInfo[];
  inProgress: { sessionId: string; answered: number; total: number } | null;
}) {
  const router = useRouter();
  const skills = [...new Set(sections.map((s) => s.languageSkill).filter((x): x is string => !!x))];
  const [pickedSkills, setPickedSkills] = useState<string[]>([]);
  const [pickedSections, setPickedSections] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<PracticeFilter>("all");
  const [checkEnabled, setCheckEnabled] = useState(true);
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const selection = { skills: pickedSkills, sectionIds: pickedSections, all, filter };
  const count = countInScope(sections, selection);
  const req = buildPracticeRequest({ ...selection, timed, checkEnabled });

  async function start() {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/practice`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const j = (await res.json().catch(() => null)) as { sessionId?: string; error?: string } | null;
      if (!res.ok || !j?.sessionId) {
        setError(
          j?.error === "practice_scope_empty"
            ? "Không có câu nào phù hợp với lựa chọn này. Thử bỏ bộ lọc hoặc chọn thêm phần."
            : "Không bắt đầu được. Vui lòng thử lại.",
        );
        setBusy(false);
        return;
      }
      router.push(`/learn/${slug}/exams/${examId}/practice/${j.sessionId}`);
    } catch {
      setError("Không bắt đầu được. Kiểm tra mạng rồi thử lại.");
      setBusy(false);
    }
  }

  async function abandon() {
    if (!inProgress || !window.confirm("Bỏ buổi luyện đang dở? Các câu đã làm trong buổi này sẽ không có kết quả.")) return;
    await fetch(apiUrl(`/api/practice-sessions/${inProgress.sessionId}`), { method: "DELETE" });
    router.refresh();
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
      on ? "border-brand-300 bg-brand-100 font-medium text-brand-800" : "border-token text-muted hover:bg-brand-soft"
    }`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6" data-testid="practice-setup">
      <Link href={`/learn/${slug}`} className="link text-sm">← Về trang khoá</Link>
      <h1 className="text-h1 mt-3">Luyện đề</h1>
      <p className="text-meta mt-1">
        {title} · Chọn phạm vi để luyện. Không bấm giờ, quay lại sửa tự do, xem đáp án ngay sau từng câu. Luyện đề không
        cộng XP và không ảnh hưởng điểm thi thử.
      </p>

      {inProgress && (
        <section className="banner-info mt-4 flex flex-wrap items-center justify-between gap-3">
          <span>
            Bạn đang có một buổi luyện dở ({inProgress.answered}/{inProgress.total} câu đã trả lời).
          </span>
          <span className="flex gap-2">
            <Link
              href={`/learn/${slug}/exams/${examId}/practice/${inProgress.sessionId}`}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Tiếp tục
            </Link>
            <button type="button" onClick={() => void abandon()} className="rounded-full border border-token px-4 py-1.5 text-sm hover:bg-brand-soft">
              Bỏ buổi này
            </button>
          </span>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <h2 className="text-body font-semibold">1. Chọn phạm vi</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Kỹ năng">
          {skills.map((sk) => (
            <button key={sk} type="button" aria-pressed={pickedSkills.includes(sk) && !all} disabled={all} onClick={() => setPickedSkills((l) => toggle(l, sk))} className={`${chip(pickedSkills.includes(sk) && !all)} disabled:opacity-50`}>
              {SKILL_LABEL[sk] ?? sk}
            </button>
          ))}
          <button type="button" aria-pressed={all} onClick={() => setAll((v) => !v)} className={chip(all)}>
            Cả đề
          </button>
        </div>
        <ul className="mt-3 space-y-1.5" aria-label="Các phần">
          {sections.map((s) => {
            const viaSkill = !!s.languageSkill && pickedSkills.includes(s.languageSkill);
            const on = all || viaSkill || pickedSections.includes(s.id);
            return (
              <li key={s.id}>
                <label className="flex items-center gap-3 rounded border border-token px-3 py-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={on} disabled={all || viaSkill} onChange={() => setPickedSections((l) => toggle(l, s.id))} />
                  <span className="flex-1">
                    <span className="font-medium">{s.title}</span>
                    {s.languageSkill && SKILL_LABEL[s.languageSkill] !== s.title && <span className="ml-2 text-xs text-faint">({SKILL_LABEL[s.languageSkill]})</span>}
                  </span>
                  <span className="text-xs text-faint tabular-nums">
                    {s.questionCount} câu · {s.unansweredCount} chưa làm · {s.wrongCount} từng sai
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <h2 className="text-body font-semibold">2. Chọn câu</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Bộ lọc câu">
          {FILTERS.map((f) => (
            <label key={f.value} className={`cursor-pointer rounded border px-3 py-2 text-sm ${filter === f.value ? "border-brand-300 bg-brand-soft" : "border-token"}`}>
              <input type="radio" name="filter" className="mr-2" checked={filter === f.value} onChange={() => setFilter(f.value)} />
              <span className="font-medium">{f.label}</span>
              <span className="mt-0.5 block text-xs text-faint">{f.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <h2 className="text-body font-semibold">3. Tuỳ chọn</h2>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checkEnabled} onChange={(e) => setCheckEnabled(e.target.checked)} />
          <span>
            <span className="font-medium">Kiểm tra từng câu</span>
            <span className="block text-xs text-faint">Bấm “Kiểm tra” sau khi trả lời để xem đúng/sai và đáp án ngay. Tắt thì chỉ thấy kết quả khi kết thúc.</span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          <span>
            <span className="font-medium">Hiện đồng hồ bấm giờ</span>
            <span className="block text-xs text-faint">Chỉ để bạn tự theo dõi thời gian, không bị ép và không tự nộp.</span>
          </span>
        </label>
      </section>

      {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-6 flex items-center justify-end gap-3">
        <span className="text-sm text-faint">{req ? `${count} câu` : "Chọn kỹ năng, phần hoặc cả đề"}</span>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy || !req || count === 0 || !!inProgress}
          title={inProgress ? "Hãy tiếp tục hoặc bỏ buổi đang dở trước" : undefined}
          className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Đang bắt đầu…" : "Bắt đầu luyện"}
        </button>
      </div>
    </main>
  );
}
