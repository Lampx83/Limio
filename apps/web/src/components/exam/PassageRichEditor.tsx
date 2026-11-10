"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import { PASSAGE_EXTENSIONS } from "@/lib/passageDoc";
import { PASSAGE_FONT_SIZES } from "@/lib/passageFontSizes";
import { PASSAGE_HIGHLIGHT_COLORS, PASSAGE_TEXT_COLORS, passageHighlightColor, passageTextColor } from "@/lib/passageColors";
import { cleanWordHtml } from "@/components/richtext/wordPaste";

/**
 * Trình soạn Đoạn văn (đề thi và Bài luyện) — docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, mục D.
 * Chỉ có những gì học viên thật sự thấy (xem lib/passageDoc.ts): đậm, nghiêng, gạch chân, tô nổi, tiêu đề cỡ 2/3, danh sách, ảnh.
 * Audio/video do `PassageEditor` chèn qua `onReady` (editor). Dán Word/web: giữ đậm, nghiêng, tiêu đề, danh sách; bỏ màu, liên kết, bảng.
 */
export interface PassageImageUpload {
  url: string;
  alt: string;
}

export default function PassageRichEditor({
  html,
  onChange,
  onReady,
  uploadImage,
  placeholder = "Soạn nội dung bài đọc ở đây…",
  minHeight = 200,
}: {
  html: string;
  /** Gọi mỗi lần người soạn sửa (không gọi khi nạp nội dung ban đầu). */
  onChange: (html: string) => void;
  onReady?: (editor: Editor | null) => void;
  /** Tải ảnh lên (hỏi mô tả, gửi lên máy chủ); trả null nếu người soạn huỷ. */
  uploadImage: (file: File) => Promise<PassageImageUpload | null>;
  placeholder?: string;
  minHeight?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Màu chữ vừa chọn gần nhất: hiện trên nút "Màu chữ" khi con trỏ đang ở chữ chưa tô màu.
  const [lastTextColor, setLastTextColor] = useState("");
  const uploadRef = useRef(uploadImage);
  uploadRef.current = uploadImage;

  const editor = useEditor({
    extensions: PASSAGE_EXTENSIONS,
    content: html || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none dark:prose-invert px-3 py-2",
        "data-placeholder": placeholder,
        style: `min-height: ${minHeight}px;`,
      },
      transformPastedHTML: cleanWordHtml,
      handlePaste(_view, event) {
        // Chữ có định dạng (Word, web) luôn kèm một bitmap chụp lại vùng chọn trong clipboardData.files: chỉ lấy ảnh khi KHÔNG có chữ.
        const clipHtml = event.clipboardData?.getData("text/html") ?? "";
        const clipText = event.clipboardData?.getData("text/plain") ?? "";
        if (clipText.trim() !== "" || clipHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim() !== "") return false;
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
      handleDrop(_view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const out = ed.getHTML();
      onChange(out === "<p></p>" ? "" : out);
    },
  });

  useEffect(() => {
    onReady?.(editor ?? null);
    return () => onReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  async function insertImages(files: File[]) {
    if (!editor) return;
    setError(null);
    for (const file of files) {
      try {
        const r = await uploadRef.current(file);
        if (r) editor.chain().focus().setImage({ src: r.url, alt: r.alt }).run();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  // Nút đậm/nghiêng/cỡ chữ… phải đổi trạng thái theo vị trí con trỏ (v3 không tự vẽ lại mỗi lần chọn).
  const st = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            underline: ed.isActive("underline"),
            highlight: ed.isActive("highlight"),
            h2: ed.isActive("heading", { level: 2 }),
            h3: ed.isActive("heading", { level: 3 }),
            bullet: ed.isActive("bulletList"),
            ordered: ed.isActive("orderedList"),
            fontSize: (ed.getAttributes("textStyle").fontSize as string | undefined) ?? "",
            textColor: passageTextColor(ed.getAttributes("textStyle").color) ?? "",
            highlightColor: ed.isActive("highlight") ? (passageHighlightColor(ed.getAttributes("highlight").color) ?? "default") : "",
          }
        : null,
  });

  const shownTextColor = st?.textColor || lastTextColor;

  if (!editor) {
    return <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm text-faint">Đang tải trình soạn…</div>;
  }

  const btn = (active: boolean) =>
    `h-7 min-w-[28px] rounded px-2 text-xs font-semibold transition-colors ${
      active ? "bg-brand-soft text-brand-700" : "text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
    }`;
  const chain = () => editor.chain().focus();

  return (
    <div className="rounded-lg border border-token bg-[rgb(var(--surface))]" data-testid="passage-rich-editor">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-token bg-[rgb(var(--surface-muted))/0.4] p-1" role="toolbar" aria-label="Định dạng đoạn văn">
        <button type="button" onClick={() => chain().toggleBold().run()} className={btn(!!st?.bold)} title="Đậm (Ctrl+B)" aria-label="Đậm">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => chain().toggleItalic().run()} className={btn(!!st?.italic)} title="Nghiêng (Ctrl+I)" aria-label="Nghiêng">
          <em>I</em>
        </button>
        <button type="button" onClick={() => chain().toggleUnderline().run()} className={btn(!!st?.underline)} title="Gạch chân (Ctrl+U)" aria-label="Gạch chân">
          <u>U</u>
        </button>
        <ToolbarMenu
          label="Màu chữ"
          title="Màu của đoạn chữ đang chọn"
          active={!!st?.textColor}
          // Chữ A tô đúng màu đang chọn (hoặc màu vừa dùng gần nhất) kèm vạch màu bên dưới, như Word: nhìn là biết màu nào.
          trigger={
            <span className="flex flex-col items-center leading-none" data-testid="text-color-indicator">
              <span className="text-[15px] font-extrabold" style={{ color: shownTextColor || undefined }}>
                A
              </span>
              <span className="mt-0.5 h-[3px] w-4 rounded-full" style={{ backgroundColor: shownTextColor || "rgb(var(--text-faint))" }} />
            </span>
          }
          btn={btn}
        >
          {(close) => (
            <SwatchGrid
              colors={PASSAGE_TEXT_COLORS}
              current={st?.textColor ?? ""}
              resetLabel="Màu mặc định"
              onPick={(v) => {
                if (v) chain().setColor(v).run();
                else chain().unsetColor().run();
                setLastTextColor(v ?? "");
                close();
              }}
            />
          )}
        </ToolbarMenu>
        <ToolbarMenu
          label="Tô màu"
          title="Tô nổi đoạn chữ đang chọn"
          active={!!st?.highlight}
          trigger={<mark className="px-0.5" style={st?.highlightColor && st.highlightColor !== "default" ? { backgroundColor: st.highlightColor } : undefined}>ab</mark>}
          btn={btn}
        >
          {(close) => (
            <SwatchGrid
              colors={PASSAGE_HIGHLIGHT_COLORS}
              current={st?.highlightColor === "default" ? PASSAGE_HIGHLIGHT_COLORS[0]!.value : (st?.highlightColor ?? "")}
              resetLabel="Bỏ tô"
              onPick={(v) => {
                if (v) chain().setHighlight({ color: v }).run();
                else chain().unsetHighlight().run();
                close();
              }}
            />
          )}
        </ToolbarMenu>
        <span className="mx-1 h-5 w-px bg-token" />
        {/* Cỡ chữ: nút ghi "Cỡ chữ"; mở ra thì mỗi mức hiện chính chữ "Cỡ chữ" ở đúng cỡ đó để xem trước. */}
        <ToolbarMenu label="Cỡ chữ" title="Cỡ chữ của đoạn chữ đang chọn" active={!!st?.fontSize} trigger={<>Cỡ chữ</>} btn={btn}>
          {(close) => (
            <ul role="listbox" aria-label="Cỡ chữ" className="py-1">
              {PASSAGE_FONT_SIZES.map((f) => {
                const known = PASSAGE_FONT_SIZES.some((x) => x.value === st?.fontSize);
                const active = (f.value ?? "") === (known ? (st?.fontSize ?? "") : "");
                return (
                  <li key={f.label} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        if (f.value === null) chain().unsetFontSize().run();
                        else chain().setFontSize(f.value).run();
                        close();
                      }}
                      className={`flex w-full items-baseline justify-between gap-4 px-3 py-1.5 text-left hover:bg-[rgb(var(--surface-muted))] ${active ? "bg-brand-soft" : ""}`}
                    >
                      <span style={f.value ? { fontSize: f.value } : undefined} className="leading-tight text-[rgb(var(--text))]">
                        Cỡ chữ
                      </span>
                      <span className="shrink-0 text-xs text-faint">{f.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ToolbarMenu>
        <span className="mx-1 h-5 w-px bg-token" />
        <button type="button" onClick={() => chain().toggleHeading({ level: 2 }).run()} className={btn(!!st?.h2)} title="Tiêu đề lớn" aria-label="Tiêu đề lớn">
          H2
        </button>
        <button type="button" onClick={() => chain().toggleHeading({ level: 3 }).run()} className={btn(!!st?.h3)} title="Tiêu đề nhỏ" aria-label="Tiêu đề nhỏ">
          H3
        </button>
        <span className="mx-1 h-5 w-px bg-token" />
        <button type="button" onClick={() => chain().toggleBulletList().run()} className={btn(!!st?.bullet)} title="Danh sách chấm" aria-label="Danh sách chấm">
          • List
        </button>
        <button type="button" onClick={() => chain().toggleOrderedList().run()} className={btn(!!st?.ordered)} title="Danh sách số" aria-label="Danh sách số">
          1. List
        </button>
        <span className="mx-1 h-5 w-px bg-token" />
        <button type="button" onClick={() => fileRef.current?.click()} className={btn(false)} title="Chèn ảnh (cũng có thể dán hoặc kéo thả vào ô)" aria-label="Chèn ảnh">
          🖼️
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void insertImages(files);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => chain().unsetAllMarks().clearNodes().run()} className={btn(false)} title="Xoá định dạng" aria-label="Xoá định dạng">
          ⌫
        </button>
      </div>
      <EditorContent editor={editor} />
      {error && <p className="border-t border-token px-3 py-1.5 text-xs text-danger-600">Lỗi tải ảnh: {error}</p>}
    </div>
  );
}

/** Nút mở menu thả xuống trên thanh công cụ: tự đóng khi bấm ra ngoài hoặc nhấn Esc. */
function ToolbarMenu({
  label,
  title,
  active,
  trigger,
  btn,
  children,
}: {
  label: string;
  title: string;
  active: boolean;
  trigger: ReactNode;
  btn: (active: boolean) => string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={title}
        onClick={() => setOpen((o) => !o)}
        className={`${btn(open || active)} inline-flex items-center gap-1 font-medium`}
      >
        {trigger} <span aria-hidden className="text-[10px]">▾</span>
      </button>
      {open && (
        <div aria-labelledby={id} className="absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-token bg-[rgb(var(--surface))] shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Lưới ô màu + nút bỏ màu. */
function SwatchGrid({
  colors,
  current,
  resetLabel,
  onPick,
}: {
  colors: ReadonlyArray<{ name: string; value: string }>;
  current: string;
  resetLabel: string;
  onPick: (value: string | null) => void;
}) {
  return (
    <div className="p-2">
      <div className="grid grid-cols-5 gap-1.5">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={current === c.value}
            onClick={() => onPick(c.value)}
            style={{ backgroundColor: c.value }}
            className={`h-6 w-6 rounded-md border border-black/10 ${current === c.value ? "ring-2 ring-brand-500 ring-offset-1" : "hover:scale-110"}`}
          />
        ))}
      </div>
      <button type="button" onClick={() => onPick(null)} className="mt-2 w-full rounded border border-token px-2 py-1 text-xs hover:bg-[rgb(var(--surface-muted))]">
        {resetLabel}
      </button>
    </div>
  );
}
