"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { LessonDraftResult, LessonLook } from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";
import LessonLookMenu from "@/components/lesson/LessonLookMenu";
import { htmlImageCount, htmlWordCount } from "@/lib/lessonKeepFormat";
import { AI_EXAMPLE_LABEL, blockToText, candidateBlocks, headingBefore, replaceBlock } from "@/lib/lessonKeepFormatEdit";
import { stripObjectivesSummary } from "@/lib/lessonRender";
import { ResultView } from "./ResultPane";

const AI_ERRORS: Record<string, string> = {
  no_token_budget: "Bạn đã dùng hết hạn mức AI. Bài vẫn giữ nguyên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  too_long: "Nội dung quá dài để AI xử lý một lượt.",
};

const ACTIONS = [
  { key: "shorter", label: "Viết ngắn hơn" },
  { key: "simpler", label: "Dễ hiểu hơn" },
  { key: "example", label: "Thêm ví dụ" },
  { key: "spelling", label: "Sửa chính tả" },
] as const;
type ActionKey = (typeof ACTIONS)[number]["key"];

/** Chữ có **đậm** và *nghiêng* → phần tử React (không dùng HTML thô). */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

interface Selected {
  index: number;
  text: string;
  heading: string;
}
interface Proposal {
  action: ActionKey;
  text: string;
  example: string;
}

/**
 * Bản nháp "giữ nguyên định dạng": tệp Word/Markdown đã vào thẳng một bài. Không
 * có dàn ý để sửa — xem bài đúng như học viên thấy, chọn bảng màu, rồi Áp dụng.
 * AI chỉ chạy khi giảng viên bấm: "Thêm Mục tiêu và Tổng kết" cho cả bài, hoặc bấm
 * một đoạn rồi chọn việc ("Nhờ AI" sửa đoạn đó, xem cũ/mới rồi mới dùng).
 */
