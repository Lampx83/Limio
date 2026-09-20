"use client";

import { useEffect, useState } from "react";
import {
  DRAG_DROP_DISTRACTOR_EXAMPLE,
  PROMPT_EXAMPLE,
} from "@/lib/questionExamples";
import { htmlToPlainText, looksLikeHtml } from "@/lib/richText";
import { needsRich } from "@/components/AdaptiveTextField";
import {
  blankifyAt,
  blankIndexes,
  blankOf,
  compose,
  mk,
  rebuild,
  split,
  tokenize,
  type BuildTok,
  type Opt,
} from "@/lib/dragDropFill";

/**
 * Soạn câu kéo thả từ/câu: GV gõ trọn câu, rồi BẤM VÀO TỪ muốn ẩn để biến nó
 * thành ô trống (bấm lại vào ô để bỏ). Từ được ẩn chính là đáp án đúng của ô.
 * GV không phải gõ hay đánh số gì.
 *
 * Bên dưới vẫn lưu đúng định dạng cũ mà bộ chấm điểm và trình phát đang đọc:
 * câu chứa `[[N]]` (N đánh số theo thứ tự xuất hiện) và mỗi option mang
 * `extra.blankIndex` (N = đáp án của ô [[N]], null = từ gây nhiễu).
 *
 * Câu có định dạng/ảnh (rich) không chuyển được sang chế độ bấm-từ mà không
 * mất định dạng, nên rơi về cách cũ: gõ `[[N]]` tay, editor chỉ đồng bộ đáp án.
 */

const LABEL =
  "mb-1.5 block text-xs font-semibold uppercase leading-4 tracking-wide text-muted";

