"use client";

import { looksLikeHtml } from "@/lib/richText";
import { MATCHING_EXAMPLES } from "@/lib/questionExamples";
import AdaptiveTextField from "@/components/AdaptiveTextField";
import type { MatchingDraft, MatchingPair } from "./types";

/**
 * Đợt 9 — bản DÙNG CHUNG, port nguyên UX của bản Quiz-only cũ
 * (apps/web/src/components/MatchingPairsEditor.tsx, nay đã xoá) theo yêu cầu
 * "Bank/Đề thi dùng lại UI của Quiz". Thao tác thẳng trên canonical
 * MatchingDraft ({pairs:[{id,left,right}]}) — thực ra ĐƠN GIẢN HƠN bản cũ vì
 * không cần tự đối chiếu side/pairKey nữa (đó là gánh nặng riêng của shape
 * options[] bên Quiz, adapter của Quiz lo phần dịch đó — xem AddQuestionForm.tsx).
 */

const MIN_PAIRS = 2;

/** Nội dung có định dạng/ảnh (do import hoặc soạn rich trước đó) → giữ ô rich để không mất. */
function isRich(label: string): boolean {
  return looksLikeHtml(label) && /<(?!\/?(?:p|br)\b)[a-z]/i.test(label);
}

function Cell({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  if (isRich(value)) {
    return <AdaptiveTextField value={value} onChange={onChange} placeholder={placeholder} minHeight={48} />;
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className="input"
    />
  );
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `mp${Date.now().toString(36)}${seq}`;
}

export default function MatchingEditor({
  value,
  onChange,
}: {
  value: MatchingDraft;
  onChange: (next: MatchingDraft) => void;
}) {
  const pairs = value.pairs;

  function setSide(i: number, side: "left" | "right", v: string) {
    onChange({ pairs: pairs.map((p, idx) => (idx === i ? { ...p, [side]: v } : p)) });
  }
  function add() {
    onChange({ pairs: [...pairs, { id: newId(), left: "", right: "" }] });
  }
  function remove(i: number) {
    onChange({ pairs: pairs.filter((_, idx) => idx !== i) });
  }

  return (
    <div>
      <p className="-mt-1 mb-2 text-xs text-faint">
        Mỗi hàng là một cặp đúng. Học viên sẽ thấy hai cột và phải nối các vế với nhau, thứ tự bên
        phải được xáo trộn. Chỉ tính điểm khi nối đúng tất cả các cặp.
      </p>
      <div className="hidden grid-cols-[1.75rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_2rem] items-center gap-2 px-1 pb-1 text-xs font-medium text-muted sm:grid">
        <span />
        <span>Vế trái</span>
        <span />
        <span>Vế phải (đáp án đúng của vế trái)</span>
        <span />
      </div>
      <ul className="space-y-2">
        {pairs.map((p: MatchingPair, i) => (
          <li
            key={p.id}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_2rem] items-start gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-2 sm:grid-cols-[1.75rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_2rem] sm:items-center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {i + 1}
            </span>
            <div className="col-start-2 sm:col-start-auto">
              <Cell
                value={p.left}
                onChange={(v) => setSide(i, "left", v)}
                placeholder={MATCHING_EXAMPLES[i] ? `VD: ${MATCHING_EXAMPLES[i]![0]}` : `Vế trái ${i + 1}`}
                label={`Vế trái cặp ${i + 1}`}
              />
            </div>
            <span className="hidden text-center text-muted sm:block" aria-hidden>
              ↔
            </span>
            <div className="col-start-2 sm:col-start-auto">
              <Cell
                value={p.right}
                onChange={(v) => setSide(i, "right", v)}
                placeholder={MATCHING_EXAMPLES[i] ? `VD: ${MATCHING_EXAMPLES[i]![1]}` : `Vế phải ${i + 1}`}
                label={`Vế phải cặp ${i + 1}`}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={pairs.length <= MIN_PAIRS}
              aria-label={`Xóa cặp ${i + 1}`}
              className="col-start-3 row-start-1 flex h-7 w-7 items-center justify-center rounded-lg border border-danger-100 text-xs text-danger-600 hover:bg-danger-50 disabled:opacity-40 sm:col-start-auto sm:row-start-auto"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={add} className="link mt-2 text-xs">
        + Thêm cặp
      </button>
    </div>
  );
}
