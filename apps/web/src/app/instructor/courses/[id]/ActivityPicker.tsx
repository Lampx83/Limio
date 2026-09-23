"use client";

import { useEffect, useState } from "react";
import {
  Blocks,
  ClipboardList,
  FileCode,
  FileText,
  FileType,
  Globe,
  LayoutTemplate,
  Link2,
  ListChecks,
  NotebookPen,
  Package,
  Paperclip,
  PenLine,
  Puzzle,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import AddContentItemForm from "./AddContentItemForm";
import AddQuizForm from "./AddQuizForm";
import AddAssignmentForm from "./AddAssignmentForm";

type ContentSubtype =
  | "markdown"
  | "richtext"
  | "video"
  | "pdf"
  | "file"
  | "external_link"
  | "embed"
  | "scorm"
  | "h5p"
  | "lti"
  | "teacher_note"
  | "html_block";

type Tile = {
  /** Unique key */
  key: string;
  /** Group label */
  group: "resource" | "activity";
  icon: LucideIcon;
  /**
   * Màu nền/chữ của ô icon (bg-{color}-100 text-{color}-700) — dùng đúng màu
   * định danh theo loại content đã có ở ContentItemRow.tsx/QuizSection.tsx/
   * AssignmentSection.tsx, để nhất quán xuyên suốt app.
   */
  color: string;
  name: string;
  description: string;
  /** Optional small corner badge, e.g. "AI" for AI-assisted tiles */
  badge?: string;
  /** Search keywords (besides name + description) */
  keywords: string;
  /**
   * What to render when picked. "content" + ContentSubtype renders
   * AddContentItemForm with that type locked. "quiz"/"assignment" render
   * the dedicated form.
   */
  pick:
    | { kind: "content"; subtype: ContentSubtype; richtextMode?: "ai" | "wysiwyg" }
    | { kind: "quiz" }
    | { kind: "assignment" };
};

const TILES: Tile[] = [
  {
    key: "richtext_ai",
    group: "resource",
    icon: FileText,
    color: "bg-blue-100 text-blue-700",
    name: "Văn bản — AI hỗ trợ",
    description: "Copy-paste văn bản thô — AI định dạng đẹp giúp bạn",
    badge: "AI supported",
    keywords: "text richtext ai dinh dang format van ban tho paste",
    pick: { kind: "content", subtype: "richtext", richtextMode: "ai" },
  },
  {
    key: "richtext_wysiwyg",
    group: "resource",
    icon: PenLine,
    color: "bg-blue-100 text-blue-700",
    name: "Richtext editor",
    description: "Soạn trực tiếp — in đậm, danh sách, ảnh, bảng, không qua AI",
    keywords: "richtext wysiwyg editor soan thao truc quan van ban",
    pick: { kind: "content", subtype: "richtext", richtextMode: "wysiwyg" },
  },
  {
    key: "teacher_note",
    group: "resource",
    icon: NotebookPen,
    color: "bg-amber-100 text-amber-700",
    name: "Ghi chú giảng viên",
    description: "Chỉ bạn thấy khi dạy — học viên và bản in của họ không có",
    keywords: "ghi chu giao an speaker note teacher presenter giang vien",
    pick: { kind: "content", subtype: "teacher_note" },
  },
  {
    key: "markdown",
    group: "resource",
    icon: FileCode,
    color: "bg-indigo-100 text-indigo-700",
    name: "Markdown",
    description: "Viết markdown thô — cho người quen cú pháp",
    keywords: "markdown md note",
    pick: { kind: "content", subtype: "markdown" },
  },
  {
    key: "video",
    group: "resource",
    icon: Video,
    color: "bg-red-100 text-red-700",
    name: "Video",
    description: "Embed YouTube/Vimeo/Loom hoặc upload file",
    keywords: "youtube vimeo loom mp4 webm",
    pick: { kind: "content", subtype: "video" },
  },
  {
    key: "pdf",
    group: "resource",
    icon: FileType,
    color: "bg-orange-100 text-orange-700",
    name: "PDF",
    description: "Upload file PDF hoặc dán link",
    keywords: "pdf document slide",
    pick: { kind: "content", subtype: "pdf" },
  },
  {
    key: "file",
    group: "resource",
    icon: Paperclip,
    color: "bg-slate-100 text-slate-700",
    name: "File đính kèm",
    description: "Tài liệu để học viên download",
    keywords: "file download attachment",
    pick: { kind: "content", subtype: "file" },
  },
  {
    key: "external_link",
    group: "resource",
    icon: Link2,
    color: "bg-cyan-100 text-cyan-700",
    name: "Link ngoài",
    description: "Trỏ tới website/tài liệu bên ngoài",
    keywords: "url link external website",
    pick: { kind: "content", subtype: "external_link" },
  },
  {
    key: "embed",
    group: "resource",
    icon: LayoutTemplate,
    color: "bg-purple-100 text-purple-700",
    name: "Embed",
    description: "Nhúng iframe URL bất kỳ",
    keywords: "iframe embed url",
    pick: { kind: "content", subtype: "embed" },
  },
  {
    key: "html_block",
    group: "resource",
    icon: Globe,
    color: "bg-rose-100 text-rose-700",
    name: "HTML tự tải lên",
    description: "Upload 1 file .html, hiển thị trong khung riêng (sandbox)",
    keywords: "html file iframe sandbox upload",
    pick: { kind: "content", subtype: "html_block" },
  },
  {
    key: "quiz",
    group: "activity",
    icon: ListChecks,
    color: "bg-brand-100 text-brand-700",
    name: "Quiz",
    description: "Trắc nghiệm, short answer — auto chấm",
    keywords: "quiz question test mcq",
    pick: { kind: "quiz" },
  },
  {
    key: "assignment",
    group: "activity",
    icon: ClipboardList,
    color: "bg-pink-100 text-pink-700",
    name: "Assignment",
    description: "Bài tập — instructor chấm tay",
    keywords: "assignment homework essay",
    pick: { kind: "assignment" },
  },
  {
    key: "scorm",
    group: "activity",
    icon: Package,
    color: "bg-teal-100 text-teal-700",
    name: "SCORM",
    description: "Package SCORM 1.2 (.zip)",
    keywords: "scorm package zip",
    pick: { kind: "content", subtype: "scorm" },
  },
  {
    key: "h5p",
    group: "activity",
    icon: Blocks,
    color: "bg-emerald-100 text-emerald-700",
    name: "H5P",
    description: "Interactive H5P content",
    keywords: "h5p interactive",
    pick: { kind: "content", subtype: "h5p" },
  },
  {
    key: "lti",
    group: "activity",
    icon: Puzzle,
    color: "bg-fuchsia-100 text-fuchsia-700",
    name: "LTI",
    description: "Tool LTI 1.3 external",
    keywords: "lti external tool",
    pick: { kind: "content", subtype: "lti" },
  },
];

type Filter = "all" | "resource" | "activity";

export default function ActivityPicker({
  open,
  onClose,
  lessonId,
  nextContentOrderIndex,
}: {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  nextContentOrderIndex: number;
}) {
  const [pickedTile, setPickedTile] = useState<Tile | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  // Reset internal state whenever the modal closes — picker should always
  // start fresh next time.
  useEffect(() => {
    if (!open) {
      setPickedTile(null);
      setFilter("all");
      setSearch("");
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = search.trim().toLowerCase();
  const filtered = TILES.filter((t) => {
    if (filter !== "all" && t.group !== filter) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.toLowerCase().includes(q)
    );
  });

  const resources = filtered.filter((t) => t.group === "resource");
  const activities = filtered.filter((t) => t.group === "activity");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-picker-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-7xl rounded-2xl bg-[rgb(var(--surface))] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-token px-5 py-4">
          {pickedTile ? (
            <button
              type="button"
              onClick={() => setPickedTile(null)}
              className="link inline-flex items-center gap-1 text-sm"
            >
              ← Chọn loại khác
            </button>
          ) : (
            <h2 id="activity-picker-title" className="text-lg font-semibold">
              Thêm hoạt động/tài nguyên
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-default"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body — picker grid OR selected form */}
        {!pickedTile ? (
          <div className="space-y-4 p-5">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Tìm hoạt động..."
              className="input"
            />

            <div className="flex gap-1.5">
              {(["all", "resource", "activity"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-brand-600 text-white"
                      : "bg-[rgb(var(--surface-muted))] text-default hover:bg-brand-soft"
                  }`}
                >
                  {f === "all"
                    ? "Tất cả"
                    : f === "resource"
                      ? "Tài nguyên"
                      : "Hoạt động"}
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="rounded-lg border border-dashed border-token px-4 py-8 text-center text-sm text-muted">
                Không có loại nào khớp "{search}".
              </p>
            )}

            {resources.length > 0 && (
              <Group label="Tài nguyên" tiles={resources} onPick={setPickedTile} />
            )}
            {activities.length > 0 && (
              <Group label="Hoạt động" tiles={activities} onPick={setPickedTile} />
            )}
          </div>
        ) : (
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${pickedTile.color}`}
              >
                <pickedTile.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-semibold">{pickedTile.name}</span>
              <span className="text-muted">— {pickedTile.description}</span>
            </div>
            {pickedTile.pick.kind === "content" && (
              <AddContentItemForm
                lessonId={lessonId}
                nextOrderIndex={nextContentOrderIndex}
                embedded
                onCancel={onClose}
                lockedType={pickedTile.pick.subtype}
                richtextMode={pickedTile.pick.richtextMode}
              />
            )}
            {pickedTile.pick.kind === "quiz" && (
              <AddQuizForm lessonId={lessonId} embedded onCancel={onClose} />
            )}
            {pickedTile.pick.kind === "assignment" && (
              <AddAssignmentForm
                lessonId={lessonId}
                embedded
                onCancel={onClose}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({
  label,
  tiles,
  onPick,
}: {
  label: string;
  tiles: Tile[];
  onPick: (t: Tile) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            className="relative flex flex-col items-center gap-1.5 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-soft hover:shadow-sm"
          >
            {t.badge && (
              <span
                className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-violet-600 py-0.5 pl-1.5 pr-2 text-[10px] font-semibold text-white"
                aria-hidden
              >
                <Sparkles className="h-2.5 w-2.5" />
                {t.badge}
              </span>
            )}
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.color}`}
            >
              <t.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-default">{t.name}</span>
            <span className="text-xs text-muted leading-snug">
              {t.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
