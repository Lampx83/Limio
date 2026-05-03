"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/institution-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, fullName, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Tạo tài khoản thất bại");
        return;
      }
      setSuccess(`Đã tạo ${role === "student" ? "sinh viên" : "giảng viên"}: @${username}`);
      setUsername("");
      setFullName("");
      setPassword("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Tạo tài khoản mới
      </button>
    );

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <h3 className="font-semibold">Tài khoản mới</h3>
      <div>
        <label className="label">Vai trò</label>
        <div className="flex gap-2">
          {(["student", "instructor"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 px-3 py-2 rounded border text-sm ${
                role === r
                  ? "border-brand-600 bg-brand-50 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            >
              {r === "student" ? "Sinh viên" : "Giảng viên"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Họ tên</label>
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div>
        <label className="label">Tên đăng nhập (chữ thường, số, _, .)</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          required
          pattern="^[a-z0-9_.]{3,20}$"
        />
      </div>
      <div>
        <label className="label">Mật khẩu (≥ 6 ký tự)</label>
        <input
          type="text"
          className="input font-mono"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {success && <div className="text-sm text-emerald-700">{success}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary"
        >
          Đóng
        </button>
        <button disabled={submitting} className="btn-primary">
          {submitting ? "Đang tạo..." : "Tạo tài khoản"}
        </button>
      </div>
    </form>
  );
}