export default function DragDropFillEditor({
  prompt,
  onPrompt,
  options,
  onChange,
}: {
  prompt: string;
  onPrompt: (next: string) => void;
  options: Opt[];
  onChange: (next: Opt[]) => void;
}) {
  const rich = needsRich(prompt);
  const plain = looksLikeHtml(prompt) ? htmlToPlainText(prompt) : prompt;
  const blanks = blankIndexes(prompt);
  const { answers, distractors } = split(options);

  // Bấm-từ chỉ khi đã có câu; câu trống thì bắt đầu ở bước gõ câu.
  const [editing, setEditing] = useState(() => plain.trim() === "");

  // Giữ option khớp với các [[N]] trong câu (thêm dòng cho ô mới, bỏ ô mồ côi).
  useEffect(() => {
    const target = compose(blanks, answers, distractors);
    const key = (o: Opt) => `${blankOf(o) ?? "x"}|${o.label}`;
    const same =
      target.length === options.length &&
      target.every((o, i) => key(o) === key(options[i]!));
    if (!same) onChange(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, options]);

  const tokens = tokenize(plain);

  function apply(next: BuildTok[]) {
    const r = rebuild(next, answers, distractors);
    onPrompt(r.prompt);
    onChange(r.options);
  }

  function blankify(idx: number) {
    const r = blankifyAt(tokens, idx, answers, distractors);
    if (!r) return;
    onPrompt(r.prompt);
    onChange(r.options);
  }

  function unblank(idx: number) {
    const t = tokens[idx];
    if (!t || t.kind !== "blank") return;
    const label = answers.get(t.old)?.label || "…";
    apply(tokens.map((x, i): BuildTok => (i === idx ? { kind: "space", text: label } : x)));
  }

  function setAnswer(n: number, label: string) {
    const next = new Map(answers);
    next.set(n, mk(label, n));
    onChange(compose(blanks, next, distractors));
  }
  function setDistractor(i: number, label: string) {
    onChange(
      compose(
        blanks,
        answers,
        distractors.map((d, idx) => (idx === i ? mk(label, null) : d)),
      ),
    );
  }
  function addDistractor() {
    onChange(compose(blanks, answers, [...distractors, mk("", null)]));
  }
  function removeDistractor(i: number) {
    onChange(compose(blanks, answers, distractors.filter((_, idx) => idx !== i)));
  }

  return (
    <div className="space-y-4">
      {rich ? (
        <p className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm text-muted">
          Câu này đang có định dạng hoặc ảnh nên chưa dùng được cách bấm vào từ. Hãy gõ{" "}
          <code>[[1]]</code>, <code>[[2]]</code>… ở chỗ cần điền, rồi nhập đáp án cho từng ô bên dưới.
        </p>
      ) : editing ? (
        <div>
          <span className={LABEL}>Bước 1 · Viết trọn câu</span>
          <textarea
            value={plain}
            onChange={(e) => onPrompt(e.target.value)}
            rows={3}
            placeholder={PROMPT_EXAMPLE.drag_drop_fill}
            className="textarea"
          />
          <p className="mt-1 text-xs text-faint">
            Viết câu hoàn chỉnh với đáp án đúng. Ở bước sau bạn sẽ bấm vào từ nào muốn ẩn đi.
          </p>
          {blanks.length > 0 && (
            <p className="mt-1 text-xs text-warning-700">
              Câu đang có {blanks.length} ô trống. Giữ nguyên các ký hiệu [[số]] nếu không muốn mất ô.
            </p>
          )}
          <button
            type="button"
            onClick={() => plain.trim() !== "" && setEditing(false)}
            className="btn-primary btn-sm mt-2"
          >
            Tiếp: chọn từ để ẩn →
          </button>
        </div>
      ) : (
        <div>
          <span className={LABEL}>Bước 2 · Bấm vào từ muốn ẩn đi</span>
          <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-base leading-10">
            {tokens.map((t, i) => {
              if (t.kind === "space") {
                return (
                  <span key={i} className="whitespace-pre-wrap">
                    {t.text}
                  </span>
                );
              }
              if (t.kind === "blank") {
                const ans = answers.get(t.old)?.label;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => unblank(i)}
                    title="Bấm để bỏ ô trống"
                    className="mx-0.5 rounded-md border border-dashed border-brand-500 bg-brand-soft px-2 py-0.5 text-brand-700 hover:bg-brand-100"
                  >
                    {ans || "…"} <span aria-hidden>×</span>
                  </button>
                );
              }
              return (
                <span key={i}>
                  {t.lead}
                  <button
                    type="button"
                    onClick={() => blankify(i)}
                    className="rounded-md px-0.5 hover:bg-brand-soft hover:text-brand-700"
                  >
                    {t.core}
                  </button>
                  {t.trail}
                </span>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-faint">
            {blanks.length === 0
              ? "Chưa có ô trống. Bấm vào một từ để biến nó thành ô trống. Muốn ẩn cả cụm, bấm tiếp từ kề bên để nối vào ô."
              : "Từ đã ẩn là đáp án đúng của ô. Bấm từ kề bên để nối thêm vào ô, bấm vào ô để bỏ."}
          </p>
          <button type="button" onClick={() => setEditing(true)} className="link mt-1 text-xs">
            Sửa lại nội dung câu
          </button>
        </div>
      )}

      {blanks.length > 0 && (
        <div>
          <span className={LABEL}>Đáp án đúng của từng ô</span>
          <ul className="space-y-2">
            {blanks.map((n) => (
              <li key={n} className="flex items-center gap-2">
                <span className="w-16 shrink-0 rounded-md border border-dashed border-brand-400 bg-brand-soft px-2 py-1.5 text-center text-xs font-semibold text-brand-700">
                  Ô {n}
                </span>
                <input
                  value={answers.get(n)?.label ?? ""}
                  onChange={(e) => setAnswer(n, e.target.value)}
                  required
                  aria-label={`Đáp án ô ${n}`}
                  className="input flex-1"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {blanks.length > 0 && (
        <div>
          <span className={LABEL}>
            Từ gây nhiễu <span className="font-normal normal-case text-faint">(không bắt buộc)</span>
          </span>
          <p className="-mt-1 mb-2 text-xs text-faint">
            Những từ sai được đặt lẫn với đáp án đúng trong khung từ để học viên phải cân nhắc.
          </p>
          <ul className="space-y-2">
            {distractors.map((d, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  value={d.label}
                  onChange={(e) => setDistractor(i, e.target.value)}
                  required
                  placeholder={`VD: ${DRAG_DROP_DISTRACTOR_EXAMPLE}`}
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeDistractor(i)}
                  aria-label="Xóa từ gây nhiễu"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger-100 text-xs text-danger-600 hover:bg-danger-50"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addDistractor} className="link mt-2 text-xs">
            + Thêm từ gây nhiễu
          </button>
        </div>
      )}

      {blanks.length > 0 && (
        <div>
          <span className={LABEL}>Khung từ học viên sẽ thấy</span>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] p-3">
            {[...blanks.map((n) => answers.get(n)?.label ?? ""), ...distractors.map((d) => d.label)]
              .filter(Boolean)
              .map((t, i) => (
                <span key={i} className="rounded border border-token bg-white px-2 py-0.5 text-sm">
                  {t}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
