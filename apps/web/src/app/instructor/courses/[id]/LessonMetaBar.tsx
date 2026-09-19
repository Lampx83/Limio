"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, AlertTriangle, Presentation, Lock } from "lucide-react";
import { isAutoLessonSkillCode } from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";
import SkillTagsEditor from "./SkillTagsEditor";
import LessonActionMenu from "./LessonActionMenu";

interface Tag {
  skillId: string;
  code: string;
  name: string;
}

interface ModuleRef {
  id: string;
  title: string;
}

export default function LessonMetaBar({
  lessonId,
  order,
  isHidden: initialIsHidden,
  isLocked: initialIsLocked,
  previewable: initialPreviewable,
  tags,
  title,
  onEdit,
  moduleId,
  siblingLessonIds,
  modules,
  courseSlug,
  hideUntaggedWarning = false,
}: {
  lessonId: string;
  order?: number;
  isHidden: boolean;
  isLocked: boolean;
  previewable: boolean;
  tags: Tag[];
  title?: string;
  onEdit?: () => void;
  /** Có slug thì hiện nút mở thẳng chế độ giảng dạy của bài này. */
  courseSlug?: string;
  moduleId?: string;
  siblingLessonIds?: string[];
  modules?: ModuleRef[];
  hideUntaggedWarning?: boolean;
}) {
  const router = useRouter();
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [previewable, setPreviewable] = useState(initialPreviewable);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!skillsOpen) return;
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSkillsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSkillsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [skillsOpen]);

  async function patch(body: Record<string, unknown>) {
    await fetch(apiUrl(`/api/lessons/${lessonId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await patch({ isHidden: next });
  }

  async function toggleLocked() {
    const next = !isLocked;
    setIsLocked(next);
    await patch({ isLocked: next });
  }

  async function togglePreviewable() {
    const next = !previewable;
    setPreviewable(next);
    await patch({ previewable: next });
  }

  const noSkill = tags.length === 0;
  const showSkillsCluster = !(noSkill && hideUntaggedWarning);

  const manualCodes = tags.filter((t) => !isAutoLessonSkillCode(t.code)).map((t) => t.code);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {isHidden && (
        <span className="chip-danger" title="Bài đang ẩn với học viên">
          Đang ẩn
        </span>
      )}

      {isLocked && !isHidden && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-0.5 font-medium text-accent-700"
          title="Học viên thấy tên bài kèm ổ khoá, nhưng không mở được nội dung"
        >
          <Lock className="h-3 w-3" aria-hidden />
          Đang khoá
        </span>
      )}

      {courseSlug && (
        // Soạn xong là dạy được ngay, không phải tự dò đường sang trang học
        // viên rồi thêm tay ?gv=1. Mở tab mới để trang soạn còn nguyên.
        <Link
          href={`/learn/${courseSlug}/lessons/${lessonId}?gv=1`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-soft px-2.5 py-0.5 font-medium text-brand-700 transition-colors hover:bg-brand-100"
          title="Mở bài này ở chế độ giảng dạy (thanh giảng viên, ghi chú, màn chiếu) trong tab mới"
        >
          <Presentation className="h-3.5 w-3.5" aria-hidden />
          Trình chiếu
        </Link>
      )}

      {/* Skills cluster — hidden when course personalization is off and no tags */}
      {showSkillsCluster && (
      <div ref={popoverRef} className="relative inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setSkillsOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
            noSkill
              ? "border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100"
              : "border-token bg-[rgb(var(--surface-muted))] text-default hover:bg-[rgb(var(--surface))]"
          }`}
          aria-haspopup="dialog"
          aria-expanded={skillsOpen}
          title={noSkill ? "Bài học chưa được tag skill — bấm để thêm" : `${tags.length} skill đã tag — bấm để chỉnh sửa`}
        >
          {noSkill ? (
            <span className="inline-flex items-center gap-1 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              chưa tag skill
            </span>
          ) : (
            <>
              <span>{tags.length} skill{tags.length > 1 ? "s" : ""}</span>
              {manualCodes.length > 0 && (
                <span className="hidden sm:inline text-faint">
                  {manualCodes.slice(0, 2).join(" · ")}
                  {manualCodes.length > 2 && ` +${manualCodes.length - 2}`}
                </span>
              )}
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-faint" aria-hidden />
        </button>

        {skillsOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 shadow-2xl">
            <SkillTagsEditor lessonId={lessonId} tags={tags} />
          </div>
        )}
      </div>
      )}

      {onEdit && (
        <div className="ml-auto inline-flex items-center gap-1">
          <LessonActionMenu
            lessonId={lessonId}
            title={title ?? ""}
            onEdit={onEdit}
            moduleId={moduleId}
            siblingLessonIds={siblingLessonIds}
            modules={modules}
            isHidden={isHidden}
            isLocked={isLocked}
            previewable={previewable}
            onToggleHidden={toggleHidden}
            onToggleLocked={toggleLocked}
            onTogglePreviewable={togglePreviewable}
          />
        </div>
      )}
    </div>
  );
}
