"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { LIMITS, errorText } from "./types";
import type { PanelProps } from "./VanDapEditor";

/** Thông tin đề + Phong cách (ghi chú giọng điệu) + Rubric. Prompt cũ chỉ hiện ở khung chỉ đọc (AC0.5). */
export default function SettingsPanel({ data, reload, say }: PanelProps) {
  const { exam } = data;
  const draft = exam.status === "draft";
  const [title, setTitle] = useState(exam.title);
  const [durationMin, setDurationMin] = useState(exam.durationMin);
  const [language, setLanguage] = useState(exam.language);
  const [toneNote, setToneNote] = useState(exam.toneNote ?? "");
  const [rubric, setRubric] = useState(exam.rubricText ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { toneNote, rubricText: rubric };
      if (draft) Object.assign(body, { title, durationMin, language });
      const res = await fetch(apiUrl(`/api/van-dap/exams/${exam.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return say("error", errorText(out.error));
      say("ok", "Đã lưu thông tin đề.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="vd-settings" className="card space-y-4">
      <h2 id="vd-settings" className="text-h3">
        Thông tin đề
      </h2>
      <div>
        <label htmlFor="vd-e-title" className="block text-caption font-medium">
          Tiêu đề
        </label>
        <input id="vd-e-title" className="input mt-1 w-full" value={title} maxLength={200} disabled={!draft} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vd-e-lang" className="block text-caption font-medium">
            Ngôn ngữ hỏi–đáp
          </label>
          <select id="vd-e-lang" className="input mt-1 w-full" value={language} disabled={!draft} onChange={(e) => setLanguage(e.target.value as typeof language)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">Tiếng Anh</option>
            <option value="zh">Tiếng Trung</option>
          </select>
        </div>
        <div>
          <label htmlFor="vd-e-dur" className="block text-caption font-medium">
            Thời lượng (phút)
          </label>
          <input id="vd-e-dur" type="number" min={5} max={120} className="input mt-1 w-full" value={durationMin} disabled={!draft} onChange={(e) => setDurationMin(Number(e.target.value))} />
        </div>
      </div>

      <div>
        <label htmlFor="vd-e-tone" className="block text-caption font-medium">
          Ghi chú giọng điệu — AI hỏi thế nào (tối đa {LIMITS.toneNoteMax} ký tự)
        </label>
        <textarea
          id="vd-e-tone"
          rows={3}
          className="textarea mt-1 w-full"
          value={toneNote}
          maxLength={LIMITS.toneNoteMax}
          onChange={(e) => setToneNote(e.target.value)}
          placeholder="Ví dụ: thân thiện, câu ngắn, xưng hô lịch sự."
        />
        <p className="mt-1 text-xs text-slate-500">
          Chỉ chỉnh giọng điệu. Nội dung và thứ tự câu hỏi do dàn câu hỏi quyết định, không viết luật hỏi ở đây. {toneNote.length}/{LIMITS.toneNoteMax}
        </p>
      </div>

      <div>
        <label htmlFor="vd-e-rubric" className="block text-caption font-medium">
          Rubric — chấm thế nào (không ảnh hưởng câu hỏi)
        </label>
        <textarea id="vd-e-rubric" rows={5} className="textarea mt-1 w-full" value={rubric} maxLength={LIMITS.rubricMax} onChange={(e) => setRubric(e.target.value)} />
      </div>

      {exam.legacyPrompt && (
        <div className="rounded-lg border border-default bg-slate-50 p-3">
          <p className="text-caption font-medium">Prompt của đề vấn đáp cũ (chỉ để đối chiếu)</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Không được chép tự động vào ghi chú giọng điệu vì thường chứa lệnh về thứ tự và nội dung câu hỏi. Thầy/cô tự rút phần giọng điệu nếu cần.
          </p>
          <textarea readOnly aria-label="Prompt của đề vấn đáp cũ" rows={4} className="textarea mt-2 w-full bg-slate-100 text-slate-700" value={exam.legacyPrompt} />
        </div>
      )}

      <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm disabled:opacity-50">
        {busy ? "Đang lưu…" : "Lưu thông tin"}
      </button>
    </section>
  );
}
