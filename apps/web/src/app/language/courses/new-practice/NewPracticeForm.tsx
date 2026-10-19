"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const FAMILIES = {
  hsk: { label: "HSK", skills: ["listening", "reading", "writing"], levels: ["1", "2", "3", "4", "5", "6"] },
  ielts: { label: "IELTS", skills: ["listening", "reading", "writing", "speaking"], levels: [] as string[] },
  toeic: { label: "TOEIC", skills: ["listening", "reading"], levels: [] as string[] },
} as const;
type FamilyId = keyof typeof FAMILIES;
const SKILL_TEXT: Record<string, string> = { listening: "Nghe", reading: "Đọc", writing: "Viết", speaking: "Nói" };

/** LANG L6.9 — tạo khoá luyện đề: chọn họ thi + kỹ năng (+ cấp độ HSK) → khoá nháp kèm bộ/Part mẫu. */
export default function NewPracticeForm() {
  const [family, setFamily] = useState<FamilyId>("hsk");
  const [skill, setSkill] = useState("listening");
  const [level, setLevel] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fam = FAMILIES[family];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/courses/practice-bank"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ family, skill, ...(fam.levels.length ? { level } : {}) }),
      });
      const j = (await r.json().catch(() => null)) as { courseId?: string; error?: string } | null;
      if (r.ok && j?.courseId) {
        window.location.href = `/instructor/courses/${j.courseId}/library`;
        return;
      }
      setError(j?.error === "forbidden" ? "Tài khoản của bạn chưa được cấp quyền giảng viên." : "Không tạo được khoá. Kiểm tra lựa chọn rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-5" aria-label="Tạo khoá luyện đề">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-caption block text-muted">Họ thi</span>
          <select
            className="select mt-1 w-full"
            value={family}
            onChange={(e) => {
              const f = e.target.value as FamilyId;
              setFamily(f);
              if (!(FAMILIES[f].skills as readonly string[]).includes(skill)) setSkill(FAMILIES[f].skills[0]);
            }}
          >
            {Object.entries(FAMILIES).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
          </select>
        </label>
        {fam.levels.length > 0 && (
          <label className="text-sm">
            <span className="text-caption block text-muted">Cấp độ</span>
            <select className="select mt-1 w-full" value={level} onChange={(e) => setLevel(e.target.value)}>
              {fam.levels.map((l) => <option key={l} value={l}>{fam.label} {l}</option>)}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="text-caption block text-muted">Kỹ năng</span>
          <select className="select mt-1 w-full" value={skill} onChange={(e) => setSkill(e.target.value)}>
            {fam.skills.map((s) => <option key={s} value={s}>{SKILL_TEXT[s]}</option>)}
          </select>
        </label>
      </div>
      <p className="text-meta">
        Tạo khoá nháp “{fam.label}{fam.levels.length ? ` ${level}` : ""} — {SKILL_TEXT[skill]}” kèm các bộ/Part gợi ý (sửa được). Sau đó bạn thêm từng đề hoặc nhập hàng loạt từ file.
      </p>
      {error && <p role="alert" className="banner-danger text-sm">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo khoá luyện đề"}</button>
    </form>
  );
}
