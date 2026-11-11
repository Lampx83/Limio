"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMicro4AsiaSlug } from "@/lib/micro4asia";

/**
 * Logo ở góc trái header. Trang khoá học thuộc MICRO4ASIA hiện logo NEU + Micro4Asia
 * thay cho logo Limio; mọi nơi khác giữ nguyên (children = logo Limio do AppHeader truyền vào).
 */
export default function HeaderBrand({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const m = pathname.match(/^\/catalog\/([^/]+)/);
  let slug = "";
  try {
    slug = m?.[1] ? decodeURIComponent(m[1]) : "";
  } catch {}
  if (!slug || !isMicro4AsiaSlug(slug)) return <>{children}</>;

  return (
    <Link
      href="/micro4asia"
      aria-label="MICRO4ASIA"
      className="flex shrink-0 items-center gap-3 rounded bg-white px-2 py-1"
    >
      <img src="/brand/neu/neu-logo-ngang.svg" alt="Đại học Kinh tế Quốc dân" className="h-8 w-auto sm:h-10" />
      <span className="h-8 w-px bg-[#B2B2B2] sm:h-10" aria-hidden />
      <img src="/brand/micro4asia/logo.png" alt="MICRO4ASIA" width={112} height={160} className="h-9 w-auto sm:h-11" />
    </Link>
  );
}
