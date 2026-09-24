"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate, formatDateTime } from "@/lib/datetime";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastAccessAt: string | null;
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

type SortKey = "displayName" | "createdAt" | "lastAccessAt";
type SortDir = "asc" | "desc";

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
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("learner");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    params.set("sort", sort);
    params.set("dir", dir);
    params.set("page", String(page));
    params.set("limit", "25");
    fetch(apiUrl(`/api/admin/users?${params}`))
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
  }, [q, role, page, sort, dir, reloadKey]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      // Tên: A→Z trước; các cột thời gian: mới nhất trước.
      setDir(key === "displayName" ? "asc" : "desc");
    }
    setPage(0);
  }

  function sortTh(key: SortKey, label: string) {
    const active = sort === key;
    return (
      <th
        className="px-4 py-2 text-left font-medium"
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 uppercase hover:text-body"
        >
          {label}
          <span aria-hidden className={active ? "" : "opacity-40"}>
            {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/admin/users"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error === "invalid_email"
            ? "Email không hợp lệ"
            : data?.error === "missing_name"
              ? "Tên không được bỏ trống"
              : data?.error === "invalid_password"
                ? "Mật khẩu phải từ 8 đến 128 ký tự"
                : data?.error === "invalid_role"
                  ? "Role không hợp lệ"
                  : data?.error === "email_exists"
                    ? "Email đã tồn tại"
                    : `Lỗi: ${data?.error ?? res.status}`;
        setCreateError(msg);
        return;
      }
      setCreateOk(`Đã tạo người dùng ${data.user.email}`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("learner");
      setPage(0);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setCreateError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  async function impersonate(userId: string) {
    setImpersonatingId(userId);
    try {
      const res = await fetch(apiUrl("/api/admin/impersonate"), {
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
      {/* Create user */}
      <form onSubmit={createUser} className="card mb-4">
        <div className="mb-2">
          <h2 className="text-base font-semibold">Thêm người dùng mới</h2>
          <p className="text-xs text-muted">
            Nhập tên, email và mật khẩu để tạo tài khoản. Email chưa được
            xác thực.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-user-name" className="label">
              Tên hiển thị
            </label>
            <input
              id="new-user-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input mt-1"
              placeholder="vd: Nguyễn Văn A"
              required
            />
          </div>
          <div className="min-w-[240px] flex-1">
            <label htmlFor="new-user-email" className="label">
              Email
            </label>
            <input
              id="new-user-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="input mt-1"
              placeholder="vd: a@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="new-user-role" className="label">
              Role
            </label>
            <select
              id="new-user-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="select mt-1"
            >
              <option value="learner">Learner</option>
              <option value="instructor">Instructor</option>
              <option value="mentor">Mentor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-user-password" className="label">
              Mật khẩu
            </label>
            <input
              id="new-user-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input mt-1"
              placeholder="Tối thiểu 8 ký tự"
              minLength={8}
              maxLength={128}
              required
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="btn-primary"
          >
            {creating ? "Đang tạo…" : "Thêm người dùng"}
          </button>
        </div>
        {createError && (
          <p className="mt-2 text-sm text-danger">{createError}</p>
        )}
        {createOk && (
          <p className="mt-2 text-sm text-success">{createOk}</p>
        )}
      </form>

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
              {sortTh("displayName", "Người dùng")}
              <th className="px-4 py-2 text-left font-medium">Roles</th>
              <th className="px-4 py-2 text-left font-medium">SSO</th>
              {sortTh("createdAt", "Tạo lúc")}
              {sortTh("lastAccessAt", "Truy cập gần nhất")}
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !data && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {data?.users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
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
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted tabular-nums">
                  {u.lastAccessAt ? formatDateTime(u.lastAccessAt) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="btn-secondary btn-sm"
                      prefetch={false}
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
                      {impersonatingId === u.id ? "…" : "Xem"}
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
