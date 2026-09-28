"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";

interface AdminEntry {
  userId: string;
  email: string;
  displayName: string;
  grantedAt: string;
  grantedByName: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: "Nhập email trước đã",
  user_not_found: "Không tìm thấy user nào với email này",
  already_admin: "User này đã là OrgAdmin của tổ chức này rồi",
  org_not_found: "Không tìm thấy tổ chức",
  forbidden: "Bạn không có quyền thực hiện thao tác này",
  not_admin: "User này không phải OrgAdmin của tổ chức này",
};

function errorMessage(code: unknown): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `Lỗi: ${code ?? "unknown"}`;
}

export default function OrgAdminManager({
  organizationId,
  initialAdmins,
}: {
  organizationId: string;
  initialAdmins: AdminEntry[];
}) {
  const [admins, setAdmins] = useState<AdminEntry[]>(initialAdmins);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/orgs/${organizationId}/admins`),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(body.error));
        return;
      }
      const refreshed = await fetch(
        apiUrl(`/api/admin/orgs/${organizationId}/admins`),
      );
      if (refreshed.ok) {
        const data = (await refreshed.json()) as { admins: AdminEntry[] };
        setAdmins(data.admins);
      }
      setEmail("");
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string, displayName: string) {
    if (!confirm(`Thu hồi quyền OrgAdmin của ${displayName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/orgs/${organizationId}/admins/${userId}`),
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(errorMessage(body.error));
        return;
      }
      setAdmins((rs) => rs.filter((r) => r.userId !== userId));
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {admins.length === 0 ? (
        <p className="text-sm text-muted">Chưa có OrgAdmin nào.</p>
      ) : (
        <ul className="space-y-1.5">
          {admins.map((a) => (
            <li
              key={a.userId}
              className="flex items-center justify-between rounded-lg border border-token p-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.displayName}</p>
                <p className="truncate text-xs text-faint">{a.email}</p>
                <p className="mt-0.5 text-xs text-faint">
                  Cấp lúc {formatDateTime(a.grantedAt)}
                  {a.grantedByName ? ` bởi ${a.grantedByName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(a.userId, a.displayName)}
                disabled={busy}
                className="shrink-0 text-xs text-danger-600 hover:underline disabled:text-faint"
              >
                Thu hồi
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={grant}
        className="mt-4 flex items-end gap-2 border-t border-token pt-3"
      >
        <div className="flex-1">
          <label htmlFor="grant-org-admin-email" className="label">
            Cấp quyền OrgAdmin cho user (theo email)
          </label>
          <input
            id="grant-org-admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            placeholder="vd: giaovien@truong.edu.vn"
            required
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "…" : "Cấp quyền"}
        </button>
      </form>

      {error && (
        <p className="mt-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
