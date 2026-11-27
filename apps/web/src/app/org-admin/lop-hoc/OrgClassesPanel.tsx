"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Trash2, UserRound } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Lớp của một khoá cho quản trị trường (CENTER, xếp lớp): tạo lớp, chọn giáo viên phụ trách, xoá lớp trống, và đi tới trang lớp để đặt lịch, điểm danh.
 * Dùng các API sẵn có (`/api/courses/:id/sections`, `/api/courses/:id/cohorts`, `/api/cohorts/:id`, `/api/sections/:id`); quyền kiểm ở máy chủ.
 */
interface Section {
  id: string;
  name: string;
  enrolledCount: number;
}
interface Teacher {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

const ERR: Record<string, string> = {
  section_name_taken: "Đã có lớp tên này trong khoá.",
  section_has_enrollments: "Lớp còn học viên, hãy chuyển học viên sang lớp khác trước khi xoá.",
  forbidden: "Thầy/cô không có quyền thực hiện thao tác này.",
  validation_failed: "Thông tin chưa hợp lệ.",
};

async function errText(r: Response): Promise<string> {
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  return (j.error && ERR[j.error]) || `Không làm được (${r.status}).`;
}

function TeacherSelect({ teachers, value, onChange, disabled, label }: { teachers: Teacher[]; value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <select className="input h-9 py-0 text-sm" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Chưa có giáo viên</option>
      {teachers.map((t) => (
        <option key={t.userId} value={t.userId}>
          {t.displayName || t.email}
        </option>
      ))}
    </select>
  );
}

export default function OrgClassesPanel({ courseId }: { courseId: string }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [schedules, setSchedules] = useState<Record<string, { hasSchedule: boolean; text: string }> | null>(null);
  const [teacherOf, setTeacherOf] = useState<Record<string, string | null>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, c, t] = await Promise.all([
      fetch(apiUrl(`/api/courses/${courseId}/sections`)),
      fetch(apiUrl(`/api/courses/${courseId}/cohorts`)),
      fetch(apiUrl(`/api/courses/${courseId}/instructors`)),
    ]);
    if (s.ok) {
      const j = (await s.json()) as { sections: Section[]; schedules?: Record<string, { hasSchedule: boolean; text: string }> | null };
      setSections(j.sections);
      setSchedules(j.schedules ?? null);
    } else {
      setErr(await errText(s));
      setSections([]);
    }
    if (c.ok) {
      const j = (await c.json()) as { cohorts: Array<{ id: string; instructorId: string | null }> };
      setTeacherOf(Object.fromEntries(j.cohorts.map((x) => [x.id, x.instructorId])));
    }
    if (t.ok) setTeachers((await t.json()) as Teacher[]);
  }, [courseId]);

  useEffect(() => {
    setSections(null);
    setErr(null);
    void load();
  }, [load]);

  // Giáo viên của khoá có thể vừa được thêm ở khối bên cạnh: nạp lại khi quay lại tab.
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("create");
    setErr(null);
    const r = await fetch(apiUrl(`/api/courses/${courseId}/sections`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    if (!r.ok) {
      setErr(await errText(r));
      setBusy(null);
      return;
    }
    const { section } = (await r.json()) as { section: Section };
    if (newTeacher) {
      const p = await fetch(apiUrl(`/api/cohorts/${section.id}`), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ instructorId: newTeacher }) });
      if (!p.ok) setErr(`Đã tạo lớp nhưng chưa gán được giáo viên: ${await errText(p)}`);
    }
    setName("");
    setNewTeacher("");
    await load();
    setBusy(null);
  };

  const assign = async (sectionId: string, instructorId: string) => {
    setBusy(sectionId);
    setErr(null);
    setTeacherOf((m) => ({ ...m, [sectionId]: instructorId || null })); // hiện ngay, máy chủ xác nhận sau (lỗi thì nạp lại giá trị thật)
    const r = await fetch(apiUrl(`/api/cohorts/${sectionId}`), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ instructorId: instructorId || null }) });
    if (!r.ok) setErr(await errText(r));
    await load();
    setBusy(null);
  };

  const remove = async (s: Section) => {
    if (!window.confirm(`Xoá lớp "${s.name}"? Lớp phải không còn học viên.`)) return;
    setBusy(s.id);
    setErr(null);
    const r = await fetch(apiUrl(`/api/sections/${s.id}`), { method: "DELETE" });
    if (!r.ok) setErr(await errText(r));
    await load();
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-2xl border border-token p-3">
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="mb-1 block font-medium">Tên lớp mới</span>
          <input className="input h-9 py-0" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vd: HSK1 Tối T3-T5" maxLength={100} />
        </label>
        <label className="min-w-[10rem] text-sm">
          <span className="mb-1 block font-medium">Giáo viên phụ trách</span>
          <TeacherSelect teachers={teachers} value={newTeacher} onChange={setNewTeacher} label="Giáo viên phụ trách lớp mới" />
        </label>
        <button type="submit" disabled={busy !== null || !name.trim()} className="btn-primary btn-sm inline-flex h-9 items-center gap-1.5">
          <Plus size={15} aria-hidden /> Thêm lớp
        </button>
      </form>

      {err && <div className="banner-danger rounded-xl px-3 py-2 text-sm" role="alert">{err}</div>}

      {sections === null ? (
        <p className="text-sm text-muted">Đang tải…</p>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-token p-6 text-center text-sm text-muted">Khoá này chưa có lớp nào. Thêm lớp ở trên, rồi đặt lịch cho từng lớp.</div>
      ) : (
        <ul className="divide-y divide-[rgb(var(--border))] overflow-hidden rounded-2xl border border-token" data-testid="org-class-list">
          {sections.map((s) => {
            const sch = schedules?.[s.id];
            const teacher = teacherOf[s.id] ?? "";
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <span>{s.enrolledCount} học viên</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={12} aria-hidden />
                      {sch?.hasSchedule ? sch.text : <span className="text-amber-700 dark:text-amber-400">Chưa đặt lịch</span>}
                    </span>
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <UserRound size={15} className={teacher ? "text-muted" : "text-amber-600"} aria-hidden />
                  <TeacherSelect teachers={teachers} value={teacher} onChange={(v) => void assign(s.id, v)} disabled={busy === s.id} label={`Giáo viên phụ trách ${s.name}`} />
                </label>
                <Link href={`/instructor/courses/${courseId}/sections/${s.id}`} className="btn-pill" title="Danh sách học viên, lịch dạy và điểm danh của lớp">
                  Lịch và học viên
                </Link>
                <button type="button" onClick={() => void remove(s)} disabled={busy === s.id} className="rounded-full p-2 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-red-600" aria-label={`Xoá lớp ${s.name}`} title="Xoá lớp">
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
