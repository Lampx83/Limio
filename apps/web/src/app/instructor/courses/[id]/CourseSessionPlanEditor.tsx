"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { distributeLessons } from "@/lib/sessionDistribution";
import LessonPicker, { type CourseTreeModule, type PickedLesson } from "./LessonPicker";

interface PlanView {
  source: "plan" | "chapters" | "none";
  editable: boolean;
  sessions: Array<{ sessionNo: number; topic: string | null; lessons: PickedLesson[] }>;
  unplannedLessons: number;
}

interface Row {
  key: number;
  topic: string;
  lessons: PickedLesson[];
}

const TOPIC_MAX = 120;
const MAX_LESSONS = 30;
const MAX_SESSIONS = 200;

const ERRORS: Record<string, string> = {
  too_many_lessons: `Mỗi buổi tối đa ${MAX_LESSONS} bài.`,
  too_many_sessions: `Bảng tối đa ${MAX_SESSIONS} buổi.`,
  lesson_not_in_course: "Có bài không còn thuộc khoá này. Tải lại trang rồi thử lại.",
  validation_failed: `Thông tin chưa hợp lệ (cần ít nhất một buổi, chủ đề tối đa ${TOPIC_MAX} ký tự, mỗi bài chỉ một lần trong một buổi).`,
  forbidden: "Chỉ chủ khoá và đồng giảng viên sửa được phân phối chương trình.",
};
const errText = (c?: string) => ERRORS[c ?? ""] ?? `Có lỗi xảy ra${c ? ` (${c})` : ""}. Thử lại sau.`;

/**
 * CENTER K — Phân phối chương trình: bảng "buổi nào học bài nào" cho mọi lớp của khoá. Chia nhanh theo số buổi rồi chỉnh
 * tay; lưu một lần cả bảng. Người chỉ dạy chỉ xem.
 */
