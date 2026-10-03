"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ClipboardPaste,
  Eye,
  Headphones,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import VocabListView from "@/components/VocabListView";
import DialogueView from "@/components/DialogueView";
import { useExclusiveAudio } from "@/components/useExclusiveAudio";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import { AUDIO_UPLOAD_ACCEPT } from "@/lib/lessonAudio";
import { uploadLessonAudio } from "@/lib/uploadLessonAudio";
import AiVocabImportPanel from "@/components/instructor/AiVocabImportPanel";
import type { AiVocabItem } from "@/lib/aiVocabImport";
import {
  parseDialoguePaste,
  parseVocabPaste,
  splitDuplicateTerms,
  type PasteError,
  type VocabDraft,
} from "@/lib/langBlocks";
import {
  emptyTurn,
  emptyVocabItem,
  moveItem,
  nextSpeaker,
  type DialogueEditorValue,
  type TurnEditorItem,
  type VocabEditorItem,
  type VocabEditorValue,
} from "@/lib/langBlockEditor";

/**
 * LANG G2 — bộ soạn bảng từ vựng và hội thoại, dùng chung cho form Thêm và form Sửa.
 * Giá trị là state "chuỗi" của lib/langBlockEditor.ts; `id` của dòng/lượt đi
 * nguyên qua form nên các lần sửa giữ được id ổn định.
 */

/** Dòng nháp trước khi vào danh sách: dán bảng chỉ có 4 trường đầu, AI có thể có đủ. */
type VocabDraftFull = VocabDraft & { exampleReading?: string; exampleMeaning?: string; note?: string };

const MAX_SHOWN_ERRORS = 8;

function PasteErrors({ errors }: { errors: PasteError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="banner-danger text-xs" role="alert">
      <p className="font-medium">{errors.length} dòng chưa nhập được (đã giữ lại trong ô để bạn sửa):</p>
      <ul className="mt-1 list-disc pl-4">
        {errors.slice(0, MAX_SHOWN_ERRORS).map((e) => (
          <li key={e.line}>
            Dòng {e.line}: {e.reason}
          </li>
        ))}
        {errors.length > MAX_SHOWN_ERRORS && <li>… và {errors.length - MAX_SHOWN_ERRORS} dòng khác.</li>}
      </ul>
    </div>
  );
}

