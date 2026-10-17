"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { probeEditorLoss, type LossReport } from "./richtext/lossProbe";
import { cleanWordHtml } from "./richtext/wordPaste";
import { EXTENSIONS } from "./richtext/extensions";
import { LessonActive } from "./richtext/lessonCommands";
import { LessonContextBar, LessonInsertMenu } from "./richtext/LessonTools";
import SafeHtml from "./SafeHtml";
import type { LessonLook } from "@feedbackme/shared-types";
import { lessonStyleVars } from "@/lib/lessonLook";
import { LESSON_FONT_VARIABLES } from "./lesson/lessonFonts";
import LessonLookMenu from "./lesson/LessonLookMenu";
import "./lesson/lessonLook.css";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /**
   * Bật công cụ của bài học văn bản: "Chèn khối" (mục theo bố cục, hộp, ảnh có
   * chú thích) và thanh "Mục này / Hộp này". Chỉ bật ở nội dung bài học.
   */
  lessonTools?: boolean;
  /** Bảng màu + kiểu chữ của bài — để trình soạn trông đúng như học viên thấy. */
  look?: LessonLook | null;
  /** Có thì hiện nút "Giao diện" ở đầu thanh công cụ để đổi bảng màu, kiểu chữ. */
  onLookChange?: (look: LessonLook) => void;
}

const EDITOR_EXTENSIONS_LESSON = [...EXTENSIONS, LessonActive];

const HIGHLIGHT_COLORS = [
  { name: "Vàng", value: "#fef08a" },
  { name: "Xanh lá", value: "#bbf7d0" },
  { name: "Xanh dương", value: "#bfdbfe" },
  { name: "Hồng", value: "#fbcfe8" },
  { name: "Cam", value: "#fed7aa" },
  { name: "Tím", value: "#ddd6fe" },
];

const TEXT_COLORS = [
  { name: "Đen", value: "#111827" },
  { name: "Xám", value: "#6b7280" },
  { name: "Đỏ", value: "#dc2626" },
  { name: "Cam", value: "#ea580c" },
  { name: "Vàng", value: "#ca8a04" },
  { name: "Xanh lá", value: "#16a34a" },
  { name: "Xanh dương", value: "#2563eb" },
  { name: "Tím", value: "#7c3aed" },
  { name: "Hồng", value: "#db2777" },
];

// Danh sách extension dùng chung với hàm dò mất mát — xem richtext/extensions.ts.
export { EXTENSIONS };

function htmlHasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim().length > 0;
}

