"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlaskConical, Search, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import ModuleOverviewCard, { type OverviewLesson } from "./ModuleOverviewCard";

interface OverviewModule {
  id: string;
  title: string;
  orderIndex: number;
  isHidden: boolean;
  isLocked: boolean;
  lessons: OverviewLesson[];
}

export default function ModuleOverviewList({
  courseId,
  modules,
}: {
  courseId: string;
  modules: OverviewModule[];
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0;

  const visible = useMemo(
    () =>
      modules
        .map((m, i) => ({
          order: i + 1,
          module: {
            ...m,
            lessons: filtering
              ? m.lessons.filter((l) => l.title.toLowerCase().includes(q))
              : m.lessons,
          },
        }))
        .filter((x) => !filtering || x.module.lessons.length > 0),
    [modules, q, filtering],
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))]">
      <div className="flex flex-wrap items-center gap-2 border-b border-token p-3">
        <label className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bài học…"
            aria-label="Tìm bài học"
            className="input !h-8 pl-8 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(modules.map((m) => m.id)))}
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
        >
          <ChevronsDownUp className="h-4 w-4" aria-hidden /> Gập hết
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(new Set())}
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
        >
          <ChevronsUpDown className="h-4 w-4" aria-hidden /> Mở hết
        </button>
        <Link
          href={`/instructor/courses/${courseId}/exams`}
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
        >
          <FlaskConical className="h-4 w-4" aria-hidden /> Bài thi
        </Link>
      </div>

      {visible.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted">Không có bài nào khớp “{query}”.</p>
      )}
      {visible.map(({ module, order }) => (
        <ModuleOverviewCard
          key={module.id}
          courseId={courseId}
          module={module}
          order={order}
          collapsed={!filtering && collapsed.has(module.id)}
          onToggle={() => toggle(module.id)}
          filtering={filtering}
        />
      ))}
    </div>
  );
}
