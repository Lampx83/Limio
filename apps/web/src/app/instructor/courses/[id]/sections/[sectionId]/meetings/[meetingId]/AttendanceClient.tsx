"use client";

import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import StickyMobileCTA from "@/components/ui/StickyMobileCTA";

type Status = "present" | "late" | "absent" | "excused";

interface Entry {
  userId: string;
  displayName: string;
  email: string;
  status: Status | null;
  note: string | null;
  markedAt: string | null;
  inRoster: boolean;
}

export interface AttendanceView {
  meeting: { id: string; status: "planned" | "held" | "cancelled" };
  window: { state: "not_open" | "open" | "closed"; opensAt: string; closesAt: string };
  entries: Entry[];
}

const OPTIONS: ReadonlyArray<{ value: Status; label: string; on: string }> = [
  { value: "present", label: "Có mặt", on: "bg-success-100 text-success-700 border-success-500" },
  { value: "late", label: "Muộn", on: "bg-yellow-100 text-yellow-800 border-yellow-500" },
  { value: "absent", label: "Vắng", on: "bg-danger-100 text-danger-700 border-danger-500" },
  { value: "excused", label: "Có phép", on: "bg-sky-100 text-sky-700 border-sky-500" },
];

const ERRORS: Record<string, string> = {
  attendance_not_open: "Chưa đến giờ điểm danh. Điểm danh mở từ 30 phút trước giờ học.",
  attendance_closed: "Đã quá hạn sửa điểm danh (7 ngày sau buổi học).",
  meeting_cancelled: "Buổi này đã huỷ nên không điểm danh được.",
  not_in_roster: "Có học viên không còn thuộc lớp này. Tải lại trang rồi thử lại.",
  validation_failed: "Thông tin chưa hợp lệ. Ghi chú tối đa 200 ký tự.",
  forbidden: "Bạn không có quyền điểm danh lớp này.",
};

const err = (code?: string) => ERRORS[code ?? ""] ?? `Có lỗi xảy ra${code ? ` (${code})` : ""}. Thử lại sau.`;

