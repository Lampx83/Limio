"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate } from "@/lib/datetime";

interface InstructorRow {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  addedAt: string;
}

interface Assignments {
  sections: Array<{ id: string; name: string }>;
  upcomingMeetings: number;
  slots: number;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Chủ khóa",
  "co-instructor": "Đồng giảng viên",
  "non-editing-teacher": "GV không chỉnh sửa",
  "teaching-assistant": "Trợ giảng",
};

const ASSIGNABLE_ROLES: Array<{ value: string; label: string; hint: string }> = [
  {
    value: "co-instructor",
    label: "Đồng giảng viên",
    hint: "Sửa nội dung như chủ khóa",
  },
  {
    value: "non-editing-teacher",
    label: "GV không chỉnh sửa",
    hint: "Chấm bài + can thiệp lúc thi, không sửa nội dung",
  },
  {
    value: "teaching-assistant",
    label: "Trợ giảng",
    hint: "Chỉ chấm bài, không can thiệp lúc thi",
  },
];

const AVATAR_TONES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
];

function avatarTone(name: string): string {
  const code = name.trim().toUpperCase().charCodeAt(0) || 0;
  return AVATAR_TONES[code % AVATAR_TONES.length]!;
}

export default function InstructorsSection({
  courseId,
  isOwner,
}: {
  courseId: string;
  isOwner: boolean;
}) {
  const [rows, setRows] = useState<InstructorRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("co-instructor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Gỡ một người: mở hộp xác nhận có số việc đang giao và ô chọn người nhận bàn giao.
  const [removing, setRemoving] = useState<{ userId: string; label: string; a: Assignments; handover: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/courses/${courseId}/instructors`));
    if (res.ok) setRows((await res.json()) as InstructorRow[]);
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    const roleLabel = ROLE_LABEL[role] ?? role;
    if (!confirm(`Thêm "${trimmed}" làm "${roleLabel}" của khóa này?`)) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/instructors`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, role }),
    });
    setBusy(false);
    if (res.ok) {
      const r = (await res.json()) as { invited: boolean };
      setEmail("");
      setMsg(
        r.invited
          ? "Đã tạo tài khoản mới và gửi email đặt mật khẩu."
          : "Đã thêm — họ sẽ thấy khóa này ở lần đăng nhập tiếp theo.",
      );
      await load();
      return;
    }
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setErr(
      d.error === "invalid_email"
        ? "Email không hợp lệ."
        : d.error === "forbidden"
          ? "Chỉ chủ khóa hoặc quản trị của tổ chức mới thêm được giảng viên."
          : d.error === "cannot_change_owner_role"
            ? "Không thể đổi vai trò của chủ khóa qua đây."
            : `Thêm thất bại: ${d.error ?? "unknown"}`,
    );
  }

  async function askRemove(userId: string, label: string) {
    setErr(null);
    setMsg(null);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/instructors/${userId}`));
    const a: Assignments = res.ok ? ((await res.json()) as Assignments) : { sections: [], upcomingMeetings: 0, slots: 0 };
    setRemoving({ userId, label, a, handover: "" });
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    const q = removing.handover ? `?handoverTo=${encodeURIComponent(removing.handover)}` : "";
    const res = await fetch(apiUrl(`/api/courses/${courseId}/instructors/${removing.userId}${q}`), { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setMsg(`Đã gỡ "${removing.label}": người này không còn dạy được trên khóa.`);
      setRemoving(null);
      await load();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(d.error === "forbidden" ? "Bạn không có quyền gỡ giảng viên của khóa này." : `Gỡ thất bại: ${d.error ?? "unknown"}`);
    }
  }

  return (
    <div className="space-y-4">
      {isOwner && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            placeholder="email@vidu.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input min-w-[240px] flex-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input w-auto"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value} title={r.hint}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="btn-primary btn-sm">
            {busy ? "Đang thêm…" : "Thêm"}
          </button>
        </form>
      )}
      {isOwner && (
        <p className="text-xs text-muted">
          {ASSIGNABLE_ROLES.find((r) => r.value === role)?.hint}
        </p>
      )}
      {err && <p className="text-sm text-danger-600">{err}</p>}
      {msg && <p className="text-sm text-success-600">{msg}</p>}

      {removing && (
        <div role="dialog" aria-label="Gỡ giảng viên" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:bg-red-950/20" data-testid="remove-instructor">
          <p className="text-sm font-semibold">Gỡ "{removing.label}" khỏi khóa này?</p>
          <p className="text-sm">Người này sẽ không còn dạy được trên khóa (xem bài, chiếu lớp, điểm danh) ngay lập tức.</p>
          {removing.a.sections.length + removing.a.upcomingMeetings + removing.a.slots > 0 ? (
            <div className="space-y-2 text-sm">
              <p>
                Họ đang được giao:
                {removing.a.sections.length > 0 && ` phụ trách ${removing.a.sections.length} lớp (${removing.a.sections.map((s) => s.name).join(", ")})`}
                {removing.a.upcomingMeetings > 0 && `, ${removing.a.upcomingMeetings} buổi sắp tới`}
                {removing.a.slots > 0 && `, ${removing.a.slots} khung giờ lặp`}.
                Các buổi đã dạy giữ nguyên.
              </p>
              <label className="flex flex-wrap items-center gap-2">
                <span>Chuyển các việc này cho</span>
                <select className="input w-auto" value={removing.handover} onChange={(e) => setRemoving({ ...removing, handover: e.target.value })}>
                  <option value="">Để trống (chưa có người dạy)</option>
                  {(rows ?? []).filter((r) => r.userId !== removing.userId).map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.displayName || r.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted">Họ không được giao lớp hay buổi nào.</p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={confirmRemove} className="btn-primary btn-sm">
              {busy ? "Đang gỡ…" : "Gỡ"}
            </button>
            <button type="button" disabled={busy} onClick={() => setRemoving(null)} className="btn-ghost btn-sm">
              Không gỡ
            </button>
          </div>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-muted">Đang tải…</p>
      ) : (
        <ul className="divide-y divide-token overflow-hidden rounded-xl border border-token">
          {rows.map((r) => (
            <li
              key={r.userId}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    r.role === "owner" ? "bg-lime-600 text-white" : avatarTone(r.displayName || r.email)
                  }`}
                  aria-hidden
                >
                  {(r.displayName || r.email).trim().charAt(0).toUpperCase()}
                </span>
                <p className="min-w-0 truncate text-sm">
                  <span className="font-medium">{r.displayName || r.email}</span>
                  {r.displayName && <span className="ml-2 text-xs text-muted">{r.email}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={r.role === "owner" ? "chip-brand" : "chip"}>
                  {ROLE_LABEL[r.role] ?? r.role}
                </span>
                <span className="text-xs text-faint">
                  từ {formatDate(r.addedAt)}
                </span>
                {isOwner && r.role !== "owner" && (
                  <button
                    onClick={() => askRemove(r.userId, r.displayName || r.email)}
                    className="btn-ghost btn-sm text-red-600"
                  >
                    Gỡ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
