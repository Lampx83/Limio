import Link from "next/link";
import { accessExpiryInfo } from "@/lib/accessExpiry";
import type { UiLang } from "@/lib/i18n/core";

const T = {
  vi: {
    label: "Truy cập",
    lifetime: "Không giới hạn thời gian",
    until: (d: string) => `Đến hết ngày ${d}`,
    left: (n: number) => (n === 0 ? "hết hạn hôm nay" : `còn ${n} ngày`),
    renew: "Gia hạn",
  },
  en: {
    label: "Access",
    lifetime: "No time limit",
    until: (d: string) => `Until ${d}`,
    left: (n: number) => (n === 0 ? "expires today" : `${n} days left`),
    renew: "Renew",
  },
} as const;

/**
 * Hạn truy cập của học viên ở trang Khoá học của tôi và trang khoá (docs/tieu-chi/trang-thanh-toan.md, AC5).
 * `renewHref` có thì hiện nút Gia hạn (chỉ truyền khi khoá có gói đang bán và hạn không phải vô thời hạn).
 * `onDark`: dùng trên nền màu của banner khoá (chữ trắng).
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
  const tone = onDark
    ? info.kind === "until" && info.soon
      ? "text-amber-100"
      : "text-white/90"
    : info.kind === "until" && info.soon
      ? "text-warning-700"
      : "text-muted";
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${tone}`} data-testid="access-expiry">
      <span className="font-semibold">{t.label}:</span>
      {info.kind === "lifetime" ? (
        <span>{t.lifetime}</span>
      ) : (
        <span>
          {t.until(info.dateText)} <span className="opacity-80">({t.left(info.daysLeft)})</span>
        </span>
      )}
      {renewHref && info.kind === "until" && (
        <Link
          href={renewHref}
          prefetch={false}
          className={
            onDark
              ? "rounded-full bg-white/20 px-2.5 py-0.5 font-semibold text-white hover:bg-white/30"
              : "rounded-full bg-brand-soft px-2.5 py-0.5 font-semibold text-brand-700 hover:bg-brand-100"
          }
        >
          {t.renew}
        </Link>
      )}
    </p>
  );
}