/** Audio của một dòng/lượt: upload, nghe thử, xoá. */
function RowTools({
  index,
  count,
  onMove,
  onRemove,
  noun,
}: {
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  noun: string;
}) {
  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-token hover:bg-brand-soft disabled:opacity-40";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Đưa ${noun} ${index + 1} lên`}>
        <ArrowUp size={14} aria-hidden />
      </button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Đưa ${noun} ${index + 1} xuống`}>
        <ArrowDown size={14} aria-hidden />
      </button>
      <button type="button" className={btn} onClick={onRemove} aria-label={`Xoá ${noun} ${index + 1}`}>
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}

const isBlankVocab = (i: VocabEditorItem) =>
  [i.term, i.reading, i.meaning, i.example, i.exampleReading, i.exampleMeaning, i.note, i.audioUrl].every((x) => x.trim() === "");
const isBlankTurn = (t: TurnEditorItem) =>
  [t.speaker, t.text, t.reading, t.translation, t.audioUrl].every((x) => x.trim() === "");

/** Bỏ các dòng trống trước khi nối thêm dòng dán vào, để không để lại dòng rỗng ở đầu. */
const dropBlankVocab = (items: VocabEditorItem[]) => items.filter((i) => !isBlankVocab(i));
const dropBlankTurns = (turns: TurnEditorItem[]) => turns.filter((t) => !isBlankTurn(t));

type Method = "type" | "paste" | "ai";

const METHODS: Array<{ key: Method; icon: typeof Pencil; title: string; hint: string }> = [
  { key: "type", icon: Pencil, title: "Gõ từng từ", hint: "Điền trực tiếp vào danh sách bên dưới" },
  { key: "paste", icon: ClipboardPaste, title: "Dán từ Excel", hint: "Copy nhiều dòng từ Excel hoặc Google Sheets" },
  { key: "ai", icon: Sparkles, title: "Nhập bằng AI", hint: "Dán văn bản thô, AI tách từ giúp bạn" },
];

/** Nhãn nhỏ luôn hiện trên ô nhập — placeholder biến mất khi gõ nên không đủ để biết ô nào là gì. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Audio của một dòng, dạng gọn: chưa có → nút "Thêm audio"; có rồi → nghe thử / đổi / xoá. */
function AudioChip({ id, url, onChange, label }: { id: string; url: string; onChange: (u: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { playingId, toggle } = useExclusiveAudio();
  const playing = playingId === id;
  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-token hover:bg-brand-soft";

  async function pick(file: File) {
    setBusy(true);
    setErr(null);
    const r = await uploadLessonAudio(file);
    setBusy(false);
    if (r.ok) onChange(r.url);
    else setErr(lmsErrorMessage(r.error, r.status));
  }

  const picker = (text: string, icon: boolean) => (
    <label className={`inline-flex cursor-pointer items-center gap-1.5 text-xs ${icon ? btn : "rounded-lg border border-dashed border-token px-2.5 py-1.5 hover:bg-brand-soft"}`}>
      {icon ? <Headphones size={14} aria-label={text} /> : <><Headphones size={14} aria-hidden />{text}</>}
      <input
        type="file"
        accept={AUDIO_UPLOAD_ACCEPT}
        disabled={busy}
        aria-label={`${text} cho ${label}`}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
    </label>
  );

  return (
    <div className="space-y-1">
      {busy ? (
        <span className="text-xs text-muted">Đang tải audio lên...</span>
      ) : url ? (
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-brand-100 py-0.5 pl-2.5 pr-0.5">
          <span className="whitespace-nowrap text-xs font-medium text-brand-700">Có audio</span>
          <button type="button" className={btn} onClick={() => toggle(id, url)} aria-pressed={playing} aria-label={`Nghe thử audio của ${label}`}>
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          </button>
          {picker("Đổi audio", true)}
          <button type="button" className={btn} onClick={() => onChange("")} aria-label={`Bỏ audio của ${label}`}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : (
        picker("Thêm audio", false)
      )}
      {err && <p className="text-xs text-danger-600">{err}</p>}
    </div>
  );
}

/**
 * Dòng đang soạn (dòng cuối) chưa nên bị báo thiếu: vừa bấm Enter thêm dòng mới mà đã thấy
 * cảnh báo vàng thì khó chịu. Chỉ báo sau khi con trỏ rời khỏi dòng đó; các dòng phía
 * trên vẫn báo ngay. `onBlur` gắn ở thẻ <li> nên chuyển ô trong cùng dòng không tính là rời.
 */
function useLeftRows() {
  const [left, setLeft] = useState<Set<string>>(new Set());
  const markLeft = (id: string, e: React.FocusEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setLeft((cur) => (cur.has(id) ? cur : new Set(cur).add(id)));
  };
  return { left, markLeft };
}

/** Lý do dòng chưa hợp lệ, nói bằng lời — hiện ngay dưới dòng chứ không đợi bấm Tạo mới biết. */
function vocabRowHint(i: VocabEditorItem): string | null {
  const hasTerm = i.term.trim() !== "";
  const hasMeaning = i.meaning.trim() !== "";
  if (hasTerm && !hasMeaning) return "Chưa có nghĩa — dòng này sẽ không lưu được.";
  if (!hasTerm && hasMeaning) return "Chưa có từ — dòng này sẽ không lưu được.";
  return null;
}

export function VocabListEditor({
  value,
  onChange,
}: {
  value: VocabEditorValue;
  onChange: (v: VocabEditorValue) => void;
}) {
  const [method, setMethod] = useState<Method>("type");
  const [pasteText, setPasteText] = useState("");
  const [pasteErrors, setPasteErrors] = useState<PasteError[]>([]);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [pendingDup, setPendingDup] = useState<VocabDraftFull[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const { left, markLeft } = useLeftRows();
  const readingLabel = value.readingLabel.trim() || "Phiên âm";

  // Sau khi thêm dòng mới thì đưa con trỏ vào ô "Từ" của dòng đó.
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`vocab-term-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const setItems = (items: VocabEditorItem[]) => onChange({ ...value, items });
  const patch = (idx: number, p: Partial<VocabEditorItem>) =>
    setItems(value.items.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const addRow = () => {
    const row = emptyVocabItem();
    setItems([...value.items, row]);
    setFocusId(row.id);
  };
  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toItem = (d: VocabDraftFull): VocabEditorItem => ({
    ...emptyVocabItem(),
    term: d.term,
    reading: d.reading ?? "",
    meaning: d.meaning,
    example: d.example ?? "",
    exampleReading: d.exampleReading ?? "",
    exampleMeaning: d.exampleMeaning ?? "",
    note: d.note ?? "",
  });

  /**
   * Thêm các dòng nháp vào danh sách — dùng chung cho dán bảng và nhập bằng AI, nên cả
   * hai đều qua đúng bước nhận biết từ trùng: dòng mới thêm ngay, dòng trùng chờ giảng
   * viên quyết định.
   */
  function addDrafts(parsed: VocabDraftFull[]): { added: number; dupes: number } {
    const existingTerms = dropBlankVocab(value.items).map((i) => ({ term: i.term }));
    const { fresh, duplicates } = splitDuplicateTerms(existingTerms, parsed);
    if (fresh.length) {
      setItems([...dropBlankVocab(value.items), ...fresh.map(toItem)]);
    }
    setPendingDup(duplicates);
    return { added: fresh.length, dupes: duplicates.length };
  }

  function importPaste() {
    const { items: parsed, errors } = parseVocabPaste(pasteText);
    const { added, dupes } = addDrafts(parsed);
    setPasteErrors(errors);
    setPasteNote(
      added || dupes || errors.length
        ? `Đã thêm ${added} từ${dupes ? `; ${dupes} từ trùng đang chờ bạn quyết định` : ""}.`
        : "Chưa có gì để nhập.",
    );
    setPasteText(errors.map((e) => e.raw).join("\n"));
  }

  function importAi(aiItems: AiVocabItem[]) {
    const { added, dupes } = addDrafts(aiItems.map(({ filled: _f, ...draft }) => draft));
    setPasteErrors([]);
    setPasteNote(
      `Đã thêm ${added} từ do AI trích xuất${dupes ? `; ${dupes} từ trùng đang chờ bạn quyết định` : ""}. Hãy kiểm tra lại trước khi lưu.`,
    );
    setMethod("type"); // quay về danh sách để kiểm tra các dòng vừa thêm
  }

  function addDuplicates() {
    setItems([...dropBlankVocab(value.items), ...pendingDup.map(toItem)]);
    setPasteNote(`Đã thêm ${pendingDup.length} từ trùng.`);
    setPendingDup([]);
  }

  const filled = value.items.filter((i) => i.term.trim() && i.meaning.trim());
  const withAudio = value.items.filter((i) => i.audioUrl).length;
  const previewItems = filled.map((i) => ({
    id: i.id,
    term: i.term.trim(),
    meaning: i.meaning.trim(),
    ...(i.reading.trim() ? { reading: i.reading.trim() } : {}),
    ...(i.example.trim() ? { example: i.example.trim() } : {}),
    ...(i.exampleReading.trim() ? { exampleReading: i.exampleReading.trim() } : {}),
    ...(i.exampleMeaning.trim() ? { exampleMeaning: i.exampleMeaning.trim() } : {}),
    ...(i.note.trim() ? { note: i.note.trim() } : {}),
    ...(i.audioUrl ? { audioUrl: i.audioUrl } : {}),
  }));

  return (
    <div className="space-y-6">
      {/* 1. Thông tin chung của khối */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="vocab-title" className="mb-1 block text-sm font-medium">Tiêu đề khối</label>
          <input id="vocab-title" className="input" maxLength={200} value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Vd: Từ mới bài 5" />
          <p className="mt-1 text-xs text-muted">Hiện phía trên bảng từ của học viên.</p>
        </div>
        <div>
          <label htmlFor="vocab-reading-label" className="mb-1 block text-sm font-medium">Nhãn cột phiên âm</label>
          <input id="vocab-reading-label" className="input" maxLength={40} value={value.readingLabel}
            onChange={(e) => onChange({ ...value, readingLabel: e.target.value })} placeholder="Vd: Pinyin, IPA" />
          <p className="mt-1 text-xs text-muted">Bỏ trống thì học viên thấy chữ “Phiên âm”.</p>
        </div>
      </div>

      {/* 2. Chọn cách thêm từ — ba lựa chọn nhìn thấy ngay, thay cho hai khung đóng sẵn */}
      <section aria-labelledby="vocab-how">
        <h3 id="vocab-how" className="mb-2 text-sm font-medium">Cách thêm từ</h3>
        <div role="tablist" aria-label="Cách thêm từ" className="grid grid-cols-3 gap-2">
          {METHODS.map(({ key, icon: Icon, title, hint }) => {
            const on = method === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="vocab-method-panel"
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors sm:flex-row sm:items-start sm:gap-3 sm:text-left ${
                  on ? "border-brand-400 bg-brand-100 shadow-sm" : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-white text-brand-700" : "bg-[rgb(var(--surface-muted))] text-muted"}`}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${on ? "text-brand-700" : ""}`}>{title}</span>
                  <span className="hidden text-xs text-muted sm:block">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {method !== "type" && (
          <div id="vocab-method-panel" role="tabpanel" className="mt-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
            {method === "paste" ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Mỗi từ một dòng. Các cột cách nhau bằng tab (copy thẳng từ bảng tính) hoặc dấu <code>|</code>:
                </p>
                <p className="rounded-lg bg-[rgb(var(--surface))] px-3 py-2 text-xs text-muted">
                  <strong>2 cột</strong>: từ · nghĩa &nbsp;|&nbsp; <strong>3 cột</strong>: từ · phiên âm · nghĩa &nbsp;|&nbsp;{" "}
                  <strong>4 cột</strong>: thêm câu ví dụ
                </p>
                <textarea className="input font-mono text-sm" rows={6} value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)} aria-label="Dán bảng từ vựng"
                  placeholder={"朋友 | péngyou | bạn bè | 他是我的朋友。\n你好 | nǐ hǎo | xin chào"} />
                <button type="button" className="btn-primary text-sm" onClick={importPaste} disabled={!pasteText.trim()}>
                  Thêm vào danh sách
                </button>
                <PasteErrors errors={pasteErrors} />
              </div>
            ) : (
              <AiVocabImportPanel onAdd={importAi} />
            )}
          </div>
        )}

        {/* Kết quả thêm + hỏi từ trùng: dùng chung cho dán bảng và AI. */}
        {pasteNote && <p className="mt-3 text-sm text-brand-700" role="status">{pasteNote}</p>}
        {pendingDup.length > 0 && (
          <div className="banner-warning mt-3 text-sm">
            <p className="font-medium">
              {pendingDup.length} từ đã có trong khối: {pendingDup.slice(0, 6).map((d) => d.term).join(", ")}
              {pendingDup.length > 6 ? "…" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded-lg border border-token bg-white px-3 py-1" onClick={addDuplicates}>
                Vẫn thêm {pendingDup.length} từ trùng
              </button>
              <button type="button" className="rounded-lg border border-token bg-white px-3 py-1" onClick={() => setPendingDup([])}>
                Bỏ qua từ trùng
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. Danh sách từ */}
      <section aria-labelledby="vocab-list">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="vocab-list" className="text-sm font-medium">Danh sách từ</h3>
          <p className="text-xs text-muted" aria-live="polite">
            {`${filled.length} từ`}
            {withAudio > 0 ? ` · ${withAudio} có audio` : ""}
          </p>
        </div>

        <ol className="space-y-3">
          {value.items.map((it, idx) => {
            const isLast = idx === value.items.length - 1;
            const hint = !isLast || left.has(it.id) ? vocabRowHint(it) : null;
            const extra = !!(it.example || it.exampleReading || it.exampleMeaning || it.note);
            const expanded = open.has(it.id) || extra;
            return (
              <li key={it.id} onBlur={(e) => markLeft(it.id, e)} className={`rounded-xl border bg-[rgb(var(--surface))] p-3 ${hint ? "border-warning-300" : "border-token"}`}>
                <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2">
                  <span aria-hidden className="col-start-1 row-start-1 flex h-7 w-7 items-center justify-center self-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 sm:mt-5 sm:self-start">
                    {idx + 1}
                  </span>
                  <div className="col-span-3 row-start-2 min-w-0 space-y-2.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
                      <Field label="Từ">
                        <input id={`vocab-term-${it.id}`} className="input" maxLength={200} value={it.term}
                          onChange={(e) => patch(idx, { term: e.target.value })} placeholder="vd: 朋友"
                          aria-label={`Từ ${idx + 1}`} />
                      </Field>
                      <Field label={readingLabel}>
                        <input className="input" maxLength={200} value={it.reading}
                          onChange={(e) => patch(idx, { reading: e.target.value })} placeholder="vd: péngyou"
                          aria-label={`${readingLabel} của từ ${idx + 1}`} />
                      </Field>
                      <div className="col-span-2 sm:col-span-1">
                      <Field label="Nghĩa">
                        <input className="input" maxLength={500} value={it.meaning}
                          onChange={(e) => patch(idx, { meaning: e.target.value })} placeholder="vd: bạn bè"
                          aria-label={`Nghĩa của từ ${idx + 1}`}
                          onKeyDown={(e) => {
                            // Enter ở dòng cuối: thêm dòng mới ngay, gõ liền tay không cần chạm chuột.
                            if (e.key === "Enter" && isLast && it.term.trim() && it.meaning.trim()) {
                              e.preventDefault();
                              addRow();
                            }
                          }} />
                      </Field>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <AudioChip id={it.id} url={it.audioUrl} onChange={(audioUrl) => patch(idx, { audioUrl })} label={`từ ${idx + 1}`} />
                      <button
                        type="button"
                        onClick={() => toggleOpen(it.id)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-token px-2.5 py-1.5 text-xs hover:bg-brand-soft"
                      >
                        <ChevronDown size={14} aria-hidden className={expanded ? "rotate-180" : ""} />
                        {expanded ? "Ẩn ví dụ và ghi chú" : extra ? "Ví dụ và ghi chú (đã có)" : "Thêm ví dụ và ghi chú"}
                      </button>
                    </div>

                    {expanded && (
                      <div className="space-y-2 rounded-lg bg-[rgb(var(--surface-muted))] p-3">
                        <Field label="Câu ví dụ">
                          <input className="input" maxLength={1000} value={it.example}
                            onChange={(e) => patch(idx, { example: e.target.value })} placeholder="vd: 他是我的朋友。"
                            aria-label={`Câu ví dụ của từ ${idx + 1}`} />
                        </Field>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label={`${readingLabel} của câu ví dụ`}>
                            <input className="input" maxLength={1000} value={it.exampleReading}
                              onChange={(e) => patch(idx, { exampleReading: e.target.value })}
                              aria-label={`${readingLabel} câu ví dụ ${idx + 1}`} />
                          </Field>
                          <Field label="Nghĩa của câu ví dụ">
                            <input className="input" maxLength={1000} value={it.exampleMeaning}
                              onChange={(e) => patch(idx, { exampleMeaning: e.target.value })}
                              aria-label={`Nghĩa câu ví dụ ${idx + 1}`} />
                          </Field>
                        </div>
                        <Field label="Ghi chú cho học viên">
                          <input className="input" maxLength={500} value={it.note}
                            onChange={(e) => patch(idx, { note: e.target.value })} placeholder="vd: âm tiết sau đọc nhẹ"
                            aria-label={`Ghi chú của từ ${idx + 1}`} />
                        </Field>
                      </div>
                    )}

                    {hint && <p className="text-xs text-warning-700" role="status">{hint}</p>}
                  </div>
                  <div className="col-start-3 row-start-1 justify-self-end">
                    <RowTools index={idx} count={value.items.length} noun="từ"
                      onMove={(d) => setItems(moveItem(value.items, idx, d))}
                      onRemove={() => setItems(value.items.length > 1 ? value.items.filter((_, i) => i !== idx) : [emptyVocabItem()])} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <button type="button" onClick={addRow}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-soft/40 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-soft sm:w-auto">
          <Plus size={16} aria-hidden /> Thêm từ
        </button>
      </section>

      {/* 4. Xem trước đúng như học viên thấy */}
      <details className="rounded-xl border border-token">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
          <Eye size={16} aria-hidden /> Xem trước như học viên
          <span className="text-xs font-normal text-muted">({filled.length} từ)</span>
        </summary>
        <div className="border-t border-token p-4">
          {previewItems.length === 0 ? (
            <p className="text-sm text-muted">Điền ít nhất một từ có đủ “Từ” và “Nghĩa” để xem trước.</p>
          ) : (
            <VocabListView title={value.title.trim() || undefined} readingLabel={value.readingLabel.trim() || undefined} items={previewItems} />
          )}
        </div>
      </details>
    </div>
  );
}

type DialogueMethod = "type" | "paste";

const DIALOGUE_METHODS: Array<{ key: DialogueMethod; icon: typeof Pencil; title: string; hint: string }> = [
  { key: "type", icon: Pencil, title: "Gõ từng lượt", hint: "Điền trực tiếp vào danh sách bên dưới" },
  { key: "paste", icon: ClipboardPaste, title: "Dán cả đoạn", hint: "Dán đoạn hội thoại, tự tách người nói" },
];

/** Lý do lượt chưa hợp lệ, nói bằng lời — hiện ngay dưới lượt. */
function turnRowHint(t: TurnEditorItem): string | null {
  const hasSpeaker = t.speaker.trim() !== "";
  const hasText = t.text.trim() !== "";
  if (hasSpeaker && !hasText) return "Chưa có lời thoại — lượt này sẽ không lưu được.";
  if (!hasSpeaker && (hasText || t.reading.trim() || t.translation.trim()))
    return "Chưa có người nói — lượt này sẽ không lưu được.";
  return null;
}

export function DialogueEditor({
  value,
  onChange,
}: {
  value: DialogueEditorValue;
  onChange: (v: DialogueEditorValue) => void;
}) {
  const [method, setMethod] = useState<DialogueMethod>("type");
  const [pasteText, setPasteText] = useState("");
  const [pasteErrors, setPasteErrors] = useState<PasteError[]>([]);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const { left, markLeft } = useLeftRows();
  const readingLabel = value.readingLabel.trim() || "Phiên âm";

  // Sau khi thêm lượt mới thì đưa con trỏ vào ô lời thoại của lượt đó (người nói đã được gợi ý sẵn).
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`dlg-text-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const setTurns = (turns: TurnEditorItem[]) => onChange({ ...value, turns });
  const patch = (idx: number, p: Partial<TurnEditorItem>) =>
    setTurns(value.turns.map((t, i) => (i === idx ? { ...t, ...p } : t)));
  const addRow = () => {
    const row = { ...emptyTurn(), speaker: nextSpeaker(value.turns) };
    setTurns([...value.turns, row]);
    setFocusId(row.id);
  };
  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function importPaste() {
    const { turns, errors } = parseDialoguePaste(pasteText);
    if (turns.length) {
      setTurns([...dropBlankTurns(value.turns), ...turns.map((t) => ({ ...emptyTurn(), speaker: t.speaker, text: t.text }))]);
    }
    setPasteErrors(errors);
    setPasteNote(turns.length || errors.length ? `Đã thêm ${turns.length} lượt.` : "Chưa có gì để nhập.");
    setPasteText(errors.map((e) => e.raw).join("\n"));
    if (turns.length && !errors.length) setMethod("type"); // quay về danh sách để kiểm tra các lượt vừa thêm
  }

  const filled = value.turns.filter((t) => t.speaker.trim() && t.text.trim());
  const withAudio = value.turns.filter((t) => t.audioUrl).length;
  const previewTurns = filled.map((t) => ({
    id: t.id,
    speaker: t.speaker.trim(),
    text: t.text.trim(),
    ...(t.reading.trim() ? { reading: t.reading.trim() } : {}),
    ...(t.translation.trim() ? { translation: t.translation.trim() } : {}),
    ...(t.audioUrl ? { audioUrl: t.audioUrl } : {}),
  }));

  return (
    <div className="space-y-6">
      {/* 1. Thông tin chung */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="dlg-title" className="mb-1 block text-sm font-medium">Tiêu đề hội thoại</label>
          <input id="dlg-title" className="input" maxLength={200} value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Vd: Hội thoại bài 5" />
          <p className="mt-1 text-xs text-muted">Hiện phía trên đoạn hội thoại của học viên.</p>
        </div>
        <div>
          <label htmlFor="dlg-reading-label" className="mb-1 block text-sm font-medium">Nhãn dòng phiên âm</label>
          <input id="dlg-reading-label" className="input" maxLength={40} value={value.readingLabel}
            onChange={(e) => onChange({ ...value, readingLabel: e.target.value })} placeholder="Vd: Pinyin, IPA" />
          <p className="mt-1 text-xs text-muted">Bỏ trống thì học viên thấy chữ “Phiên âm”.</p>
        </div>
      </div>
      <div>
        <label htmlFor="dlg-caption" className="mb-1 block text-sm font-medium">Hướng dẫn cho học viên <span className="font-normal text-muted">(không bắt buộc)</span></label>
        <input id="dlg-caption" className="input" maxLength={600} value={value.caption}
          onChange={(e) => onChange({ ...value, caption: e.target.value })} placeholder="Vd: Nghe cả đoạn một lần rồi nghe từng câu." />
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Audio cả đoạn <span className="font-normal text-muted">(không bắt buộc)</span></p>
        <p className="mb-2 text-xs text-muted">Một file ghi âm toàn bộ hội thoại. Audio riêng từng lượt thêm ở danh sách bên dưới.</p>
        <AudioChip id="dlg-whole" url={value.audioUrl} onChange={(audioUrl) => onChange({ ...value, audioUrl })} label="cả đoạn" />
      </div>

      {/* 2. Cách thêm lượt */}
      <section aria-labelledby="dlg-how">
        <h3 id="dlg-how" className="mb-2 text-sm font-medium">Cách thêm lượt thoại</h3>
        <div role="tablist" aria-label="Cách thêm lượt thoại" className="grid grid-cols-2 gap-2">
          {DIALOGUE_METHODS.map(({ key, icon: Icon, title, hint }) => {
            const on = method === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="dlg-method-panel"
                onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors sm:flex-row sm:items-start sm:gap-3 sm:text-left ${
                  on ? "border-brand-400 bg-brand-100 shadow-sm" : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-white text-brand-700" : "bg-[rgb(var(--surface-muted))] text-muted"}`}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${on ? "text-brand-700" : ""}`}>{title}</span>
                  <span className="hidden text-xs text-muted sm:block">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {method === "paste" && (
          <div id="dlg-method-panel" role="tabpanel" className="mt-3 space-y-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
            <p className="text-sm">Mỗi lượt một dòng, viết dạng <strong>Người nói：lời thoại</strong> (dấu hai chấm toàn góc <code>：</code> hoặc <code>:</code>).</p>
            <textarea className="input text-sm" rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              aria-label="Dán hội thoại" placeholder={"A：你好！\nB：你好，好久不见。\nA：最近忙吗？"} />
            <button type="button" className="btn-primary text-sm" onClick={importPaste} disabled={!pasteText.trim()}>
              Thêm các lượt
            </button>
            <PasteErrors errors={pasteErrors} />
          </div>
        )}
        {pasteNote && <p className="mt-3 text-sm text-brand-700" role="status">{pasteNote}</p>}
      </section>

      {/* 3. Danh sách lượt thoại */}
      <section aria-labelledby="dlg-list">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="dlg-list" className="text-sm font-medium">Các lượt thoại</h3>
          <p className="text-xs text-muted" aria-live="polite">
            {`${filled.length} lượt`}
            {withAudio > 0 ? ` · ${withAudio} có audio` : ""}
          </p>
        </div>

        <ol className="space-y-3">
          {value.turns.map((t, idx) => {
            const isLast = idx === value.turns.length - 1;
            const hint = !isLast || left.has(t.id) ? turnRowHint(t) : null;
            const extra = !!(t.reading || t.translation);
            const expanded = open.has(t.id) || extra;
            return (
              <li key={t.id} onBlur={(e) => markLeft(t.id, e)} className={`rounded-xl border bg-[rgb(var(--surface))] p-3 ${hint ? "border-warning-300" : "border-token"}`}>
                <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2">
                  <span aria-hidden className="col-start-1 row-start-1 flex h-7 w-7 items-center justify-center self-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 sm:mt-5 sm:self-start">
                    {idx + 1}
                  </span>
                  <div className="col-span-3 row-start-2 min-w-0 space-y-2.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
                      <Field label="Người nói">
                        <input className="input" maxLength={40} value={t.speaker}
                          onChange={(e) => patch(idx, { speaker: e.target.value })} placeholder="vd: A"
                          aria-label={`Người nói lượt ${idx + 1}`} />
                      </Field>
                      <Field label="Lời thoại">
                        <input id={`dlg-text-${t.id}`} className="input" maxLength={1000} value={t.text}
                          onChange={(e) => patch(idx, { text: e.target.value })} placeholder="vd: 你好！"
                          aria-label={`Lời thoại lượt ${idx + 1}`}
                          onKeyDown={(e) => {
                            // Enter ở lượt cuối: thêm lượt mới ngay với người nói được gợi ý sẵn.
                            if (e.key === "Enter" && isLast && t.speaker.trim() && t.text.trim()) {
                              e.preventDefault();
                              addRow();
                            }
                          }} />
                      </Field>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <AudioChip id={t.id} url={t.audioUrl} onChange={(audioUrl) => patch(idx, { audioUrl })} label={`lượt ${idx + 1}`} />
                      <button
                        type="button"
                        onClick={() => toggleOpen(t.id)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-token px-2.5 py-1.5 text-xs hover:bg-brand-soft"
                      >
                        <ChevronDown size={14} aria-hidden className={expanded ? "rotate-180" : ""} />
                        {expanded ? `Ẩn ${readingLabel.toLowerCase()} và bản dịch` : extra ? `${readingLabel} và bản dịch (đã có)` : `Thêm ${readingLabel.toLowerCase()} và bản dịch`}
                      </button>
                    </div>

                    {expanded && (
                      <div className="grid gap-2 rounded-lg bg-[rgb(var(--surface-muted))] p-3 sm:grid-cols-2">
                        <Field label={readingLabel}>
                          <input className="input" maxLength={1000} value={t.reading}
                            onChange={(e) => patch(idx, { reading: e.target.value })} placeholder="vd: Nǐ hǎo!"
                            aria-label={`${readingLabel} lượt ${idx + 1}`} />
                        </Field>
                        <Field label="Bản dịch">
                          <input className="input" maxLength={1000} value={t.translation}
                            onChange={(e) => patch(idx, { translation: e.target.value })} placeholder="vd: Xin chào!"
                            aria-label={`Bản dịch lượt ${idx + 1}`} />
                        </Field>
                      </div>
                    )}

                    {hint && <p className="text-xs text-warning-700" role="status">{hint}</p>}
                  </div>
                  <div className="col-start-3 row-start-1 justify-self-end">
                    <RowTools index={idx} count={value.turns.length} noun="lượt"
                      onMove={(d) => setTurns(moveItem(value.turns, idx, d))}
                      onRemove={() => setTurns(value.turns.length > 1 ? value.turns.filter((_, i) => i !== idx) : [emptyTurn()])} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <button type="button" onClick={addRow}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-soft/40 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-soft sm:w-auto">
          <Plus size={16} aria-hidden /> Thêm lượt
        </button>
      </section>

      {/* 4. Xem trước đúng như học viên thấy */}
      <details className="rounded-xl border border-token">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
          <Eye size={16} aria-hidden /> Xem trước như học viên
          <span className="text-xs font-normal text-muted">({filled.length} lượt)</span>
        </summary>
        <div className="border-t border-token p-4">
          {previewTurns.length === 0 ? (
            <p className="text-sm text-muted">Điền ít nhất một lượt có đủ “Người nói” và “Lời thoại” để xem trước.</p>
          ) : (
            <DialogueView
              title={value.title.trim() || undefined}
              caption={value.caption.trim() || undefined}
              audioUrl={value.audioUrl || undefined}
              turns={previewTurns}
            />
          )}
        </div>
      </details>
    </div>
  );
}
