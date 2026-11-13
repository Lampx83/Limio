"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, type UiLang } from "@/lib/i18n/core";
import { useT, useUiLang } from "@/lib/i18n/client";

/**
 * Nút "EN | VI" trên thanh đầu trang. Lưu lựa chọn vào cookie `fbm-lang` (thắng mọi mặc định theo khoá) rồi
 * `router.refresh()` để server render lại bằng ngôn ngữ mới. Ngôn ngữ nội dung khoá học không đổi — chỉ khung giao diện.
 */
export default function LangSwitch() {
  const lang = useUiLang();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: UiLang) {
    if (next === lang) return;
    try {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
    } catch {
      /* cookie bị chặn — vẫn refresh, giao diện sẽ giữ như cũ */
    }
    start(() => router.refresh());
  }

  const opts: { code: UiLang; short: string }[] = [
    { code: "en", short: "EN" },
    { code: "vi", short: "VI" },
  ];

  const other: UiLang = lang === "en" ? "vi" : "en";

  return (
    <>
    {/* < sm: header chật — một nút nhỏ hiện ngôn ngữ sẽ chuyển sang, để không tràn ngang. */}
    <button
      type="button"
      onClick={() => choose(other)}
      lang={other}
      aria-label={`${t("lang.label")}: ${t(other === "en" ? "lang.en" : "lang.vi")}`}
      data-pending={pending || undefined}
      className="inline-flex h-8 shrink-0 items-center rounded-full border border-token px-2 text-xs font-semibold text-muted hover:bg-[rgb(var(--surface-muted))] sm:hidden"
    >
      {other.toUpperCase()}
    </button>
    <div
      role="group"
      aria-label={t("lang.label")}
      data-pending={pending || undefined}
      className="hidden shrink-0 items-center overflow-hidden rounded-full border border-token text-xs font-semibold sm:inline-flex"
    >
      {opts.map((o) => (
        <button
          key={o.code}
          type="button"
          onClick={() => choose(o.code)}
          aria-pressed={lang === o.code}
          lang={o.code}
          title={t(o.code === "en" ? "lang.en" : "lang.vi")}
          className={`px-2 py-1 transition-colors ${
            lang === o.code
              ? "bg-[rgb(var(--text))] text-[rgb(var(--surface))]"
              : "text-muted hover:bg-[rgb(var(--surface-muted))]"
          }`}
        >
          {o.short}
        </button>
      ))}
    </div>
    </>
  );
}
