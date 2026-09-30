"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACADEMIC_TERM_MAX_WEEKS,
  isDayKey,
  resolveAcademicPosition,
  termFirstDay,
  termLastDay,
  weekdayIndexMon0,
  type AcademicTermLike,
} from "@feedbackme/shared-types";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { formatDayKey } from "@/lib/datetime";

const WEEKDAY_NAME = ["thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy", "Chủ Nhật"];

interface Draft {
  name: string;
  startDate: string;
  weekCount: string;
}

const EMPTY_DRAFT: Draft = { name: "", startDate: "", weekCount: "16" };

const ERROR_TEXT: Record<string, string> = {
  invalid_name: "Tên kỳ không được để trống (tối đa 100 ký tự).",
  invalid_start_date: "Ngày bắt đầu không hợp lệ.",
  invalid_week_count: `Số tuần phải là số nguyên từ 1 đến ${ACADEMIC_TERM_MAX_WEEKS}.`,
  forbidden: "Bạn không có quyền cấu hình kỳ học của trường này.",
  not_found: "Kỳ học không còn tồn tại — hãy tải lại trang.",
};

async function errorMessage(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    details?: { conflictingTermName?: string };
  };
  if (data.error === "overlaps_existing_term") {
    return `Trùng tuần với kỳ “${data.details?.conflictingTermName ?? "khác"}”. Kỳ mới phải bắt đầu sau khi kỳ kia kết thúc.`;
  }
  return (data.error && ERROR_TEXT[data.error]) || "Lưu thất bại.";
}

