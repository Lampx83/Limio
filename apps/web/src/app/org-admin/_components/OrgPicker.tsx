"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

export interface PickableOrg {
  id: string;
  name: string;
  code: string;
  kind: "school" | "center" | "publisher";
  assigned: boolean;
}

const KIND_LABEL: Record<PickableOrg["kind"], string> = { school: "Trường thường", center: "Trung tâm", publisher: "Nhà xuất bản" };

/**
 * Màn chọn tổ chức trước khi vào khu quản trị đơn vị. Platform Admin thấy mọi tổ chức và mỗi lần vào một tổ chức mình không được gán
 * đều được ghi lại; OrgAdmin chỉ thấy tổ chức mình được gán.
 */
export default function OrgPicker({ orgs, platform }: { orgs: PickableOrg[]; platform: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? orgs.filter((o) => o.name.toLowerCase().includes(needle) || o.code.toLowerCase().includes(needle)) : orgs;
  }, [orgs, q]);

  async function enter(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/org-admin/active-org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: id }) });
      if (!res.ok) {
        setError(res.status === 403 ? "Thầy/cô không có quyền vào tổ chức này." : "Không vào được tổ chức này. Thử lại sau.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Thử lại sau.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h1">Chọn tổ chức để quản trị</h1>
      <p className="mt-1 text-sm text-muted">
        {platform
          ? "Menu và dữ liệu sau đó là của tổ chức thầy/cô chọn. Mỗi lần vào một tổ chức mà thầy/cô không được gán làm quản trị đều được ghi lại."
          : "Menu và dữ liệu sau đó là của tổ chức thầy/cô chọn. Muốn làm việc với tổ chức khác, bấm \"Đổi tổ chức\" ở menu bên trái."}
      </p>
      {orgs.length > 6 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên hoặc mã tổ chức"
          aria-label="Tìm tổ chức"
          className="mt-4 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
        />
      )}
      {error && <p className="banner-danger mt-3 text-sm" role="alert"><span>{error}</span></p>}
      {orgs.length === 0 ? (
        <p className="banner-info mt-4 text-sm"><span>Chưa có tổ chức nào để chọn.</span></p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Không có tổ chức nào khớp.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => enter(o.id)}
                disabled={busy !== null}
                className="flex w-full items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  <Building2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {KIND_LABEL[o.kind]} · {o.code}
                    {platform && !o.assigned ? " · vào bằng quyền Platform Admin" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium text-brand-700 dark:text-brand-300">{busy === o.id ? "Đang vào..." : "Vào"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
