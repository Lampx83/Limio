"use client";

import { useEffect, useState } from "react";
import SortableModulesWrapper from "../../instructor/courses/[id]/SortableModulesWrapper";

type SectionType = "MANUAL" | "AUTO_RECENT";

interface SectionRow {
  id: string;
  title: string;
  type: SectionType;
  order: number;
  isActive: boolean;
  autoLimit: number | null;
  courseCount: number;
}

interface CourseInSection {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface CourseSearchResult {
  id: string;
  title: string;
  slug: string;
  category: string | null;
}

const TYPE_LABEL: Record<SectionType, string> = {
  MANUAL: "Thủ công",
  AUTO_RECENT: "Tự động — mới xuất bản",
};

export default function CatalogSectionsManager({
  initialSections,
}: {
  initialSections: SectionRow[];
}) {
  const [sections, setSections] = useState(initialSections);
  useEffect(() => setSections(initialSections), [initialSections]);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<SectionType>("MANUAL");
  const [newAutoLimit, setNewAutoLimit] = useState(8);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; autoLimit: number } | null>(
    null,
  );

  async function createSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/admin/catalog-sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        type: newType,
        ...(newType === "AUTO_RECENT" ? { autoLimit: newAutoLimit } : {}),
      }),
    });
    setCreating(false);
    if (!res.ok) {
      setCreateError("Tạo section thất bại — kiểm tra lại tên section.");
      return;
    }
    const { section } = await res.json();
    setSections((prev) => [...prev, { ...section, courseCount: 0 }]);
    setNewTitle("");
    setNewType("MANUAL");
    setNewAutoLimit(8);
  }

  async function saveEdit() {
    if (!editing) return;
    const res = await fetch(`/api/admin/catalog-sections/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editing.title, autoLimit: editing.autoLimit }),
    });
    if (!res.ok) {
      alert("Cập nhật thất bại");
      return;
    }
    const { section } = await res.json();
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, ...section } : s)),
    );
    setEditing(null);
  }

  async function toggleActive(s: SectionRow) {
    const res = await fetch(`/api/admin/catalog-sections/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (!res.ok) {
      alert("Cập nhật thất bại");
      return;
    }
    setSections((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)),
    );
  }

  async function removeSection(s: SectionRow) {
    if (!confirm(`Xoá section "${s.title}"? Không thể hoàn tác.`)) return;
    const res = await fetch(`/api/admin/catalog-sections/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Xoá thất bại");
      return;
    }
    setSections((prev) => prev.filter((x) => x.id !== s.id));
    if (expandedId === s.id) setExpandedId(null);
  }

  function updateCourseCount(sectionId: string, count: number) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, courseCount: count } : s)),
    );
  }

  function renderSectionRow(s: SectionRow) {
    const isEditing = editing?.id === s.id;
    return (
      <div className="card !p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={s.type === "MANUAL" ? "chip-brand" : "chip-success"}>
                {TYPE_LABEL[s.type]}
              </span>
              {!s.isActive && <span className="chip-danger">Đang ẩn</span>}
              <span className="text-xs text-faint">{s.courseCount} course</span>
            </div>

            {isEditing ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-xs"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  autoFocus
                />
                {s.type === "AUTO_RECENT" && (
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="input w-24"
                    value={editing.autoLimit}
                    onChange={(e) =>
                      setEditing({ ...editing, autoLimit: Number(e.target.value) || 1 })
                    }
                  />
                )}
                <button type="button" className="btn-secondary btn-sm" onClick={saveEdit}>
                  Lưu
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setEditing(null)}
                >
                  Huỷ
                </button>
              </div>
            ) : (
              <>
                <h3 className="mt-1 truncate text-sm font-semibold">{s.title}</h3>
                {s.type === "AUTO_RECENT" && (
                  <p className="mt-0.5 text-xs text-faint">
                    Tự lấy {s.autoLimit ?? 8} course publish gần nhất
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {s.type === "MANUAL" && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                {expandedId === s.id ? "Đóng" : "Quản lý course"}
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setEditing({ id: s.id, title: s.title, autoLimit: s.autoLimit ?? 8 })}
              >
                Sửa
              </button>
            )}
            <button type="button" className="btn-secondary btn-sm" onClick={() => toggleActive(s)}>
              {s.isActive ? "Ẩn" : "Hiện"}
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={() => removeSection(s)}>
              Xoá
            </button>
          </div>
        </div>

        {expandedId === s.id && s.type === "MANUAL" && (
          <div className="mt-4 border-t border-token pt-4">
            <SectionCoursesPanel
              sectionId={s.id}
              onCountChange={(n) => updateCourseCount(s.id, n)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-base font-semibold">Tạo section mới</h2>
        <form onSubmit={createSection} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label">Tên section</label>
            <input
              className="input mt-1"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder='vd. "Nổi bật"'
              required
            />
          </div>
          <div>
            <label className="label">Loại</label>
            <select
              className="select mt-1"
              value={newType}
              onChange={(e) => setNewType(e.target.value as SectionType)}
            >
              <option value="MANUAL">Thủ công (tự chọn course)</option>
              <option value="AUTO_RECENT">Tự động — mới xuất bản</option>
            </select>
          </div>
          {newType === "AUTO_RECENT" && (
            <div>
              <label className="label">Số course hiển thị</label>
              <input
                type="number"
                min={1}
                max={50}
                className="input mt-1 w-24"
                value={newAutoLimit}
                onChange={(e) => setNewAutoLimit(Number(e.target.value) || 1)}
              />
            </div>
          )}
          <button className="btn-primary" disabled={creating}>
            Tạo section
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-danger-600">{createError}</p>}
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-faint">
          Chưa có section nào — trang /catalog đang hiển thị list phẳng mặc định.
        </p>
      ) : (
        <SortableModulesWrapper
          items={sections.map((s) => ({ id: s.id, node: renderSectionRow(s) }))}
          reorderEndpoint="/api/admin/catalog-sections/reorder"
          payloadKey="orderedSectionIds"
        />
      )}
    </div>
  );
}

function SectionCoursesPanel({
  sectionId,
  onCountChange,
}: {
  sectionId: string;
  onCountChange: (count: number) => void;
}) {
  const [courses, setCourses] = useState<CourseInSection[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/catalog-sections/${sectionId}/courses`)
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []));
  }, [sectionId]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/courses/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.courses ?? []))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function addCourse(c: CourseSearchResult) {
    const res = await fetch(`/api/admin/catalog-sections/${sectionId}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: c.id }),
    });
    if (!res.ok) {
      alert("Thêm course thất bại");
      return;
    }
    setCourses((prev) => {
      const next = [...(prev ?? []), { id: c.id, title: c.title, slug: c.slug, status: "published" }];
      onCountChange(next.length);
      return next;
    });
    setQuery("");
    setResults([]);
  }

  async function removeCourse(courseId: string) {
    const res = await fetch(`/api/admin/catalog-sections/${sectionId}/courses/${courseId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Xoá course thất bại");
      return;
    }
    setCourses((prev) => {
      const next = (prev ?? []).filter((c) => c.id !== courseId);
      onCountChange(next.length);
      return next;
    });
  }

  if (courses === null) return <p className="text-sm text-faint">Đang tải...</p>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          className="input"
          placeholder="Tìm course đã publish để thêm vào section..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-token bg-[rgb(var(--surface))] shadow-card">
            {searching ? (
              <p className="p-3 text-sm text-faint">Đang tìm...</p>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-faint">Không tìm thấy course publish nào khớp.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {results.map((c) => {
                  const already = courses.some((x) => x.id === c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => addCourse(c)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50"
                      >
                        <span className="truncate">{c.title}</span>
                        <span className="shrink-0 text-xs text-faint">
                          {already ? "Đã có" : "+ Thêm"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-faint">Section này chưa có course nào.</p>
      ) : (
        <SortableModulesWrapper
          items={courses.map((c) => ({
            id: c.id,
            node: (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm">
                <span className="truncate">{c.title}</span>
                <button
                  type="button"
                  onClick={() => removeCourse(c.id)}
                  className="btn-ghost btn-sm shrink-0"
                >
                  Xoá
                </button>
              </div>
            ),
          }))}
          reorderEndpoint={`/api/admin/catalog-sections/${sectionId}/courses/reorder`}
          payloadKey="orderedCourseIds"
        />
      )}
    </div>
  );
}