export default function AcademicTermsManager({
  organizationId,
  initialTerms,
  todayKey,
}: {
  organizationId: string;
  initialTerms: AcademicTermLike[];
  /** Ngày hôm nay theo giờ VN (server tính) để chip trạng thái không phụ thuộc đồng hồ máy người xem. */
  todayKey: string;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(initialTerms);
  // editingId: id đang sửa; "new": đang thêm; null: đóng form.
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const position = resolveAcademicPosition(todayKey, terms);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditingId("new");
  }

  function openEdit(t: AcademicTermLike) {
    setDraft({ name: t.name, startDate: t.startDate, weekCount: String(t.weekCount) });
    setEditingId(t.id);
  }

  const weekCountNum = Number(draft.weekCount);
  const draftValid =
    draft.name.trim().length > 0 &&
    isDayKey(draft.startDate) &&
    Number.isInteger(weekCountNum) &&
    weekCountNum >= 1 &&
    weekCountNum <= ACADEMIC_TERM_MAX_WEEKS;
  const midweek = isDayKey(draft.startDate) && weekdayIndexMon0(draft.startDate) !== 0;

  async function save() {
    if (!draftValid || editingId === null) return;
    setSaving(true);
    const body = JSON.stringify({
      name: draft.name.trim(),
      startDate: draft.startDate,
      weekCount: weekCountNum,
    });
    const creating = editingId === "new";
    const res = await fetch(
      apiUrl(creating ? `/api/orgs/${organizationId}/academic-terms` : `/api/academic-terms/${editingId}`),
      { method: creating ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body },
    );
    setSaving(false);
    if (!res.ok) {
      toast.error("Không lưu được kỳ học", { description: await errorMessage(res) });
      return;
    }
    const { term } = (await res.json()) as { term: AcademicTermLike };
    setTerms((prev) =>
      (creating ? [...prev, term] : prev.map((t) => (t.id === term.id ? term : t))).sort((a, b) =>
        termFirstDay(a).localeCompare(termFirstDay(b)),
      ),
    );
    setEditingId(null);
    toast.success(creating ? "Đã thêm kỳ học" : "Đã cập nhật kỳ học");
    router.refresh();
  }

  async function remove(t: AcademicTermLike) {
    if (!confirm(`Xoá kỳ “${t.name}”? Nhãn tuần trên lịch của trường sẽ không còn hiện cho kỳ này.`)) return;
    const res = await fetch(apiUrl(`/api/academic-terms/${t.id}`), { method: "DELETE" });
    if (!res.ok) {
      toast.error("Xoá thất bại", { description: await errorMessage(res) });
      return;
    }
    setTerms((prev) => prev.filter((x) => x.id !== t.id));
    if (editingId === t.id) setEditingId(null);
    toast.success("Đã xoá kỳ học");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Kỳ học &amp; lịch</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted">
            Khai báo ngày bắt đầu và số tuần của từng kỳ. Lịch của mọi giáo viên và học viên trong
            trường sẽ hiện “Tuần N/M” của kỳ đang diễn ra. Tuần 1 là tuần (thứ Hai – Chủ Nhật)
            chứa ngày bắt đầu.
          </p>
        </div>
        {editingId === null && (
          <button type="button" onClick={openNew} className="btn-secondary btn-sm">
            + Thêm kỳ học
          </button>
        )}
      </div>

      {position.kind === "in_term" && (
        <p className="banner-info mt-4 rounded-lg px-3 py-2 text-sm">
          Hôm nay ({formatDayKey(todayKey)}) là <strong>tuần {position.week}/{position.weekCount}</strong>{" "}
          của kỳ “{position.term.name}”.
        </p>
      )}
      {position.kind === "before_term" && (
        <p className="banner-info mt-4 rounded-lg px-3 py-2 text-sm">
          Chưa vào kỳ học. Kỳ “{position.term.name}” bắt đầu sau {position.daysUntilStart} ngày.
        </p>
      )}
      {position.kind === "no_term" && (
        <p className="banner-warning mt-4 rounded-lg px-3 py-2 text-sm">
          {terms.length === 0
            ? "Trường chưa khai báo kỳ học nào — lịch của thành viên chưa hiện nhãn tuần."
            : "Hiện không nằm trong kỳ học nào và chưa có kỳ sắp tới."}
        </p>
      )}

      {terms.length > 0 && (
        <ul className="mt-4 divide-y divide-[rgb(var(--border))] rounded-xl border border-token">
          {terms.map((t) => {
            const first = termFirstDay(t);
            const last = termLastDay(t);
            const state =
              todayKey > last
                ? { label: "Đã kết thúc", chip: "chip" }
                : todayKey >= first
                  ? { label: "Đang diễn ra", chip: "chip-success" }
                  : { label: "Sắp tới", chip: "chip-brand" };
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t.name}
                    <span className={`${state.chip} text-[11px]`}>{state.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDayKey(first)} → {formatDayKey(last)} · {t.weekCount} tuần
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(t)} className="btn-secondary btn-sm">
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    className="btn-ghost btn-sm text-danger-700 hover:bg-danger-50"
                  >
                    Xoá
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingId !== null && (
        <div className="mt-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4">
          <p className="text-sm font-semibold">{editingId === "new" ? "Thêm kỳ học" : "Sửa kỳ học"}</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-semibold" htmlFor="term-name">
                Tên kỳ
              </label>
              <input
                id="term-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={100}
                placeholder="Học kỳ 1 năm 2026-2027"
                className="input mt-1 w-64 max-w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="term-start">
                Ngày bắt đầu
              </label>
              <input
                id="term-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                className="input mt-1 w-44"
              />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="term-weeks">
                Số tuần
              </label>
              <input
                id="term-weeks"
                type="number"
                min={1}
                max={ACADEMIC_TERM_MAX_WEEKS}
                value={draft.weekCount}
                onChange={(e) => setDraft({ ...draft, weekCount: e.target.value })}
                className="input mt-1 w-24"
              />
            </div>
          </div>

          {draftValid && (
            <p className="mt-3 text-xs text-muted">
              Kỳ kéo dài từ {formatDayKey(termFirstDay({ startDate: draft.startDate }))} đến{" "}
              {formatDayKey(termLastDay({ startDate: draft.startDate, weekCount: weekCountNum }))}.
              {midweek && (
                <>
                  {" "}
                  Ngày bắt đầu là {WEEKDAY_NAME[weekdayIndexMon0(draft.startDate)]}, nên tuần 1 tính từ
                  thứ Hai cùng tuần.
                </>
              )}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} disabled={saving || !draftValid} className="btn-primary btn-sm">
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditingId(null)} disabled={saving} className="btn-ghost btn-sm">
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
