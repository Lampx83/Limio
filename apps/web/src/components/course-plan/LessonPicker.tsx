"use client";

import { useState } from "react";

export interface CourseTreeModule {
  id: string;
  title: string;
  lessons: Array<{ id: string; title: string; hidden: boolean }>;
}

export interface PickedLesson {
  id: string;
  title: string;
  moduleTitle: string;
  hidden: boolean;
}

/**
 * Bộ chọn bài của khoá: cây chương → bài, tìm theo tên bài hoặc chương, chọn nhiều bài một lần. Bài đã có (`have`) hiện
 * mờ, không chọn lại được. Dùng ở nút "Kế hoạch" của buổi (CENTER J) và bảng "Phân phối chương trình" (CENTER K).
 */
export default function LessonPicker({
  courseTree,
  have,
  addLabel,
  onAdd,
  onCancel,
}: {
  courseTree: CourseTreeModule[];
  have: ReadonlySet<string>;
  /** Nhãn nút xác nhận, theo số bài đã chọn (0 = chưa chọn). */
  addLabel: (count: number) => string;
  /** Bài đã chọn, theo đúng thứ tự trong khoá. */
  onAdd: (lessons: PickedLesson[]) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const tree = courseTree
    .map((m) => ({ ...m, lessons: m.lessons.filter((l) => !q || l.title.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)) }))
    .filter((m) => m.lessons.length > 0);

  const confirm = () => {
    const out: PickedLesson[] = [];
    for (const m of courseTree)
      for (const l of m.lessons) if (picked.has(l.id) && !have.has(l.id)) out.push({ id: l.id, title: l.title, moduleTitle: m.title, hidden: l.hidden });
    onAdd(out);
  };

  return (
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
        <button type="button" className="btn-primary btn-sm" disabled={picked.size === 0} onClick={confirm}>
          {addLabel(picked.size)}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  );
}
