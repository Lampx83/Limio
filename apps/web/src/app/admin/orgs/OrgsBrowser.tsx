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

export default function OrgsBrowser() {
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

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
  }, [q]);

  return (
    <>
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
                <td className="px-4 py-2.5 font-medium">{o.name}</td>
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
                    Quản lý OrgAdmin
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