export default function AttendanceClient({ meetingId, initial }: { meetingId: string; initial: AttendanceView }) {
  const [view, setView] = useState(initial);
  // Chỉ giữ những thay đổi chưa lưu; bấm lại đúng trạng thái đã lưu thì bỏ khỏi bản nháp.
  const [draft, setDraft] = useState<Record<string, { status?: Status; note?: string }>>({});
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const writable = view.window.state === "open" && view.meeting.status !== "cancelled";
  const statusOf = (e: Entry): Status | null => draft[e.userId]?.status ?? e.status;
  const noteOf = (e: Entry): string => draft[e.userId]?.note ?? e.note ?? "";
  const dirtyCount = Object.keys(draft).length;

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0, none: 0 };
    for (const e of view.entries) {
      const s = draft[e.userId]?.status ?? e.status;
      if (s) c[s]++;
      else c.none++;
    }
    return c;
  }, [view.entries, draft]);

  const reload = async () => {
    const r = await fetch(apiUrl(`/api/meetings/${meetingId}/attendance`));
    if (r.ok) setView((await r.json()) as AttendanceView);
  };

  const pick = (e: Entry, status: Status) => {
    setNotice(null);
    setDraft((d) => {
      const next = { ...d };
      const cur = next[e.userId] ?? {};
      if (status === e.status && (cur.note === undefined || cur.note === (e.note ?? ""))) delete next[e.userId];
      else next[e.userId] = { ...cur, status };
      return next;
    });
  };

  const setNote = (e: Entry, note: string) => {
    setNotice(null);
    setDraft((d) => {
      const next = { ...d };
      const cur = next[e.userId] ?? {};
      const merged = { ...cur, note };
      const sameStatus = (merged.status ?? e.status) === e.status;
      if (sameStatus && note === (e.note ?? "")) delete next[e.userId];
      else next[e.userId] = merged;
      return next;
    });
  };

  const call = async (url: string, method: string, body?: unknown): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(apiUrl(url), {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setError(err(j.error as string | undefined));
        return null;
      }
      return j;
    } catch {
      // Mạng yếu: giữ nguyên các lựa chọn chưa lưu để thử lại.
      setError("Chưa lưu được vì mạng không ổn định. Các lựa chọn của bạn vẫn còn, bấm lưu lại khi có mạng.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const allPresent = async () => {
    const j = await call(`/api/meetings/${meetingId}/attendance/all-present`, "POST");
    if (!j) return;
    await reload();
    setNotice(Number(j.marked) === 0 ? "Mọi học viên đã được đánh dấu." : `Đã đánh dấu ${j.marked} học viên có mặt.`);
  };

  const save = async () => {
    const entries = Object.entries(draft).flatMap(([userId, d]) => {
      const e = view.entries.find((x) => x.userId === userId);
      const status = d.status ?? e?.status;
      if (!status) return []; // chỉ có ghi chú mà chưa chọn trạng thái: chưa lưu được
      return [{ userId, status, ...(d.note !== undefined ? { note: d.note } : {}) }];
    });
    if (entries.length === 0) {
      setError("Hãy chọn trạng thái cho học viên trước khi lưu ghi chú.");
      return;
    }
    const j = await call(`/api/meetings/${meetingId}/attendance`, "PUT", { entries });
    if (!j) return;
    setDraft({});
    await reload();
    setNotice(`Đã lưu điểm danh (${entries.length} học viên).`);
  };

  const saveLabel = busy ? "Đang lưu…" : dirtyCount > 0 ? `Lưu điểm danh (${dirtyCount})` : "Lưu điểm danh";
  const saveButton = (
    <button type="button" className="btn-primary" disabled={!writable || busy || dirtyCount === 0} onClick={save}>
      {saveLabel}
    </button>
  );

  return (
    <section className="mt-5 pb-24 lg:pb-0" aria-label="Điểm danh">
      {view.meeting.status === "cancelled" && <div className="banner-warning mb-3 text-sm">Buổi này đã huỷ nên không điểm danh được.</div>}
      {view.meeting.status !== "cancelled" && view.window.state === "not_open" && (
        <div className="banner-info mb-3 text-sm">Điểm danh mở từ {formatDateTime(view.window.opensAt)} (30 phút trước giờ học).</div>
      )}
      {view.meeting.status !== "cancelled" && view.window.state === "closed" && (
        <div className="banner-info mb-3 text-sm">Đã quá hạn sửa điểm danh (7 ngày sau buổi học). Bạn vẫn xem được kết quả.</div>
      )}
      {error && <div className="banner-danger mb-3 text-sm">{error}</div>}
      {notice && <div className="banner-success mb-3 text-sm">{notice}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          Có mặt {counts.present} · Muộn {counts.late} · Vắng {counts.absent} · Có phép {counts.excused} · Chưa đánh dấu {counts.none}
        </p>
        <div className="hidden items-center gap-2 lg:flex">
          <button type="button" className="btn-secondary" disabled={!writable || busy} onClick={allPresent}>
            Có mặt cả lớp
          </button>
          {saveButton}
        </div>
      </div>

      {view.entries.length === 0 ? (
        <div className="mt-4 rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Lớp chưa có học viên nào.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-token overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))]">
          {view.entries.map((e) => {
            const current = statusOf(e);
            const changed = draft[e.userId] !== undefined;
            return (
              <li key={e.userId} className={`px-4 py-3 ${changed ? "bg-[rgb(var(--brand-soft))/0.35]" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {e.displayName}
                      {!e.inRoster && <span className="ml-2 text-xs font-normal text-muted">(đã rời lớp)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{e.email}</p>
                  </div>
                  <div role="group" aria-label={`Điểm danh ${e.displayName}`} className="grid w-full grid-cols-4 gap-1.5 sm:w-auto">
                    {OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={current === o.value}
                        disabled={!writable || busy}
                        onClick={() => pick(e, o.value)}
                        className={`min-h-11 whitespace-nowrap rounded-lg border px-1 text-[13px] font-medium transition-colors disabled:opacity-60 sm:min-h-9 sm:px-3 sm:text-sm ${
                          current === o.value ? o.on : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-[rgb(var(--surface-muted))]"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-1.5">
                  {noteOpen[e.userId] || noteOf(e) ? (
                    <input
                      aria-label={`Ghi chú cho ${e.displayName}`}
                      className="input w-full text-sm"
                      placeholder="Ghi chú ngắn (chỉ giáo viên thấy)"
                      maxLength={200}
                      disabled={!writable || busy}
                      value={noteOf(e)}
                      onChange={(ev) => setNote(e, ev.target.value)}
                    />
                  ) : (
                    writable && (
                      <button
                        type="button"
                        className="text-caption text-muted underline-offset-2 hover:underline"
                        onClick={() => setNoteOpen((n) => ({ ...n, [e.userId]: true }))}
                      >
                        + Thêm ghi chú
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* pl-[4.5rem] chừa chỗ cho nút mở menu nổi ở góc trái dưới (dưới lg). */}
      <StickyMobileCTA
        className="pl-[4.5rem]"
        action={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={!writable || busy} onClick={allPresent}>
              Có mặt cả lớp
            </button>
            {saveButton}
          </div>
        }
      />
    </section>
  );
}
