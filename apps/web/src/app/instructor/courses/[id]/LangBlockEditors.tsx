"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Headphones, Plus, Trash2, X } from "lucide-react";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import { AUDIO_UPLOAD_ACCEPT } from "@/lib/lessonAudio";
import { uploadLessonAudio } from "@/lib/uploadLessonAudio";
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

const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-faint";
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
function RowAudioField({
  url,
  onChange,
  label,
}: {
  url: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setErr(null);
    const r = await uploadLessonAudio(file);
    setBusy(false);
    if (r.ok) onChange(r.url);
    else setErr(lmsErrorMessage(r.error, r.status));
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-token px-2.5 py-1 text-xs hover:bg-brand-soft">
          <Headphones size={14} aria-hidden />
          {url ? "Đổi audio" : "Thêm audio"}
          <input
            type="file"
            accept={AUDIO_UPLOAD_ACCEPT}
            disabled={busy}
            aria-label={`Upload audio cho ${label}`}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void pick(f);
            }}
          />
        </label>
        {busy && <span className="text-xs text-muted">Đang upload...</span>}
        {url && !busy && (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- nghe thử cho giảng viên */}
            <audio src={url} controls preload="none" className="h-8 max-w-[220px]" />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={`Bỏ audio của ${label}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-token hover:bg-brand-soft"
            >
              <X size={14} aria-hidden />
            </button>
          </>
        )}
      </div>
      {err && <p className="text-xs text-danger-600">{err}</p>}
    </div>
  );
}

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
  const btn = "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-token hover:bg-brand-soft disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
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

export function VocabListEditor({
  value,
  onChange,
}: {
  value: VocabEditorValue;
  onChange: (v: VocabEditorValue) => void;
}) {
  const [pasteText, setPasteText] = useState("");
  const [pasteErrors, setPasteErrors] = useState<PasteError[]>([]);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [pendingDup, setPendingDup] = useState<VocabDraft[]>([]);
  const readingPlaceholder = value.readingLabel.trim() || "Phiên âm";

  const setItems = (items: VocabEditorItem[]) => onChange({ ...value, items });
  const patch = (idx: number, p: Partial<VocabEditorItem>) =>
    setItems(value.items.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const toItem = (d: VocabDraft): VocabEditorItem => ({
    ...emptyVocabItem(),
    term: d.term,
    reading: d.reading ?? "",
    meaning: d.meaning,
    example: d.example ?? "",
  });

  function importPaste() {
    const { items: parsed, errors } = parseVocabPaste(pasteText);
    const existingTerms = dropBlankVocab(value.items).map((i) => ({ term: i.term }));
    const { fresh, duplicates } = splitDuplicateTerms(existingTerms, parsed);
    if (fresh.length) {
      setItems([...dropBlankVocab(value.items), ...fresh.map(toItem)]);
    }
    setPasteErrors(errors);
    setPendingDup(duplicates);
    setPasteNote(
      fresh.length || duplicates.length || errors.length
        ? `Đã thêm ${fresh.length} từ${duplicates.length ? `; ${duplicates.length} từ trùng đang chờ bạn quyết định` : ""}.`
        : "Chưa có gì để nhập.",
    );
    setPasteText(errors.map((e) => e.raw).join("\n"));
  }

  function addDuplicates() {
    setItems([...dropBlankVocab(value.items), ...pendingDup.map(toItem)]);
    setPasteNote(`Đã thêm ${pendingDup.length} từ trùng.`);
    setPendingDup([]);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="vocab-title" className={LABEL}>Tiêu đề khối</label>
          <input id="vocab-title" className="input" maxLength={200} value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Vd: Từ mới bài 5" />
        </div>
        <div>
          <label htmlFor="vocab-reading-label" className={LABEL}>Tên cột phiên âm</label>
          <input id="vocab-reading-label" className="input" maxLength={40} value={value.readingLabel}
            onChange={(e) => onChange({ ...value, readingLabel: e.target.value })} placeholder="Mặc định: Phiên âm. Vd: Pinyin, IPA" />
        </div>
      </div>

      <details className="rounded-lg border border-dashed border-token p-3">
        <summary className="cursor-pointer text-sm font-medium">Dán nhiều từ cùng lúc từ Excel / Google Sheets</summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">
            Mỗi từ một dòng, các cột cách nhau bằng tab (copy thẳng từ bảng tính) hoặc dấu <code>|</code>.
            2 cột = từ · nghĩa; 3 cột = từ · phiên âm · nghĩa; 4 cột thêm câu ví dụ.
          </p>
          <textarea className="input font-mono text-sm" rows={5} value={pasteText}
            onChange={(e) => setPasteText(e.target.value)} aria-label="Dán bảng từ vựng"
            placeholder={"朋友 | péngyou | bạn bè | 他是我的朋友。\n你好 | nǐ hǎo | xin chào"} />
          <button type="button" className="btn-secondary text-sm" onClick={importPaste} disabled={!pasteText.trim()}>
            Thêm vào danh sách
          </button>
          {pasteNote && <p className="text-xs text-muted" role="status">{pasteNote}</p>}
          {pendingDup.length > 0 && (
            <div className="banner-warning text-xs">
              <p className="font-medium">
                {pendingDup.length} từ đã có trong khối: {pendingDup.slice(0, 6).map((d) => d.term).join(", ")}
                {pendingDup.length > 6 ? "…" : ""}
              </p>
              <div className="mt-1 flex gap-2">
                <button type="button" className="rounded border border-token px-2 py-0.5" onClick={addDuplicates}>
                  Vẫn thêm {pendingDup.length} từ trùng
                </button>
                <button type="button" className="rounded border border-token px-2 py-0.5" onClick={() => setPendingDup([])}>
                  Bỏ qua từ trùng
                </button>
              </div>
            </div>
          )}
          <PasteErrors errors={pasteErrors} />
        </div>
      </details>

      <ol className="space-y-2">
        {value.items.map((it, idx) => (
          <li key={it.id} className="space-y-2 rounded-lg border border-token p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-faint">Từ {idx + 1}</span>
              <RowTools index={idx} count={value.items.length} noun="từ"
                onMove={(d) => setItems(moveItem(value.items, idx, d))}
                onRemove={() => setItems(value.items.length > 1 ? value.items.filter((_, i) => i !== idx) : [emptyVocabItem()])} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input className="input" maxLength={200} value={it.term} onChange={(e) => patch(idx, { term: e.target.value })}
                placeholder="Từ (vd: 朋友)" aria-label={`Từ ${idx + 1}`} />
              <input className="input" maxLength={200} value={it.reading} onChange={(e) => patch(idx, { reading: e.target.value })}
                placeholder={readingPlaceholder} aria-label={`${readingPlaceholder} của từ ${idx + 1}`} />
              <input className="input" maxLength={500} value={it.meaning} onChange={(e) => patch(idx, { meaning: e.target.value })}
                placeholder="Nghĩa (vd: bạn bè)" aria-label={`Nghĩa của từ ${idx + 1}`} />
            </div>
            <input className="input" maxLength={1000} value={it.example} onChange={(e) => patch(idx, { example: e.target.value })}
              placeholder="Câu ví dụ (không bắt buộc)" aria-label={`Câu ví dụ của từ ${idx + 1}`} />
            <details>
              <summary className="cursor-pointer text-xs text-muted">Phiên âm / dịch câu ví dụ và ghi chú</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input className="input" maxLength={1000} value={it.exampleReading} onChange={(e) => patch(idx, { exampleReading: e.target.value })}
                  placeholder={`${readingPlaceholder} của câu ví dụ`} aria-label={`${readingPlaceholder} câu ví dụ ${idx + 1}`} />
                <input className="input" maxLength={1000} value={it.exampleMeaning} onChange={(e) => patch(idx, { exampleMeaning: e.target.value })}
                  placeholder="Nghĩa của câu ví dụ" aria-label={`Nghĩa câu ví dụ ${idx + 1}`} />
              </div>
              <input className="input mt-2" maxLength={500} value={it.note} onChange={(e) => patch(idx, { note: e.target.value })}
                placeholder="Ghi chú (vd: thanh nhẹ ở âm tiết sau)" aria-label={`Ghi chú của từ ${idx + 1}`} />
            </details>
            <RowAudioField url={it.audioUrl} onChange={(audioUrl) => patch(idx, { audioUrl })} label={`từ ${idx + 1}`} />
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => setItems([...value.items, emptyVocabItem()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-token px-3 py-1.5 text-sm hover:bg-brand-soft">
        <Plus size={14} aria-hidden /> Thêm từ
      </button>
    </div>
  );
}

export function DialogueEditor({
  value,
  onChange,
}: {
  value: DialogueEditorValue;
  onChange: (v: DialogueEditorValue) => void;
}) {
  const [pasteText, setPasteText] = useState("");
  const [pasteErrors, setPasteErrors] = useState<PasteError[]>([]);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const readingPlaceholder = value.readingLabel.trim() || "Phiên âm";

  const setTurns = (turns: TurnEditorItem[]) => onChange({ ...value, turns });
  const patch = (idx: number, p: Partial<TurnEditorItem>) =>
    setTurns(value.turns.map((t, i) => (i === idx ? { ...t, ...p } : t)));

  function importPaste() {
    const { turns, errors } = parseDialoguePaste(pasteText);
    if (turns.length) {
      setTurns([...dropBlankTurns(value.turns), ...turns.map((t) => ({ ...emptyTurn(), speaker: t.speaker, text: t.text }))]);
    }
    setPasteErrors(errors);
    setPasteNote(turns.length || errors.length ? `Đã thêm ${turns.length} lượt.` : "Chưa có gì để nhập.");
    setPasteText(errors.map((e) => e.raw).join("\n"));
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="dlg-title" className={LABEL}>Tiêu đề hội thoại</label>
          <input id="dlg-title" className="input" maxLength={200} value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Vd: Hội thoại bài 5" />
        </div>
        <div>
          <label htmlFor="dlg-reading-label" className={LABEL}>Tên dòng phiên âm</label>
          <input id="dlg-reading-label" className="input" maxLength={40} value={value.readingLabel}
            onChange={(e) => onChange({ ...value, readingLabel: e.target.value })} placeholder="Mặc định: Phiên âm. Vd: Pinyin" />
        </div>
      </div>
      <div>
        <label htmlFor="dlg-caption" className={LABEL}>Hướng dẫn cho học viên (không bắt buộc)</label>
        <input id="dlg-caption" className="input" maxLength={600} value={value.caption}
          onChange={(e) => onChange({ ...value, caption: e.target.value })} placeholder="Vd: Nghe hai lần rồi xem bản dịch." />
      </div>
      <div>
        <span className={LABEL}>Audio cả bài (không bắt buộc)</span>
        <RowAudioField url={value.audioUrl} onChange={(audioUrl) => onChange({ ...value, audioUrl })} label="cả bài" />
      </div>

      <details className="rounded-lg border border-dashed border-token p-3">
        <summary className="cursor-pointer text-sm font-medium">Dán cả đoạn hội thoại</summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">Mỗi lượt một dòng, dạng <code>A：lời thoại</code> (dấu hai chấm toàn góc <code>：</code> hoặc <code>:</code>).</p>
          <textarea className="input text-sm" rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            aria-label="Dán hội thoại" placeholder={"A：你好！\nB：你好，好久不见。\nA：最近忙吗？"} />
          <button type="button" className="btn-secondary text-sm" onClick={importPaste} disabled={!pasteText.trim()}>
            Thêm các lượt
          </button>
          {pasteNote && <p className="text-xs text-muted" role="status">{pasteNote}</p>}
          <PasteErrors errors={pasteErrors} />
        </div>
      </details>

      <ol className="space-y-2">
        {value.turns.map((t, idx) => (
          <li key={t.id} className="space-y-2 rounded-lg border border-token p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-faint">Lượt {idx + 1}</span>
              <RowTools index={idx} count={value.turns.length} noun="lượt"
                onMove={(d) => setTurns(moveItem(value.turns, idx, d))}
                onRemove={() => setTurns(value.turns.length > 1 ? value.turns.filter((_, i) => i !== idx) : [emptyTurn()])} />
            </div>
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <input className="input" maxLength={40} value={t.speaker} onChange={(e) => patch(idx, { speaker: e.target.value })}
                placeholder="Người nói (vd: A)" aria-label={`Người nói lượt ${idx + 1}`} />
              <input className="input" maxLength={1000} value={t.text} onChange={(e) => patch(idx, { text: e.target.value })}
                placeholder="Lời thoại" aria-label={`Lời thoại lượt ${idx + 1}`} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" maxLength={1000} value={t.reading} onChange={(e) => patch(idx, { reading: e.target.value })}
                placeholder={`${readingPlaceholder} (không bắt buộc)`} aria-label={`${readingPlaceholder} lượt ${idx + 1}`} />
              <input className="input" maxLength={1000} value={t.translation} onChange={(e) => patch(idx, { translation: e.target.value })}
                placeholder="Bản dịch (không bắt buộc)" aria-label={`Bản dịch lượt ${idx + 1}`} />
            </div>
            <RowAudioField url={t.audioUrl} onChange={(audioUrl) => patch(idx, { audioUrl })} label={`lượt ${idx + 1}`} />
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => setTurns([...value.turns, emptyTurn()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-token px-3 py-1.5 text-sm hover:bg-brand-soft">
        <Plus size={14} aria-hidden /> Thêm lượt
      </button>
    </div>
  );
}
