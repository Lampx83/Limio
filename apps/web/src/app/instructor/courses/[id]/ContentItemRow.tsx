"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Blocks,
  Eye,
  EyeOff,
  ExternalLink,
  FileCode,
  FileText,
  FileType,
  Globe,
  Headphones,
  BookA,
  ClipboardCheck,
  ClipboardList,
  MessagesSquare,
  LayoutTemplate,
  Link2,
  NotebookPen,
  Package,
  Paperclip,
  Pencil,
  Puzzle,
  Trash2,
  Video,
} from "lucide-react";
import { parseVideoUrl } from "@/lib/videoUrl";
import { blockSummary } from "@/lib/langBlocks";
import { toast } from "@/lib/toast";
import EditContentItemForm from "./EditContentItemForm";
import { apiUrl } from "@/lib/apiUrl";

// Loại nào có trình soạn riêng (trang toàn màn hình, xem
// contents/[contentId]/edit/) thay vì chỉ sửa nội-tuyến chật hẹp trong hàng
// này — bắt đầu với richtext (editor + AiFormatPanel cần chỗ rộng hơn).
const POPOUT_EDITOR_TYPES = new Set(["richtext"]);

interface Item {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
  isHidden?: boolean;
}

function summarize(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case "video":
      return String(p.url ?? "(no url)");
    case "markdown": {
      const body = String(p.body ?? "");
      return body.length > 80 ? body.slice(0, 80) + "…" : body;
    }
    case "richtext": {
      const text = String(p.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return text.length > 80 ? text.slice(0, 80) + "…" : text || "(văn bản trống)";
    }
    case "embed":
      return String(p.url ?? "(no url)");
    case "file":
      return `${String(p.filename ?? "(no name)")} — ${String(p.url ?? "")}`;
    case "external_link":
      return `${String(p.title ?? "")} — ${String(p.url ?? "")}`;
    case "pdf":
      return `${String(p.title ?? "PDF")} — ${String(p.url ?? "")}`;
    case "html_block":
      return `${String(p.title ?? "HTML")} — ${String(p.url ?? "")}`;
    case "audio":
      return `${String(p.title ?? "Audio")} — ${String(p.url ?? "")}`;
    case "vocab_list":
      return `${String(p.title ?? "Từ vựng")} — ${blockSummary(type, payload)}`;
    case "dialogue":
      return `${String(p.title ?? "Hội thoại")} — ${blockSummary(type, payload)}`;
    case "exam_practice":
      return String(p.title ?? "Bài luyện");
    case "exam_ref":
      return String(p.title ?? "Đề thi");
    case "scorm":
      return `${String(p.title ?? "SCORM")} — packageId=${String(p.packageId ?? "")}`;
    case "lti":
      return `${String(p.title ?? "LTI tool")} — toolId=${String(p.toolId ?? "")}`;
    case "h5p":
      return `${String(p.title ?? "H5P")} — packageId=${String(p.packageId ?? "")}`;
    default:
      return JSON.stringify(payload).slice(0, 80);
  }
}

export const ICON: Record<string, typeof Video> = {
  video: Video,
  markdown: FileCode,
  richtext: FileText,
  teacher_note: NotebookPen,
  embed: LayoutTemplate,
  file: Paperclip,
  external_link: Link2,
  pdf: FileType,
  scorm: Package,
  lti: Puzzle,
  h5p: Blocks,
  html_block: Globe,
  audio: Headphones,
  vocab_list: BookA,
  dialogue: MessagesSquare,
  exam_practice: ClipboardCheck,
  exam_ref: ClipboardList,
};

