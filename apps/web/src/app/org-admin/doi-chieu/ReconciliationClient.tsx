"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckInRow, OrgReconciliation } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { formatTime, formatVN, fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";
import CheckInFlags from "@/components/CheckInFlags";

const EDIT_ERRORS: Record<string, string> = {
  validation_failed: "Kiểm tra lại giờ vào, giờ ra và lý do (bắt buộc).",
  forbidden: "Bạn không có quyền sửa buổi này.",
};

/** Bảng tổng theo giáo viên, danh sách buổi, và sửa khi giáo viên quên bấm (lý do bắt buộc). */
export default function ReconciliationClient({
  organizationId,
  report,
  teachers,
}: {
  organizationId: string;
  report: OrgReconciliation;
  teachers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(String(report.thresholdMin));
  const [savingTh, setSavingTh] = useState(false);

  const saveThreshold = async () => {
    setSavingTh(true);
    try {
      const r = await fetch(apiUrl(`/api/orgs/${organizationId}/checkin-threshold`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minutes: Number(threshold) }),
      });
      if (!r.ok) {
        toast.error("Chưa đổi được ngưỡng", { description: r.status === 400 ? "Nhập số phút từ 5 đến 120." : undefined });
        return;
      }
      toast.success("Đã đổi ngưỡng");
      router.refresh();
    } catch {
      toast.error("Chưa đổi được ngưỡng", { description: "Mạng không ổn định, thử lại sau." });
    } finally {
      setSavingTh(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <section className="card p-4" aria-labelledby="th-heading">
        <h2 id="th-heading" className="text-h4">
          Ngưỡng lệch giờ
        </h2>
        <p className="mt-1 text-sm text-muted">
          Vào sau giờ bắt đầu hoặc ra trước giờ kết thúc quá số phút này thì tính là trễ hoặc kết thúc sớm. Mặc định 15 phút.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={120}
            className="input w-24"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            aria-label="Ngưỡng lệch giờ, số phút"
          />
          <span className="text-sm">phút</span>
          <button type="button" className="btn-secondary" onClick={saveThreshold} disabled={savingTh || Number(threshold) === report.thresholdMin}>
            Lưu
          </button>
        </div>
      </section>

      <section aria-labelledby="tally-heading">
        <h2 id="tally-heading" className="text-h4">
          Theo giáo viên
        </h2>
        {report.teachers.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tuần này chưa có buổi nào đã diễn ra để đối chiếu.</p>
        ) : (
          <div className="mt-2 overflow-x-auto card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="p-3">Giáo viên</th>
                  <th className="p-3">Số buổi</th>
                  <th className="p-3">Đúng giờ</th>
                  <th className="p-3">Trễ</th>
                  <th className="p-3">Kết thúc sớm</th>
                  <th className="p-3">Dạy thay</th>
                  <th className="p-3">Không check-in</th>
                  <th className="p-3">Chưa điểm danh</th>
                </tr>
              </thead>
              <tbody>
                {report.teachers.map((t) => (
                  <tr key={t.teacherId ?? "none"} className="border-t border-token">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3">{t.meetings}</td>
                    <td className="p-3">{t.onTime}</td>
                    <td className="p-3">{t.late}</td>
                    <td className="p-3">{t.earlyEnd}</td>
                    <td className="p-3">{t.substitute}</td>
                    <td className="p-3">{t.noCheckIn}</td>
                    <td className="p-3">{t.attendanceMissing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="meetings-heading">
        <h2 id="meetings-heading" className="text-h4">
          Từng buổi
        </h2>
        {report.meetings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tuần này chưa có buổi nào.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[rgb(var(--border))] card">
            {report.meetings.map((r) => (
              <li key={r.meetingId} className="p-4">
                <button
                  type="button"
                  className="w-full text-left"
                  aria-expanded={openId === r.meetingId}
                  onClick={() => setOpenId(openId === r.meetingId ? null : r.meetingId)}
                >
                  <span className="font-medium">
                    {r.courseTitle} · {r.sectionName}
                    {r.seq ? ` · Buổi ${r.seq}` : ""}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {formatVN(r.startsAt, { weekday: "long", day: "2-digit", month: "2-digit" })} · {formatTime(r.startsAt)}–{formatTime(r.endsAt)} ·{" "}
                    {r.expectedTeacher ? r.expectedTeacher.name : "Chưa xếp giáo viên"}
                  </span>
                </button>
                <div className="mt-2">
                  <CheckInFlags row={r} />
                </div>
                {openId === r.meetingId && (
                  <MeetingDetail
                    row={r}
                    teachers={teachers}
                    onSaved={() => {
                      setOpenId(null);
                      router.refresh();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MeetingDetail({ row, teachers, onSaved }: { row: CheckInRow; teachers: Array<{ id: string; name: string }>; onSaved: () => void }) {
  const [teacherId, setTeacherId] = useState(row.actualTeacher?.id ?? row.expectedTeacher?.id ?? teachers[0]?.id ?? "");
  const [inAt, setInAt] = useState(toDateTimeInputValue(row.startsAt));
  const [outAt, setOutAt] = useState(toDateTimeInputValue(row.endsAt));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const checkedInAt = fromDateTimeInputValue(inAt);
    const checkedOutAt = outAt ? fromDateTimeInputValue(outAt) : null;
    if (!checkedInAt || !teacherId || !reason.trim()) {
      setError(EDIT_ERRORS.validation_failed!);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/meetings/${row.meetingId}/check-in`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teacherId, checkedInAt, checkedOutAt, reason: reason.trim() }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(EDIT_ERRORS[j.error ?? ""] ?? "Chưa lưu được, thử lại sau.");
        return;
      }
      toast.success("Đã bổ sung giờ dạy");
      onSaved();
    } catch {
      setError("Mạng không ổn định, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-token p-3 text-sm">
      <p className="text-muted">
        {row.actualTeacher
          ? `${row.actualTeacher.name} bắt đầu buổi này.`
          : "Chưa có ai bắt đầu buổi này."}{" "}
        Nếu giáo viên quên bấm, thầy/cô bổ sung giờ dạy thực tế bên dưới; lý do được lưu lại.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-caption text-muted">Người dạy</span>
          <select className="input mt-1 w-full" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-caption text-muted">Giờ bắt đầu thực tế</span>
          <input type="datetime-local" className="input mt-1 w-full" value={inAt} onChange={(e) => setInAt(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-caption text-muted">Giờ kết thúc thực tế</span>
          <input type="datetime-local" className="input mt-1 w-full" value={outAt} onChange={(e) => setOutAt(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-caption text-muted">Lý do bổ sung (bắt buộc)</span>
        <input
          type="text"
          maxLength={300}
          className="input mt-1 w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ví dụ: Cô quên bấm, đã xác nhận qua tin nhắn"
        />
      </label>
      {error && (
        <p role="alert" className="banner-danger mt-3">
          {error}
        </p>
      )}
      <button type="button" className="btn-primary mt-3" onClick={save} disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu giờ dạy"}
      </button>
    </div>
  );
}
