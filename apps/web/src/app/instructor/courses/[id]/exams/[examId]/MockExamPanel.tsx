"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { formatScoreBands, parseScoreBandsText, type Band } from "@/lib/scoreBandsText";

type Skill = "listening" | "speaking" | "reading" | "writing";
type Section = {
  id: string;
  title: string;
  itemCount: number;
  selectionMode: "fixed" | "random_from_bank";
  durationMin: number | null;
  languageSkill: Skill | null;
  scoreBands: Band[] | null;
};

const SKILL_OPTIONS: { value: Skill; label: string }[] = [
  { value: "listening", label: "Nghe" },
  { value: "reading", label: "Đọc" },
  { value: "writing", label: "Viết" },
  { value: "speaking", label: "Nói" },
];

const ERR_TEXT: Record<string, string> = {
  exam_has_attempts: "Đề đã có người thi nên không đổi được.",
  validation_failed: "Giá trị chưa hợp lệ (giờ phần từ 1 đến 240 phút).",
  exam_not_draft: "Chỉ đổi được khi đề còn ở trạng thái nháp.",
};

/**
 * LANG G5a — bật chế độ "Thi thử" và đặt giờ/kỹ năng cho từng phần.
 * Thêm phần và xếp câu hỏi vào phần vẫn làm ở khu "Nội dung bài thi" bên dưới.
 */
