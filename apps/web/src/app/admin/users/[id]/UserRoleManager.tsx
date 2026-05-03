"use client";

import { useState } from "react";

interface RoleEntry {
  userRoleId: string;
  roleName: string;
  courseId: string | null;
  courseTitle: string | null;
  grantedAt: string;
}

const ASSIGNABLE_ROLES = ["admin", "instructor", "mentor", "learner"];

export default function UserRoleManager({
  userId,
  initialRoles,
}: {
  userId: string;
  initialRoles: RoleEntry[];
}) {
  const [roles, setRoles] = useState<RoleEntry[]>(initialRoles);
  const [pickRole, setPickRole] = useState<string>("learner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/users/${userId}/roles`);
    if (!res.ok) return;
    const data = (await res.json()) as { roles: Array<{
      userRoleId: string;
      roleName: string;
      courseId: string | null;
    }> };
    setRoles((current) =>
      data.roles.map((r) => {
        const existing = current.find((c) => c.userRoleId === r.userRoleId);
        return {
          userRoleId: r.userRoleId,
          roleName: r.roleName,
          courseId: r.courseId,
          courseTitle: existing?.courseTitle ?? null,
          grantedAt: existing?.grantedAt ?? new Date().toISOString(),
        };
      }),
    );
  }

  async function grant() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleName: pickRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`Không cấp được: ${body.error ?? res.status}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userRoleId: string) {
    if (!confirm("Thu hồi role này?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${userId}/roles/${userRoleId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`Không thu hồi được: ${body.error ?? res.status}`);
        return;
      }
      setRoles((rs) => rs.filter((r) => r.userRoleId !== userRoleId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {roles.length === 0 ? (
        <p className="text-sm text-muted">Chưa có role nào.</p>
      ) : (
        <ul className="space-y-1.5">
          {roles.map((r) => (
            <li
              key={r.userRoleId}
              className="flex items-center justify-between rounded-lg border border-token p-2.5 text-sm"
            >
              <div>
                <span className={roleChipClass(r.roleName)}>{r.roleName}</span>
                {r.courseTitle && (
                  <span className="ml-2 text-xs text-faint">
                    @ {r.courseTitle}
                  </span>
                )}
                {!r.courseTitle && r.courseId && (
                  <span className="ml-2 text-xs text-faint">
                    @ course {r.courseId.slice(0, 8)}…
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => revoke(r.userRoleId)}
                disabled={busy}
                className="text-xs text-danger-600 hover:underline disabled:text-faint"
              >
                Thu hồi
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-end gap-2 border-t border-token pt-3">
        <div className="flex-1">
          <label htmlFor="grant-role" className="label">
            Cấp role mới (platform-wide)
          </label>
          <select
            id="grant-role"
            value={pickRole}
            onChange={(e) => setPickRole(e.target.value)}
            className="select mt-1"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={grant}
          disabled={busy}
          className="btn-primary btn-sm"
        >
          {busy ? "…" : "Cấp"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

function roleChipClass(role: string): string {
  switch (role) {
    case "admin":
      return "chip-danger";
    case "instructor":
      return "chip-brand";
    case "mentor":
      return "chip-accent";
    case "learner":
      return "chip-success";
    default:
      return "chip";
  }
}