// Mỗi loại content 1 màu riêng để quét mắt nhanh giữa danh sách nhiều loại
// trộn lẫn — tránh trùng màu đã có ý nghĩa riêng nơi khác: lime (Quiz),
// hồng/pink (Assignment), tím/violet (AI import).
export const TYPE_COLOR: Record<string, string> = {
  video: "bg-red-100 text-red-700",
  markdown: "bg-indigo-100 text-indigo-700",
  richtext: "bg-blue-100 text-blue-700",
  teacher_note: "bg-amber-100 text-amber-700",
  embed: "bg-purple-100 text-purple-700",
  file: "bg-slate-100 text-slate-700",
  external_link: "bg-cyan-100 text-cyan-700",
  pdf: "bg-orange-100 text-orange-700",
  scorm: "bg-teal-100 text-teal-700",
  lti: "bg-fuchsia-100 text-fuchsia-700",
  h5p: "bg-emerald-100 text-emerald-700",
  html_block: "bg-rose-100 text-rose-700",
  audio: "bg-sky-100 text-sky-700",
  vocab_list: "bg-yellow-100 text-yellow-800",
  dialogue: "bg-green-100 text-green-700",
  exam_practice: "bg-stone-200 text-stone-800",
  exam_ref: "bg-lime-100 text-lime-800",
};
export const DEFAULT_TYPE_COLOR = "bg-slate-100 text-slate-700";

const EXAM_REF_ISSUE: Record<string, string> = {
  not_selected: "Chưa chọn đề — bấm sửa để chọn. Học viên chưa thấy khối này.",
  missing: "Đề đã bị xoá — chọn đề khác. Học viên chưa thấy khối này.",
  draft: "Đề chưa xuất bản — học viên chưa thấy khối này.",
  archived: "Đề đã lưu trữ — học viên chưa thấy khối này.",
  other_course: "Đề thuộc khoá khác — chọn đề của khoá này.",
  modes_off: "Đề đã tắt cả Thi thử và Luyện đề — học viên chưa thấy khối này.",
};