async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/api/lesson-media/images"), {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error ?? `upload_failed_${res.status}`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung...",
  minHeight = 160,
  lessonTools = false,
  look = null,
  onLookChange,
}: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  // null = chưa dò xong (chỉ dò được ở trình duyệt). "source" = chỉ xem bản hiển thị, giữ nguyên nội dung.
  const [mode, setMode] = useState<"wysiwyg" | "source" | null>(null);
  const [loss, setLoss] = useState<LossReport | null>(null);
  // Chỉ dò một lần cho nội dung ban đầu: sau khi người dùng bắt đầu gõ, `value`
  // đã là thứ do chính editor sinh ra nên dò lại luôn cho kết quả "không mất gì".
  const probedRef = useRef(false);

  useEffect(() => {
    if (probedRef.current) return;
    probedRef.current = true;
    const report = probeEditorLoss(value || "", EXTENSIONS);
    setLoss(report);
    setMode(report ? "source" : "wysiwyg");
  }, [value]);

  // Soạn toàn màn hình (chỉ bài học): Esc để thoát; khoá cuộn trang phía sau.
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const editor = useEditor({
    extensions: lessonTools ? EDITOR_EXTENSIONS_LESSON : EXTENSIONS,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none dark:prose-invert px-3 py-2",
        "data-placeholder": placeholder,
        style: `min-height: ${minHeight}px;`,
      },
      transformPastedHTML: cleanWordHtml,
      handlePaste(view, event) {
        // Word (và nhiều nguồn rich-text khác) luôn kèm một bitmap chụp lại
        // vùng chọn trong clipboardData.files, kể cả khi người dùng chỉ copy
        // chữ có định dạng. Nếu clipboard có text/html mang nội dung chữ thật,
        // để ProseMirror parse HTML đó — đừng cướp paste chỉ vì có ảnh đính kèm.
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (htmlHasText(html)) return false;

        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
      handleDrop(view, event) {
        const files = Array.from(
          (event as DragEvent).dataTransfer?.files ?? [],
        ).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  async function insertImageFiles(files: File[]) {
    if (!editor) return;
    setUploadError(null);
    for (const file of files) {
      try {
        const url = await uploadImageFile(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor || mode === null) {
    return (
      <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm text-faint">
        Đang tải editor...
      </div>
    );
  }

  if (mode === "source") {
    // Nội dung có định dạng mà editor trực quan không biểu diễn được: chỉ cho xem
    // bản hiển thị thật, không lộ mã HTML. Giữ nguyên văn cho tới khi người dùng
    // chủ động chuyển sang trình soạn thảo (LossBanner có xác nhận).
    return (
      <div className="rounded-lg border border-token bg-[rgb(var(--surface))]">
        {loss && <LossBanner loss={loss} onForceWysiwyg={() => setMode("wysiwyg")} />}
        <div className="max-h-[28rem] overflow-y-auto px-3 py-2">
          <SafeHtml html={value} className="prose prose-sm max-w-none dark:prose-invert" />
        </div>
      </div>
    );
  }

  const shell = (
    <div
      className={
        full
          ? "fixed inset-0 z-[60] overflow-y-auto bg-[rgb(var(--bg))]"
          : "rounded-lg border border-token bg-[rgb(var(--surface))]"
      }
      role={full ? "dialog" : undefined}
      aria-modal={full ? true : undefined}
      aria-label={full ? "Soạn bài toàn màn hình" : undefined}
    >
      {/* Bài học dài: từ màn hình rộng, thanh công cụ dính dưới thanh đầu trang
          (cao 4rem) để "Chèn khối" và "Mục này" luôn trong tầm tay khi cuộn.
          Màn hẹp thì không dính — thanh nhiều dòng sẽ che mất nửa bài.
          Toàn màn hình: thanh dính sát mép trên, bài ở giữa với bề ngang đọc thoải mái. */}
      <div
        className={
          full
            ? "sticky top-0 z-10 border-b border-token bg-[rgb(var(--surface))] shadow-sm"
            : `rounded-t-lg bg-[rgb(var(--surface))] ${lessonTools ? "relative lg:sticky lg:top-16 lg:z-10" : ""}`
        }
      >
        <div className={full ? "relative mx-auto max-w-4xl" : ""}>
        <Toolbar
          editor={editor}
          onUpload={insertImageFiles}
          lead={
            lessonTools ? (
              <>
                <LessonInsertMenu editor={editor} onUploadFigure={uploadImageFile} />
                {onLookChange && <LessonLookMenu value={look} onChange={onLookChange} />}
              </>
            ) : null
          }
          tail={
            lessonTools ? (
              <button
                type="button"
                onClick={() => setFull((v) => !v)}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
                title={full ? "Thu nhỏ (Esc)" : "Soạn toàn màn hình"}
                aria-pressed={full}
              >
                {full ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
                <span className="hidden sm:inline">{full ? "Thu nhỏ" : "Toàn màn hình"}</span>
              </button>
            ) : null
          }
        />
        {lessonTools && <LessonContextBar editor={editor} />}
        </div>
      </div>
      <div className={full ? "mx-auto my-6 max-w-4xl overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] shadow-sm" : ""}>
      {look ? (
        <div
          className={`lesson-look ${LESSON_FONT_VARIABLES} ${full ? "px-2 py-4 sm:px-8 sm:py-6" : "rounded-b-lg"}`}
          data-palette={look.palette}
          data-font={look.font}
          style={lessonStyleVars(look)}
        >
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className={full ? "px-2 py-4 sm:px-8 sm:py-6" : ""}>
          <EditorContent editor={editor} />
        </div>
      )}
      </div>
      {uploadError && (
        <p className="border-t border-token px-3 py-1.5 text-xs text-danger-600">
          Lỗi upload ảnh: {uploadError}
        </p>
      )}
    </div>
  );
  // Toàn màn hình phải gắn thẳng vào <body>: khung bài nằm trong thẻ kéo thả
  // (dnd-kit đặt transform), mà "fixed" bên trong phần tử có transform chỉ phủ
  // được phần tử đó chứ không phủ cả màn hình.
  return full ? createPortal(shell, document.body) : shell;
}

/**
 * Nói thẳng cái gì sẽ mất, bằng con số, chứ không phải "định dạng có thể thay
 * đổi". Người dạy cần biết đây là mất dữ liệu để dừng lại, không phải một lời
 * nhắc lịch sự để bấm qua.
 */
function LossBanner({
  loss,
  onForceWysiwyg,
}: {
  loss: LossReport;
  onForceWysiwyg: () => void;
}) {
  const parts: string[] = [];
  if (loss.lostImages > 0) parts.push(`${loss.lostImages} ảnh`);
  if (loss.lostChars > 0) parts.push(`${loss.lostChars.toLocaleString("vi-VN")} ký tự nội dung`);
  if (loss.lostStyles > 0) parts.push(`${loss.lostStyles} định dạng (cỡ chữ, khung, nền…)`);

  return (
    <div
      className={`block rounded-none border-x-0 border-t-0 px-3 py-2 text-xs ${
        loss.contentLoss ? "banner-danger" : "banner-warning"
      }`}
    >
      <p className="font-medium">
        Nội dung này có định dạng mà trình soạn thảo trực quan không biểu diễn được.
      </p>
      <p className="mt-0.5">
        Mở bằng trình soạn thảo rồi lưu sẽ mất {parts.join(", ")} — kể cả khi bạn
        không sửa gì. Vì vậy nội dung đang được giữ nguyên và chỉ hiển thị bên dưới.
      </p>
      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              `Chuyển sang trình soạn thảo trực quan sẽ xoá vĩnh viễn ${parts.join(", ")} khi bạn lưu. Vẫn chuyển?`,
            )
          ) {
            onForceWysiwyg();
          }
        }}
        className="mt-1.5 rounded border border-current px-2 py-0.5 font-medium opacity-70 hover:opacity-100"
      >
        Vẫn dùng trình soạn thảo trực quan
      </button>
    </div>
  );
}

function Toolbar({
  editor,
  onUpload,
  lead,
  tail,
}: {
  editor: Editor;
  onUpload: (files: File[]) => Promise<void>;
  /** Nút đặt đầu thanh công cụ (vd. "Chèn khối" của bài học). */
  lead?: ReactNode;
  /** Nút đặt cuối thanh công cụ (vd. "Toàn màn hình"). */
  tail?: ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const currentTextColor = (editor.getAttributes("textStyle").color as string) || "";

  const btn = (active: boolean) =>
    `h-7 min-w-[28px] rounded px-2 text-xs font-semibold transition-colors ${
      active
        ? "bg-brand-soft text-brand-700"
        : "text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
    }`;

  function toggleLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Nhập URL (để trống để bỏ link):", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-token bg-[rgb(var(--surface-muted))/0.4] p-1">
      {lead && (
        <>
          {lead}
          <span className="mx-1 h-5 w-px bg-token" />
        </>
      )}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive("underline"))}
        title="Underline (Ctrl+U)"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <span className="mx-1 h-5 w-px bg-token" />
      <div className="relative">
        <button
          type="button"
          onClick={() => setTextColorOpen((v) => !v)}
          className={btn(!!currentTextColor)}
          title="Màu chữ"
          aria-expanded={textColorOpen}
          aria-haspopup="true"
        >
          <span className="font-bold" style={{ color: currentTextColor || "currentColor" }}>
            A
          </span>
          <span className="ml-1 align-middle">▾</span>
        </button>
        {textColorOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-10 mt-1 flex flex-wrap gap-1 rounded-lg border border-token bg-[rgb(var(--surface))] p-2 shadow-lg"
            onMouseLeave={() => setTextColorOpen(false)}
          >
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor(c.value).run();
                  setTextColorOpen(false);
                }}
                className="h-6 w-6 rounded border border-token transition-transform hover:scale-110"
                style={{ background: c.value }}
                title={c.name}
                aria-label={`Màu chữ ${c.name}`}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setTextColorOpen(false);
              }}
              className="h-6 rounded border border-token bg-[rgb(var(--surface-muted))] px-2 text-xs hover:bg-[rgb(var(--surface))]"
              title="Bỏ màu chữ"
            >
              Bỏ
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setColorOpen((v) => !v)}
          className={btn(editor.isActive("highlight"))}
          title="Bôi màu (highlight)"
          aria-expanded={colorOpen}
          aria-haspopup="true"
        >
          <span
            className="inline-block h-3 w-3 rounded-sm align-middle"
            style={{
              background:
                (editor.getAttributes("highlight").color as string) ||
                "linear-gradient(45deg,#fef08a,#fbcfe8,#bfdbfe)",
            }}
            aria-hidden
          />
          <span className="ml-1 align-middle">▾</span>
        </button>
        {colorOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-10 mt-1 flex flex-wrap gap-1 rounded-lg border border-token bg-[rgb(var(--surface))] p-2 shadow-lg"
            onMouseLeave={() => setColorOpen(false)}
          >
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  editor.chain().focus().setHighlight({ color: c.value }).run();
                  setColorOpen(false);
                }}
                className="h-6 w-6 rounded border border-token transition-transform hover:scale-110"
                style={{ background: c.value }}
                title={c.name}
                aria-label={`Highlight ${c.name}`}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setColorOpen(false);
              }}
              className="h-6 rounded border border-token bg-[rgb(var(--surface-muted))] px-2 text-xs hover:bg-[rgb(var(--surface))]"
              title="Bỏ highlight"
            >
              Bỏ
            </button>
          </div>
        )}
      </div>
      <span className="mx-1 h-5 w-px bg-token" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
      >
        H3
      </button>
      <span className="mx-1 h-5 w-px bg-token" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        title="Quote"
      >
        ❝
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
        title="Code block"
      >
        {"</>"}
      </button>
      <span className="mx-1 h-5 w-px bg-token" />
      <button
        type="button"
        onClick={toggleLink}
        className={btn(editor.isActive("link"))}
        title="Link"
      >
        🔗
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={btn(false)}
        title="Chèn ảnh (cũng có thể paste/kéo thả vào editor)"
      >
        🖼️
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void onUpload(files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        className={btn(false)}
        title="Xoá định dạng"
      >
        ⌫
      </button>
      {tail}
    </div>
  );
}
