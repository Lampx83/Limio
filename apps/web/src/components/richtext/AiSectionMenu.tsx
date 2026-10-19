"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DOMSerializer } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { Loader2, Sparkles, X } from "lucide-react";
import type { LessonLook, SectionDraft } from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";
import { lessonStyleVars } from "@/lib/lessonLook";
import { renderEditedSection } from "@/lib/lessonRender";
import { LESSON_FONT_VARIABLES } from "@/components/lesson/lessonFonts";
import { lessonContext } from "./lessonCommands";
import { extractSection, sectionUnsupported } from "./lessonSectionExtract";

const ACTIONS = [
  { key: "shorter", label: "Viết ngắn hơn" },
  { key: "simpler", label: "Dễ hiểu hơn" },
  { key: "example", label: "Thêm ví dụ" },
  { key: "spelling", label: "Sửa chính tả" },
] as const;
type Action = (typeof ACTIONS)[number]["key"];

const ERRORS: Record<string, string> = {
  no_token_budget: "Bạn đã dùng hết hạn mức AI. Bạn vẫn sửa tay được bình thường.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  validation_failed: "Mục này trống hoặc quá dài để nhờ AI.",
};

const UNSUPPORTED_LABEL: Record<string, string> = {
  table: "bảng",
  blockquote: "trích dẫn",
  codeBlock: "khối mã",
  image: "ảnh không có chú thích",
  horizontalRule: "đường kẻ",
};

/**
 * "Nhờ AI" cho MỘT mục (S2): chọn việc → AI đề xuất → so bản hiện tại với bản
 * đề xuất (đúng giao diện bài) → "Dùng bản này" thay mục, hoặc "Bỏ". Chỉ mục
 * đang chọn bị đụng tới; Ctrl+Z hoàn tác được; lần lưu sau được đánh dấu
 * "trước khi nhờ AI sửa" trong lịch sử.
 */
export default function AiSectionMenu({
  editor,
  lessonId,
  look,
  onApplied,
}: {
  editor: Editor;
  lessonId: string;
  look: LessonLook | null;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ pos: number; size: number; oldHtml: string; newHtml: string; action: Action } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const section = lessonContext(editor.state).section;
  const unsupported = section ? sectionUnsupported(section.node) : null;

  async function run(action: Action) {
    const ctx = lessonContext(editor.state).section;
    if (!ctx) return;
    setOpen(false);
    setError(null);
    setBusy(action);
    const ex = extractSection(ctx.node);
    try {
      const r = await fetch(apiUrl(`/api/lessons/${lessonId}/ai-edit-section`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, lessonTitle: "", title: ex.title, layout: ex.layout, intro: ex.intro, parts: ex.parts, boxes: ex.boxes }),
      });
      const d = (await r.json().catch(() => ({}))) as { draft?: SectionDraft; error?: string };
      if (!r.ok || !d.draft) throw new Error(d.error ?? "generate_failed");
      const serializer = DOMSerializer.fromSchema(editor.schema);
      const wrap = document.createElement("div");
      wrap.appendChild(serializer.serializeNode(ctx.node));
      setCompare({
        pos: ctx.pos,
        size: ctx.node.nodeSize,
        oldHtml: wrap.innerHTML,
        newHtml: renderEditedSection({ title: ex.title, layout: ex.layout }, d.draft, ex.figures),
        action,
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      setError(ERRORS[code] ?? "AI chưa sửa được mục này. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  function accept() {
    if (!compare) return;
    // Mục có thể đã dịch chỗ nếu tài liệu đổi trong lúc chờ — chỉ thay khi vẫn đúng là mục đó.
    const node = editor.state.doc.nodeAt(compare.pos);
    if (!node || node.type.name !== "lessonSection" || node.nodeSize !== compare.size) {
      setError("Mục đã thay đổi trong lúc chờ AI. Hãy nhờ AI lại.");
      setCompare(null);
      return;
    }
    editor.chain().focus().insertContentAt({ from: compare.pos, to: compare.pos + compare.size }, compare.newHtml).run();
    setCompare(null);
    onApplied?.();
  }

  const label = ACTIONS.find((a) => a.key === compare?.action)?.label;

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!!busy || !!unsupported}
        title={unsupported ? `Mục có ${UNSUPPORTED_LABEL[unsupported] ?? unsupported} — chưa nhờ AI được, hãy sửa tay` : "Nhờ AI sửa mục này"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-xs font-medium text-brand-700 hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        {busy ? "AI đang sửa…" : "Nhờ AI"}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-token bg-[rgb(var(--surface))] p-1 shadow-lg">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              onClick={() => void run(a.key)}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {error && <span className="ml-2 text-xs text-danger-600">{error}</span>}
      {compare &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="So sánh bản hiện tại với đề xuất của AI"
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3 sm:p-6"
          >
            <div className="flex h-full max-h-[52rem] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[rgb(var(--surface))] shadow-2xl">
              <div className="flex items-center gap-3 border-b border-token px-4 py-3">
                <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
                <h2 className="text-h4 flex-1">Nhờ AI: {label}</h2>
                <button type="button" onClick={() => setCompare(null)} aria-label="Đóng" className="rounded p-1 text-faint hover:text-[rgb(var(--text))]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid min-h-0 flex-1 gap-px bg-[rgb(var(--border))] md:grid-cols-2">
                {[
                  { t: "Bản hiện tại", h: compare.oldHtml },
                  { t: "Đề xuất của AI", h: compare.newHtml },
                ].map((col) => (
                  <div key={col.t} className="min-h-0 overflow-y-auto bg-[rgb(var(--bg))] p-3 sm:p-4">
                    <p className="text-meta mb-2 font-semibold">{col.t}</p>
                    <div
                      className={`prose prose-sm max-w-none rounded-xl p-4 ${look ? `lesson-look ${LESSON_FONT_VARIABLES}` : "bg-[rgb(var(--surface))]"}`}
                      style={look ? lessonStyleVars(look) : undefined}
                      data-palette={look?.palette}
                      data-font={look?.font}
                      // Bản hiện tại lấy từ chính trình soạn; bản đề xuất dựng bằng renderEditedSection (đã thoát HTML).
                      dangerouslySetInnerHTML={{ __html: col.h }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-token px-4 py-3">
                <span className="flex-1 text-xs text-faint">
                  Chỉ mục này bị thay. Dùng xong vẫn hoàn tác được bằng Ctrl+Z hoặc từ Lịch sử sau khi lưu.
                </span>
                <button type="button" className="btn-secondary" onClick={() => setCompare(null)}>
                  Bỏ
                </button>
                <button type="button" className="btn-primary" onClick={accept}>
                  Dùng bản này
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
