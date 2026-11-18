"use client";

import { Keyboard } from "lucide-react";
import { splitTrailingHint } from "@/lib/practiceHint";
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import SafeHtml from "@/components/SafeHtml";
import PromptAid from "./PromptAid";
import PinyinLabel, { RubyRun, PinyinProvider, useSyllables, useSyllableFn, type SyllableFn } from "./PinyinLabel";
import { DragFillDnd, OrderingDnd } from "./PracticeDnd";
import { parsePromptAid } from "@/lib/promptAid";
import { promptSyllables, questionHidesPinyin, sliceByHan } from "@/lib/promptRuby";
import { htmlToPlainText, looksLikeHtml, plainToRichHtml } from "@/lib/richText";
import { useT } from "@/lib/i18n/client";
import ExamQuestion, { isAnswerValueAnswered as isAnswered, type AnswerValue } from "@/components/exam/ExamQuestion";
import {
  blankCountOf,
  blankWidthCh,
  groupSharedOptions,
  instructionPlan,
  cleanMatchingLabels,
  letterOf,
  optionLabelsOf,
  questionsToCheck,
  revealText,
  sheetKind,
  sheetStatus,
  splitBlankPrompt,
  splitDragPrompt,
} from "@/lib/practiceSheetView";

/**
 * Phiếu bài tập của Bài luyện (khoá ngoại ngữ): một tờ giấy kem, mỗi bước là một tab bài tập, mỗi câu một dòng gọn, trả lời ngay trong
 * dòng (chỗ trống gạch chân, khoanh đáp án, ô chọn), không kéo thả. Chỉ là lớp TRÌNH BÀY: cách chấm, lưu đáp án và sự kiện do
 * `LessonPractice` lo như cũ. Tiêu chí: docs/tieu-chi/limio-language-phieu-bai-tap.md.
 */

export interface SheetQuestion {
  id: string;
  type: string;
  prompt: string;
  points: number;
  config: Record<string, unknown>;
}

export interface SheetCheck {
  isCorrect: boolean | null;
  manual: boolean;
  config: unknown;
}

export interface SheetTab {
  key: string;
  label: string;
  /** Nhãn ngắn hiện trên nút tab (mã bài tập); đủ tên ở gợi ý. */
  short?: string;
  questionIds: string[];
  /** Đoạn văn chỉ là câu yêu cầu (chữ) hoặc câu yêu cầu kèm trình phát (nút): hiện ở đầu bài tập (một cột) thay vì thẻ đoạn văn bên trái. */
  intro?: ReactNode;
  /** Tên bài tập (vd "Ex 2D · …") hiện làm tiêu đề phía trên `intro`, cùng kiểu tiêu đề với thẻ đoạn văn, để biết đang làm bài tập nào. */
  introTitle?: string;
  /** Biểu tượng đặt trước tên bài tập (vd micro cho bài nói với bạn ảo / đóng vai), để nhận ra ngay đây là phần phải nói. */
  introIcon?: ReactNode;
  /** Tên đã hiện ở thẻ đề phía trên (hoặc chỉ là nhãn mặc định "Bài n" không mang nghĩa): đầu tab chỉ còn số câu, không lặp tên. */
  hideTitle?: boolean;
}

const plain = (prompt: string) => (looksLikeHtml(prompt) ? htmlToPlainText(prompt) : prompt);

