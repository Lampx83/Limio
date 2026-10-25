"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

export interface CourseTreeModule {
  id: string;
  title: string;
  lessons: Array<{ id: string; title: string; hidden: boolean }>;
}

interface PlanLesson {
  id: string;
  title: string;
  moduleTitle: string;
  hidden: boolean;
}

interface PlanView {
  customized: boolean;
  topic: string | null;
  lessons: PlanLesson[];
  editable: boolean;
}

const TOPIC_MAX = 120;
const MAX_LESSONS = 30;

const ERRORS: Record<string, string> = {
  meeting_locked: "Buổi này đã kết thúc hoặc đã huỷ nên không sửa kế hoạch được.",
  too_many_lessons: `Mỗi buổi tối đa ${MAX_LESSONS} bài.`,
  lesson_not_in_course: "Có bài không thuộc khoá này. Tải lại trang rồi thử lại.",
  validation_failed: `Thông tin chưa hợp lệ (chủ đề tối đa ${TOPIC_MAX} ký tự, mỗi bài chỉ một lần).`,
  forbidden: "Bạn không có quyền sửa kế hoạch của buổi này.",
};
const errText = (c?: string) => ERRORS[c ?? ""] ?? `Có lỗi xảy ra${c ? ` (${c})` : ""}. Thử lại sau.`;

/**
 * CENTER J — Kế hoạch giảng dạy của một buổi: danh sách bài theo thứ tự, chủ đề, thêm bài từ cây chương của khoá, bỏ,
 * đổi thứ tự, "Đặt lại theo giáo trình". Người chỉ dạy chỉ xem. Lưu một lần bằng "Lưu kế hoạch".
 */
