"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  LESSON_BOX_KINDS,
  LESSON_BOX_LABELS,
  LESSON_LAYOUT_HINTS,
  LESSON_LAYOUT_KEYS,
  LESSON_LAYOUT_LABELS,
  isLessonBoxKind,
  isLessonLayoutKey,
  type LessonBoxKind,
  type LessonLayoutKey,
  type LessonLook,
} from "@feedbackme/shared-types";
import AiSectionMenu from "./AiSectionMenu";
import {
  addPart,
  canMove,
  deleteNode,
  insertBox,
  insertFigure,
  insertSection,
  lessonContext,
  moveNode,
  setBoxAttrs,
  setSectionLayout,
} from "./lessonCommands";

/**
 * Nút "Chèn khối": mục mới theo bố cục, hộp, ảnh có chú thích. Mục mới luôn
 * chèn sau khối ngoài cùng đang chứa con trỏ; hộp và ảnh chèn ngay sau đoạn
 * đang đứng.
 */
export function LessonInsertMenu({
  editor,
  onUploadFigure,
}: {
  editor: Editor;
  onUploadFigure: (file: File) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-[rgb(var(--surface-muted))]";

  return (
    // Không "relative" ở đây: menu bám theo cả thanh công cụ (đang sticky) để
    // trải đúng bề ngang trình soạn, không tràn ra mép phải khi khung hẹp.
    <div ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-7 rounded border border-brand-300 bg-brand-soft px-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        + Chèn khối
      </button>
      {error && <span className="ml-2 text-xs text-danger-600">Lỗi tải ảnh: {error}</span>}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const url = await onUploadFigure(file);
            insertFigure(editor, url, file.name.replace(/\.[^.]+$/, ""));
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      {open && (
        <div
          role="menu"
          className="absolute left-1 right-1 top-full z-20 mt-1 grid max-h-[70vh] max-w-[36rem] gap-3 overflow-y-auto rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm shadow-lg sm:grid-cols-2"
        >
          <div>
            <p className="text-meta mb-1 font-semibold">Mục mới, chọn bố cục</p>
            {LESSON_LAYOUT_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  insertSection(editor, k);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{LESSON_LAYOUT_LABELS[k]}</span>
                <span className="text-caption text-faint">{LESSON_LAYOUT_HINTS[k]}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-meta mb-1 font-semibold">Hộp</p>
            {LESSON_BOX_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  insertBox(editor, k);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{LESSON_BOX_LABELS[k]}</span>
              </button>
            ))}
            <p className="text-meta mb-1 mt-3 font-semibold">Ảnh</p>
            <button
              type="button"
              role="menuitem"
              className={item}
              disabled={busy}
              onClick={() => {
                setOpen(false);
                fileRef.current?.click();
              }}
            >
              <span className="font-medium">{busy ? "Đang tải ảnh..." : "Ảnh có chú thích"}</span>
              <span className="text-caption text-faint">Chú thích ghi cả nguồn ảnh.</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Thanh "Mục / Phần / Hộp": một dòng, hiện khi con trỏ nằm trong mục, phần
 * hoặc hộp, để đổi bố cục, đổi loại hộp, di chuyển, xoá. Nút dạng biểu tượng
 * cho gọn; tên đầy đủ nằm ở tooltip và nhãn cho trình đọc màn hình. Mọi thao
 * tác hoàn tác được bằng Ctrl+Z.
 */
export function LessonContextBar({
  editor,
  aiLessonId,
  look = null,
  onAiApplied,
}: {
  editor: Editor;
  /** Có thì hiện "Nhờ AI" cho mục đang chọn (S2). */
  aiLessonId?: string;
  look?: LessonLook | null;
  onAiApplied?: () => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const ctx = lessonContext(ed.state);
      return {
        sectionPos: ctx.section?.pos ?? null,
        layout: (ctx.section?.node.attrs.layout as string | undefined) ?? null,
        sectionUp: ctx.section ? canMove(ed.state, ctx.section, -1) : false,
        sectionDown: ctx.section ? canMove(ed.state, ctx.section, 1) : false,
        partPos: ctx.part?.pos ?? null,
        partUp: ctx.part ? canMove(ed.state, ctx.part, -1) : false,
        partDown: ctx.part ? canMove(ed.state, ctx.part, 1) : false,
        boxPos: ctx.box?.pos ?? null,
        kind: (ctx.box?.node.attrs.kind as string | undefined) ?? null,
        title: (ctx.box?.node.attrs.title as string | null | undefined) ?? null,
        boxUp: ctx.box ? canMove(ed.state, ctx.box, -1) : false,
        boxDown: ctx.box ? canMove(ed.state, ctx.box, 1) : false,
      };
    },
  });

  if (s.sectionPos === null && s.boxPos === null) return null;
  // Đọc lại node tại thời điểm bấm — vị trí trong state có thể đã đổi.
  const ctx = () => lessonContext(editor.state);
  const layout = isLessonLayoutKey(s.layout) ? s.layout : "text";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-token bg-[rgb(var(--surface-muted))/0.25] px-2 py-1 text-xs">
      {s.sectionPos !== null && (
        <Group label="Mục">
          <select
            value={layout}
            title={`Bố cục của mục: ${LESSON_LAYOUT_HINTS[layout]}`}
            aria-label="Bố cục của mục"
            onChange={(e) => {
              const c = ctx();
              if (c.section && isLessonLayoutKey(e.target.value)) {
                setSectionLayout(editor, c.section, e.target.value as LessonLayoutKey);
              }
            }}
            className="h-6 rounded border border-token bg-[rgb(var(--surface))] px-1 text-xs"
          >
            {LESSON_LAYOUT_KEYS.map((k) => (
              <option key={k} value={k}>
                {LESSON_LAYOUT_LABELS[k]}
              </option>
            ))}
          </select>
          {aiLessonId && <AiSectionMenu editor={editor} lessonId={aiLessonId} look={look} onApplied={onAiApplied} />}
          <IconBtn label="Thêm phần vào mục" onClick={() => addPart(editor, ctx())}>
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
          <MoveDelete
            what="mục"
            up={s.sectionUp}
            down={s.sectionDown}
            onMove={(dir) => {
              const c = ctx();
              if (c.section) moveNode(editor, c.section, dir);
            }}
            onDelete={() => {
              const c = ctx();
              if (c.section && window.confirm("Xoá cả mục này cùng toàn bộ nội dung bên trong? (Ctrl+Z để hoàn tác)")) {
                deleteNode(editor, c.section);
              }
            }}
          />
        </Group>
      )}
      {s.partPos !== null && (
        <Group label="Phần">
          <MoveDelete
            what="phần"
            up={s.partUp}
            down={s.partDown}
            onMove={(dir) => {
              const c = ctx();
              if (c.part) moveNode(editor, c.part, dir);
            }}
            onDelete={() => {
              const c = ctx();
              if (c.part) deleteNode(editor, c.part);
            }}
          />
        </Group>
      )}
      {s.boxPos !== null && (
        <BoxGroup
          kind={isLessonBoxKind(s.kind) ? s.kind : "note"}
          title={s.title}
          up={s.boxUp}
          down={s.boxDown}
          onKind={(kind) => {
            const c = ctx();
            if (c.box) setBoxAttrs(editor, c.box, { kind });
          }}
          onTitle={(title) => {
            const c = ctx();
            if (c.box) setBoxAttrs(editor, c.box, { title });
          }}
          onMove={(dir) => {
            const c = ctx();
            if (c.box) moveNode(editor, c.box, dir);
          }}
          onDelete={() => {
            const c = ctx();
            if (c.box) deleteNode(editor, c.box);
          }}
        />
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-token bg-[rgb(var(--surface))] py-0.5 pl-2 pr-0.5">
      <span className="mr-1 font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-faint transition-colors hover:bg-[rgb(var(--surface-muted))] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? "hover:text-danger-600" : "hover:text-brand-600"
      }`}
    >
      {children}
    </button>
  );
}

function MoveDelete({
  what,
  up,
  down,
  onMove,
  onDelete,
}: {
  what: string;
  up: boolean;
  down: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <IconBtn label={`Đưa ${what} lên`} disabled={!up} onClick={() => onMove(-1)}>
        <ArrowUp className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label={`Đưa ${what} xuống`} disabled={!down} onClick={() => onMove(1)}>
        <ArrowDown className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label={`Xoá ${what}`} danger onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </IconBtn>
    </>
  );
}

function BoxGroup({
  kind,
  title,
  up,
  down,
  onKind,
  onTitle,
  onMove,
  onDelete,
}: {
  kind: LessonBoxKind;
  title: string | null;
  up: boolean;
  down: boolean;
  onKind: (k: LessonBoxKind) => void;
  onTitle: (t: string | null) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  // Ô tên hộp: gõ tự do, chỉ ghi vào bài khi rời ô hoặc Enter (để không tạo
  // một bước hoàn tác cho mỗi ký tự).
  const [draft, setDraft] = useState(title ?? "");
  useEffect(() => setDraft(title ?? ""), [title]);
  const commit = () => {
    const t = draft.trim();
    onTitle(t && t !== LESSON_BOX_LABELS[kind] ? t : null);
  };

  return (
    <Group label="Hộp">
      <select
        value={kind}
        aria-label="Loại hộp"
        onChange={(e) => isLessonBoxKind(e.target.value) && onKind(e.target.value)}
        className="h-6 rounded border border-token bg-[rgb(var(--surface))] px-1 text-xs"
      >
        {LESSON_BOX_KINDS.map((k) => (
          <option key={k} value={k}>
            {LESSON_BOX_LABELS[k]}
          </option>
        ))}
      </select>
      <input
        value={draft}
        placeholder={`Tên: ${LESSON_BOX_LABELS[kind]}`}
        aria-label="Tên hộp"
        title="Tên hiện trên đầu hộp. Để trống thì dùng tên của loại hộp."
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        maxLength={80}
        className="ml-0.5 h-6 w-32 rounded border border-token bg-[rgb(var(--surface))] px-1.5 text-xs"
      />
      <MoveDelete what="hộp" up={up} down={down} onMove={onMove} onDelete={onDelete} />
    </Group>
  );
}
