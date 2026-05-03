"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewInstitutionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, name, address, contact_email: contactEmail,
          admin: adminUsername.trim()
            ? { username: adminUsername, fullName: adminFullName, password: adminPassword }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Tạo cơ sở thất bại");
        return;
      }
      setSuccess(`Đã tạo cơ sở: ${name} (${code})`);
      setCode("");
      setName("");
      setAddress("");
      setContactEmail("");
      setAdminUsername("");
      setAdminFullName("");
      setAdminPassword("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Tạo cơ sở giáo dục mới
      </button>
    );

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5 space-y-3">
      <h3 className="font-semibold">Cơ sở giáo dục mới</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Mã (vd: HUST, NEU)</label>
          <input
            className="input font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            pattern="^[A-Z0-9]{2,15}$"
          />
        </div>
        <div>
          <label className="label">Email liên hệ</label>
          <input
            type="email"
            className="input"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">Tên đầy đủ</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label">Địa chỉ</label>
        <input
          className="input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <details className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <summary className="text-sm font-medium cursor-pointer">
          + Tạo tài khoản Quản trị Cơ sở (tuỳ chọn)
        </summary>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <input
            className="input"
            placeholder="Họ tên QT"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
          />
          <input
            className="input"
            placeholder="username"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value.toLowerCase())}
          />
          <input
            className="input font-mono"
            placeholder="mật khẩu"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </div>
      </details>

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
          {submitting ? "Đang tạo..." : "Tạo cơ sở"}
        </button>
      </div>
    </form>
  );
}
