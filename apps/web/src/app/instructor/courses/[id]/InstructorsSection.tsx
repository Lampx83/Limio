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
          ? "Chỉ chủ khóa mới được thêm đồng giảng viên."
          : d.error === "cannot_change_owner_role"
            ? "Không thể đổi vai trò của chủ khóa qua đây."
            : `Thêm thất bại: ${d.error ?? "unknown"}`,
    );
  }

  async function remove(userId: string, label: string) {
    if (!confirm(`Gỡ "${label}" khỏi vai trò giảng viên của khóa này?`)) return;
    const res = await fetch(
      apiUrl(`/api/courses/${courseId}/instructors/${userId}`),
      { method: "DELETE" },
    );
    if (res.ok) {
      await load();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(`Gỡ thất bại: ${d.error ?? "unknown"}`);
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

      {rows === null ? (
        <p className="text-sm text-muted">Đang tải…</p>
      ) : (
        <ul className="divide-y divide-token overflow-hidden rounded-xl border border-token">
          {rows.map((r) => (
            <li
              key={r.userId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{r.displayName || r.email}</p>
                <p className="text-xs text-muted">{r.email}</p>
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
                    onClick={() => remove(r.userId, r.displayName || r.email)}
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
