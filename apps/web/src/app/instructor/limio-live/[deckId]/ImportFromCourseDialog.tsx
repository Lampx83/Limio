"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

interface Outline {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
}

/**
 * Nhập bài giảng có sẵn từ một khoá học (chỉ khoá giảng viên được sửa) thành
 * slide văn bản nối vào cuối bài giảng. Chỉ chữ (richtext/markdown) được nhập.
 */
export default function ImportFromCourseDialog({
  deckId,
  onImported,
  onClose,
}: {
  deckId: string;
  onImported: (slides: unknown[]) => void;
  onClose: () => void;
}) {
  const [courses, setCourses] = useState<{ id: string; title: string }[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [modules, setModules] = useState<Outline[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  useEffect(() => {
    fetch(apiUrl("/api/instructor/limio-live/import-course"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCourses(d.courses))
      .catch(() => {
        setCourses([]);
        toast.error("Không tải được danh sách khoá học");
      });
  }, []);

  const pickCourse = async (id: string) => {
    setCourseId(id);
    setPicked(new Set());
    setModules(null);
    if (!id) return;
    try {
      const r = await fetch(apiUrl(`/api/instructor/limio-live/import-course?courseId=${encodeURIComponent(id)}`));
      if (!r.ok) throw new Error();
      setModules((await r.json()).modules);
    } catch {
      setModules([]);
      toast.error("Không tải được mục lục khoá học");
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (picked.size === 0 || busy) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/import-course`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonIds: Array.from(picked) }),
      });
      if (!r.ok) { toast.error("Nhập bài giảng thất bại"); return; }
      const { slides } = (await r.json()) as { slides: unknown[] };
      toast.success(`Đã nhập ${slides.length} slide từ khoá học`);
      onImported(slides);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-label="Nhập bài giảng từ khoá học"
        className="max-h-[90vh] w-full max-w-lg animate-dialog-in overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-h4">Nhập bài giảng từ khoá học</h3>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-faint hover:bg-[rgb(var(--surface-muted))]" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <p className="banner-info mb-3 text-sm">
          Mỗi bài học thành một hoặc vài slide văn bản (tiêu đề + ý chính) nối vào cuối bài giảng. Chỉ nhập phần chữ
          (văn bản/Markdown); video, PDF và câu hỏi không được nhập.
        </p>

        {courses === null ? (
          <p className="text-meta text-muted">Đang tải…</p>
        ) : courses.length === 0 ? (
          <p className="text-meta text-muted">Bạn chưa có khoá học nào được quyền sửa.</p>
        ) : (
          <select className="input" value={courseId} onChange={(e) => pickCourse(e.target.value)} aria-label="Chọn khoá học">
            <option value="">— Chọn khoá học —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}

        {courseId && modules === null && <p className="text-meta mt-3 text-muted">Đang tải mục lục…</p>}
        {modules && modules.length === 0 && <p className="text-meta mt-3 text-muted">Khoá này chưa có bài học.</p>}
        {modules && modules.length > 0 && (
          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-token p-3">
            {modules.map((m) => (
              <div key={m.id}>
                <p className="text-caption font-semibold uppercase tracking-wide text-faint">{m.title}</p>
                <ul className="mt-1 space-y-1">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={picked.has(l.id)} onChange={() => toggle(l.id)} />
                        <span>{l.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="btn-secondary btn-sm">Huỷ</button>
          <button onClick={submit} disabled={busy || picked.size === 0} className="btn-primary btn-sm">
            {busy ? "Đang nhập…" : `Nhập ${picked.size || ""} bài`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