/** Tóm tắt khối Đề thi: tên đề, trạng thái, hai công tắc; báo rõ lý do khi học viên chưa thấy khối. */
function ExamRefInfo({ contentId, onLoaded }: { contentId: string; onLoaded: (info: { courseId: string; examId: string | null }) => void }) {
  const [info, setInfo] = useState<{ courseId: string; examId: string | null; title: string | null; issue: string; allowMock: boolean; allowPractice: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/contents/${contentId}/exam-ref`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setInfo(d);
          onLoaded({ courseId: d.courseId, examId: d.examId });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);
  if (!info) return null;
  if (info.issue !== "ok") return <p className="mt-1 text-xs font-medium text-amber-700">{EXAM_REF_ISSUE[info.issue] ?? "Đề chưa dùng được."}</p>;
  return (
    <p className="mt-1 text-xs text-muted">
      {info.title} · Đã xuất bản · {[info.allowMock ? "Cho thi thử" : null, info.allowPractice ? "Cho luyện đề" : null].filter(Boolean).join(", ")}
    </p>
  );
}

/** Tóm tắt khối Bài luyện: số đoạn, số câu; báo rõ khi chưa có câu hỏi (học viên sẽ không thấy khối). */
function PracticeBlockInfo({ contentId }: { contentId: string }) {
  const [info, setInfo] = useState<{ passages: number; questions: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/contents/${contentId}/practice-summary`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setInfo(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [contentId]);
  if (!info) return null;
  return info.questions === 0 ? (
    <p className="mt-1 text-xs font-medium text-amber-700">Chưa có câu hỏi — học viên chưa thấy bài luyện này.</p>
  ) : (
    <p className="mt-1 text-xs text-muted">
      {info.passages} đoạn · {info.questions} câu hỏi
    </p>
  );
}

export default function ContentItemRow({
  item,
  lessonId,
}: {
  item: Item;
  lessonId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [examRef, setExamRef] = useState<{ courseId: string; examId: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isHidden, setIsHidden] = useState(item.isHidden ?? false);

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/contents/${item.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove() {
    const message =
      item.type === "exam_ref"
        ? "Xoá khối đề thi này khỏi bài? Đề thi vẫn còn ở khoá, chỉ không hiện trong bài nữa."
        : item.type === "exam_practice"
        ? "Xoá bài luyện này? Toàn bộ đoạn văn, câu hỏi và kết quả luyện tập của học viên trong bài luyện cũng bị xoá, không hoàn tác được."
        : `Xoá content "${item.type}"? Hành động này không thể hoàn tác.`;
    if (!confirm(message)) return;
    setBusy(true);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/contents/${item.id}`), { method: "DELETE" });
    } catch (networkErr) {
      setBusy(false);
      console.error("[ContentItemRow] network error", networkErr);
      toast.error("Không kết nối được tới server");
      return;
    }

    if (res.ok) {
      toast.success("Đã xoá content");
    } else {
      const d = await res.json().catch(() => ({}));
      const code = (d as { error?: string }).error ?? `http_${res.status}`;
      console.error("[ContentItemRow] delete failed", res.status, d);
      toast.error(`Xoá thất bại: ${code}`);
    }

    setBusy(false);
    router.refresh();
  }

  const videoMeta =
    item.type === "video"
      ? parseVideoUrl(String((item.payload as { url?: string })?.url ?? ""))
      : null;

  if (editing) {
    return (
      <div className="rounded-lg border border-brand-300 bg-[rgb(var(--surface))] p-3">
        <EditContentItemForm
          item={item}
          lessonId={lessonId}
          onClose={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2.5 transition-colors hover:border-brand-200">
      {/* Visual: thumbnail for video items, emoji for others */}
      {videoMeta?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={videoMeta.thumbnailUrl}
          alt=""
          className="h-12 w-20 shrink-0 rounded-md border border-token bg-black object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TYPE_COLOR[item.type] ?? DEFAULT_TYPE_COLOR}`}
        >
          {(() => {
            const Icon = ICON[item.type] ?? FileText;
            return <Icon className="h-4 w-4" aria-hidden />;
          })()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`chip ${TYPE_COLOR[item.type] ?? DEFAULT_TYPE_COLOR}`}>
            {item.type}
          </span>
          {videoMeta && videoMeta.kind !== "file" && (
            <span className={`chip ${TYPE_COLOR.video}`}>{videoMeta.providerName}</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {summarize(item.type, item.payload)}
        </p>
        {item.type === "exam_practice" && <PracticeBlockInfo contentId={item.id} />}
        {item.type === "exam_ref" && <ExamRefInfo contentId={item.id} onLoaded={setExamRef} />}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg p-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
        <button
          type="button"
          onClick={toggleHidden}
          disabled={busy}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
            isHidden
              ? "bg-danger-50 text-danger-600 hover:bg-danger-100"
              : "text-faint hover:bg-brand-soft hover:text-brand-600"
          }`}
          title={isHidden ? "Đang ẩn — bấm để hiện" : "Đang hiện — bấm để ẩn"}
          aria-label={isHidden ? "Hiện content" : "Ẩn content"}
          aria-pressed={isHidden}
        >
          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {item.type === "exam_ref" && examRef?.examId && (
          <Link
            href={`/instructor/courses/${examRef.courseId}/exams/${examRef.examId}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            title="Mở trang soạn đề này"
          >
            Sửa đề
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        )}
        {item.type === "exam_practice" && (
          <Link
            href={`${pathname}/bai-luyen/${item.id}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            title="Soạn đoạn văn, âm thanh và câu hỏi của bài luyện"
          >
            Soạn bài luyện
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        )}
        {POPOUT_EDITOR_TYPES.has(item.type) && (
          <Link
            href={`${pathname}/contents/${item.id}/edit`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            title="Mở trình soạn"
          >
            Mở trình soạn
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600 disabled:opacity-50"
          title="Sửa content"
          aria-label="Sửa"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          title="Xoá content"
          aria-label="Xoá"
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