export default function CourseSessionPlanEditor({ courseId, courseTree }: { courseId: string; courseTree: CourseTreeModule[] }) {
  const nextKey = useRef(1);
  const [view, setView] = useState<PlanView | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState<string>("");
  const [count, setCount] = useState("");
  const [pickingRow, setPickingRow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toRows = (v: PlanView): Row[] => v.sessions.map((s) => ({ key: nextKey.current++, topic: s.topic ?? "", lessons: s.lessons }));
  const snapshot = (rs: Row[]) => JSON.stringify(rs.map((r) => [r.topic.trim(), r.lessons.map((l) => l.id)]));

  const apply = (v: PlanView) => {
    const rs = toRows(v);
    setView(v);
    setRows(rs);
    setSaved(v.source === "plan" ? snapshot(rs) : "");
    setCount(String(rs.length || ""));
  };

  useEffect(() => {
    void (async () => {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/session-plan`));
      const j = (await r.json().catch(() => ({}))) as PlanView & { error?: string };
      if (!r.ok) return setError(errText(j.error));
      apply(j);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const editable = !!view?.editable;
  const dirty = useMemo(() => snapshot(rows) !== saved, [rows, saved]);
  const visibleLessons = useMemo(
    () => courseTree.flatMap((m) => m.lessons.filter((l) => !l.hidden).map((l) => ({ id: l.id, title: l.title, moduleTitle: m.title, hidden: false }))),
    [courseTree],
  );
  const unplanned = useMemo(() => {
    const used = new Set(rows.flatMap((r) => r.lessons.map((l) => l.id)));
    return courseTree.reduce((n, m) => n + m.lessons.filter((l) => !used.has(l.id)).length, 0);
  }, [rows, courseTree]);

  const update = (key: number, fn: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.key === key ? fn(r) : r)));
  const moveLesson = (key: number, i: number, d: -1 | 1) =>
    update(key, (r) => {
      const j = i + d;
      if (j < 0 || j >= r.lessons.length) return r;
      const ls = [...r.lessons];
      [ls[i], ls[j]] = [ls[j]!, ls[i]!];
      return { ...r, lessons: ls };
    });

  const split = () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > MAX_SESSIONS) return setError(`Số buổi phải là số nguyên từ 1 đến ${MAX_SESSIONS}.`);
    if (visibleLessons.length > n * MAX_LESSONS) return setError(`${visibleLessons.length} bài chia cho ${n} buổi thì mỗi buổi quá ${MAX_LESSONS} bài. Tăng số buổi lên.`);
    if (rows.some((r) => r.lessons.length || r.topic.trim()) && !window.confirm(`Chia lại ${visibleLessons.length} bài cho ${n} buổi? Bảng đang soạn trên màn hình sẽ bị thay.`)) return;
    setError(null);
    setNotice(`Đã chia ${visibleLessons.length} bài cho ${n} buổi. Xem lại rồi bấm "Lưu phân phối".`);
    setRows(distributeLessons(visibleLessons, n).map((lessons) => ({ key: nextKey.current++, topic: "", lessons })));
  };

  const call = async (method: "PUT" | "DELETE", body?: unknown, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/session-plan`), {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as PlanView & { error?: string };
      if (!r.ok) return setError(errText(j.error));
      apply(j);
      setNotice(done ?? "Đã lưu.");
    } catch {
      setError("Chưa lưu được vì mạng không ổn định. Bảng trên màn hình vẫn còn, bấm lưu lại khi có mạng.");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    call(
      "PUT",
      { sessions: rows.map((r) => ({ topic: r.topic.trim() || null, lessonIds: r.lessons.map((l) => l.id) })) },
      "Đã lưu phân phối chương trình. Các lớp của khoá đã theo bảng mới.",
    );
  const clear = () => {
    if (!window.confirm("Xoá phân phối chương trình? Các lớp sẽ quay về giáo án theo chương (nếu có). Buổi đã kết thúc giữ nguyên.")) return;
    void call("DELETE", undefined, "Đã xoá phân phối chương trình.");
  };

  if (!view) {
    return <div className="rounded-xl border border-token p-4 text-sm text-muted">{error ? <span role="alert" className="text-danger-600">{error}</span> : "Đang tải…"}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-h3">Phân phối chương trình</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Bảng này cho biết buổi nào học bài nào. Mọi lớp của khoá tự theo bảng: buổi số N của lớp hiện các bài của &quot;Buổi N&quot; ở
          lịch dạy của giáo viên và lịch học của học viên. Buổi nào đã chỉnh riêng bằng nút &quot;Kế hoạch&quot; ở trang lớp thì giữ
          nguyên; buổi đã kết thúc không bị đổi.
        </p>
      </div>

      {view.source === "chapters" && (
        <p className="banner-info text-sm">
          Khoá đang theo chương: chương số N là giáo án của buổi N. Bảng dưới đây chép từ các chương đó; bấm &quot;Lưu phân phối&quot; thì
          các lớp chuyển sang theo bảng.
        </p>
      )}
      {view.source === "none" && rows.length === 0 && (
        <p className="banner-info text-sm">Khoá chưa có giáo án theo buổi. Nhập số buổi rồi bấm &quot;Chia bài theo số buổi&quot; để bắt đầu.</p>
      )}
      {!editable && <p className="text-meta text-muted">Chỉ xem. Chủ khoá và đồng giảng viên mới sửa được bảng này.</p>}

      {editable && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-token p-3">
          <label className="text-sm">
            <span className="text-meta">Số buổi</span>
            <input
              type="number"
              min={1}
              max={MAX_SESSIONS}
              inputMode="numeric"
              className="input mt-1 block w-28"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <button type="button" className="btn-secondary btn-sm" disabled={busy || visibleLessons.length === 0} onClick={split}>
            Chia bài theo số buổi
          </button>
          {view.source === "plan" && (
            <button type="button" className="btn-ghost btn-sm ml-auto text-danger-600" disabled={busy} onClick={clear}>
              Xoá phân phối
            </button>
          )}
          <p className="basis-full text-meta text-muted">
            Lấy {visibleLessons.length} bài đang hiện của khoá theo đúng thứ tự rồi chia đều cho các buổi; sau đó chỉnh tay từng buổi.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <ol className="space-y-3">
          {rows.map((r, idx) => {
            const have = new Set(r.lessons.map((l) => l.id));
            return (
              <li key={r.key} className="card space-y-2 p-3" aria-label={`Buổi ${idx + 1}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-h4 shrink-0">Buổi {idx + 1}</h3>
                  {editable ? (
                    <input
                      className="input order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1"
                      maxLength={TOPIC_MAX}
                      aria-label={`Chủ đề buổi ${idx + 1}`}
                      placeholder="Chủ đề buổi (không bắt buộc)"
                      value={r.topic}
                      onChange={(e) => update(r.key, (x) => ({ ...x, topic: e.target.value }))}
                    />
                  ) : (
                    r.topic && <span className="text-sm">{r.topic}</span>
                  )}
                  {editable && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm ml-auto text-danger-600 sm:ml-0"
                      disabled={busy}
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Bỏ buổi
                    </button>
                  )}
                </div>

                {r.lessons.length === 0 ? (
                  <p className="text-sm text-muted">Chưa có bài nào.</p>
                ) : (
                  <ol className="space-y-1">
                    {r.lessons.map((l, i) => (
                      <li key={l.id} className="flex items-center gap-2 rounded-lg border border-token px-2 py-1.5 text-sm">
                        <span className="w-5 shrink-0 text-center text-meta text-muted">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{l.title}</span>
                          <span className="ml-2 text-meta text-muted">{l.moduleTitle}</span>
                          {l.hidden && <span className="chip ml-2 text-xs">Đang ẩn với học viên</span>}
                        </span>
                        {editable && (
                          <span className="flex shrink-0 gap-0.5">
                            <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={`Đưa "${l.title}" lên`} disabled={i === 0 || busy} onClick={() => moveLesson(r.key, i, -1)}>
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm px-1.5"
                              aria-label={`Đưa "${l.title}" xuống`}
                              disabled={i === r.lessons.length - 1 || busy}
                              onClick={() => moveLesson(r.key, i, 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm px-1.5 text-danger-600"
                              aria-label={`Bỏ "${l.title}" khỏi buổi ${idx + 1}`}
                              disabled={busy}
                              onClick={() => update(r.key, (x) => ({ ...x, lessons: x.lessons.filter((y) => y.id !== l.id) }))}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {editable &&
                  (pickingRow === r.key ? (
                    <LessonPicker
                      courseTree={courseTree}
                      have={have}
                      addLabel={(n) => `Thêm ${n > 0 ? `${n} bài` : "bài đã chọn"} vào buổi ${idx + 1}`}
                      onAdd={(add) => {
                        if (r.lessons.length + add.length > MAX_LESSONS) return setError(errText("too_many_lessons"));
                        setError(null);
                        update(r.key, (x) => ({ ...x, lessons: [...x.lessons, ...add] }));
                        setPickingRow(null);
                      }}
                      onCancel={() => setPickingRow(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={busy || r.lessons.length >= MAX_LESSONS}
                      onClick={() => setPickingRow(r.key)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Thêm bài
                    </button>
                  ))}
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={busy || rows.length >= MAX_SESSIONS}
          onClick={() => setRows((rs) => [...rs, { key: nextKey.current++, topic: "", lessons: [] }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Thêm buổi
        </button>
      )}

      {/* Thanh dính đáy, nội dung căn giữa để không nằm dưới nút nổi "Hỏi Lily" (góc phải) và nút menu (góc trái). */}
      <div
        className="sticky bottom-0 z-30 -mx-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-token bg-[rgb(var(--surface))]/95 px-1 py-3 backdrop-blur"
        role="region"
        aria-label="Lưu phân phối chương trình"
      >
        {/* Thông báo nằm trong thanh dính để thấy ngay, kể cả khi bảng dài 24 buổi. */}
        {error && <p className="banner-danger basis-full text-sm" role="alert">{error}</p>}
        {notice && <p className="banner-success basis-full text-sm" role="status">{notice}</p>}
        <span className="basis-full text-center text-meta text-muted">
          {rows.length} buổi · {unplanned > 0 ? `còn ${unplanned} bài chưa xếp vào buổi nào` : "mọi bài đã được xếp"}
        </span>
        {editable && (
          <button type="button" className="btn-primary btn-sm" disabled={busy || rows.length === 0 || !dirty} onClick={save}>
            Lưu phân phối
          </button>
        )}
      </div>
    </div>
  );
}
