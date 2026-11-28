"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, Plus, Search, TriangleAlert, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { EmptyState, KpiCard } from "@/components/ui";
import { orgKindMeta, type OrgKindValue } from "./orgKindMeta";

interface OrgRow {
  id: string;
  code: string;
  name: string;
  kind: OrgKindValue;
  adminCount: number;
  userCount: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Mã chỉ gồm chữ/số/gạch ngang, 2–32 ký tự, bắt đầu bằng chữ hoặc số",
  missing_name: "Tên tổ chức không được bỏ trống",
  invalid_kind: "Loại tổ chức không hợp lệ",
  code_taken: "Mã đã tồn tại, hãy chọn mã khác",
};

function errorMessage(code: unknown): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `Lỗi: ${code ?? "unknown"}`;
}

/** Bỏ dấu + hạ chữ thường để "bach khoa" khớp "Bách Khoa". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
}

type KindFilter = "all" | OrgKindValue;

const KIND_FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "school", label: "Trường" },
  { value: "center", label: "Trung tâm" },
  { value: "publisher", label: "Nhà xuất bản" },
];

export default function OrgsBrowser() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [onlyNoAdmin, setOnlyNoAdmin] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<OrgKindValue>("school");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Số tổ chức ít (vài chục) nên lấy hết một lần rồi lọc ngay trên máy: gõ đến đâu lọc đến đó, số liệu tổng không đổi theo ô tìm.
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    fetch(apiUrl("/api/admin/orgs"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { organizations: OrgRow[] }) => {
        if (!cancelled) setOrgs(d.organizations ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setOrgs((prev) => prev ?? []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const stats = useMemo(() => {
    const list = orgs ?? [];
    return {
      total: list.length,
      noAdmin: list.filter((o) => o.adminCount === 0).length,
      users: list.reduce((n, o) => n + o.userCount, 0),
      byKind: {
        all: list.length,
        school: list.filter((o) => o.kind === "school").length,
        center: list.filter((o) => o.kind === "center").length,
        publisher: list.filter((o) => o.kind === "publisher").length,
      } as Record<KindFilter, number>,
    };
  }, [orgs]);

  const filtered = useMemo(() => {
    const needle = fold(q.trim());
    return (orgs ?? []).filter((o) => {
      if (kindFilter !== "all" && o.kind !== kindFilter) return false;
      if (onlyNoAdmin && o.adminCount > 0) return false;
      if (!needle) return true;
      return fold(o.name).includes(needle) || fold(o.code).includes(needle);
    });
  }, [orgs, q, kindFilter, onlyNoAdmin]);

  const hasFilter = q.trim() !== "" || kindFilter !== "all" || onlyNoAdmin;

  function resetFilters() {
    setQ("");
    setKindFilter("all");
    setOnlyNoAdmin(false);
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateError(null);
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/admin/orgs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: newCode, name: newName, kind: newKind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(errorMessage(data?.error));
        return;
      }
      toast.success(`Đã tạo tổ chức ${data.organization.name}`, {
        description: "Mở tổ chức để cấp OrgAdmin và cấu hình tiếp.",
      });
      setNewCode("");
      setNewName("");
      setShowCreate(false);
      setReloadKey((k) => k + 1);
      router.prefetch(`/admin/orgs/${data.organization.id}`);
    } catch (err) {
      setCreateError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* Số liệu tổng: bấm "Chưa có OrgAdmin" để lọc nhanh nhóm cần xử lý. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Tổ chức" value={orgs ? stats.total : "–"} />
        <KpiCard label="Người dùng thuộc tổ chức" value={orgs ? stats.users.toLocaleString("vi-VN") : "–"} tone="info" />
        <button
          type="button"
          onClick={() => setOnlyNoAdmin((v) => !v)}
          aria-pressed={onlyNoAdmin}
          disabled={!orgs || stats.noAdmin === 0}
          className={`card col-span-2 text-left transition-colors lg:col-span-1 ${onlyNoAdmin ? "border-warning-500 ring-2 ring-warning-500/30" : ""} ${stats.noAdmin > 0 ? "cursor-pointer hover:bg-[rgb(var(--surface-muted))]" : "cursor-default"}`}
        >
          <div className={`h-display text-2xl font-bold tabular-nums ${stats.noAdmin > 0 ? "text-yellow-700" : "text-success-600"}`}>
            {orgs ? stats.noAdmin : "–"}
          </div>
          <div className="mt-1 text-xs text-muted sm:text-sm">Chưa có OrgAdmin</div>
          <div className="mt-0.5 text-xs text-faint">
            {orgs && stats.noAdmin === 0
              ? "Tổ chức nào cũng có người quản trị"
              : onlyNoAdmin
                ? "Đang lọc, bấm để bỏ lọc"
                : "Bấm để chỉ hiện các tổ chức này"}
          </div>
        </button>
      </div>

      {/* Thanh công cụ: tìm + lọc loại + thêm mới */}
      <div className="card mb-4 space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="orgs-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input pl-9"
              placeholder="Tìm theo tên hoặc mã, ví dụ: bach khoa, HUST"
              aria-label="Tìm theo tên hoặc mã tổ chức"
            />
          </div>
          <button
            type="button"
            onClick={() => (showCreate ? closeCreate() : setShowCreate(true))}
            aria-expanded={showCreate}
            aria-controls="org-create-panel"
            className={showCreate ? "btn-secondary" : "btn-primary"}
          >
            {showCreate ? <X className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {showCreate ? "Đóng" : "Thêm tổ chức"}
          </button>
        </div>

        <div role="group" aria-label="Lọc theo loại tổ chức" className="flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((f) => {
            const active = kindFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setKindFilter(f.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                    : "border-token text-muted hover:bg-[rgb(var(--surface-muted))]"
                }`}
              >
                {f.label}
                <span className="tabular-nums text-faint">{orgs ? stats.byKind[f.value] : ""}</span>
              </button>
            );
          })}
          {hasFilter && (
            <button type="button" onClick={resetFilters} className="ml-1 text-xs text-brand-600 hover:underline">
              Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <form id="org-create-panel" onSubmit={createOrg} className="card mb-4 border-brand-300">
          <div className="mb-3">
            <h2 className="text-h4">Thêm tổ chức mới</h2>
            <p className="text-xs text-muted">
              Mã ngắn, viết hoa, dùng làm định danh nên không đổi được sau khi tạo. Loại có thể đổi sau ở trang chi tiết.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[160px_1fr_180px]">
            <div>
              <label htmlFor="new-org-code" className="label">Mã</label>
              <input
                id="new-org-code"
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="input mt-1 font-mono uppercase"
                placeholder="vd: BKHN"
                maxLength={32}
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="new-org-name" className="label">Tên tổ chức</label>
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
            <div>
              <label htmlFor="new-org-kind" className="label">Loại</label>
              <select id="new-org-kind" value={newKind} onChange={(e) => setNewKind(e.target.value as OrgKindValue)} className="input mt-1">
                <option value="school">Trường thường</option>
                <option value="center">Trung tâm</option>
                <option value="publisher">Nhà xuất bản</option>
              </select>
            </div>
          </div>
          {createError && (
            <p role="alert" className="mt-3 text-sm text-danger">{createError}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeCreate} className="btn-ghost">Huỷ</button>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? "Đang tạo…" : "Tạo tổ chức"}
            </button>
          </div>
        </form>
      )}

      {loadError && (
        <div role="alert" className="banner-danger mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Chưa tải được danh sách tổ chức.
          </span>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary btn-sm">Thử lại</button>
        </div>
      )}

      {!orgs ? (
        <div className="card space-y-3" aria-busy="true" aria-label="Đang tải danh sách">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[rgb(var(--surface-muted))]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon="🔎"
            title="Không có tổ chức nào khớp"
            description="Thử bỏ bớt bộ lọc hoặc gõ tên ngắn hơn."
            actions={[{ label: "Xoá bộ lọc", onClick: resetFilters, variant: "secondary" }]}
          />
        ) : (
          <EmptyState
            icon="🏫"
            title="Chưa có tổ chức nào"
            description="Tạo tổ chức đầu tiên để gom người dùng, khoá học và quản trị về một nơi."
            actions={[{ label: "Thêm tổ chức", onClick: () => setShowCreate(true) }]}
          />
        )
      ) : (
        <>
          <p className="mb-2 text-xs text-muted" aria-live="polite">
            {hasFilter ? `${filtered.length} / ${stats.total} tổ chức` : `${stats.total} tổ chức`}
          </p>

          {/* Máy tính: bảng. Bấm cả dòng để mở. */}
          <div className="card hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-token bg-base-50 text-left text-xs uppercase text-faint">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tổ chức</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Loại</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">OrgAdmin</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Người dùng</th>
                  <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Mở</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {filtered.map((o) => {
                  const kind = orgKindMeta(o.kind);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/admin/orgs/${o.id}`)}
                      className="group cursor-pointer hover:bg-base-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orgs/${o.id}`}
                          prefetch={false}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:underline"
                        >
                          {o.name}
                        </Link>
                        <div className="font-mono text-xs text-faint">{o.code}</div>
                      </td>
                      <td className="px-4 py-3"><span className={kind.chip}>{kind.label}</span></td>
                      <td className="px-4 py-3">
                        {o.adminCount === 0 ? (
                          <span className="chip-warning">Chưa có</span>
                        ) : (
                          <span className="chip-success">{o.adminCount} người</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{o.userCount.toLocaleString("vi-VN")}</td>
                      <td className="px-2 py-3 text-faint group-hover:text-brand-600">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: thẻ, cả thẻ là một liên kết */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((o) => {
              const kind = orgKindMeta(o.kind);
              return (
                <li key={o.id}>
                  <Link href={`/admin/orgs/${o.id}`} prefetch={false} className="card flex items-center gap-3 p-4 hover:bg-[rgb(var(--surface-muted))]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-muted))] text-muted">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-faint">{o.code}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={kind.chip}>{kind.label}</span>
                        {o.adminCount === 0 ? (
                          <span className="chip-warning">Chưa có OrgAdmin</span>
                        ) : (
                          <span className="chip-success">{o.adminCount} OrgAdmin</span>
                        )}
                        <span className="text-xs text-muted tabular-nums">{o.userCount.toLocaleString("vi-VN")} người dùng</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
