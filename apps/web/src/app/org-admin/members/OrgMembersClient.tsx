"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate } from "@/lib/datetime";
import MemberImport from "./MemberImport";

interface MemberRow {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  createdAt: string;
}

interface MembersResponse {
  members: MemberRow[];
  total: number;
  page: number;
  limit: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: "Nhập email trước đã",
  invalid_email: "Email không hợp lệ",
  already_member: "User này đã thuộc trường rồi",
  belongs_to_other_org: "User này đã thuộc một trường khác — không thể tự chuyển",
  org_not_found: "Không tìm thấy trường",
  forbidden: "Bạn không có quyền thực hiện thao tác này",
  not_member: "User này không thuộc trường này",
};

function errorMessage(code: unknown): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `Lỗi: ${code ?? "unknown"}`;
}

export default function OrgMembersClient({
  organizationId,
}: {
  organizationId: string;
}) {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("limit", "25");
    fetch(apiUrl(`/api/orgs/${organizationId}/members?${params}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MembersResponse | null) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, q, page, reloadKey]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/orgs/${organizationId}/members`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, displayName: displayName || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(body.error));
        return;
      }
      setOk(
        body.invited
          ? `Đã tạo tài khoản và gửi email mời cho ${email}`
          : `Đã thêm ${email} vào trường`,
      );
      setEmail("");
      setDisplayName("");
      setPage(0);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Gỡ ${name} khỏi trường? User sẽ quay về nhóm chung của nền tảng.`)) return;
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/orgs/${organizationId}/members/${userId}`),
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(errorMessage(body.error));
        return;
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <form onSubmit={addMember} className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Thêm thành viên</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="member-email" className="label">
              Email
            </label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              placeholder="vd: hocvien@truong.edu.vn"
              required
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="member-name" className="label">
              Tên hiển thị (nếu tạo mới)
            </label>
            <input
              id="member-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input mt-1"
              placeholder="Để trống = lấy từ email"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "…" : "Thêm"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {ok && <p className="mt-2 text-sm text-success">{ok}</p>}
      </form>

      <MemberImport
        organizationId={organizationId}
        onImported={() => {
          setPage(0);
          setReloadKey((k) => k + 1);
        }}
      />

      <div className="card mb-4">
        <label htmlFor="member-search" className="label">
          Tìm theo email / tên
        </label>
        <input
          id="member-search"
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

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Người dùng</th>
              <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Roles</th>
              <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Tham gia</th>
              <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !data && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {data?.members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Chưa có thành viên nào.
                </td>
              </tr>
            )}
            {data?.members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5">
                  <p className="truncate font-medium">{m.displayName}</p>
                  <p className="truncate text-xs text-faint">{m.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  {m.roles.length === 0 ? (
                    <span className="text-faint">—</span>
                  ) : (
                    m.roles.join(", ")
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted tabular-nums">
                  {formatDate(m.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeMember(m.id, m.displayName)}
                    className="text-xs text-danger-600 hover:underline"
                  >
                    Gỡ khỏi trường
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>
            Trang {data.page + 1} / {Math.ceil(data.total / data.limit)} · {data.total} thành viên
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
              disabled={page >= Math.ceil(data.total / data.limit) - 1 || loading}
              className="btn-ghost btn-sm"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
