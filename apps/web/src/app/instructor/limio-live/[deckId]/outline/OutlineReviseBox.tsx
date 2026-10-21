"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import type { Outline } from "@/lib/limioLiveOutline";
import {
  REVISE_MAX_CHARS,
  REVISE_MIN_CHARS,
  REVISE_SUGGESTIONS,
  appendSuggestion,
  checkInstruction,
  estimateReviseTokens,
  shortInstruction,
} from "@/lib/limioLiveOutlineRevise";

const ERROR_TEXT: Record<string, string> = {
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Dàn ý vẫn giữ nguyên.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này. Dàn ý vẫn giữ nguyên.",
  no_source: "Bài này không còn văn bản nguồn để AI dựa vào.",
  imported_deck: "Bài nhập từ PowerPoint giữ nguyên slide gốc nên không chỉnh bằng AI được.",
  empty_outline: "AI chưa chỉnh được dàn ý. Hãy thử lại hoặc viết lời dặn rõ hơn.",
};

export interface RevisedState {
  /** Lời dặn đã dùng (rút gọn); rỗng khi soạn lại từ đầu không kèm lời dặn. */
  label: string;
  mode: "revise" | "restart";
  /** Lưu ý của máy chủ ngoài các cảnh báo sẵn có (vd. AI đề xuất quá nhiều slide). */
  notes: string[];
}

/**
 * Hộp "Chỉnh dàn ý bằng AI" ở cột phải trang dàn ý (docs/tieu-chi/dan-y-chinh-bang-ai.md, R1–R10): một ô dặn AI chỉnh dàn ý, bốn gợi ý điền sẵn,
 * dòng "Soạn lại từ đầu", và thanh "Quay lại bản trước" sau khi áp. Hộp chỉ gọi máy chủ và trao dàn ý mới cho trang áp vào; trang giữ bản cũ để hoàn tác.
 */
export default function OutlineReviseBox({
  deckId,
  outline,
  minutes,
  sourceChars,
  hasSlides,
  disabled,
  revised,
  onApply,
  onUndo,
}: {
  deckId: string;
  outline: Outline;
  minutes: number;
  sourceChars: number;
  hasSlides: boolean;
  disabled: boolean;
  revised: RevisedState | null;
  onApply: (next: Outline, info: RevisedState) => void;
  onUndo: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "revise" | "restart">(null);
  const [error, setError] = useState<string | null>(null);

  const check = checkInstruction(text);
  const tokens = estimateReviseTokens({ sourceChars, slideCount: outline.slides.length }).total;
  const tokensLabel = tokens >= 1000 ? `${Math.round(tokens / 100) / 10} nghìn`.replace(".", ",") : String(tokens);
  const locked = disabled || busy !== null;
  const hint = !text.trim()
    ? null
    : !check.ok && check.reason === "too_short"
      ? `Lời dặn cần ít nhất ${REVISE_MIN_CHARS} ký tự.`
      : !check.ok
        ? `Lời dặn dài quá ${REVISE_MAX_CHARS} ký tự (đang ${text.trim().length}).`
        : null;

  const run = async (mode: "revise" | "restart") => {
    if (locked) return;
    const instruction = check.ok ? check.text : "";
    if (mode === "revise" && !check.ok) return;
    if (mode === "restart") {
      if (text.trim() && !check.ok) return;
      const ok = window.confirm(
        `Soạn lại dàn ý từ đầu?\n\nDàn ý hiện tại, kể cả phần thầy/cô đã sửa, sẽ được thay bằng bản AI soạn mới từ tài liệu nguồn. Bấm "Quay lại bản trước" ngay sau đó nếu muốn lấy lại.\n\nDự kiến dùng khoảng ${tokensLabel} token AI.`,
      );
      if (!ok) return;
    }
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/outline/revise`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, ...(instruction ? { instruction } : {}), ...(mode === "revise" ? { outline } : {}), minutes }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        return setError(ERROR_TEXT[j?.error ?? ""] ?? "Không chỉnh được dàn ý. Dàn ý vẫn giữ nguyên, thử lại nhé.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; outline?: Outline; warnings?: string[]; error?: string };
          if (ev.type === "done" && ev.outline) {
            finished = true;
            onApply(ev.outline, { label: instruction ? shortInstruction(instruction) : "", mode, notes: ev.warnings ?? [] });
            setText("");
          } else if (ev.type === "error") {
            finished = true;
            setError(ERROR_TEXT[ev.error ?? ""] ?? "Không chỉnh được dàn ý. Dàn ý vẫn giữ nguyên, thử lại nhé.");
          }
        }
      }
      if (!finished) setError("Kết nối bị gián đoạn. Dàn ý vẫn giữ nguyên, thử lại nhé.");
    } catch {
      setError("Mất kết nối. Dàn ý vẫn giữ nguyên; kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Chỉnh dàn ý bằng AI">
      <h2 className="mb-2 text-base font-semibold">Chỉnh dàn ý bằng AI</h2>
      <textarea
        className="input min-h-[84px] w-full resize-y text-[15px] leading-normal"
        rows={3}
        value={text}
        disabled={locked}
        placeholder="Thầy/cô muốn chỉnh gì? Ví dụ: rút còn 12 slide, thêm ví dụ cho sinh viên năm nhất."
        aria-label="Lời dặn AI chỉnh dàn ý"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void run("revise");
          }
        }}
      />
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
        {REVISE_SUGGESTIONS.map((s) => (
          <button key={s} type="button" disabled={locked} className="font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" onClick={() => setText((t) => appendSuggestion(t, s))}>
            {s}
          </button>
        ))}
      </p>
      {hint && <p className="mt-1.5 text-[13px] font-medium text-amber-800 dark:text-amber-200">{hint}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <button type="button" className="btn-primary inline-flex items-center gap-1.5 text-sm" disabled={locked || !check.ok} onClick={() => void run("revise")}>
          {busy === "revise" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} aria-hidden />}
          {busy === "revise" ? "Đang chỉnh..." : "Chỉnh dàn ý"}
        </button>
        <button type="button" className="text-[13px] font-semibold text-muted hover:text-[rgb(var(--text))] hover:underline disabled:opacity-50" disabled={locked || (!!text.trim() && !check.ok)} onClick={() => void run("restart")}>
          {busy === "restart" ? "Đang soạn lại..." : "Soạn lại từ đầu"}
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        {busy ? "AI thường mất từ 20 đến 60 giây." : `Mỗi lần chỉnh dùng khoảng ${tokensLabel} token AI. Phần thầy/cô đã sửa tay được giữ nếu lời dặn không đụng tới.`}
        {hasSlides && !busy ? " Slide đã tạo giữ nguyên cho đến khi thầy/cô bấm Cập nhật slide theo dàn ý." : ""}
      </p>
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] font-medium text-red-700 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {revised && !busy && (
        <div role="status" className="mt-3 grid gap-1.5 rounded-xl bg-[rgb(var(--brand-soft))] px-3 py-2.5 text-[13.5px]">
          <span className="leading-snug">{revised.mode === "restart" ? "Đã soạn lại dàn ý từ đầu" : "Đã chỉnh theo"}{revised.label ? <>: “{revised.label}”</> : "."}</span>
          {revised.notes.length > 0 && <span className="text-muted">{revised.notes[0]}</span>}
          <button type="button" className="inline-flex items-center gap-1.5 justify-self-start font-bold text-brand-700 hover:underline dark:text-brand-300" onClick={onUndo}>
            <RotateCcw size={13} aria-hidden /> Quay lại bản trước
          </button>
        </div>
      )}
    </section>
  );
}