export default function MockExamPanel({
  examId,
  initialMockMode,
  initialAllowMock,
  initialAllowPractice,
  locked,
  lockedReason,
}: {
  examId: string;
  initialMockMode: boolean;
  initialAllowMock: boolean;
  initialAllowPractice: boolean;
  /** true = không sửa được (đã xuất bản / đã có lượt thi / lưu trữ). */
  locked: boolean;
  lockedReason?: string;
}) {
  const router = useRouter();
  const [mock, setMock] = useState(initialMockMode);
  const [allowMock, setAllowMock] = useState(initialAllowMock);
  const [allowPractice, setAllowPractice] = useState(initialAllowPractice);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/exams/${examId}/sections`);
    if (r.ok) setSections(((await r.json()) as { sections: Section[] }).sections);
  }, [examId]);

  useEffect(() => {
    if (!mock) return;
    void refresh();
    const on = () => void refresh();
    window.addEventListener("fbm:exam-sections-changed", on);
    return () => window.removeEventListener("fbm:exam-sections-changed", on);
  }, [mock, refresh]);

  async function call(url: string, body: unknown): Promise<boolean> {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(ERR_TEXT[j?.error ?? ""] ?? "Không lưu được. Vui lòng thử lại.");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(next: boolean) {
    if (await call(`/api/exams/${examId}`, { mockMode: next })) {
      setMock(next);
      router.refresh();
    }
  }

  async function toggleAllowMock(next: boolean) {
    if (await call(`/api/exams/${examId}`, { allowMock: next })) setAllowMock(next);
  }

  async function toggleAllowPractice(next: boolean) {
    if (await call(`/api/exams/${examId}`, { allowPractice: next })) setAllowPractice(next);
  }

  async function patchSection(id: string, body: { durationMin?: number | null; languageSkill?: Skill | null }) {
    if (await call(`/api/exam-sections/${id}`, body)) await refresh();
    else await refresh();
  }

  const total = (sections ?? []).reduce((a, s) => a + (s.durationMin ?? 0), 0);
  const missing = (sections ?? []).filter((s) => !s.durationMin).length;

  return (
    <section className="mt-6 rounded border border-default bg-white p-5" data-testid="mock-exam-panel">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={mock}
          disabled={locked || busy}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span>
          <span className="flex items-center gap-1.5 text-base font-semibold">
            <Timer className="h-4 w-4 shrink-0 text-slate-400" /> Đề thi thử (HSK · IELTS · TOEIC…)
          </span>
          <span className="block text-sm text-faint">
            Mỗi phần có giờ riêng, học viên làm lần lượt từng phần và <b>không quay lại</b> phần đã nộp.
            Hết giờ phần thì tự sang phần kế. Đề thi thật (không bật mục này) giữ nguyên cách làm bài tự do.
          </span>
        </span>
      </label>
      {locked && lockedReason && <p className="mt-2 text-sm text-amber-700">{lockedReason}</p>}
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}

      {mock && (
        <label className="mt-4 flex items-start gap-3 rounded border border-default p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={allowMock}
            disabled={busy}
            onChange={(e) => void toggleAllowMock(e.target.checked)}
          />
          <span>
            <span className="font-medium">Cho thi thử</span>
            <span className="block text-faint">
              Tắt thì học viên không bắt đầu được lượt thi mới và đề biến mất khỏi mục “Luyện thi” (lượt đang làm dở vẫn
              tiếp tục được). Đổi được bất cứ lúc nào, kể cả sau khi xuất bản.
            </span>
          </span>
        </label>
      )}

      {mock && (
        <label className="mt-3 flex items-start gap-3 rounded border border-default p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={allowPractice}
            disabled={busy}
            onChange={(e) => void toggleAllowPractice(e.target.checked)}
          />
          <span>
            <span className="font-medium">Cho luyện đề</span>
            <span className="block text-faint">
              Cho học viên luyện đề này theo kỹ năng hoặc từng phần: không bấm giờ, quay lại sửa tự do, xem đáp án ngay sau
              từng câu. Kỹ năng lấy từ nhãn kỹ năng của từng phần. Tắt thì học viên không bắt đầu được buổi luyện mới.
              Luyện đề không cộng XP và không ảnh hưởng điểm thi thử.
            </span>
          </span>
        </label>
      )}

      {mock && (
        <div className="mt-4">
          {sections === null ? (
            <p className="text-sm text-faint">Đang tải…</p>
          ) : sections.length === 0 ? (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Chưa có phần nào. Vào mục <b>Nội dung bài thi</b> bên dưới, bấm <b>+ Section mới</b> để thêm
              (ví dụ Nghe, Đọc, Viết), rồi quay lại đây đặt giờ cho từng phần.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-caption">
                    <tr className="border-b border-token">
                      <th className="px-2 py-2">Phần</th>
                      <th className="px-2 py-2">Kỹ năng</th>
                      <th className="px-2 py-2">Giờ (phút)</th>
                      <th className="px-2 py-2 text-right">Số câu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((s) => (
                      <tr key={s.id} className="border-b border-token">
                        <td className="px-2 py-2 font-medium">{s.title}</td>
                        <td className="px-2 py-2">
                          <select
                            aria-label={`Kỹ năng của ${s.title}`}
                            className="rounded border border-default px-2 py-1"
                            value={s.languageSkill ?? ""}
                            disabled={locked || busy}
                            onChange={(e) =>
                              void patchSection(s.id, { languageSkill: (e.target.value || null) as Skill | null })
                            }
                          >
                            <option value="">— chưa gán —</option>
                            {SKILL_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <DurationInput
                            label={`Giờ của ${s.title}`}
                            value={s.durationMin}
                            disabled={locked || busy}
                            onCommit={(v) => void patchSection(s.id, { durationMin: v })}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          {s.itemCount === 0 && s.selectionMode === "fixed" ? (
                            <span className="text-amber-700">0 (chưa có câu)</span>
                          ) : s.itemCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm">
                Tổng thời gian:{" "}
                <b>{total} phút</b>
                {missing > 0 && <span className="ml-2 text-amber-700">· {missing} phần chưa có giờ — chưa xuất bản được</span>}
              </p>
              <div className="mt-4 space-y-2" data-testid="score-bands">
                <h3 className="text-sm font-semibold">Bảng quy đổi điểm (tuỳ chọn)</h3>
                <p className="text-xs text-faint">
                  Để học viên thấy <b>khoảng điểm ước lượng</b> theo từng phần. Hệ thống không mang sẵn số liệu chính thức của
                  HSK/IELTS/TOEIC — bạn tự đối chiếu nguồn rồi nhập; học viên luôn thấy nhãn “không phải điểm chính thức”.
                  Không nhập thì chỉ hiện “đúng X/Y câu”. Sửa được bất cứ lúc nào, kể cả sau khi có người thi.
                </p>
                {sections.map((sec) => (
                  <BandsEditor
                    key={sec.id}
                    section={sec}
                    disabled={busy}
                    onSave={async (bands) => {
                      const ok = await call(`/api/exam-sections/${sec.id}`, { scoreBands: bands });
                      await refresh();
                      return ok;
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Ô số phút: chỉ gửi khi rời ô hoặc nhấn Enter, để gõ "45" không gửi "4" rồi "45". */
function DurationInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  const commit = () => {
    const t = text.trim();
    const v = t === "" ? null : Number(t);
    if (v === value) return;
    onCommit(v === null || Number.isNaN(v) ? null : v);
  };
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      className="w-24 rounded border border-default px-2 py-1"
      value={text}
      disabled={disabled}
      placeholder="vd. 45"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Ô soạn bảng quy đổi của một phần: mỗi dòng "từ-đến: nhãn". */
function BandsEditor({
  section,
  disabled,
  onSave,
}: {
  section: Section;
  disabled: boolean;
  onSave: (bands: Band[]) => Promise<boolean>;
}) {
  const [text, setText] = useState(formatScoreBands(section.scoreBands));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setText(formatScoreBands(section.scoreBands)), [section.scoreBands]);

  async function save() {
    const parsed = parseScoreBandsText(text);
    if (!parsed.ok) {
      setMsg({ ok: false, text: `Dòng ${parsed.line} sai cú pháp. Dùng dạng “0-9: 100–150” (mỗi dòng một khoảng).` });
      return;
    }
    const ok = await onSave(parsed.bands);
    setMsg(ok ? { ok: true, text: parsed.bands.length ? "Đã lưu bảng quy đổi." : "Đã bỏ bảng quy đổi." } : { ok: false, text: "Không lưu được — các khoảng không được chồng nhau (từ ≤ đến)." });
  }

  return (
    <details className="rounded border border-default px-3 py-2">
      <summary className="cursor-pointer text-sm">
        {section.title}
        <span className="ml-2 text-xs text-faint">
          {section.scoreBands && section.scoreBands.length > 0 ? `${section.scoreBands.length} khoảng` : "chưa có bảng"}
        </span>
      </summary>
      <textarea
        aria-label={`Bảng quy đổi của ${section.title}`}
        className="mt-2 w-full rounded border border-default p-2 font-mono text-sm"
        rows={5}
        value={text}
        placeholder={"0-9: 100–150\n10-19: 150–200"}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={disabled}
          className="rounded border border-default px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Lưu bảng
        </button>
        {msg && (
          <span role="status" className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </details>
  );
}
