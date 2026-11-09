"use client";

import { useState } from "react";
import { CEFR_LEVELS, LIBRARY_FOCUS_LABEL, LIBRARY_FOCUS_TAGS, parseLevelBand, type LibraryFocusTag } from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";

export interface LibraryMetaState {
  inLibrary: boolean;
  publisher: string | null;
  authors: string | null;
  edition: string | null;
  levelBand: string | null;
  focusTags: LibraryFocusTag[];
  listed: boolean;
  hiddenReason: "not_published" | "invite_only" | null;
}

const ERR: Record<string, string> = {
  forbidden: "Chỉ chủ khoá học mới đổi được mục này.",
  validation_failed: "Thông tin chưa hợp lệ. Hãy kiểm tra lại các ô.",
};

/**
 * Mục "Thư viện giáo trình" ở trang sửa khoá (docs/tieu-chi/limio-language-hoc-vien-dot-2.md, AC2). Chỉ chủ khoá
 * và admin thấy: đây là cách khoá được hiển thị và bán, cùng nhóm với giá và học liệu bản quyền.
 */
export default function LibraryMetaPanel({ courseId, initial }: { courseId: string; initial: LibraryMetaState }) {
  const band = initial.levelBand ? parseLevelBand(initial.levelBand) : null;
  const [state, setState] = useState(initial);
  const [inLibrary, setInLibrary] = useState(initial.inLibrary);
  const [publisher, setPublisher] = useState(initial.publisher ?? "");
  const [authors, setAuthors] = useState(initial.authors ?? "");
  const [edition, setEdition] = useState(initial.edition ?? "");
  const [from, setFrom] = useState<string>(band?.[0] ?? "");
  const [to, setTo] = useState<string>(band && band[1] !== band[0] ? band[1] : "");
  const [tags, setTags] = useState<LibraryFocusTag[]>(initial.focusTags);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (!from && to) return setMsg({ ok: false, text: "Chọn mức bắt đầu trước khi chọn mức kết thúc." });
    const levelBand = !from ? null : to ? `${from}-${to}` : from;
    if (levelBand && !parseLevelBand(levelBand)) return setMsg({ ok: false, text: "Mức kết thúc không được thấp hơn mức bắt đầu." });
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/library`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inLibrary, publisher, authors, edition, levelBand, focusTags: tags }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<LibraryMetaState> & { error?: string; details?: Record<string, string> };
      if (!res.ok) {
        const detail = data.details ? Object.values(data.details)[0] : null;
        setMsg({ ok: false, text: detail ? `${ERR.validation_failed} (${detail})` : (ERR[data.error ?? ""] ?? "Không lưu được. Vui lòng thử lại.") });
        return;
      }
      setState(data as LibraryMetaState);
      setMsg({ ok: true, text: "Đã lưu." });
    } catch {
      setMsg({ ok: false, text: "Chưa kết nối được tới Limio. Hãy kiểm tra mạng rồi thử lại." });
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm";
  return (
    <div>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Thư viện giáo trình</h2>
        <p className="mt-0.5 text-xs text-muted">
          Đưa khoá này vào Thư viện giáo trình của Limio Language để học viên tìm, lưu và xem thử. Khoá chỉ hiện khi đã xuất
          bản và cho ghi danh tự do (khoá chỉ vào bằng link mời không đưa vào thư viện được).
        </p>
      </header>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={inLibrary} onChange={(e) => setInLibrary(e.target.checked)} disabled={busy} />
        <span className="text-sm">Đưa vào Thư viện giáo trình</span>
      </label>
      {state.inLibrary && (
        <p className={`mt-1 text-xs ${state.listed ? "text-success-600" : "text-muted"}`}>
          {state.listed
            ? "Khoá đang hiện ở thư viện."
            : state.hiddenReason === "not_published"
              ? "Khoá chưa hiện ở thư viện vì chưa xuất bản."
              : "Khoá chưa hiện ở thư viện vì chỉ vào bằng link mời."}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-xs text-muted">Nhà xuất bản</span>
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} maxLength={120} className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Tác giả</span>
          <input value={authors} onChange={(e) => setAuthors(e.target.value)} maxLength={120} className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Ấn bản</span>
          <input value={edition} onChange={(e) => setEdition(e.target.value)} maxLength={120} className={input} />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-xs text-muted">Trình độ từ</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={input}>
            <option value="">Chưa đặt</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Đến (bỏ trống nếu chỉ một mức)</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={input}>
            <option value="">Một mức</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs text-muted">Kỹ năng trọng tâm</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {LIBRARY_FOCUS_TAGS.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={tags.includes(t)}
                onChange={(e) => setTags((cur) => (e.target.checked ? [...cur, t] : cur.filter((x) => x !== t)))}
              />
              {LIBRARY_FOCUS_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className="btn-primary btn-sm">
          Lưu thông tin
        </button>
        {msg && (
          <span role="status" className={`text-xs ${msg.ok ? "text-success-600" : "text-danger-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
