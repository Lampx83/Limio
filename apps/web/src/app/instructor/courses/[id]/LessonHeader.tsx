"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Pencil, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";
import SafeHtml from "@/components/SafeHtml";
import LessonMetaBar from "./LessonMetaBar";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

interface SkillTag {
  skillId: string;
  code: string;
  name: string;
}

interface ModuleRef {
  id: string;
  title: string;
}

export default function LessonHeader({
  lessonId,
  title,
  description,
  order,
  orderIndex,
  previewable: initialPreviewable,
  isHidden: initialIsHidden,
  noSkill = false,
  showTitle = false,
  tags = [],
  moduleId,
  siblingLessonIds,
  modules,
}: {
  lessonId: string;
  title: string;
  description: string | null;
  order?: number;
  orderIndex: number;
  previewable: boolean;
  isHidden: boolean;
  noSkill?: boolean;
  showTitle?: boolean;
  tags?: SkillTag[];
  moduleId?: string;
  siblingLessonIds?: string[];
  modules?: ModuleRef[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title);
  const [d, setD] = useState(plainToRichHtml(description ?? ""));
  const [oi, setOi] = useState(orderIndex);
  const [previewable, setPreviewable] = useState(initialPreviewable);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [busy, setBusy] = useState(false);

  async function togglePreviewable() {
    const next = !previewable;
    setPreviewable(next);
    await fetch(apiUrl(`/api/lessons/${lessonId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewable: next }),
    });
    router.refresh();
  }

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/lessons/${lessonId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        description: d.trim() === "" ? null : d,
        orderIndex: oi,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function remove() {
    if (
      !confirm(
        `Xóa lesson "${title}"? Cascade content + quiz + skill tags + notes.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}`), {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">
              Title
            </span>
            <input
              value={t}
              onChange={(e) => setT(e.target.value)}
              required
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-faint">
              Order
            </span>
            <input
              type="number"
              min={0}
              value={oi}
              onChange={(e) => setOi(Number(e.target.value))}
              className="input mt-1 w-20"
            />
          </label>
        </div>
        <RichTextEditor
          value={d}
          onChange={setD}
          placeholder="Mô tả ngắn"
          minHeight={100}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary btn-sm">
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-secondary btn-sm"
          >
            Hủy
          </button>
        </div>
      </form>
    );
  }

  // Flat (lesson editor pane) — Option C compact layout.
  if (showTitle) {
    return (
      <header className="space-y-1.5">
        <h2 className="text-2xl font-bold leading-tight">{title}</h2>
        <LessonMetaBar
          lessonId={lessonId}
          order={order}
          isHidden={isHidden}
          previewable={previewable}
          tags={tags}
          title={title}
          onEdit={() => setEditing(true)}
          moduleId={moduleId}
          siblingLessonIds={siblingLessonIds}
          modules={modules}
        />
        {description && (
          <SafeHtml
            html={plainToRichHtml(description)}
            className="prose prose-sm max-w-none pt-1 italic text-muted dark:prose-invert"
          />
        )}
      </header>
    );
  }

  // Non-flat (preview list) — keep older TogglePill row.
  return (
    <header className="space-y-2">
      {description && (
        <SafeHtml
          html={plainToRichHtml(description)}
          className="prose prose-sm max-w-none text-muted dark:prose-invert"
        />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <TogglePill
          active={isHidden}
          activeClass="bg-danger-100 text-danger-700 border-danger-200"
          onClick={toggleHidden}
          icon="👁"
          label={isHidden ? "Đang ẩn" : "Hiển thị"}
          title={
            isHidden
              ? "Bài học bị ẩn khỏi học viên"
              : "Bài học hiển thị với học viên — bấm để ẩn"
          }
        />
        <TogglePill
          active={previewable}
          activeClass="bg-brand-soft text-brand-700 border-brand-200"
          onClick={togglePreviewable}
          icon="🔓"
          label={previewable ? "Cho preview" : "Không preview"}
          title={
            previewable
              ? "Học viên chưa mua có thể xem preview bài này"
              : "Chỉ học viên đã mua/đăng ký mới có thể xem — bấm để mở preview"
          }
        />
        {noSkill && <span className="chip-accent text-xs">chưa tag skill</span>}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-token bg-surface-2/50 p-0.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
            title="Sửa lesson"
            aria-label="Sửa"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            title="Xóa lesson"
            aria-label="Xóa"
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function TogglePill({
  active,
  activeClass,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  icon: string;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? activeClass
          : "border-token bg-[rgb(var(--surface-muted))] text-muted hover:bg-[rgb(var(--surface))]"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
