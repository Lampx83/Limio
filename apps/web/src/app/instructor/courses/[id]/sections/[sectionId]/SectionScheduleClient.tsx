"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import MeetingPlanEditor, { type CourseTreeModule } from "./MeetingPlanEditor";
import { formatTime, formatVN, fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";

type MeetingStatus = "planned" | "held" | "cancelled";

export interface ScheduleMeeting {
  id: string;
  seq: number | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  plannedTeacherId: string | null;
  plannedTeacherName: string | null;
  status: MeetingStatus;
  cancelReason: string | null;
  makeupOfId: string | null;
  locked: boolean;
  plan: {
    courseSlug: string;
    sessionNo: number | null;
    title: string | null;
    lessons: Array<{ id: string; title: string }>;
    customized: boolean;
  } | null;
  /** CENTER J — buổi đã tuỳ chỉnh kế hoạch giảng dạy. */
  planCustomized: boolean;
  planTopic: string | null;
}

interface SlotForm {
  weekday: number;
  startTime: string;
  durationMin: number;
  room: string;
  plannedTeacherId: string;
}

export interface ScheduleDetail {
  schedule: {
    startDate: string;
    totalMeetings: number;
    slots: Array<{
      weekday: number;
      startTime: string;
      durationMin: number;
      room: string | null;
      plannedTeacherId: string | null;
    }>;
  } | null;
  meetings: ScheduleMeeting[];
  countedMeetings: number;
  shortBy: number;
  planSessions: number;
  unscheduledSessions: number;
  meetingsWithoutPlan: number;
}

interface Conflict {
  kind: "teacher" | "room";
  otherSectionName: string;
  startsAt: string;
}

const WEEKDAYS = [
  [1, "Thứ hai"],
  [2, "Thứ ba"],
  [3, "Thứ tư"],
  [4, "Thứ năm"],
  [5, "Thứ sáu"],
  [6, "Thứ bảy"],
  [7, "Chủ nhật"],
] as const;

const ERRORS: Record<string, string> = {
  validation_failed: "Thông tin chưa hợp lệ. Kiểm tra lại ngày, giờ, thời lượng và số buổi.",
  teacher_not_in_course: "Giáo viên này không thuộc khoá học của lớp.",
  meeting_not_editable: "Buổi đã dạy hoặc đã huỷ nên không sửa được.",
  already_cancelled: "Buổi này đã được huỷ trước đó.",
  makeup_of_invalid: "Chỉ chọn được buổi đã huỷ của chính lớp này.",
  default_section: "Lớp mặc định không có lịch dạy.",
  forbidden: "Bạn không có quyền với lớp này.",
};

const err = (code?: string) => ERRORS[code ?? ""] ?? `Có lỗi xảy ra${code ? ` (${code})` : ""}. Thử lại sau.`;

const blankSlot = (): SlotForm => ({ weekday: 2, startTime: "18:30", durationMin: 120, room: "", plannedTeacherId: "" });

function toForm(d: ScheduleDetail) {
  return {
    startDate: d.schedule?.startDate ?? "",
    total: d.schedule?.totalMeetings ?? 24,
    slots: d.schedule
      ? d.schedule.slots.map((s) => ({
          weekday: s.weekday,
          startTime: s.startTime,
          durationMin: s.durationMin,
          room: s.room ?? "",
          plannedTeacherId: s.plannedTeacherId ?? "",
        }))
      : [blankSlot()],
  };
}

export default function SectionScheduleClient({
  courseId,
  sectionId,
  initial,
  teachers,
  canManage = true,
  viewerId,
  autoSendSummary = true,
  courseTree = [],
}: {
  courseId: string;
  sectionId: string;
  initial: ScheduleDetail;
  teachers: Array<{ id: string; name: string }>;
  /** false = người chỉ dạy (giảng viên trung tâm): xem lịch và điểm danh, không đặt/sửa/huỷ/dạy bù. */
  canManage?: boolean;
  /** Người đang xem: người chỉ dạy không có nút điểm danh ở buổi đã xếp cho giảng viên khác. */
  viewerId?: string;
  /** Lớp có tự gửi tổng kết chung khi giáo viên kết thúc buổi không (mặc định bật). */
  autoSendSummary?: boolean;
  /** Cây chương và bài của khoá, để chọn bài đưa vào kế hoạch của buổi (chỉ người quản khoá). */
  courseTree?: CourseTreeModule[];
}) {
  const [detail, setDetail] = useState(initial);
  const [autoSend, setAutoSend] = useState(autoSendSummary);
  const [planOpenId, setPlanOpenId] = useState<string | null>(null);
  const [form, setForm] = useState(() => toForm(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [editing, setEditing] = useState<{ id: string; startsAt: string; durationMin: string; room: string; teacher: string } | null>(null);
  const [makeup, setMakeup] = useState<{ startsAt: string; durationMin: string; room: string; makeupOfId: string } | null>(null);

  const reload = async () => {
    const r = await fetch(apiUrl(`/api/sections/${sectionId}/schedule`));
    if (r.ok) setDetail((await r.json()) as ScheduleDetail);
  };

  /** Gọi API ghi; thành công thì tải lại. Trả về JSON để chỗ gọi đọc cảnh báo trùng. */
  const send = async (url: string, method: string, body: unknown): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(apiUrl(url), {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setError(err(j.error as string | undefined));
        return null;
      }
      await reload();
      return j;
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const j = await send(`/api/sections/${sectionId}/schedule`, "PUT", {
      startDate: form.startDate,
      totalMeetings: Number(form.total),
      slots: form.slots.map((s) => ({
        weekday: s.weekday,
        startTime: s.startTime,
        durationMin: Number(s.durationMin),
        room: s.room || null,
        plannedTeacherId: s.plannedTeacherId || null,
      })),
    });
    if (!j) return;
    setConflicts((j.conflicts as Conflict[]) ?? []);
    const changed = Number(j.created) + Number(j.updated) + Number(j.removed);
    setNotice(
      changed === 0
        ? "Lịch không có gì thay đổi."
        : `Đã áp dụng lịch: thêm ${j.created} buổi, cập nhật ${j.updated}, bỏ ${j.removed}.`,
    );
  };

  const cancel = async (m: ScheduleMeeting) => {
    const reason = window.prompt("Lý do huỷ buổi này?");
    if (reason === null) return;
    const j = await send(`/api/meetings/${m.id}/cancel`, "POST", { reason });
    if (j) setNotice("Đã huỷ buổi. Các buổi sau tự đánh lại số thứ tự.");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const startsAt = fromDateTimeInputValue(editing.startsAt);
    const j = await send(`/api/meetings/${editing.id}`, "PATCH", {
      ...(startsAt ? { startsAt } : {}),
      durationMin: Number(editing.durationMin),
      room: editing.room || null,
      plannedTeacherId: editing.teacher || null,
    });
    if (!j) return;
    setConflicts((j.conflicts as Conflict[]) ?? []);
    setEditing(null);
  };

  const saveMakeup = async () => {
    if (!makeup) return;
    const startsAt = fromDateTimeInputValue(makeup.startsAt);
    if (!startsAt) {
      setError(err("validation_failed"));
      return;
    }
    const j = await send(`/api/sections/${sectionId}/meetings`, "POST", {
      startsAt,
      durationMin: Number(makeup.durationMin),
      room: makeup.room || null,
      makeupOfId: makeup.makeupOfId || null,
    });
    if (!j) return;
    setConflicts((j.conflicts as Conflict[]) ?? []);
    setMakeup(null);
  };

  const setSlot = (i: number, patch: Partial<SlotForm>) =>
    setForm((f) => ({ ...f, slots: f.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const cancelled = detail.meetings.filter((m) => m.status === "cancelled");
  const teacherName = (id: string | null) => teachers.find((t) => t.id === id)?.name ?? null;

  return (
    <section className="mt-6 space-y-4" aria-labelledby="lich-day-heading">
      <h2 id="lich-day-heading" className="text-h3">
        Lịch dạy
      </h2>

      {error && <div className="banner-danger text-sm">{error}</div>}
      {notice && <div className="banner-success text-sm">{notice}</div>}
      {conflicts.length > 0 && (
        <div className="banner-warning text-sm">
          <p className="font-medium">Lịch vừa lưu có {conflicts.length} chỗ trùng (vẫn được lưu):</p>
          <ul className="mt-1 list-disc pl-5">
            {conflicts.slice(0, 6).map((c, i) => (
              <li key={i}>
                {formatVN(c.startsAt, { weekday: "short", day: "2-digit", month: "2-digit" })} {formatTime(c.startsAt)} —{" "}
                {c.kind === "teacher" ? "giáo viên đang dạy" : "phòng đang dùng"} lớp “{c.otherSectionName}”
              </li>
            ))}
            {conflicts.length > 6 && <li>và {conflicts.length - 6} chỗ khác</li>}
          </ul>
        </div>
      )}
      {detail.planSessions > 0 && detail.unscheduledSessions > 0 && (
        <div className="banner-info text-sm">
          Giáo án có {detail.planSessions} buổi nhưng lịch mới có {detail.countedMeetings} buổi, còn {detail.unscheduledSessions} buổi giáo án
          chưa có lịch dạy. Tăng “Tổng số buổi” rồi bấm “Áp dụng lịch”.
        </div>
      )}
      {detail.planSessions > 0 && detail.meetingsWithoutPlan > 0 && (
        <div className="banner-info text-sm">
          Có {detail.meetingsWithoutPlan} buổi học nằm ngoài giáo án ({detail.planSessions} buổi): các buổi này chưa có giáo án.
        </div>
      )}
      {detail.schedule && detail.shortBy > 0 && (
        <div className="banner-info text-sm">
          Kế hoạch có {detail.schedule.totalMeetings} buổi, hiện mới có {detail.countedMeetings}. Bấm “Áp dụng lịch” để thêm
          buổi thay cho buổi đã huỷ, hoặc thêm buổi dạy bù.
        </div>
      )}

      {canManage && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={autoSend}
            onChange={async (e) => {
              const enabled = e.target.checked;
              setAutoSend(enabled);
              const r = await fetch(apiUrl(`/api/sections/${sectionId}/summary-setting`), {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled }),
              });
              if (!r.ok) setAutoSend(!enabled);
            }}
          />
          <span>
            Tự gửi tổng kết cho cả lớp khi kết thúc buổi
            <span className="block text-meta text-muted">Tổng kết gồm bài đã học, từ vựng, bài tập về nhà và buổi sau. Tắt thì thầy/cô gửi bằng nút riêng.</span>
          </span>
        </label>
      )}

      {canManage && (
      <div className="card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-meta">Ngày bắt đầu</span>
            <input
              type="date"
              className="input mt-1 w-full"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-meta">Tổng số buổi</span>
            <input
              type="number"
              min={1}
              max={200}
              className="input mt-1 w-full"
              value={form.total}
              onChange={(e) => setForm({ ...form, total: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-meta">Khung giờ lặp hằng tuần</p>
          {form.slots.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-token p-3 xl:grid-cols-6">
              <select
                aria-label="Thứ"
                className="select"
                value={s.weekday}
                onChange={(e) => setSlot(i, { weekday: Number(e.target.value) })}
              >
                {WEEKDAYS.map(([n, label]) => (
                  <option key={n} value={n}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Giờ bắt đầu"
                type="time"
                className="input"
                value={s.startTime}
                onChange={(e) => setSlot(i, { startTime: e.target.value })}
              />
              <input
                aria-label="Thời lượng (phút)"
                type="number"
                min={15}
                max={480}
                className="input"
                placeholder="Phút"
                value={s.durationMin}
                onChange={(e) => setSlot(i, { durationMin: Number(e.target.value) })}
              />
              <input
                aria-label="Phòng"
                className="input"
                placeholder="Phòng"
                value={s.room}
                onChange={(e) => setSlot(i, { room: e.target.value })}
              />
              <select
                aria-label="Giáo viên dự kiến"
                className="select col-span-2 xl:col-span-1"
                value={s.plannedTeacherId}
                onChange={(e) => setSlot(i, { plannedTeacherId: e.target.value })}
              >
                <option value="">Chưa gán giáo viên</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost btn-sm col-span-2 xl:col-span-1"
                disabled={form.slots.length === 1}
                onClick={() => setForm({ ...form, slots: form.slots.filter((_, k) => k !== i) })}
              >
                Bỏ khung này
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setForm({ ...form, slots: [...form.slots, blankSlot()] })}
          >
            + Thêm khung giờ
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy || !form.startDate} onClick={apply}>
            {busy ? "Đang lưu…" : "Áp dụng lịch"}
          </button>
          <p className="text-caption text-muted">
            Chỉ các buổi chưa diễn ra được sinh lại. Buổi đã dạy, đã huỷ, dạy bù và buổi đã sửa riêng giữ nguyên.
          </p>
        </div>
      </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h4">Các buổi học ({detail.countedMeetings})</h3>
        {canManage && (
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setMakeup({ startsAt: "", durationMin: "120", room: "", makeupOfId: "" })}
        >
          + Thêm buổi dạy bù
        </button>
        )}
      </div>

      {makeup && (
        <div className="card grid grid-cols-2 gap-2 p-4 xl:grid-cols-5">
          <input
            aria-label="Giờ bắt đầu buổi dạy bù"
            type="datetime-local"
            className="input"
            value={makeup.startsAt}
            onChange={(e) => setMakeup({ ...makeup, startsAt: e.target.value })}
          />
          <input
            aria-label="Thời lượng (phút)"
            type="number"
            className="input"
            value={makeup.durationMin}
            onChange={(e) => setMakeup({ ...makeup, durationMin: e.target.value })}
          />
          <input
            aria-label="Phòng"
            className="input"
            placeholder="Phòng"
            value={makeup.room}
            onChange={(e) => setMakeup({ ...makeup, room: e.target.value })}
          />
          <select
            aria-label="Dạy bù cho buổi nào"
            className="select"
            value={makeup.makeupOfId}
            onChange={(e) => setMakeup({ ...makeup, makeupOfId: e.target.value })}
          >
            <option value="">Không gắn buổi nào</option>
            {cancelled.map((m) => (
              <option key={m.id} value={m.id}>
                Bù cho {formatVN(m.startsAt, { day: "2-digit", month: "2-digit" })} (đã huỷ)
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={saveMakeup}>
              Lưu
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMakeup(null)}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {detail.meetings.length === 0 ? (
        <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Lớp chưa có buổi nào. Điền khung giờ ở trên rồi bấm “Áp dụng lịch”.
        </div>
      ) : (
        <ul className="divide-y divide-token overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))]">
          {detail.meetings.map((m) => {
            const isEditing = editing?.id === m.id;
            return (
              <li key={m.id} className={`px-4 py-3 text-sm ${m.status === "cancelled" ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-16 font-semibold">{m.seq ? `Buổi ${m.seq}` : "—"}</span>
                  <span className={m.status === "cancelled" ? "line-through" : ""}>
                    {formatVN(m.startsAt, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
                    {formatTime(m.startsAt)}–{formatTime(m.endsAt)}
                  </span>
                  {m.room && <span className="text-muted">Phòng {m.room}</span>}
                  {(m.plannedTeacherName ?? teacherName(m.plannedTeacherId)) && (
                    <span className="text-muted">{m.plannedTeacherName ?? teacherName(m.plannedTeacherId)}</span>
                  )}
                  {m.status === "cancelled" && <span className="chip-danger text-xs">Đã huỷ</span>}
                  {m.status === "held" && <span className="chip-success text-xs">Đã dạy</span>}
                  {m.makeupOfId && <span className="chip-accent text-xs">Dạy bù</span>}
                  {m.status !== "cancelled" && (
                    <span className="ml-auto flex gap-2">
                      {(canManage || !m.plannedTeacherId || m.plannedTeacherId === viewerId) && (
                        <Link
                          href={`/instructor/courses/${courseId}/sections/${sectionId}/meetings/${m.id}`}
                          className="btn-secondary btn-sm"
                        >
                          Điểm danh
                        </Link>
                      )}
                      {(canManage || !m.plannedTeacherId || m.plannedTeacherId === viewerId) && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          aria-expanded={planOpenId === m.id}
                          onClick={() => setPlanOpenId(planOpenId === m.id ? null : m.id)}
                        >
                          Kế hoạch
                        </button>
                      )}
                      {canManage && m.status === "planned" && (
                        <>
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() =>
                              setEditing({
                                id: m.id,
                                startsAt: toDateTimeInputValue(m.startsAt),
                                durationMin: String(Math.round((Date.parse(m.endsAt) - Date.parse(m.startsAt)) / 60000)),
                                room: m.room ?? "",
                                teacher: m.plannedTeacherId ?? "",
                              })
                            }
                          >
                            Sửa
                          </button>
                          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => cancel(m)}>
                            Huỷ buổi
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
                {m.status !== "cancelled" && m.plan && (
                  <p className="mt-1 text-caption text-muted">
                    <span className="font-medium text-[rgb(var(--text))]">Giáo án:</span>{" "}
                    {m.plan.title ?? (m.plan.lessons.length === 0 ? "chưa có bài nào" : "")}
                    {m.planCustomized && <span className="chip-accent ml-2 text-xs">Đã tuỳ chỉnh</span>}
                    {m.plan.title && m.plan.lessons.length > 0 && " — "}
                    {m.plan.lessons.map((l, i) => (
                      <span key={l.id}>
                        {i > 0 && ", "}
                        <Link href={`/learn/${m.plan!.courseSlug}/lessons/${l.id}`} className="underline underline-offset-2 hover:text-[rgb(var(--text))]">
                          {l.title}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                {m.status !== "cancelled" && !m.plan && (detail.planSessions > 0 || canManage) && (
                  <p className="mt-1 text-caption text-muted">
                    Chưa có giáo án cho buổi này.{canManage && " Bấm \"Kế hoạch\" để thêm bài vào buổi."}
                  </p>
                )}
                {planOpenId === m.id && m.status !== "cancelled" && (
                  <MeetingPlanEditor
                    meetingId={m.id}
                    canManage={canManage}
                    courseTree={courseTree}
                    onChanged={reload}
                    onClose={() => setPlanOpenId(null)}
                  />
                )}
                {m.status === "cancelled" && m.cancelReason && (
                  <p className="mt-1 text-caption text-muted">Lý do: {m.cancelReason}</p>
                )}
                {isEditing && editing && (
                  <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-5">
                    <input
                      aria-label="Giờ bắt đầu"
                      type="datetime-local"
                      className="input"
                      value={editing.startsAt}
                      onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                    />
                    <input
                      aria-label="Thời lượng (phút)"
                      type="number"
                      className="input"
                      value={editing.durationMin}
                      onChange={(e) => setEditing({ ...editing, durationMin: e.target.value })}
                    />
                    <input
                      aria-label="Phòng"
                      className="input"
                      placeholder="Phòng"
                      value={editing.room}
                      onChange={(e) => setEditing({ ...editing, room: e.target.value })}
                    />
                    <select
                      aria-label="Giáo viên dự kiến"
                      className="select"
                      value={editing.teacher}
                      onChange={(e) => setEditing({ ...editing, teacher: e.target.value })}
                    >
                      <option value="">Chưa gán giáo viên</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={saveEdit}>
                        Lưu
                      </button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                        Đóng
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
