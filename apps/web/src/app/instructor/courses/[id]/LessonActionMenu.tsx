"use client";

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  MoreVertical,
  Copy,
  ArrowUp,
  ArrowDown,
  Shuffle,
  ChevronRight,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface ModuleRef {
  id: string;
  title: string;
}

export default function LessonActionMenu({
  lessonId,
  title,
  onEdit,
  moduleId,
  siblingLessonIds,
  modules,
  isHidden,
  isLocked,
  previewable,
  onToggleHidden,
  onToggleLocked,
  onTogglePreviewable,
}: {
  lessonId: string;
  title: string;
  onEdit: () => void;
  /** Current parent module id — used to filter "move to" target list. */
  moduleId?: string;
  /** Ordered ids of lessons in current module — used for up/down. */
  siblingLessonIds?: string[];
  /** All modules in the course — used for cross-module move sub-menu. */
  modules?: ModuleRef[];
  isHidden?: boolean;
  isLocked?: boolean;
  previewable?: boolean;
  onToggleHidden?: () => void;
  onToggleLocked?: () => void;
  onTogglePreviewable?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMoveOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setMoveOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setMoveOpen(false);
  }

  async function duplicate() {
    setBusy(true);
    close();
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/duplicate`), {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Duplicate thất bại");
  }

  async function reorder(direction: "up" | "down") {
    if (!siblingLessonIds || !moduleId) return;
    const idx = siblingLessonIds.indexOf(lessonId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblingLessonIds.length) return;
    const next = [...siblingLessonIds];
    [next[idx], next[targetIdx]] = [next[targetIdx]!, next[idx]!];
    setBusy(true);
    close();
    const res = await fetch(apiUrl(`/api/modules/${moduleId}/lessons/reorder`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedLessonIds: next }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Reorder thất bại");
  }

  async function moveTo(targetModuleId: string) {
    setBusy(true);
    close();
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/move`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId: targetModuleId }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Chuyển module thất bại");
  }

  async function remove() {
    if (
      !confirm(
        `Xóa lesson "${title}"? Cascade content + quiz + skill tags + notes.`,
      )
    )
      return;
    setBusy(true);
    close();
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}`), {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  const idx = siblingLessonIds?.indexOf(lessonId) ?? -1;
  const canUp = idx > 0;
  const canDown =
    idx >= 0 && siblingLessonIds && idx < siblingLessonIds.length - 1;
  const otherModules = modules?.filter((m) => m.id !== moduleId) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
        title="Sửa lesson (tiêu đề, mô tả, order)"
        aria-label="Sửa lesson"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-default disabled:opacity-50"
          title="Hành động khác (duplicate, di chuyển, xoá)"
          aria-label="Menu hành động"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[240px] rounded-xl border border-token bg-[rgb(var(--surface))] py-1 shadow-2xl"
          >
            {onToggleHidden && (
              <MenuItem
                Icon={isHidden ? EyeOff : Eye}
                label={isHidden ? "Đang ẩn với học viên" : "Đang hiện với học viên"}
                hint={isHidden ? "Bấm để hiện" : "Bấm để ẩn"}
                onClick={() => {
                  onToggleHidden();
                  close();
                }}
                tone={isHidden ? "danger" : undefined}
              />
            )}
            {onToggleLocked && (
              <MenuItem
                Icon={isLocked ? Lock : Unlock}
                label={isLocked ? "Đang khoá nội dung" : "Nội dung đang mở"}
                hint={isLocked ? "Bấm để mở" : "Bấm để khoá"}
                onClick={() => {
                  onToggleLocked();
                  close();
                }}
              />
            )}
            {onTogglePreviewable && (
              <MenuItem
                Icon={previewable ? Eye : EyeOff}
                label={
                  previewable
                    ? "Người chưa ghi danh xem thử được"
                    : "Chỉ học viên đã ghi danh xem được"
                }
                hint={previewable ? "Bấm để tắt xem thử" : "Bấm để mở xem thử"}
                onClick={() => {
                  onTogglePreviewable();
                  close();
                }}
              />
            )}
            {(onToggleHidden || onToggleLocked || onTogglePreviewable) && (
              <div role="separator" className="my-1 border-t border-token" />
            )}
            <MenuItem Icon={Copy} label="Duplicate lesson" onClick={duplicate} />
            {siblingLessonIds && (
              <>
                <MenuItem
                  Icon={ArrowUp}
                  label="Chuyển lên"
                  onClick={() => reorder("up")}
                  disabled={!canUp}
                />
                <MenuItem
                  Icon={ArrowDown}
                  label="Chuyển xuống"
                  onClick={() => reorder("down")}
                  disabled={!canDown}
                />
              </>
            )}
            {modules && otherModules.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  role="menuitem"
                  onMouseEnter={() => setMoveOpen(true)}
                  onClick={() => setMoveOpen((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
                  aria-haspopup="menu"
                  aria-expanded={moveOpen}
                >
                  <Shuffle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1">Chuyển sang module khác</span>
                  <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
                </button>
                {moveOpen && (
                  <div
                    role="menu"
                    className="absolute right-full top-0 mr-1 min-w-[220px] max-h-72 overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] py-1 shadow-2xl"
                  >
                    {otherModules.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitem"
                        onClick={() => moveTo(m.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
                      >
                        <span className="truncate">{m.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div role="separator" className="my-1 border-t border-token" />
            <MenuItem
              Icon={Trash2}
              label="Xóa lesson"
              onClick={remove}
              danger
            />
          </div>
        )}
      </div>
    </>
  );
}

function MenuItem({
  Icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
  tone,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  tone?: "danger";
}) {
  const toneClass =
    danger
      ? "text-danger-600 hover:bg-danger-50"
      : tone === "danger"
      ? "text-danger-600 hover:bg-danger-50"
      : "hover:bg-[rgb(var(--surface-muted))]";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </button>
  );
}