function items(v: unknown): Array<{ id: string; label: string }> {
  return Array.isArray(v)
    ? v.filter((x): x is { id: string; label: string } => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" && typeof (x as { label?: unknown }).label === "string")
    : [];
}

function Blank({ value, onChange, label, inputMode }: { value: string; onChange: (v: string) => void; label: string; inputMode?: "decimal" }) {
  return (
    <input
      type="text"
      data-ps-input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      inputMode={inputMode}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={200}
      className="ps-blank"
      style={{ width: `${blankWidthCh(value)}ch` }}
    />
  );
}

function Alt({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="ps-alt">
      {children}
    </button>
  );
}

/** Lựa chọn ngắn ngay trong dòng: mỗi lựa chọn là một nút viền mảnh (nhìn là biết bấm được); chọn rồi thì được khoanh mực xanh. Cả nhóm không bị ngắt dòng giữa chừng. */
function InlineChoices({ options, selected, onPick }: { options: Array<{ id: string; label: string }>; selected: string | undefined; onPick: (id: string) => void }) {
  return (
    <span className="ps-alts" role="group">
      {options.map((o) => (
        <Alt key={o.id} on={selected === o.id} onClick={() => onPick(o.id)}>
          <PinyinLabel text={o.label} />
        </Alt>
      ))}
    </span>
  );
}

/**
 * Đề dạng biến đổi câu ("câu gốc / TỪ KHOÁ / câu có chỗ trống", ba phần ngăn bằng xuống dòng trong dữ liệu): hiện trên MỘT dòng — câu gốc, từ khoá
 * trong ngoặc, rồi phần phải viết lại bằng màu chữ khác để học viên thấy ngay đâu là câu gốc, đâu là câu mình điền. Không đúng dạng thì null.
 */
export function splitTransform(text: string): { head: string; key: string; rest: string } | null {
  const m = /^([^\n]+)\n([A-Z][A-Z' -]+)\n([^\n]+)$/.exec(text);
  return m ? { head: m[1]!.trim(), key: m[2]!.trim(), rest: m[3]!.trim() } : null;
}

/** Chữ thuần của đề với một chỗ để gắn điều khiển: nếu đề có dấu trống thì điều khiển thay dấu đó, không thì nằm sau chữ. */
function PromptWith({ prompt, control, syllables = null }: { prompt: string; control: ReactNode; /** Pinyin cho cả đề (đề chữ Hán): đặt dưới từng chữ ở các đoạn chữ, chỗ điều khiển nằm giữa. */ syllables?: string[] | null }) {
  const segs = splitBlankPrompt(plain(prompt), 1);
  const slices = syllables ? sliceByHan(syllables, segs.flatMap((s) => (s.kind === "text" ? [s.text] : []))) : null;
  let ti = 0;
  return (
    <>
      {segs.map((s, i) =>
        s.kind === "text" ? (
          slices ? <RubyRun key={i} text={s.text} syllables={slices[ti++]!} /> : <span key={i}>{s.text}</span>
        ) : (
          <span key={i}>{control}</span>
        ),
      )}
    </>
  );
}

function RowBody({
  q,
  n,
  value,
  onChange,
  shared = false,
}: {
  q: SheetQuestion;
  n: number;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  /** Câu thuộc nhóm dùng chung bộ lựa chọn: chỉ chọn chữ cái, bộ lựa chọn hiện một lần ở đầu nhóm. */
  shared?: boolean;
}) {
  const kind = sheetKind(q);
  const text = plain(q.prompt);
  const hs = useSyllables();
  const rubySyl = rowRubySyllables(q, shared, hs);
  // Đề chữ thường: pinyin dưới từng chữ Hán khi ghép được, không thì chữ thường như cũ.
  const textNode = rubySyl ? (
    <span className="han-text ruby-line" lang="zh-Hans">
      <RubyRun text={text} syllables={rubySyl} />
    </span>
  ) : (
    <span>{text}</span>
  );

  if (shared) {
    const opts = items(q.config.options);
    const sel = value && "optionIds" in value ? value.optionIds[0] ?? "" : "";
    return (
      <div className="ps-shared">
        <span>{text}</span>
        <select className="ps-select ps-select-inline" value={sel} onChange={(e) => onChange({ optionIds: e.target.value ? [e.target.value] : [] })} aria-label={`Câu ${n}, chọn chữ cái`}>
          <option value="">—</option>
          {opts.map((o, i) => (
            <option key={o.id} value={o.id}>
              {letterOf(i)}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const prompt = rubySyl ? (
    <p className="han-text ruby-line ps-prompt" lang="zh-Hans">
      <RubyRun text={text} syllables={rubySyl} />
    </p>
  ) : (
    <SafeHtml html={plainToRichHtml(q.prompt)} className="prose prose-sm ps-prompt max-w-none dark:prose-invert" />
  );

  if (kind === "gap") {
    const blanks = Array.isArray(q.config.blanks) ? (q.config.blanks as Array<{ id: string }>) : [];
    const count = blankCountOf(q);
    const cur = value && "blanks" in value ? value.blanks : {};
    const txt = value && "text" in value ? value.text : "";
    const tr = splitTransform(text);
    // Gợi ý cách trả lời cuối đề ("(gõ một từ tiếng Trung, nghĩa: …)") hiện thành dòng riêng dưới câu, không chen vào cuối câu.
    const hint = splitTrailingHint(tr ? tr.rest : text);
    const segs = splitBlankPrompt(hint ? hint.main : tr ? tr.rest : text, count);
    // Đề chữ Hán có pinyin ghép được: pinyin dưới từng chữ ở các đoạn chữ (ô gõ nằm giữa); không có thì như cũ.
    const syl = rubySyl;
    const textSegs = segs.filter((s) => s.kind === "text") as Array<{ kind: "text"; text: string }>;
    const slices = syl ? sliceByHan(syl, textSegs.map((s) => s.text)) : null;
    let ti = 0;
    const parts = segs.map((s, i) => {
      if (s.kind === "text") {
        const sl = slices?.[ti++];
        return sl ? <RubyRun key={i} text={s.text} syllables={sl} /> : <span key={i}>{s.text}</span>;
      }
      const label = `Câu ${n}${count > 1 ? `, chỗ trống ${s.index + 1}` : ""}`;
      if (q.type === "short_answer" || blanks.length === 0) return <Blank key={i} value={txt} label={label} onChange={(v) => onChange({ text: v })} />;
      const b = blanks[s.index]!;
      return <Blank key={i} value={cur[b.id] ?? ""} label={label} onChange={(v) => onChange({ blanks: { ...cur, [b.id]: v } })} />;
    });
    return (
      <div>
        <div className={syl ? "han-text ruby-line" : undefined} lang={syl ? "zh-Hans" : undefined}>
          {tr ? (
            <>
              <span>{tr.head}</span> <span className="ps-key-inline">({tr.key})</span> <span className="ps-rewrite">{parts}</span>
            </>
          ) : (
            parts
          )}
        </div>
        {hint && (
          <p className="ps-hint" data-testid="ps-hint">
            <Keyboard size={14} aria-hidden />
            <span>{hint.how}</span>
            {hint.meaning && (
              <>
                <span aria-hidden>·</span>
                <span className="ps-hint-meaning">{hint.meaning}</span>
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  if (kind === "choice-inline") {
    const opts = items(q.config.options);
    const sel = value && "optionIds" in value ? value.optionIds[0] : undefined;
    const control = <InlineChoices options={opts} selected={sel} onPick={(id) => onChange({ optionIds: [id] })} />;
    const hasMarker = splitBlankPrompt(text, 1).some((s) => s.kind === "blank") && /_{3,}/.test(text);
    return hasMarker ? (
      <div className={rubySyl ? "han-text ruby-line" : undefined} lang={rubySyl ? "zh-Hans" : undefined}>
        <PromptWith prompt={q.prompt} control={control} syllables={rubySyl} />
      </div>
    ) : (
      <div>
        {textNode} 
        {control}
      </div>
    );
  }

  if (kind === "tfng") {
    const cur = value && "correct" in value ? value.correct : undefined;
    const opts = [
      { id: "true", label: "TRUE" },
      { id: "false", label: "FALSE" },
      { id: "notgiven", label: "NOT GIVEN" },
    ];
    return (
      <div>
        {textNode} 
        <InlineChoices options={opts} selected={cur} onPick={(id) => onChange({ correct: id as "true" | "false" | "notgiven" })} />
      </div>
    );
  }

  if (kind === "choice-list" || kind === "multi-list") {
    const opts = items(q.config.options);
    const single = kind === "choice-list";
    const selected = new Set(value && "optionIds" in value ? value.optionIds : []);
    const toggle = (id: string) => {
      const next = new Set(selected);
      if (single) {
        next.clear();
        next.add(id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange({ optionIds: Array.from(next) });
    };
    // Phương án đều ngắn (từ, lượng từ…): xếp thành một hàng ngang tự xuống dòng thay vì mỗi phương án một dòng, đỡ tốn chỗ.
    const compact = opts.length > 0 && opts.every((o) => [...o.label].length <= COMPACT_OPTION_CHARS);
    return (
      <div>
        {prompt}
        <ul className={`ps-opts${compact ? " ps-opts-row" : ""}`} data-compact={compact ? "" : undefined}>
          {opts.map((o, i) => (
            <li key={o.id}>
              <label className="ps-opt">
                <input className="ps-opt-input" type={single ? "radio" : "checkbox"} name={`ps-${q.id}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                <span className="ps-opt-text">
                  <span className="ps-letter">{letterOf(i)}</span>
                  <span>
                    <PinyinLabel text={o.label} />
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === "numerical") {
    const raw = value && "value" in value ? String(value.value) : "";
    return (
      <div>
        {textNode} 
        <Blank value={raw} inputMode="decimal" label={`Câu ${n}`} onChange={(v) => onChange({ value: v })} />
      </div>
    );
  }

  if (kind === "matching") {
    const { lefts, rights } = cleanMatchingLabels(items(q.config.lefts), items(q.config.rights));
    const matched = value && "matched" in value ? value.matched : {};
    const used = new Set(Object.values(matched).filter(Boolean));
    const set = (leftId: string, rightId: string) => {
      const next = { ...matched };
      if (rightId) next[leftId] = rightId;
      else delete next[leftId];
      onChange({ matched: next });
    };
    return (
      <div>
        {prompt}
        <ul className="ps-box" aria-label="Các vế để chọn">
          {rights.map((r, i) => (
            <li key={r.id} className={used.has(r.id) ? "ps-used" : undefined}>
              <span className="ps-letter">{letterOf(i)}.</span> <PinyinLabel text={r.label} />
            </li>
          ))}
        </ul>
        <ul className="ps-pairs ps-pairs-match">
          {lefts.map((l, i) => {
            const chosen = rights.findIndex((r) => r.id === matched[l.id]);
            return (
              <li key={l.id}>
                <span>
                  <span className="ps-sub">{i + 1}</span> <PinyinLabel text={l.label} />
                </span>
                <select className="ps-select ps-select-match" value={matched[l.id] ?? ""} onChange={(e) => set(l.id, e.target.value)} aria-label={`Câu ${n}, mục ${i + 1}`}>
                  <option value="">—</option>
                  {rights.map((r, j) => (
                    <option key={r.id} value={r.id}>
                      {/* Danh sách hiện cả nghĩa để chọn không phải tra chữ cái ở bảng trên; ô đóng chỉ thấy chữ cái (cắt bằng CSS). */}
                      {letterOf(j)} — {r.label}
                    </option>
                  ))}
                </select>
                {chosen >= 0 && (
                  <span className="ps-chosen">
                    → {letterOf(chosen)}) <PinyinLabel text={rights[chosen]!.label} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (kind === "ordering") return <OrderingRow q={q} n={n} value={value} onChange={onChange} prompt={prompt} />;

  if (kind === "drag") {
    const placed = value && "placed" in value ? value.placed : {};
    const segs = splitDragPrompt(text);
    // Đề chữ Hán có pinyin: pinyin dưới từng chữ ở các đoạn chữ, chỗ trống là một ô cùng cao với chữ có pinyin.
    const slices = rubySyl ? sliceByHan(rubySyl, segs.flatMap((s) => (s.kind === "text" ? [s.text] : []))) : null;
    return <DragFillDnd n={n} tokens={items(q.config.tokens)} segs={segs} slices={slices} placed={placed} onPlaced={(next) => onChange({ placed: next })} />;
  }

  // Dạng câu phiếu chưa biết dựng: dùng ô nhập của trình làm bài chung để câu vẫn trả lời được (không để một dòng chỉ có đề).
  // Chú giải đề do hàng phiếu vẽ (bên dưới RowBody), nên bỏ khỏi cấu hình đưa cho ExamQuestion để không hiện hai lần.
  return <ExamQuestion question={{ ...q, config: { ...q.config, promptAid: undefined } }} value={value} onChange={onChange} compact />;
}

/** Sắp xếp bằng kéo-thả (xem `PracticeDnd`): chỉ lưu khi mọi mảnh đã vào ô; giữ các mảnh đã đặt khi chuyển tab. */
function OrderingRow({ q, n, value, onChange, prompt }: { q: SheetQuestion; n: number; value: AnswerValue; onChange: (v: AnswerValue) => void; prompt: ReactNode }) {
  return <OrderingDnd n={n} items={items(q.config.items)} order={value && "order" in value ? value.order : null} onOrder={(order) => onChange({ order })} prompt={prompt} />;
}

/**
 * Thanh tab các bài tập. Tách riêng để đặt PHÍA TRÊN cả đoạn văn lẫn phiếu câu hỏi: bấm tab đổi cả hai, nên tab không được nằm gọn trong một cột.
 */
export function SheetTabBar({
  tabs,
  activeIdx,
  onTab,
  questions,
  answers,
  checks,
  standalone = false,
}: {
  tabs: SheetTab[];
  activeIdx: number;
  onTab: (i: number) => void;
  questions: Map<string, SheetQuestion>;
  answers: Record<string, AnswerValue>;
  checks: Record<string, SheetCheck>;
  /** Đứng riêng ngoài thẻ phiếu (không có đường kẻ dưới, không cần lề thẻ). */
  standalone?: boolean;
}) {
  const isEssay = (id: string) => questions.get(id)?.type === "essay";
  const answeredOf = (id: string) => isAnswered(answers[id] ?? null);
  const activeKey = tabs[activeIdx]?.key;
  useEffect(() => {
    // Hàng tab cuộn ngang: tab đang mở luôn nằm trong tầm nhìn (chỉ cuộn trong hàng tab, không cuộn cả trang).
    const el = document.getElementById(`ps-tab-${activeKey}`);
    const bar = el?.parentElement;
    if (!el || !bar || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [activeKey]);
  if (tabs.length <= 1) return null;

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const to = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onTab(to);
    setTimeout(() => document.getElementById(`ps-tab-${tabs[to]!.key}`)?.focus(), 0);
  }

  return (
    <div role="tablist" aria-label="Các bài tập" className={`ps-tabs ${standalone ? "ps-tabs-standalone" : ""}`} data-testid="ps-tabs">
      {tabs.map((t, i) => {
        const real = t.questionIds.filter((id) => !isEssay(id));
        const done = real.filter(answeredOf).length;
        const allChecked = real.length > 0 && real.every((id) => id in checks);
        return (
          <button
            key={t.key}
            id={`ps-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={i === activeIdx}
            aria-controls={`ps-panel-${t.key}`}
            tabIndex={i === activeIdx ? 0 : -1}
            onClick={() => onTab(i)}
            onKeyDown={(e) => onTabKey(e, i)}
            title={t.label}
            className="ps-tab"
          >
            <span className="ps-tab-label">{t.short ?? t.label}</span>
            {real.length > 0 && (allChecked || done > 0 || i === activeIdx) && (
              <span className={`ps-count ${allChecked ? "ps-count-done" : ""}`} aria-label={allChecked ? "Đã kiểm tra xong" : `Đã làm ${done} trên ${real.length} câu`}>
                {allChecked ? "✓" : `${done}/${real.length}`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Phương án trắc nghiệm có số ký tự (chữ Hán hay chữ cái) không quá ngưỡng này thì xếp một hàng ngang. */
export const COMPACT_OPTION_CHARS = 14;

export default function PracticeSheet({
  tabs,
  activeIdx,
  onTab,
  questions,
  numberOf,
  answers,
  onAnswer,
  checks,
  restoring,
  checkEnabled,
  batch,
  onCheck,
  renderEssay,
  renderReview,
  explanationOf,
  header,
  banner,
  hideTabs = false,
  pinyin = false,
}: {
  tabs: SheetTab[];
  activeIdx: number;
  onTab: (i: number) => void;
  questions: Map<string, SheetQuestion>;
  numberOf: Map<string, number>;
  answers: Record<string, AnswerValue>;
  onAnswer: (qid: string, v: AnswerValue) => void;
  checks: Record<string, SheetCheck>;
  restoring: Set<string>;
  checkEnabled: boolean;
  /** Đang kiểm tra nhiều câu: k / n. */
  batch: { done: number; total: number } | null;
  onCheck: (ids: string[]) => void;
  renderEssay: (qid: string) => ReactNode;
  /** Bài làm và đáp án đầy đủ cho hàng sai thuộc dạng chưa có đáp án bằng chữ (ghép, sắp xếp, kéo thả). */
  renderReview: (qid: string) => ReactNode;
  explanationOf: (config: unknown) => string | null;
  header: ReactNode;
  banner?: string | null;
  /** Thanh tab do nơi dùng vẽ ở ngoài (phía trên cả đoạn văn lẫn phiếu) để thấy tab đổi cả hai. */
  hideTabs?: boolean;
  /** Khoá tiếng Trung: đặt pinyin dưới chữ Hán của đề và các phương án (xem `PinyinLabel`). */
  pinyin?: boolean;
}) {
  // Chỉ nạp bộ tính pinyin khi phiếu thật sự có chữ Hán (khoá `vi` không phải tiếng Trung thì khỏi tải bảng).
  const hasHan = useMemo(() => pinyin && /[\u3400-\u9fff]/.test(JSON.stringify(Array.from(questions.values()))), [pinyin, questions]);
  const hs = useSyllableFn(hasHan);
  const tr = useT();
  const root = useRef<HTMLDivElement>(null);
  const isEssay = (id: string) => questions.get(id)?.type === "essay";
  const answeredOf = (id: string) => isAnswered(answers[id] ?? null);
  const state = {
    answered: answeredOf,
    checked: (id: string) => id in checks,
    correct: (id: string) => checks[id]?.isCorrect === true,
    restoring: (id: string) => restoring.has(id),
    isEssay,
  };
  const tab = tabs[activeIdx] ?? tabs[0]!;
  const allIds = tabs.flatMap((t) => t.questionIds);
  const hereTodo = questionsToCheck(tab.questionIds, state);
  const allTodo = questionsToCheck(allIds, state);
  const isLast = activeIdx >= tabs.length - 1;
  const status = sheetStatus(tab.questionIds, state);
  const hasCheckable = tab.questionIds.some((id) => !isEssay(id));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== "Enter" || !el.matches("[data-ps-input]")) return;
    e.preventDefault();
    const panel = el.closest("[role=tabpanel]");
    const inputs = Array.from(panel?.querySelectorAll<HTMLElement>("[data-ps-input]") ?? []);
    const next = inputs[inputs.indexOf(el) + 1];
    if (next) next.focus();
    else root.current?.querySelector<HTMLElement>("[data-ps-check]")?.focus();
  }

  function renderRow(qid: string, shared = false) {
    const q = questions.get(qid);
    if (!q) return null;
    if (q.type === "essay") return <div key={qid}>{renderEssay(qid)}</div>;
    const n = numberOf.get(qid) ?? 0;
    const res = checks[qid];
    const graded = !!res && !res.manual;
    const ok = graded && res.isCorrect === true;
    let reveal = graded && !ok ? revealText(q.type, res.config) : null;
    if (reveal && shared) {
      // Nhóm dùng chung bộ lựa chọn: đáp án đúng ghi cả chữ cái để đối chiếu với bộ lựa chọn ở đầu nhóm.
      const labels = optionLabelsOf(q.config);
      const idx = labels.indexOf(reveal);
      if (idx >= 0) reveal = `${letterOf(idx)}) ${reveal}`;
    }
    const expl = graded && !ok ? explanationOf(res.config) : null;
    return (
      <div key={qid} id={`lp-${qid}`} className="ps-row" data-state={graded ? (ok ? "ok" : "no") : undefined}>
        <span className="ps-n">{n}</span>
        <div className="ps-body">
          {/* Câu hỏi về cách đọc: pinyin dưới chữ Hán (và dòng pinyin của đề) sẽ lộ đáp án, nên tắt cả phần tự tính lẫn của tác giả. */}
          <PinyinProvider value={hidesPinyin(q) ? null : hs}>
            <RowBody q={q} n={n} value={answers[qid] ?? null} onChange={(v) => onAnswer(qid, v)} shared={shared} />
          </PinyinProvider>
          {!shared && <PromptAid config={q.config} hideReading={hidesPinyin(q) || !!rowRubySyllables(q, false, hs)} />}
        </div>
        <span className="ps-mark">
          {graded && (
            <span role="img" aria-label={ok ? "Đúng" : "Sai"} className={ok ? "ps-ok" : "ps-no"}>
              {ok ? "✓" : "✗"}
            </span>
          )}
        </span>
        {graded && !ok && (reveal || expl) && (
          <div className="ps-fix" role="status">
            {reveal && (
              <div>
                → <PinyinLabel text={reveal} />
              </div>
            )}
            {expl && (
              <div className="ps-expl">
                <PinyinLabel text={expl} />
              </div>
            )}
          </div>
        )}
        {graded && !ok && !reveal && (
          <div className="ps-fix ps-review" role="status">
            {expl && (
              <div className="ps-expl">
                <PinyinLabel text={expl} />
              </div>
            )}
            {/* Khối dài (ghép cặp, sắp xếp, kéo thả): gập sẵn cho đỡ tốn diện tích, bấm mới mở. */}
            <details className="ps-review-details">
              <summary>Xem bài làm và đáp án</summary>
              {renderReview(qid)}
            </details>
          </div>
        )}
        {!res && restoring.has(qid) && <div className="ps-fix ps-hint">Đang tải kết quả đã kiểm tra…</div>}
      </div>
    );
  }

  return (
    <PinyinProvider value={hs}>
    <div ref={root} className="practice-sheet" data-testid="practice-sheet" onKeyDown={onKeyDown}>
      <div className="ps-head">
        {banner && (
          <div className="ps-banner">
            <span className="ps-banner-k">{banner}</span>
          </div>
        )}
        {header}
      </div>
      {!hideTabs && (
        <SheetTabBar tabs={tabs} activeIdx={activeIdx} onTab={onTab} questions={questions} answers={answers} checks={checks} />
      )}
      {tabs.map((t, i) => (
        <div key={t.key} id={`ps-panel-${t.key}`} role="tabpanel" aria-labelledby={tabs.length > 1 ? `ps-tab-${t.key}` : undefined} hidden={i !== activeIdx} className="ps-panel">
          {t.intro && t.introTitle && (
            <header className="ps-intro-head">
              <h2 className="text-h4 flex items-center gap-2.5">
                {t.introIcon && (
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700" aria-hidden>
                    {t.introIcon}
                  </span>
                )}
                {t.introTitle}
              </h2>
              <div className="mt-1.5 h-1 w-12 rounded-full bg-brand-gradient" aria-hidden />
            </header>
          )}
          {t.intro && (typeof t.intro === "string" ? <p className="ps-intro">{t.intro}</p> : <div className="ps-intro-media">{t.intro}</div>)}
          {t.questionIds.length === 0 && <p className="ps-hint ps-empty">Phần này chỉ có nội dung để nghe hoặc đọc, không có câu hỏi.</p>}
          {(tabs.length > 1 || hideTabs) && !t.introTitle && (
            // Tab đang chọn mở đầu bằng tên khối và số câu (thanh tab chỉ có nhãn ngắn).
            <header className="ps-tabtitle">
              {!t.hideTitle && <h2 className="text-h4">{t.label}</h2>}
              <span className="ps-tabtitle-n">{tr("practice.sheet.count", { n: t.questionIds.filter((id) => questions.get(id)?.type !== "essay").length || t.questionIds.length })}</span>
            </header>
          )}
          {(() => {
            const runs = groupSharedOptions(
              t.questionIds.map((id) => {
                const q = questions.get(id);
                return { id, type: q?.type ?? "", labels: q ? optionLabelsOf(q.config) : [] };
              }),
            );
            // Dòng yêu cầu: bài tập đã có câu yêu cầu riêng (đoạn văn/`intro`) thì thôi; không thì theo `config.instruction` hoặc mặc định theo dạng câu.
            const firstOf = (run: (typeof runs)[number]) => questions.get(run.kind === "single" ? run.id : run.ids[0]!);
            const plan = instructionPlan(
              runs.map((run) => {
                const q = firstOf(run);
                const explicit = q && typeof q.config.instruction === "string" ? q.config.instruction : null;
                return { kind: q ? (q.type === "essay" ? "essay" : sheetKind(q)) : "other", prompt: q ? plain(q.prompt) : "", instruction: explicit };
              }),
            );
            return runs.map((run, ri) => {
              const p = t.intro ? null : plan[ri];
              const line = p ? (p.key ? tr(p.key as Parameters<typeof tr>[0]) : p.text) : null;
              return (
                <Fragment key={run.kind === "single" ? run.id : run.ids[0]}>
                  {line && (
                    <p className="ps-instr" data-testid="ps-instr">
                      {line}
                    </p>
                  )}
                  {run.kind === "single" ? (
                    renderRow(run.id)
                  ) : (
                    <div className="ps-group">
                      <ul className="ps-box ps-legend" aria-label="Các lựa chọn dùng chung">
                        {run.labels.map((l, i) => (
                          <li key={i}>
                            <span className="ps-letter">{letterOf(i)})</span> <PinyinLabel text={l} />
                          </li>
                        ))}
                      </ul>
                      {run.ids.map((id) => renderRow(id, true))}
                    </div>
                  )}
                </Fragment>
              );
            });
          })()}
        </div>
      ))}
      <div className="ps-foot">
        <span className="ps-status" aria-live="polite">
          {batch ? `Đang kiểm tra… (${batch.done}/${batch.total})` : status || (hasCheckable && checkEnabled ? "Làm xong thì bấm kiểm tra." : "")}
        </span>
        {checkEnabled && hasCheckable && (
          <span className="ps-actions">
            <button type="button" data-ps-check className="btn-primary btn-sm disabled:opacity-50" disabled={!!batch || hereTodo.length === 0} onClick={() => onCheck(hereTodo)}>
              Kiểm tra bài này
            </button>
            {tabs.length > 1 && isLast && (
              <button type="button" className="btn-ghost btn-sm disabled:opacity-50" disabled={!!batch || allTodo.length === 0} onClick={() => onCheck(allTodo)}>
                Kiểm tra tất cả
              </button>
            )}
          </span>
        )}
      </div>
    </div>
    </PinyinProvider>
  );
}


/**
 * Pinyin dưới từng chữ Hán của đề: mọi dạng câu RowBody vẽ bằng chữ thường, kể cả đề có ô trống/ô chọn giữa câu; dạng "viết lại câu (từ khoá)" giữ cách hiện cũ.
 * Lấy pinyin tác giả viết (`promptAid.reading`) khi ghép được từng chữ; đề không có pinyin tác giả thì tự tính (`hs`, khoá tiếng Trung). Trả dãy âm tiết cho cả đề, không thì null.
 */
/** Câu hỏi này không được hiện pinyin dưới chữ Hán (xem `questionHidesPinyin`). */
function hidesPinyin(q: SheetQuestion): boolean {
  return questionHidesPinyin(plain(q.prompt), q.config);
}

function rowRubySyllables(q: SheetQuestion, shared = false, hs: SyllableFn | null = null): string[] | null {
  if (shared || questionHidesPinyin(plain(q.prompt), q.config)) return null;
  const kind = sheetKind(q);
  if (!["gap", "choice-inline", "tfng", "numerical", "choice-list", "multi-list", "matching", "ordering", "drag"].includes(kind)) return null;
  const text = plain(q.prompt);
  if (kind === "gap" && splitTransform(text)) return null;
  const reading = parsePromptAid(q.config)?.reading;
  // Pinyin tác giả viết (ghép được từng chữ) luôn được ưu tiên.
  const authored = promptSyllables(text, reading);
  if (authored) return authored;
  // Có pinyin tác giả mà không ghép được: giữ dòng pinyin riêng như cũ (không thay bằng pinyin tự tính để khỏi mất bản của tác giả).
  if (reading || !hs || /[\n\r<>]/.test(text)) return null;
  const auto = hs(text);
  return auto && auto.some(Boolean) ? auto : null;
}
