"use client";

import { useEffect, useState } from "react";
import AddContentItemForm from "./AddContentItemForm";
import AddQuizForm from "./AddQuizForm";
import AddAssignmentForm from "./AddAssignmentForm";

type ContentSubtype =
  | "markdown"
  | "video"
  | "pdf"
  | "file"
  | "external_link"
  | "embed"
  | "scorm"
  | "h5p"
  | "lti";

type Tile = {
  /** Unique key */
  key: string;
  /** Group label */
  group: "resource" | "activity";
  icon: string;
  name: string;
  description: string;
  /** Search keywords (besides name + description) */
  keywords: string;
  /**
   * What to render when picked. "content" + ContentSubtype renders
   * AddContentItemForm with that type locked. "quiz"/"assignment" render
   * the dedicated form.
   */
  pick:
    | { kind: "content"; subtype: ContentSubtype }
    | { kind: "quiz" }
    | { kind: "assignment" };
};

const TILES: Tile[] = [
  {
    key: "markdown",
    group: "resource",
    icon: "📝",
    name: "Văn bản",
    description: "Markdown — viết hướng dẫn, lý thuyết, ghi chú",
    keywords: "markdown text note",
    pick: { kind: "content", subtype: "markdown" },
  },
  {
    key: "video",
    group: "resource",
    icon: "🎬",
    name: "Video",
    description: "Embed YouTube/Vimeo/Loom hoặc upload file",
    keywords: "youtube vimeo loom mp4 webm",
    pick: { kind: "content", subtype: "video" },
  },
  {
    key: "pdf",
    group: "resource",
    icon: "📄",
    name: "PDF",
    description: "Upload file PDF hoặc dán link",
    keywords: "pdf document slide",
    pick: { kind: "content", subtype: "pdf" },
  },
  {
    key: "file",
    group: "resource",
    icon: "📁",
    name: "File đính kèm",
    description: "Tài liệu để học viên download",
    keywords: "file download attachment",
    pick: { kind: "content", subtype: "file" },
  },
  {
    key: "external_link",
    group: "resource",
    icon: "🔗",
    name: "Link ngoài",
    description: "Trỏ tới website/tài liệu bên ngoài",
    keywords: "url link external website",
    pick: { kind: "content", subtype: "external_link" },
  },
  {
    key: "embed",
    group: "resource",
    icon: "🌐",
    name: "Embed",
    description: "Nhúng iframe URL bất kỳ",
    keywords: "iframe embed url",
    pick: { kind: "content", subtype: "embed" },
  },
  {
    key: "quiz",
    group: "activity",
    icon: "❓",
    name: "Quiz",
    description: "Trắc nghiệm, short answer — auto chấm",
    keywords: "quiz question test mcq",
    pick: { kind: "quiz" },
  },
  {
    key: "assignment",
    group: "activity",
    icon: "📋",
    name: "Assignment",
    description: "Bài tập — instructor chấm tay",
    keywords: "assignment homework essay",
    pick: { kind: "assignment" },
  },
  {
    key: "scorm",
    group: "activity",
    icon: "📦",
    name: "SCORM",
    description: "Package SCORM 1.2 (.zip)",
    keywords: "scorm package zip",
    pick: { kind: "content", subtype: "scorm" },
  },
  {
    key: "h5p",
    group: "activity",
    icon: "🎯",
    name: "H5P",
    description: "Interactive H5P content",
    keywords: "h5p interactive",
    pick: { kind: "content", subtype: "h5p" },
  },
  {
    key: "lti",
    group: "activity",
    icon: "🔌",
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
      <div className="w-full max-w-2xl rounded-2xl bg-[rgb(var(--surface))] shadow-2xl">
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
              <span className="text-2xl" aria-hidden>
                {pickedTile.icon}
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-soft hover:shadow-sm"
          >
            <span className="text-2xl" aria-hidden>
              {t.icon}
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
