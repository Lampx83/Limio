import type { EmailUsageStats } from "@feedbackme/core-lms";

const nf = new Intl.NumberFormat("vi-VN");
const timeVn = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));

function Meter({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-600";
  return (
    <div
      className="mt-3 h-2 w-full overflow-hidden rounded-full bg-base-200"
      role="progressbar"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={limit}
    >
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function EmailUsage({ stats }: { stats: EmailUsageStats }) {
  const left = stats.dailyLimit > 0 ? Math.max(0, stats.dailyLimit - stats.sentToday) : null;
  return (
    <section className="mb-6 grid gap-4 md:grid-cols-3" aria-label="Thống kê gửi email">
      <div className="rounded-2xl border border-base-300 bg-white p-5 shadow-sm md:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Đã gửi hôm nay</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{nf.format(stats.sentToday)}</span>
          {stats.dailyLimit > 0 && (
            <span className="text-lg text-muted">/ {nf.format(stats.dailyLimit)} email</span>
          )}
        </p>
        <Meter used={stats.sentToday} limit={stats.dailyLimit} />
        <p className="mt-3 text-sm text-muted">
          {left !== null && (
            <>
              Còn <strong className="text-base-800">{nf.format(left)}</strong> email trong hạn mức ngày ·{" "}
            </>
          )}
          reset lúc {timeVn(stats.resetsAt)} (giờ VN, 00:00 UTC)
          {stats.failedToday > 0 && (
            <>
              {" "}· <span className="font-medium text-danger-600">{nf.format(stats.failedToday)} lỗi</span>
            </>
          )}
        </p>
        {stats.byTemplateToday.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {stats.byTemplateToday.map((t) => (
              <li key={t.key} className="rounded-full bg-base-100 px-2.5 py-1 font-mono text-base-700">
                {t.key} · {nf.format(t.count)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-base-300 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tháng này (UTC)</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{nf.format(stats.sentThisMonth)}</span>
          {stats.monthlyLimit > 0 && (
            <span className="text-base text-muted">/ {nf.format(stats.monthlyLimit)}</span>
          )}
        </p>
        <Meter used={stats.sentThisMonth} limit={stats.monthlyLimit} />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Chỉ đếm email do hệ thống này gửi. Hạn mức Resend tính chung cho cả tài khoản, nên nếu
          domain khác (vd. codelab.ai.vn) cũng gửi thì số còn lại thực tế thấp hơn.
        </p>
      </div>
    </section>
  );
}
