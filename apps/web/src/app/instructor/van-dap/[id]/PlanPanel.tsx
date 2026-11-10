"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { LIMITS, errorText, type ItemRow, type Level } from "./types";
import type { PanelProps } from "./VanDapEditor";

const LEVEL_LABEL: Record<Level, string> = { basic: "Cơ bản", intermediate: "Trung bình", advanced: "Nâng cao" };

/**
 * Dàn câu hỏi = HỎI GÌ, THỨ TỰ NÀO. Thứ tự là thứ tự ưu tiên khi hỏi: hết giờ thì các ý cuối không được hỏi.
 * AI chỉ đề xuất; thầy/cô sửa, xoá, thêm, kéo đổi thứ tự (hoặc dùng nút Lên/Xuống).
 */
export default function PlanPanel({ data, reload, say, pendingFile }: PanelProps & { pendingFile: boolean }) {
  const draft = data.exam.status === "draft";
  const [generating, setGenerating] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [newCore, setNewCore] = useState("");
  const items = data.items;

  async function generate() {
    // AC1.1: không âm thầm bỏ tệp đang chọn dở.
    if (pendingFile) {
      return say("error", "Còn một tệp đã chọn nhưng chưa bấm \"Tải lên\". Hãy tải lên hoặc bỏ chọn trước khi tạo dàn.");
    }
    if (items.length > 0 && !window.confirm("Tạo lại sẽ THAY TOÀN BỘ dàn hiện có (kể cả phần thầy/cô đã sửa). Tiếp tục?")) return;
    setGenerating(true);
    try {
      const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/plan/generate`), { method: "POST" });
      if (!res.ok || !res.body) {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        return say("error", errorText(out.error));
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let result: { type: string; error?: string; items?: number } | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line) as { type: string; error?: string; items?: number };
            if (msg.type === "done" || msg.type === "error") result = msg;
          } catch {
            /* dòng hỏng: bỏ qua, kết quả cuối mới quan trọng */
          }
        }
      }
      if (result?.type === "done") {
        say("ok", `AI đã đề xuất ${result.items ?? ""} ý cần hỏi. Thầy/cô xem lại, sửa rồi xuất bản.`);
        await reload();
      } else {
        say("error", errorText(result?.error, "Kết nối bị ngắt giữa chừng. Dàn cũ vẫn còn nguyên, thầy/cô thử lại."));
      }
    } finally {
      setGenerating(false);
    }
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const ids = items.map((i) => i.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/plan`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    if (!res.ok) {
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      say("error", errorText(out.error));
    }
    await reload();
  }

  async function add() {
    if (!newCore.trim()) return;
    const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/plan`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ core: newCore }),
    });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return say("error", errorText(out.error));
    setNewCore("");
    await reload();
  }

  return (
    <section aria-labelledby="vd-plan" className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="vd-plan" className="text-h3">
            Dàn câu hỏi
          </h2>
          <p className="mt-1 text-sm text-faint">
            Mỗi ý là một điều AI sẽ kiểm tra, theo thứ tự ưu tiên từ trên xuống. Lúc thi, AI chỉ diễn đạt từng ý thành câu hỏi; không tự đổi nội dung hay thứ tự.
          </p>
        </div>
        {draft && (
          <button type="button" onClick={generate} disabled={generating || data.materials.length === 0} className="btn btn-primary btn-sm disabled:opacity-50">
            {generating ? "AI đang đọc tài liệu…" : "Tạo dàn từ tài liệu"}
          </button>
        )}
      </div>
      {draft && data.materials.length === 0 && <p className="text-xs text-slate-500">Cần tải ít nhất một tài liệu để AI tạo dàn. Thầy/cô cũng có thể tự thêm ý bên dưới.</p>}
      {generating && (
        <p className="banner-info text-sm" role="status">
          Tài liệu dài có thể mất vài chục giây vì AI đọc theo từng phần rồi gộp lại. Xin đừng đóng trang.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có ý nào. Tạo dàn từ tài liệu, hoặc thêm ý bằng tay.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li
              key={it.id}
              draggable={draft}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => draft && e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) void move(dragFrom, i);
                setDragFrom(null);
              }}
              className={`rounded-lg border bg-white ${dragFrom === i ? "border-brand-400 opacity-60" : "border-default"}`}
            >
              <ItemCard
                key={`${it.id}-${it.core}-${it.expectedAnswer}-${it.level}-${it.maxFollowUps}-${it.sourceExcerpt}`}
                item={it}
                position={i + 1}
                total={items.length}
                editable={draft}
                examId={data.exam.id}
                reload={reload}
                say={say}
                onMove={(delta) => void move(i, i + delta)}
              />
            </li>
          ))}
        </ol>
      )}

      {draft && items.length < LIMITS.maxItems && (
        <div className="space-y-2 rounded-lg border border-default bg-slate-50 p-3">
          <label htmlFor="vd-new-item" className="block text-caption font-medium">
            Thêm ý cần hỏi
          </label>
          <textarea
            id="vd-new-item"
            rows={2}
            className="textarea w-full"
            value={newCore}
            maxLength={LIMITS.coreMax}
            onChange={(e) => setNewCore(e.target.value)}
            placeholder="Nội dung cốt lõi cần kiểm tra, ví dụ: Phân biệt vòng lặp for và while."
          />
          <button type="button" onClick={add} disabled={!newCore.trim()} className="btn btn-secondary btn-sm disabled:opacity-50">
            Thêm ý
          </button>
        </div>
      )}
    </section>
  );
}

function ItemCard({
  item,
  position,
  total,
  editable,
  examId,
  reload,
  say,
  onMove,
}: {
  item: ItemRow;
  position: number;
  total: number;
  editable: boolean;
  examId: string;
  reload: () => Promise<void>;
  say: (kind: "ok" | "error", text: string) => void;
  onMove: (delta: number) => void;
}) {
  const [core, setCore] = useState(item.core);
  const [expected, setExpected] = useState(item.expectedAnswer);
  const [excerpt, setExcerpt] = useState(item.sourceExcerpt);
  const [level, setLevel] = useState<Level>(item.level);
  const [follow, setFollow] = useState(item.maxFollowUps);
  const [busy, setBusy] = useState(false);
  const dirty =
    core !== item.core || expected !== item.expectedAnswer || excerpt !== item.sourceExcerpt || level !== item.level || follow !== item.maxFollowUps;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/van-dap/exams/${examId}/plan/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core, expectedAnswer: expected, sourceExcerpt: excerpt, level, maxFollowUps: follow }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return say("error", errorText(out.error));
      say("ok", `Đã lưu ý số ${position}.`);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Xoá ý số ${position} khỏi dàn?`)) return;
    const res = await fetch(apiUrl(`/api/van-dap/exams/${examId}/plan/${item.id}`), { method: "DELETE" });
    if (!res.ok) {
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      return say("error", errorText(out.error));
    }
    await reload();
  }

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          <span aria-hidden className={editable ? "mr-1 cursor-grab text-slate-400" : "hidden"} title="Kéo để đổi thứ tự">
            ⋮⋮
          </span>
          Ý {position}
          <span className="ml-2 text-xs font-normal text-slate-500">{LEVEL_LABEL[item.level]}</span>
        </p>
        {editable && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onMove(-1)} disabled={position === 1} aria-label={`Đưa ý ${position} lên`} className="btn btn-secondary btn-sm disabled:opacity-40">
              Lên
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={position === total} aria-label={`Đưa ý ${position} xuống`} className="btn btn-secondary btn-sm disabled:opacity-40">
              Xuống
            </button>
            <button type="button" onClick={remove} className="btn btn-secondary btn-sm">
              Xoá
            </button>
          </div>
        )}
      </div>

      <label className="mt-2 block text-caption font-medium" htmlFor={`core-${item.id}`}>
        Nội dung cốt lõi
      </label>
      <textarea id={`core-${item.id}`} rows={2} className="textarea mt-1 w-full" value={core} readOnly={!editable} maxLength={LIMITS.coreMax} onChange={(e) => setCore(e.target.value)} />

      <label className="mt-2 block text-caption font-medium" htmlFor={`exp-${item.id}`}>
        Ý đáp án mong đợi <span className="font-normal text-slate-500">(học viên không thấy)</span>
      </label>
      <textarea id={`exp-${item.id}`} rows={2} className="textarea mt-1 w-full" value={expected} readOnly={!editable} maxLength={LIMITS.expectedAnswerMax} onChange={(e) => setExpected(e.target.value)} />

      <details className="mt-2">
        <summary className="cursor-pointer text-caption font-medium text-slate-600">Đoạn nguồn trong tài liệu (học viên không thấy)</summary>
        <textarea aria-label={`Đoạn nguồn của ý ${position}`} rows={4} className="textarea mt-1 w-full" value={excerpt} readOnly={!editable} maxLength={LIMITS.excerptMax} onChange={(e) => setExcerpt(e.target.value)} />
      </details>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-caption font-medium" htmlFor={`lvl-${item.id}`}>
            Mức độ
          </label>
          <select id={`lvl-${item.id}`} className="input mt-1 w-full" value={level} disabled={!editable} onChange={(e) => setLevel(e.target.value as Level)}>
            <option value="basic">Cơ bản</option>
            <option value="intermediate">Trung bình</option>
            <option value="advanced">Nâng cao</option>
          </select>
        </div>
        <div>
          <label className="block text-caption font-medium" htmlFor={`fu-${item.id}`}>
            Số câu đào sâu tối đa
          </label>
          <input id={`fu-${item.id}`} type="number" min={0} max={3} className="input mt-1 w-full" value={follow} disabled={!editable} onChange={(e) => setFollow(Math.min(3, Math.max(0, Number(e.target.value) || 0)))} />
        </div>
      </div>

      {editable && dirty && (
        <button type="button" onClick={save} disabled={busy || !core.trim()} className="btn btn-primary btn-sm mt-3 disabled:opacity-50">
          {busy ? "Đang lưu…" : "Lưu ý này"}
        </button>
      )}
    </div>
  );
}
