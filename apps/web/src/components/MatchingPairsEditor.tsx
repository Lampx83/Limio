"use client";

import { looksLikeHtml } from "@/lib/richText";
import { MATCHING_EXAMPLES } from "@/lib/questionExamples";
import AdaptiveTextField from "@/components/AdaptiveTextField";

/**
 * Soạn câu ghép cặp theo đúng cách GV nghĩ: mỗi hàng là MỘT cặp đúng
 * (vế trái ↔ vế phải). Bên dưới vẫn lưu dạng option phẳng với
 * `extra={side, pairKey}` mà chấm điểm và validate ở server đang cần; mã cặp
 * (p1, p2…) tự sinh, GV không phải biết tới nó.
 */

interface Opt {
  label: string;
  isCorrect: boolean;
  misconceptionId: string | null;
  extra: { side?: "left" | "right"; pairKey?: string } | null;
}

interface Pair {
  key: string;
  left: string;
  right: string;
}

const MIN_PAIRS = 2;

function toPairs(options: Opt[]): Pair[] {
  const order: string[] = [];
  const map = new Map<string, Pair>();
  options.forEach((o, i) => {
    const key = o.extra?.pairKey || `p${i}`;
    if (!map.has(key)) {
      map.set(key, { key, left: "", right: "" });
      order.push(key);
    }
    const p = map.get(key)!;
    if (o.extra?.side === "right") p.right = o.label;
    else p.left = o.label;
  });
  return order.map((k) => map.get(k)!);
}

function toOptions(pairs: Pair[]): Opt[] {
  return pairs.flatMap((p) => [
    { label: p.left, isCorrect: false, misconceptionId: null, extra: { side: "left" as const, pairKey: p.key } },
    { label: p.right, isCorrect: false, misconceptionId: null, extra: { side: "right" as const, pairKey: p.key } },
  ]);
}

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

export default function MatchingPairsEditor({
  options,
  onChange,
}: {
  options: Opt[];
  onChange: (next: Opt[]) => void;
}) {
  const pairs = toPairs(options);

  function update(next: Pair[]) {
    onChange(toOptions(next) as Opt[]);
  }
  function setSide(i: number, side: "left" | "right", v: string) {
    update(pairs.map((p, idx) => (idx === i ? { ...p, [side]: v } : p)));
  }
  function add() {
    let n = pairs.length + 1;
    while (pairs.some((p) => p.key === `p${n}`)) n++;
    update([...pairs, { key: `p${n}`, left: "", right: "" }]);
  }
  function remove(i: number) {
    update(pairs.filter((_, idx) => idx !== i));
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
        {pairs.map((p, i) => (
          <li
            key={p.key}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_2rem] items-start gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-2 sm:grid-cols-[1.75rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_2rem] sm:items-center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {i + 1}
            </span>
            <div className="col-start-2 sm:col-start-auto">
              <Cell value={p.left} onChange={(v) => setSide(i, "left", v)} placeholder={MATCHING_EXAMPLES[i] ? `VD: ${MATCHING_EXAMPLES[i]![0]}` : `Vế trái ${i + 1}`} label={`Vế trái cặp ${i + 1}`} />
            </div>
            <span className="hidden text-center text-muted sm:block" aria-hidden>
              ↔
            </span>
            <div className="col-start-2 sm:col-start-auto">
              <Cell value={p.right} onChange={(v) => setSide(i, "right", v)} placeholder={MATCHING_EXAMPLES[i] ? `VD: ${MATCHING_EXAMPLES[i]![1]}` : `Vế phải ${i + 1}`} label={`Vế phải cặp ${i + 1}`} />
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
