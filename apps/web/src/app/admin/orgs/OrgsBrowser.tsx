"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface OrgRow {
  id: string;
  code: string;
  name: string;
  adminCount: number;
  userCount: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Mã trường chỉ gồm chữ/số/gạch ngang, tối đa 32 ký tự",
  missing_name: "Tên trường không được bỏ trống",
  code_taken: "Mã trường đã tồn tại",
};

function errorMessage(code: unknown): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `Lỗi: ${code ?? "unknown"}`;
}

export default function OrgsBrowser() {
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    fetch(apiUrl(`/api/admin/orgs?${params}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { organizations: OrgRow[] } | null) => {
        if (!cancelled) setOrgs(d?.organizations ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, reloadKey]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateOk(null);
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/admin/orgs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: newCode, name: newName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(errorMessage(data?.error));
        return;
      }
      setCreateOk(`Đã tạo tổ chức ${data.organization.name}`);
      setNewCode("");
      setNewName("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setCreateError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <form onSubmit={createOrg} className="card mb-4">
        <div className="mb-2">
          <h2 className="text-base font-semibold">Thêm tổ chức mới</h2>
          <p className="text-xs text-muted">
            Mã trường ngắn, viết hoa, dùng làm định danh — không đổi được sau
            khi tạo.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="new-org-code" className="label">
              Mã trường
            </label>
            <input
              id="new-org-code"
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="input mt-1 font-mono uppercase"
              placeholder="vd: BKHN"
              maxLength={32}
              required
            />
          </div>
          <div className="min-w-[280px] flex-1">
            <label htmlFor="new-org-name" className="label">
              Tên tổ chức
            </label>
            <input
              id="new-org-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input mt-1"
              placeholder="vd: Đại học Bách khoa Hà Nội"
              required
            />
          </div>
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? "Đang tạo…" : "Thêm tổ chức"}
          </button>
        </div>
        {createError && <p className="mt-2 text-sm text-danger">{createError}</p>}
        {createOk && <p className="mt-2 text-sm text-success">{createOk}</p>}
      </form>

      <div className="card mb-4">
        <label htmlFor="orgs-search" className="label">
          Tìm theo tên / mã trường
        </label>
        <input
          id="orgs-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input mt-1"
          placeholder="vd: HUST hoặc Bách Khoa"
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-token bg-base-50 text-left text-xs uppercase text-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Tổ chức</th>
              <th className="px-4 py-2 font-medium">Mã</th>
              <th className="px-4 py-2 font-medium">OrgAdmin</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !orgs && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {orgs?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Không có tổ chức nào khớp.
                </td>
              </tr>
            )}
            {orgs?.map((o) => (
              <tr key={o.id} className="hover:bg-base-50">
                <td className="px-4 py-2.5 font-medium">
                  <Link
                    href={`/admin/orgs/${o.id}`}
                    className="hover:underline"
                    prefetch={false}
                  >
                    {o.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{o.code}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {o.adminCount === 0 ? (
                    <span className="chip-warning">Chưa có</span>
                  ) : (
                    <span className="chip-success">{o.adminCount}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-muted">{o.userCount}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/orgs/${o.id}`}
                    className="btn-secondary btn-sm whitespace-nowrap"
                    prefetch={false}
                  >
                    Cấu hình
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