export default function MeetingPlanEditor({
  meetingId,
  canManage,
  courseTree,
  onChanged,
  onClose,
}: {
  meetingId: string;
  canManage: boolean;
  courseTree: CourseTreeModule[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<PlanView | null>(null);
  const [lessons, setLessons] = useState<PlanLesson[]>([]);
  const [topic, setTopic] = useState("");
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(apiUrl(`/api/meetings/${meetingId}/plan`));
    const j = (await r.json().catch(() => ({}))) as PlanView & { error?: string };
    if (!r.ok) return setError(errText(j.error));
    setView(j);
    setLessons(j.lessons);
    setTopic(j.topic ?? "");
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const editable = !!view?.editable && canManage;
  const dirty = useMemo(() => {
    if (!view) return false;
    if ((topic.trim() || null) !== (view.topic ?? null)) return true;
    return lessons.length !== view.lessons.length || lessons.some((l, i) => l.id !== view.lessons[i]!.id);
  }, [view, lessons, topic]);

  const have = new Set(lessons.map((l) => l.id));
  const q = query.trim().toLowerCase();
  const tree = courseTree
    .map((m) => ({ ...m, lessons: m.lessons.filter((l) => !q || l.title.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)) }))
    .filter((m) => m.lessons.length > 0);

  const move = (i: number, d: -1 | 1) =>
    setLessons((ls) => {
      const j = i + d;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const addPicked = () => {
    const additions: PlanLesson[] = [];
    for (const m of courseTree)
      for (const l of m.lessons) if (picked.has(l.id) && !have.has(l.id)) additions.push({ id: l.id, title: l.title, moduleTitle: m.title, hidden: l.hidden });
    if (lessons.length + additions.length > MAX_LESSONS) return setError(errText("too_many_lessons"));
    setError(null);
    setLessons((ls) => [...ls, ...additions]);
    setPicked(new Set());
    setPicking(false);
    setQuery("");
  };

  const call = async (method: string, body?: unknown, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(apiUrl(`/api/meetings/${meetingId}/plan`), {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as PlanView & { error?: string };
      if (!r.ok) return setError(errText(j.error));
      setView(j);
      setLessons(j.lessons);
      setTopic(j.topic ?? "");
      setNotice(done ?? "Đã lưu.");
      onChanged();
    } catch {
      setError("Chưa lưu được vì mạng không ổn định. Các thay đổi của thầy/cô vẫn còn, bấm lưu lại khi có mạng.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => call("PUT", { lessonIds: lessons.map((l) => l.id), topic: topic.trim() || null }, "Đã lưu kế hoạch của buổi.");
  const reset = () => {
    if (!window.confirm("Đặt lại theo giáo trình? Danh sách bài và chủ đề riêng của buổi này sẽ bị bỏ.")) return;
    void call("DELETE", undefined, "Đã đặt lại theo giáo trình.");
  };

  if (!view) {
    return (
      <div className="mt-3 rounded-xl border border-token p-3 text-sm text-muted">
        {error ? <span role="alert" className="text-danger-600">{error}</span> : "Đang tải kế hoạch…"}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))]/50 p-3" aria-label="Kế hoạch giảng dạy của buổi">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Kế hoạch giảng dạy</h3>
        <span className={`${view.customized ? "chip-accent" : "chip-brand"} text-xs`}>{view.customized ? "Đã tuỳ chỉnh" : "Theo giáo trình"}</span>
        {!editable && <span className="text-meta text-muted">Chỉ xem{view.editable ? "" : " (buổi đã kết thúc hoặc đã huỷ)"}</span>}
        <button type="button" className="btn-ghost btn-sm ml-auto" onClick={onClose}>
          Đóng
        </button>
      </div>

      {editable && (
        <label className="block text-sm">
          <span className="text-meta">Chủ đề buổi (không bắt buộc)</span>
          <input
            className="input mt-1 w-full"
            maxLength={TOPIC_MAX}
            placeholder="Ví dụ: Ôn tập số đếm và chào hỏi"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
      )}
      {!editable && view.topic && <p className="text-sm">Chủ đề: {view.topic}</p>}

      {lessons.length === 0 ? (
        <p className="text-sm text-muted">
          {view.customized ? "Buổi này chưa có bài nào trong kế hoạch." : "Buổi này chưa có giáo án theo giáo trình."}
          {editable && " Bấm \"+ Thêm bài\" để đưa bài của khoá vào buổi."}
        </p>
      ) : (
        <ol className="space-y-1">
          {lessons.map((l, i) => (
            <li key={l.id} className="flex items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-2 py-1.5 text-sm">
              <span className="w-5 shrink-0 text-center text-meta text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{l.title}</span>
                <span className="ml-2 text-meta text-muted">{l.moduleTitle}</span>
                {l.hidden && <span className="chip ml-2 text-xs">Đang ẩn với học viên</span>}
              </span>
              {editable && (
                <span className="flex shrink-0 gap-0.5">
                  <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={`Đưa "${l.title}" lên`} disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={`Đưa "${l.title}" xuống`} disabled={i === lessons.length - 1 || busy} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm px-1.5 text-danger-600"
                    aria-label={`Bỏ "${l.title}" khỏi buổi`}
                    disabled={busy}
                    onClick={() => setLessons((ls) => ls.filter((x) => x.id !== l.id))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {editable && picking && (
        <div className="space-y-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
          <input className="input w-full" placeholder="Tìm bài hoặc chương" aria-label="Tìm bài hoặc chương" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {tree.length === 0 && <p className="text-sm text-muted">Không có bài nào khớp.</p>}
            {tree.map((m) => (
              <div key={m.id}>
                <p className="text-meta font-semibold text-muted">{m.title}</p>
                <ul className="mt-1 space-y-0.5">
                  {m.lessons.map((l) => {
                    const already = have.has(l.id);
                    return (
                      <li key={l.id}>
                        <label className={`flex items-center gap-2 text-sm ${already ? "opacity-50" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            disabled={already}
                            checked={already || picked.has(l.id)}
                            onChange={(e) =>
                              setPicked((p) => {
                                const n = new Set(p);
                                if (e.target.checked) n.add(l.id);
                                else n.delete(l.id);
                                return n;
                              })
                            }
                          />
                          <span>{l.title}</span>
                          {already && <span className="text-meta text-muted">đã có</span>}
                          {l.hidden && <span className="chip text-xs">ẩn</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={picked.size === 0} onClick={addPicked}>
              Thêm {picked.size > 0 ? `${picked.size} bài` : "bài đã chọn"} vào buổi
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setPicking(false); setPicked(new Set()); }}>
              Huỷ
            </button>
          </div>
        </div>
      )}

      {error && <p className="banner-danger text-sm" role="alert">{error}</p>}
      {notice && <p className="banner-success text-sm" role="status">{notice}</p>}

      {editable && (
        <div className="flex flex-wrap gap-2">
          {!picking && (
            <button type="button" className="btn-secondary btn-sm" disabled={busy || lessons.length >= MAX_LESSONS} onClick={() => setPicking(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Thêm bài
            </button>
          )}
          <button type="button" className="btn-primary btn-sm" disabled={busy || !dirty} onClick={save}>
            Lưu kế hoạch
          </button>
          {view.customized && (
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={reset}>
              Đặt lại theo giáo trình
            </button>
          )}
        </div>
      )}
    </div>
  );
}
