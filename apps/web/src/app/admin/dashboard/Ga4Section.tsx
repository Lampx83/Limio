import Link from "next/link";
import {
  getGa4Summary,
  getIntegrationSecret,
  type Ga4Summary,
} from "@feedbackme/core-lms";

/**
 * Khối GA4 của dashboard admin. Gọi Google Analytics Data API (3 report) nên
 * chậm và không kiểm soát được — tách thành component riêng để page bọc
 * `<Suspense>` và stream sau, thay vì chặn cả trang chờ mạng ngoài.
 * Lỗi gọi API không được làm sập cả trang (§4.8, §5.4 CLAUDE.md).
 */
export async function Ga4Section() {
  let ga4Summary: Ga4Summary | null = null;
  let ga4Error: string | null = null;
  try {
    const [propertyId, serviceAccountJson] = await Promise.all([
      getIntegrationSecret("ga4.property_id"),
      getIntegrationSecret("ga4.service_account"),
    ]);
    ga4Summary = await getGa4Summary(propertyId, serviceAccountJson);
  } catch (e) {
    ga4Error = (e as Error).message ?? "unknown_error";
  }

  return (
    <section className="card mt-8">
      <header className="flex items-baseline justify-between border-b border-token pb-3">
        <h2 className="text-base font-semibold">
          Google Analytics — 7 ngày qua
        </h2>
        <Link href="/admin/integrations" className="text-xs text-faint hover:underline">
          Cấu hình
        </Link>
      </header>
      {ga4Error ? (
        <p className="mt-4 rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
          Không lấy được dữ liệu GA4: {ga4Error}
        </p>
      ) : ga4Summary ? (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-token p-3 text-center">
              <p className="h-display text-xl font-bold tabular-nums text-brand-600">
                {ga4Summary.activeUsers7d.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">Active users</p>
            </div>
            <div className="rounded-lg border border-token p-3 text-center">
              <p className="h-display text-xl font-bold tabular-nums text-brand-600">
                {ga4Summary.sessions7d.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">Sessions</p>
            </div>
            <div className="rounded-lg border border-token p-3 text-center">
              <p className="h-display text-xl font-bold tabular-nums text-brand-600">
                {ga4Summary.newUsers7d.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">New users</p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase text-faint">
                Top trang
              </h3>
              {ga4Summary.topPages.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Chưa có dữ liệu.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {ga4Summary.topPages.map((p) => (
                    <li
                      key={p.path}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate font-mono text-xs text-muted">
                        {p.path}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                        {p.views.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-faint">
                Kênh truy cập
              </h3>
              {ga4Summary.channels.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Chưa có dữ liệu.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {ga4Summary.channels.map((c) => (
                    <li
                      key={c.channel}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted">{c.channel}</span>
                      <span className="font-mono text-xs font-semibold tabular-nums">
                        {c.sessions.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function Ga4Skeleton() {
  return (
    <section className="card mt-8" aria-busy>
      <div className="h-5 w-56 animate-pulse rounded bg-base-100" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[74px] animate-pulse rounded-lg bg-base-100" />
        ))}
      </div>
      <div className="mt-6 h-24 animate-pulse rounded-lg bg-base-100" />
    </section>
  );
}
