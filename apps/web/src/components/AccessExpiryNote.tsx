import Link from "next/link";
import { CalendarClock, CalendarX2, Infinity as InfinityIcon, TriangleAlert } from "lucide-react";
import { accessExpiryInfo } from "@/lib/accessExpiry";
import type { UiLang } from "@/lib/i18n/core";

const T = {
  vi: {
    lifetime: "Không giới hạn",
    lifetimeSub: "Học bao lâu tuỳ bạn",
    days: (n: number) => (n === 0 ? "Hết hạn hôm nay" : `Còn ${n} ngày`),
    until: (d: string) => `Đến hết ngày ${d}`,
    renew: "Gia hạn",
  },
  en: {
    lifetime: "No time limit",
    lifetimeSub: "Learn at your own pace",
    days: (n: number) => (n === 0 ? "Expires today" : `${n} days left`),
    until: (d: string) => `Until ${d}`,
    renew: "Renew",
  },
} as const;

type Tone = "ok" | "soon" | "last" | "lifetime";

// Class viết đủ để Tailwind quét được. `chip`: dùng trong thẻ nền sáng; `dark`: dùng trên banner màu.
const TONE: Record<Tone, { chip: string; icon: string; dark: string; darkIcon: string }> = {
  ok: {
    chip: "bg-brand-soft text-brand-700 ring-brand-200",
    icon: "text-brand-600",
    dark: "bg-white/15 text-white",
    darkIcon: "bg-white/20 text-white",
  },
  soon: {
    chip: "bg-warning-50 text-warning-800 ring-warning-200",
    icon: "text-warning-600",
    dark: "bg-warning-300/25 text-white",
    darkIcon: "bg-warning-300 text-warning-950",
  },
  last: {
    chip: "bg-danger-50 text-danger-700 ring-danger-100",
    icon: "text-danger-600",
    dark: "bg-danger-500/30 text-white",
    darkIcon: "bg-white text-danger-600",
  },
  lifetime: {
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    icon: "text-slate-400",
    dark: "bg-white/15 text-white",
    darkIcon: "bg-white/20 text-white",
  },
};

/**
 * Hạn truy cập của học viên ở trang Khoá học của tôi và trang khoá (docs/tieu-chi/trang-thanh-toan.md, AC5).
 *  - Thẻ nền sáng: một viên thuốc có biểu tượng, "Còn 300 ngày" nổi bật + ngày hết hạn nhạt bên cạnh. Màu theo mức:
 *    còn lâu (xanh thương hiệu), sắp hết ≤ 30 ngày (hổ phách), hết hạn hôm nay (đỏ), không giới hạn (xám).
 *  - Banner nền màu (`onDark`): khối kính mờ có biểu tượng, hai dòng, nút Gia hạn nổi bật bên phải.
 * `renewHref` có thì hiện nút Gia hạn (chỉ truyền khi khoá có gói đang bán và quyền có hạn).
 */
export default function AccessExpiryNote({
  expiresAt,
  lang = "vi",
  renewHref,
  onDark = false,
}: {
  expiresAt: Date | string | null | undefined;
  lang?: UiLang;
  renewHref?: string;
  onDark?: boolean;
}) {
  const t = T[lang];
  const info = accessExpiryInfo(expiresAt);
  const tone: Tone = info.kind === "lifetime" ? "lifetime" : info.daysLeft === 0 ? "last" : info.soon ? "soon" : "ok";
  const c = TONE[tone];
  const Icon = tone === "lifetime" ? InfinityIcon : tone === "last" ? CalendarX2 : tone === "soon" ? TriangleAlert : CalendarClock;
  const main = info.kind === "lifetime" ? t.lifetime : t.days(info.daysLeft);
  const sub = info.kind === "lifetime" ? t.lifetimeSub : t.until(info.dateText);
  const renew = renewHref && info.kind === "until" ? renewHref : null;

  if (onDark) {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl px-3.5 py-2.5 backdrop-blur ${c.dark}`}
        data-testid="access-expiry"
        data-tone={tone}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.darkIcon}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-bold">{main}</span>
          <span className="block text-xs text-white/80">{sub}</span>
        </span>
        {renew && (
          <Link
            href={renew}
            prefetch={false}
            className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand-700 shadow-sm transition-transform hover:scale-[1.03]"
          >
            {t.renew}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-testid="access-expiry" data-tone={tone}>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${c.chip}`}>
        <Icon className={`h-3.5 w-3.5 ${c.icon}`} aria-hidden />
        {main}
      </span>
      <span className="text-xs text-muted">{sub}</span>
      {renew && (
        <Link href={renew} prefetch={false} className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline">
          {t.renew} →
        </Link>
      )}
    </div>
  );
}
