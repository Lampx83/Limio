"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  roles: string[];
  providers: string[];
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

const ROLE_OPTIONS = [
  { value: "", label: "Tất cả role" },
  { value: "admin", label: "Admin" },
  { value: "instructor", label: "Instructor" },
  { value: "mentor", label: "Mentor" },
  { value: "learner", label: "Learner" },
];

export default function UsersBrowser() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(0);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    params.set("page", String(page));
    params.set("limit", "25");
    fetch(`/api/admin/users?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsersResponse | null) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, role, page]);

  async function impersonate(userId: string) {
    setImpersonatingId(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Không thể chuyển view: ${body.error ?? res.status}`);
        setImpersonatingId(null);
        return;
      }
      window.location.href = "/";
    } catch (e) {
      alert(`Lỗi mạng: ${(e as Error).message}`);
      setImpersonatingId(null);
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="users-search" className="label">
              Tìm theo email / tên
            </label>
            <input
              id="users-search"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              className="input mt-1"
              placeholder="vd: alice@... hoặc Alice"
            />
          </div>
          <div>
            <label htmlFor="users-role" className="label">
              Role
            </label>
            <select
              id="users-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(0);
              }}
              className="select mt-1"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Người dùng</th>
              <th className="px-4 py-2 text-left font-medium">Roles</th>
              <th className="px-4 py-2 text-left font-medium">SSO</th>
              <th className="px-4 py-2 text-left font-medium">Tạo lúc</th>
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !data && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {data?.users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Không có user nào khớp.
                </td>
              </tr>
            )}
            {data?.users.map((u) => (
              <tr key={u.id} className="hover:bg-base-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                      {(u.displayName || u.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.displayName}</p>
                      <p className="truncate text-xs text-faint">{u.email}</p>
                    </div>
                    {!u.emailVerified && (
                      <span
                        className="chip-warning"
                        title="Email chưa xác thực"
                      >
                        ⚠
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {u.roles.length === 0 ? (
                    <span className="text-faint">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className={roleChipClass(r)}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">
                  {u.providers.length === 0 ? "—" : u.providers.join(", ")}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted tabular-nums">
                  {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="btn-secondary btn-sm"
                    >
                      Quản lý
                    </Link>
                    <button
                      type="button"
                      onClick={() => impersonate(u.id)}
                      disabled={impersonatingId === u.id}
                      className="btn-ghost btn-sm"
                      title="Xem ứng dụng dưới vai trò user này (read-only)"
                    >
                      {impersonatingId === u.id ? "…" : "👤 Xem"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>
            Trang {data.page + 1} / {data.pageCount} · {data.total} user
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="btn-ghost btn-sm"
            >
              ← Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pageCount - 1 || loading}
              className="btn-ghost btn-sm"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </>
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
