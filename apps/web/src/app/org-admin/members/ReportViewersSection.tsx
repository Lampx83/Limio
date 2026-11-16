"use client";

/**
 * Cấp/thu quyền "Xem báo cáo" của tổ chức (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC1).
 * Người được cấp chỉ xem trang Báo cáo nhà xuất bản (số liệu tổng hợp), không sửa được khoá hay xem học viên.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";

type Viewer = { userId: string; email: string; displayName: string; grantedAt: string };

const ERRORS: Record<string, string> = {
  user_not_found: "Chưa có tài khoản nào với email này. Người đó cần đăng ký Limio trước.",
  already_viewer: "Người này đã có quyền xem báo cáo.",
  forbidden: "Bạn không có quyền quản trị tổ chức này.",
  validation_failed: "Hãy nhập email.",
};

export default function ReportViewersSection({ organizationId }: { organizationId: string }) {
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/orgs/${organizationId}/report-viewers`), { cache: "no-store" });
    if (r.ok) setViewers(((await r.json()) as { viewers: Viewer[] }).viewers);
    else setViewers([]);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl(`/api/orgs/${organizationId}/report-viewers`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (r.ok) {
      setEmail("");
      setMsg({ kind: "ok", text: "Đã cấp quyền xem báo cáo." });
      await load();
    } else {
      const code = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "";
      setMsg({ kind: "err", text: ERRORS[code] ?? "Không cấp được quyền. Hãy thử lại." });
    }
  }

  async function revoke(v: Viewer) {
    if (!confirm(`Thu quyền xem báo cáo của ${v.displayName}?`)) return;
    const r = await fetch(apiUrl(`/api/orgs/${organizationId}/report-viewers/${v.userId}`), { method: "DELETE" });
    if (r.ok) {
      setMsg({ kind: "ok", text: "Đã thu quyền xem báo cáo." });
      await load();
    } else {
      setMsg({ kind: "err", text: "Không thu được quyền. Hãy thử lại." });
    }
  }

  return (
    <section className="card mt-8 p-4 sm:p-6">
      <h2 className="text-h3">Người xem báo cáo</h2>
      <p className="text-meta mt-1">
        Người được cấp quyền chỉ xem được trang{" "}
        <Link href="/bao-cao" className="text-brand-700 underline">
          Báo cáo nhà xuất bản
        </Link>{" "}
        của các khoá thuộc tổ chức: số mã đã kích hoạt, doanh thu và số liệu học tập tổng hợp. Họ không sửa được khoá,
        không xem được danh sách học viên.
      </p>

      <form onSubmit={grant} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          className="input flex-1"
          placeholder="Email của người cần cấp quyền"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email người xem báo cáo"
        />
        <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>
          Cấp quyền xem báo cáo
        </button>
      </form>
      {msg && <p className={`mt-3 ${msg.kind === "ok" ? "banner-success" : "banner-danger"}`}>{msg.text}</p>}

      <div className="mt-4">
        {viewers === null ? (
          <p className="text-meta">Đang tải…</p>
        ) : viewers.length === 0 ? (
          <p className="text-meta">Chưa có ai được cấp quyền xem báo cáo.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-white/10">
            {viewers.map((v) => (
              <li key={v.userId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{v.displayName}</span>
                  <span className="block truncate text-caption">{v.email}</span>
                </span>
                <button type="button" className="btn-ghost btn-sm" onClick={() => void revoke(v)}>
                  Thu quyền
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