export default function DirectPane({
  draftId,
  sourceName,
  result,
  look,
  onLook,
  onHtml,
  onApply,
  applying,
  error,
  onRestart,
}: {
  draftId: string;
  sourceName: string;
  result: LessonDraftResult;
  look: LessonLook | null;
  onLook: (look: LessonLook | null) => void;
  /** HTML mới của bài (sau khi AI thêm mục tiêu/tổng kết hoặc giảng viên dùng bản AI sửa). */
  onHtml: (html: string) => void;
  onApply: () => void;
  applying: boolean;
  error: string | null;
  onRestart: () => void;
}) {
  const html = result.lessons[0]?.html ?? "";
  const words = htmlWordCount(html);
  const images = htmlImageCount(html);
  const hasExtras = /data-kind="(objectives|summary)"/.test(html);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<ActionKey | "extras" | "save" | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const container = () => wrapRef.current?.querySelector<HTMLElement>(".prose") ?? null;

  // Viền đoạn đang chọn. Gắn trực tiếp lên DOM của bản xem trước (không phải React quản lý).
  useEffect(() => {
    const root = container();
    const el = root && selected ? candidateBlocks(root)[selected.index] : null;
    if (!(el instanceof HTMLElement)) return;
    el.style.outline = "2px solid rgb(132 204 22)";
    el.style.outlineOffset = "3px";
    el.style.borderRadius = "4px";
    return () => {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.borderRadius = "";
    };
  }, [selected, html]);

  function pickBlock(e: React.MouseEvent) {
    const root = container();
    const target = (e.target as HTMLElement).closest("p, li");
    if (!root || !target || !root.contains(target)) return;
    const index = candidateBlocks(root).indexOf(target);
    if (index < 0) return;
    setProposal(null);
    const text = blockToText(target);
    if (!text) {
      setSelected(null);
      setAiErr("Đoạn này có liên kết, ảnh hoặc ký hiệu đặc biệt nên chưa nhờ AI sửa được. Bạn sửa tay sau khi áp dụng.");
      return;
    }
    setAiErr(null);
    setSelected({ index, text, heading: headingBefore(target, root) });
  }

  async function call(path: string, body?: unknown): Promise<Response> {
    return fetch(apiUrl(`/api/lesson-drafts/${draftId}/${path}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function failure(res: Response): Promise<string> {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    return AI_ERRORS[d.error ?? ""] ?? "AI chưa làm được. Bài vẫn giữ nguyên, bạn thử lại sau ít phút.";
  }

  async function addExtras() {
    setBusy("extras");
    setAiErr(null);
    setSelected(null);
    setProposal(null);
    try {
      const res = await call("objectives-summary");
      if (!res.ok) return setAiErr(await failure(res));
      onHtml(((await res.json()) as { html: string }).html);
    } catch {
      setAiErr("Mất kết nối. Bài vẫn giữ nguyên.");
    } finally {
      setBusy(null);
    }
  }

  async function save(nextHtml: string): Promise<boolean> {
    const res = await fetch(apiUrl(`/api/lesson-drafts/${draftId}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resultHtml: nextHtml }),
    });
    if (!res.ok) return false;
    onHtml(nextHtml);
    return true;
  }

  async function removeExtras() {
    setBusy("save");
    setAiErr(null);
    if (!(await save(stripObjectivesSummary(html)))) setAiErr("Chưa lưu được. Vui lòng thử lại.");
    setBusy(null);
  }

  async function ask(action: ActionKey) {
    if (!selected) return;
    setBusy(action);
    setAiErr(null);
    setProposal(null);
    try {
      const res = await call("edit-block", { action, text: selected.text, heading: selected.heading });
      if (!res.ok) return setAiErr(await failure(res));
      const d = (await res.json()) as { proposal: { text: string; example: string } };
      setProposal({ action, ...d.proposal });
    } catch {
      setAiErr("Mất kết nối. Bài vẫn giữ nguyên.");
    } finally {
      setBusy(null);
    }
  }

  async function useProposal() {
    if (!selected || !proposal) return;
    setBusy("save");
    setAiErr(null);
    const next = replaceBlock(html, selected.index, selected.text, proposal.text, proposal.example);
    if (!next) {
      setAiErr("Bài đã thay đổi so với lúc bạn chọn đoạn. Hãy chọn lại đoạn.");
    } else if (await save(next)) {
      setSelected(null);
      setProposal(null);
    } else {
      setAiErr("Chưa lưu được. Vui lòng thử lại.");
    }
    setBusy(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-token bg-[rgb(var(--surface))] px-4 py-2.5 sm:px-6">
        <p className="min-w-0 flex-1 text-sm text-muted">
          <b className="font-semibold text-[rgb(var(--text))]">{sourceName}</b> · {words.toLocaleString("vi-VN")} từ
          {images > 0 ? ` · ${images} ảnh` : ""} · giữ nguyên định dạng của tệp
        </p>
        <button
          type="button"
          onClick={() => void addExtras()}
          disabled={busy !== null}
          title="Dùng AI một lượt, chỉ khi bạn bấm. AI rút từ chính chữ của bài."
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
        >
          {busy === "extras" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
          {hasExtras ? "Tạo lại Mục tiêu và Tổng kết" : "Thêm Mục tiêu và Tổng kết"}
        </button>
        {hasExtras && (
          <button type="button" onClick={() => void removeExtras()} disabled={busy !== null} className="text-xs font-medium text-muted underline">
            Bỏ Mục tiêu và Tổng kết
          </button>
        )}
        <LessonLookMenu value={look} onChange={onLook} />
      </div>

      <div className="flex-1 overflow-y-auto" ref={wrapRef} onClick={pickBlock}>
        <ResultView result={result} look={look} onShowParas={() => {}} hideCompare />
      </div>

      {(selected || aiErr) && (
        <div className="max-h-[40vh] shrink-0 space-y-2 overflow-y-auto border-t border-token bg-[rgb(var(--surface-muted))] px-4 py-3 pl-16 sm:pr-6">
          {aiErr && <p className="text-xs text-danger-600">{aiErr}</p>}
          {selected && !proposal && (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                <b className="font-semibold">Nhờ AI sửa đoạn đã chọn:</b> “<Marked text={selected.text.length > 140 ? `${selected.text.slice(0, 140)}…` : selected.text} />”
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {ACTIONS.map((a) => (
                  <button key={a.key} type="button" onClick={() => void ask(a.key)} disabled={busy !== null} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
                    {busy === a.key && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                    {a.label}
                  </button>
                ))}
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-faint underline">
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}
          {selected && proposal && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-2.5 text-sm">
                  <p className="text-caption mb-1 font-semibold text-faint">Bản hiện tại</p>
                  <Marked text={selected.text} />
                </div>
                <div className="rounded-lg border border-brand-300 bg-[rgb(var(--surface))] p-2.5 text-sm">
                  <p className="text-caption mb-1 font-semibold text-brand-700">Bản AI đề xuất</p>
                  <Marked text={proposal.text} />
                  {proposal.example && (
                    <p className="mt-1.5">
                      <b>{AI_EXAMPLE_LABEL}:</b> <Marked text={proposal.example} />
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void useProposal()} disabled={busy !== null} className="btn-primary btn-sm inline-flex items-center gap-1.5">
                  {busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Dùng bản này
                </button>
                <button type="button" onClick={() => setProposal(null)} disabled={busy !== null} className="btn-ghost btn-sm">
                  Bỏ
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 space-y-2 border-t border-token bg-[rgb(var(--surface))] py-3 pl-16 pr-4 sm:pr-6">
        {error && <p className="text-xs text-danger-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onRestart} className="text-xs text-faint underline hover:text-[rgb(var(--text))]">
            Dùng tài liệu khác
          </button>
          <span className="hidden text-xs text-faint sm:inline">Bấm vào một đoạn trong bài để nhờ AI sửa đoạn đó.</span>
          <button type="button" onClick={onApply} disabled={applying || busy !== null} className="btn-primary ml-auto">
            {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Áp dụng vào bài học
          </button>
        </div>
      </div>
    </div>
  );
}
