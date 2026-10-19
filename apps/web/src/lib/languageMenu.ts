/**
 * LANG L2 — cấu hình menu của vỏ Limio Language. Thuần dữ liệu (icon là KHOÁ chữ, component ánh xạ sang
 * biểu tượng) để thử được không cần React.
 */

export type LanguageMenuRole = "teacher" | "student";
export type LanguageIconKey = "home" | "courses" | "exams" | "review" | "coins" | "practice" | "skills" | "cards";

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

const HOME: LanguageMenuItem = { label: "Tổng quan", href: "/language", icon: "home" };
const TOKENS: LanguageMenuItem = { label: "Token AI", href: "/me/ai-tokens", icon: "coins" };

export function languageMenuGroups(role: LanguageMenuRole): LanguageMenuGroup[] {
  if (role === "teacher") {
    return [
      { id: "overview", label: "Tổng quan", items: [HOME] },
      {
        id: "teach",
        label: "Giảng dạy",
        items: [
          { label: "Khoá ngoại ngữ", href: "/language/courses", icon: "courses" },
          { label: "Đề thi (thi thử & luyện đề)", href: "/language/exams", icon: "exams" },
          { label: "Chờ duyệt / chấm", href: "/language/review", icon: "review" },
        ],
      },
      { id: "account", label: "Tài khoản", items: [TOKENS] },
    ];
  }
  return [
    { id: "overview", label: "Tổng quan", items: [HOME] },
    {
      id: "learn",
      label: "Học tập",
      items: [
        { label: "Khoá của tôi", href: "/language/courses", icon: "courses" },
        { label: "Luyện thi", href: "/language/practice", icon: "practice" },
        { label: "Hồ sơ kỹ năng", href: "/me/skills", icon: "skills" },
        { label: "Thẻ ôn từ", href: "/language/cards", icon: "cards" },
      ],
    },
    { id: "account", label: "Tài khoản", items: [TOKENS] },
  ];
}

/** `/language` chỉ sáng ở đúng trang chủ; mục khác sáng ở chính nó và trang con (bỏ query khi so). */
export function isLanguageMenuActive(href: string, current: string): boolean {
  const path = current.split("?")[0]!;
  if (href === "/language") return path === "/language";
  return path === href || path.startsWith(`${href}/`);
}

/** Vai đang chọn (cookie active-role) → bộ menu. Admin dùng menu giảng viên khi ở vỏ ngoại ngữ. */
export function languageShellRole(activeRole: string): LanguageMenuRole {
  return activeRole === "instructor" || activeRole === "admin" ? "teacher" : "student";
}
