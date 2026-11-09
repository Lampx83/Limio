/**
 * LANG L2 — cấu hình menu của vỏ Limio Language (đợt 1: chỉ học viên). Thuần dữ liệu (icon là KHOÁ chữ,
 * component ánh xạ sang biểu tượng) để thử được không cần React.
 */

export type LanguageIconKey = "home" | "library" | "notes";

export interface LanguageMenuItem {
  label: string;
  href: string;
  icon: LanguageIconKey;
}
export interface LanguageMenuGroup {
  id: string;
  label: string;
  items: LanguageMenuItem[];
}

/** Nhóm "Không gian học". Lịch ôn tập chưa có trang nên chưa đưa vào (không để mục chết). */
export function languageMenuGroups(): LanguageMenuGroup[] {
  return [
    {
      id: "learn",
      label: "Không gian học",
      items: [
        { label: "Lộ trình của tôi", href: "/language", icon: "home" },
        { label: "Thư viện giáo trình", href: "/language/thu-vien", icon: "library" },
        { label: "Đã lưu & ghi chú", href: "/me/notes", icon: "notes" },
      ],
    },
  ];
}

/** `/language` chỉ sáng ở đúng trang chủ; mục khác sáng ở chính nó và trang con (bỏ query khi so). */
export function isLanguageMenuActive(href: string, current: string): boolean {
  const path = current.split("?")[0]!;
  if (href === "/language") return path === "/language";
  return path === href || path.startsWith(`${href}/`);
}

/** Đợt 1 chưa có vỏ giảng viên: giảng viên/admin vào /language thì chuyển về trang chủ giảng viên. */
export function languageShellIsLearner(activeRole: string): boolean {
  return activeRole !== "instructor" && activeRole !== "admin";
}
