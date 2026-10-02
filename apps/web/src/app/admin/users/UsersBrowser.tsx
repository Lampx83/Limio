"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate, formatDateTime, formatRelative } from "@/lib/datetime";
import { COMMON_POOL_FILTER_VALUE, COMMON_POOL_LABEL } from "@feedbackme/shared-types";
import { rolePriorityRank } from "@/lib/adminUserSort";
import ResendVerificationButton from "./[id]/ResendVerificationButton";

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
  organization: { id: string; name: string } | null;
}

interface OrgOption {
  id: string;
  name: string;
  code: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

type SortKey = "displayName" | "roles" | "org" | "sso" | "createdAt" | "lastAccessAt";
/**
 * Cột kéo đổi độ rộng được. "Người dùng" là cột co giãn (lấy phần còn lại) nên không nằm ở đây.
 * Mỗi thanh kéo là một RANH GIỚI giữa hai cột liền kề: nó đi theo con trỏ, cột bên trái
 * rộng ra bao nhiêu thì cột bên phải hẹp đi bấy nhiêu (riêng ranh giới với "Người dùng"
 * thì cột "Người dùng" là bên trái).
 */
type ColKey = "roles" | "org" | "sso" | "created" | "access" | "actions";
type ColWidths = Partial<Record<ColKey, number>>;

const COL_STORAGE_KEY = "admin.users.colWidths.v2";
const COL_MIN_PX: Record<ColKey, number> = {
  roles: 64,
  org: 64,
  sso: 64,
  created: 64,
  access: 64,
  actions: 150, // đủ chỗ cho 3 nút Xác thực / Quản lý / Xem
};
/** Cột "Người dùng" không bao giờ bị ép hẹp hơn mức này khi kéo cột khác. */
const USER_COL_MIN_PX = 200;
const COL_DEFAULT_WIDTH: Record<ColKey, string> = {
  roles: "11%",
  org: "15%",
  sso: "9%",
  created: "9%",
  access: "10%",
  actions: "190px",
};
type SortDir = "asc" | "desc";

const ROLE_OPTIONS = [
  { value: "", label: "Tất cả role" },
  { value: "admin", label: "Admin" },
  { value: "instructor", label: "Instructor" },
  { value: "researcher", label: "Researcher" },
  { value: "mentor", label: "Mentor" },
  { value: "learner", label: "Learner" },
];

export default function UsersBrowser() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
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
  // Độ rộng do người dùng tự kéo (px). Cột chưa kéo giữ mặc định theo %, nên vẫn co giãn theo màn hình.
  const [colW, setColW] = useState<ColWidths>({});
  const colWRef = useRef<ColWidths>({});
  colWRef.current = colW;
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COL_STORAGE_KEY);
      if (raw) setColW(JSON.parse(raw) as ColWidths);
    } catch {
      /* localStorage bị chặn / JSON hỏng: dùng mặc định */
    }
  }, []);

  function persistColW(next: ColWidths) {
    try {
      if (Object.keys(next).length === 0) localStorage.removeItem(COL_STORAGE_KEY);
      else localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* không lưu được thì thôi, chỉ mất khi tải lại */
    }
  }

  /** left = cột bên trái ranh giới (null = "Người dùng"), right = cột bên phải. */
  function startResize(e: React.PointerEvent<HTMLElement>, left: ColKey | null, right: ColKey) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const leftTh = handle.closest("th");
    const rightTh = leftTh?.nextElementSibling as HTMLElement | null | undefined;
    if (!leftTh || !rightTh) return;

    const startX = e.clientX;
    const startL = leftTh.offsetWidth;
    const startR = rightTh.offsetWidth;
    // dx > 0 = ranh giới đi sang phải. Giới hạn để không cột nào xuống dưới mức tối thiểu.
    const minDx = (left ? COL_MIN_PX[left] : USER_COL_MIN_PX) - startL;
    const maxDx = startR - COL_MIN_PX[right];
    handle.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let last: ColWidths | null = null;
    const onMove = (ev: PointerEvent) => {
      const dx = Math.round(Math.min(maxDx, Math.max(minDx, ev.clientX - startX)));
      const patch: ColWidths = { [right]: startR - dx };
      if (left) patch[left] = startL + dx;
      last = patch;
      setColW((prev) => ({ ...prev, ...patch }));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Không đọc colWRef ở đây: React có thể chưa render lại sau lần move cuối.
      if (last) persistColW({ ...colWRef.current, ...last });
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function resetEdge(left: ColKey | null, right: ColKey) {
    const next = { ...colWRef.current };
    delete next[right];
    if (left) delete next[left];
    setColW(next);
    persistColW(next);
  }

  function resetAllCols() {
    setColW({});
    persistColW({});
  }

  function colStyle(key: ColKey): React.CSSProperties {
    const px = colW[key];
    return { width: px != null ? `${px}px` : COL_DEFAULT_WIDTH[key] };
  }

  function resizeHandle(left: ColKey | null, right: ColKey, label: string) {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Kéo để đổi độ rộng cột ${label} (nhấp đúp để đặt lại)`}
        title="Kéo để đổi độ rộng · nhấp đúp để đặt lại"
        onPointerDown={(e) => startResize(e, left, right)}
        onDoubleClick={() => resetEdge(left, right)}
        className="group absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none select-none justify-center"
      >
        <span className="my-auto h-5 w-0.5 rounded-full bg-[rgb(var(--text-faint))] transition-all group-hover:h-full group-hover:bg-brand-500" />
      </span>
    );
  }

  useEffect(() => {
    fetch(apiUrl("/api/admin/orgs"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { organizations: OrgOption[] } | null) => {
        if (d) setOrgs(d.organizations);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (org) params.set("org", org);
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
  }, [q, role, org, page, sort, dir, reloadKey]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      // Cột chữ: A→Z trước (Roles: quyền cao trước); các cột thời gian: mới nhất trước.
      setDir(key === "createdAt" || key === "lastAccessAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  type Edge = [ColKey | null, ColKey];

  function sortTh(key: SortKey, label: string, edge?: Edge) {
    const active = sort === key;
    return (
      <th
        className="relative whitespace-nowrap px-3 py-2 text-left font-medium"
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 uppercase transition-colors hover:text-brand-600"
        >
          {label}
          <span aria-hidden className={active ? "" : "opacity-40"}>
            {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
        {edge && resizeHandle(edge[0], edge[1], label)}
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
              <option value="researcher">Researcher</option>
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
          <div>
            <label htmlFor="users-org" className="label">
              Tổ chức
            </label>
            <select
              id="users-org"
              value={org}
              onChange={(e) => {
                setOrg(e.target.value);
                setPage(0);
              }}
              className="select mt-1"
            >
              <option value="">Tất cả tổ chức</option>
              <option value={COMMON_POOL_FILTER_VALUE}>{COMMON_POOL_LABEL}</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {Object.keys(colW).length > 0 && (
        <div className="mb-1 text-right text-xs">
          <button type="button" onClick={resetAllCols} className="link">
            Đặt lại độ rộng cột
          </button>
        </div>
      )}
      <div className="card overflow-x-auto p-0">
        <table ref={tableRef} className="w-full min-w-[900px] table-fixed text-sm">
          {/* Cột chưa kéo chia theo %, "Người dùng" lấy phần còn lại, "Thao tác" cố định. Kéo mép tiêu đề để đổi độ rộng (lưu trong trình duyệt). */}
          <colgroup>
            <col />
            <col style={colStyle("roles")} />
            <col style={colStyle("org")} />
            <col style={colStyle("sso")} />
            <col style={colStyle("created")} />
            <col style={colStyle("access")} />
            <col style={colStyle("actions")} />
          </colgroup>
          <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
            <tr>
              {sortTh("displayName", "Người dùng", [null, "roles"])}
              {sortTh("roles", "Roles", ["roles", "org"])}
              {sortTh("org", "Tổ chức", ["org", "sso"])}
              {sortTh("sso", "SSO", ["sso", "created"])}
              {sortTh("createdAt", "Tạo lúc", ["created", "access"])}
              {sortTh("lastAccessAt", "Truy cập", ["access", "actions"])}
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !data && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {data?.users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Không có user nào khớp.
                </td>
              </tr>
            )}
            {data?.users.map((u) => (
              <tr key={u.id} className="hover:bg-base-50">
                <td className="overflow-hidden px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                      {(u.displayName || u.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium">{u.displayName}</p>
                        {!u.emailVerified && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-warning-500"
                            title="Email chưa xác thực"
                            aria-label="Email chưa xác thực"
                          />
                        )}
                      </div>
                      <p className="truncate text-xs text-faint">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <RoleCell roles={u.roles} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.organization ? (
                    <Link
                      href={`/admin/orgs/${u.organization.id}`}
                      className="link block truncate"
                      title={u.organization.name}
                      prefetch={false}
                    >
                      {u.organization.name}
                    </Link>
                  ) : (
                    <span className="whitespace-nowrap text-faint">{COMMON_POOL_LABEL}</span>
                  )}
                </td>
                <td className="break-words px-3 py-2 text-xs text-muted">
                  {u.providers.length === 0 ? "—" : u.providers.join(", ")}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted tabular-nums">
                  {formatDate(u.createdAt)}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-2 text-xs text-muted tabular-nums"
                  title={u.lastAccessAt ? formatDateTime(u.lastAccessAt) : undefined}
                >
                  {u.lastAccessAt ? formatRelative(u.lastAccessAt) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    {!u.emailVerified && (
                      <ResendVerificationButton userId={u.id} compact />
                    )}
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="btn-secondary btn-sm whitespace-nowrap !px-2.5 !py-1"
                      prefetch={false}
                    >
                      Quản lý
                    </Link>
                    <button
                      type="button"
                      onClick={() => impersonate(u.id)}
                      disabled={impersonatingId === u.id}
                      className="btn-ghost btn-sm whitespace-nowrap !px-2.5 !py-1"
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

/**
 * Gọn: một chip vai trò chính + nút "+N". Bấm nút để mở rộng ngay tại ô, hiện đủ mọi vai trò
 * (chip xếp cuộn dòng, chỉ hàng này cao thêm); bấm "−" để thu lại. Vai trò xếp quyền cao trước.
 */
function RoleCell({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  if (roles.length === 0) return <span className="text-faint">—</span>;
  const sorted = [...roles].sort((a, b) => rolePriorityRank(a) - rolePriorityRank(b));
  const [main = "", ...rest] = sorted;
  const shown = open ? sorted : [main];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((r) => (
        <span key={r} className={`${roleChipClass(r)} !px-2 !py-0`}>
          {r}
        </span>
      ))}
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Thu gọn danh sách vai trò" : `Xem đủ ${sorted.length} vai trò: ${sorted.join(", ")}`}
          title={open ? "Thu gọn" : `Xem đủ: ${sorted.join(", ")}`}
          className="chip !px-1.5 !py-0 tabular-nums transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
        >
          {open ? "−" : `+${rest.length}`}
        </button>
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
    case "researcher":
      return "chip-warning";
    case "learner":
      return "chip-success";
    default:
      return "chip";
  }
}
