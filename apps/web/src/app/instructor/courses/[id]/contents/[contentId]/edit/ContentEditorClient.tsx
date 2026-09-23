"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { ICON, TYPE_COLOR, DEFAULT_TYPE_COLOR } from "../../../ContentItemRow";
import EditContentItemForm from "../../../EditContentItemForm";

const TYPE_LABEL: Record<string, string> = {
  richtext: "Văn bản",
  markdown: "Markdown",
  video: "Video",
  pdf: "PDF",
  file: "File đính kèm",
  external_link: "Link ngoài",
  embed: "Embed",
  html_block: "HTML tự tải lên",
  teacher_note: "Ghi chú giảng viên",
  scorm: "SCORM",
  h5p: "H5P",
  lti: "LTI",
};

export default function ContentEditorClient({
  courseId,
  lessonId,
  lessonTitle,
  item,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  item: { id: string; type: string; payload: unknown };
}) {
  const router = useRouter();
  const backHref = `/instructor/courses/${courseId}?tab=content&lesson=${lessonId}`;
  const Icon = ICON[item.type] ?? FileText;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-sm">
        <header className="flex flex-wrap items-center gap-3 border-b border-token px-5 py-4">
          <Link
            href={backHref}
            aria-label="Quay lại bài học"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-muted))] text-muted transition-colors hover:bg-brand-soft hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              TYPE_COLOR[item.type] ?? DEFAULT_TYPE_COLOR
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-default">
              {TYPE_LABEL[item.type] ?? item.type}
            </h1>
            <p className="truncate text-sm text-muted">Bài: {lessonTitle}</p>
          </div>
        </header>

        <div className="p-5">
          <EditContentItemForm
            item={item}
            lessonId={lessonId}
            onClose={() => router.push(backHref)}
          />
        </div>
      </div>
    </div>
  );
}
