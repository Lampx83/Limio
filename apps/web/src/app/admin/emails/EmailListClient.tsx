"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/datetime";

interface TemplateItem {
  key: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  overriddenForScope: boolean;
  effectiveSource: "org" | "global" | "none";
  updatedAt: string;
}

interface ScopeOption {
  id: string;
  label: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  auth: "Đăng ký / Mật khẩu",
  exam: "Kỳ thi",
  cohort: "Lớp học",
  course: "Khoá học",
  gamification: "Gamification",
  notification: "Thông báo",
};

export default function EmailListClient({
  scopes,
  activeScopeId,
  items,
}: {
  scopes: ScopeOption[];
  activeScopeId: string;
  items: TemplateItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onScopeChange(newScope: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("scope", newScope);
    router.push(`/admin/emails?${sp.toString()}`);
  }

  // Group by category for display.
  const grouped = items.reduce<Record<string, TemplateItem[]>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Phạm vi
          </label>
          <select
            className="ml-3 rounded-lg border border-base-300 bg-base-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            value={activeScopeId}
            onChange={(e) => onScopeChange(e.target.value)}
          >
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted">
          {activeScopeId === "global"
            ? "Đang chỉnh template mặc định toàn hệ thống — áp dụng cho mọi trường chưa có override riêng."
            : "Đang chỉnh template riêng cho trường này. Template chưa override sẽ kế thừa từ mẫu chung."}
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {CATEGORY_LABEL[cat] ?? cat}
            </h2>
            <div className="card divide-y divide-base-200 overflow-hidden">
              {list.map((it) => (
                <Link
                  key={it.key}
                  href={`/admin/emails/${encodeURIComponent(it.key)}?scope=${activeScopeId}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-base-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{it.name}</span>
                      {it.effectiveSource === "org" && (
                        <span className="rounded bg-success-100 px-1.5 py-0.5 text-xs font-medium text-success-800">
                          Override
                        </span>
                      )}
                      {it.effectiveSource === "global" &&
                        activeScopeId !== "global" && (
                          <span className="rounded bg-base-200 px-1.5 py-0.5 text-xs text-muted">
                            Kế thừa
                          </span>
                        )}
                      {!it.enabled && (
                        <span className="rounded bg-danger-100 px-1.5 py-0.5 text-xs font-medium text-danger-800">
                          Đã tắt
                        </span>
                      )}
                    </div>
                    {it.description && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {it.description}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-faint">
                      <code>{it.key}</code>
                    </p>
                  </div>
                  <div className="shrink-0 text-xs text-muted">
                    {formatDate(it.updatedAt)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
