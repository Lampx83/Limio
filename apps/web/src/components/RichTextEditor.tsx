"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { probeEditorLoss, type LossReport } from "./richtext/lossProbe";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

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

/**
 * Một danh sách duy nhất, dùng cho cả editor thật lẫn hàm dò mất mát. Tách ra
 * đây vì hai chỗ đó mà lệch nhau thì lời cảnh báo sẽ nói sai sự thật.
 */
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
  }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { class: "max-w-full h-auto rounded-md" },
  }),
];

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
}: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  // null = chưa dò xong (chỉ dò được ở trình duyệt). "source" = soạn HTML thô.
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

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none dark:prose-invert px-3 py-2",
        "data-placeholder": placeholder,
        style: `min-height: ${minHeight}px;`,
      },
      handlePaste(view, event) {
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
    return (
      <div className="rounded-lg border border-token bg-[rgb(var(--surface))]">
        {loss && <LossBanner loss={loss} onForceWysiwyg={() => setMode("wysiwyg")} />}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{ minHeight }}
          className="w-full resize-y bg-transparent px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none"
        />
        <div className="flex items-center justify-between border-t border-token px-3 py-1.5 text-xs text-faint">
          <span>Chế độ HTML — nội dung được lưu đúng nguyên văn.</span>
          {!loss && (
            <button
              type="button"
              onClick={() => setMode("wysiwyg")}
              className="rounded px-2 py-0.5 font-medium text-brand-600 hover:bg-[rgb(var(--surface-muted))]"
            >
              Về trình soạn thảo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-token bg-[rgb(var(--surface))]">
      <Toolbar
        editor={editor}
        onUpload={insertImageFiles}
        onSourceMode={() => setMode("source")}
      />
      <EditorContent editor={editor} />
      {uploadError && (
        <p className="border-t border-token px-3 py-1.5 text-xs text-danger-600">
          Lỗi upload ảnh: {uploadError}
        </p>
      )}
    </div>
  );
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
        không sửa gì. Vì vậy nó đang mở ở chế độ HTML, nơi mọi thứ được giữ nguyên.
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
  onSourceMode,
}: {
  editor: Editor;
  onUpload: (files: File[]) => Promise<void>;
  onSourceMode: () => void;
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
      <button
        type="button"
        onClick={onSourceMode}
        className={btn(false)}
        title="Sửa HTML thô — giữ nguyên mọi định dạng"
      >
        HTML
      </button>
    </div>
  );
}
