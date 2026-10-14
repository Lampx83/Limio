import Link from "next/link";
import { getFooterSettings, getRegisterEnabled } from "@/lib/site-settings";

/**
 * Hàng link ở footer tồn tại vì SEO, không phải vì điều hướng: header chỉ có
 * logo + menu cá nhân, nên trước đó một khoá học mở từ Google là ngõ cụt —
 * crawler đọc xong không có đường nào đi tiếp sang khoá khác. Vài link cố định
 * trên mọi trang cho Googlebot (và người đọc) lối quay lại catalog.
 */
const FOOTER_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/catalog", label: "Khoá học" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/xp-guide", label: "Cách tính điểm" },
  { href: "/register", label: "Đăng ký", needsRegister: true },
  { href: "/signin", label: "Đăng nhập" },
];

export default async function Footer() {
  const [{ text, enabled }, registerEnabled] = await Promise.all([
    getFooterSettings(),
    getRegisterEnabled(),
  ]);
  // Công tắc ở /admin/settings tắt cả footer (nhãn "Đã tắt footer"), không chỉ
  // dòng credit — tôn trọng nguyên vẹn, kể cả khi mất mấy link nội bộ.
  if (!enabled) return null;

  return (
    <footer className="mt-auto border-t border-token py-6 text-sm text-muted">
      <nav
        aria-label="Liên kết chân trang"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4"
      >
        {FOOTER_LINKS.filter((l) => registerEnabled || !l.needsRegister).map((l) => (
          // `/gioi-thieu` là file tĩnh (rewrite), không phải route của Next —
          // prefetch RSC sẽ trượt và gây request thừa trên mọi trang.
          <Link key={l.href} href={l.href} className="link" prefetch={false}>
            {l.label}
          </Link>
        ))}
      </nav>
      {text.trim() && <p className="mx-auto mt-4 max-w-3xl px-4 text-center">{text}</p>}
    </footer>
  );
}
