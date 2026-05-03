import type { NavItem } from "@/components/AdminShell";

export function instructorNav(active: string): NavItem[] {
  return [
    { href: "/instructor", label: "Tổng quan", active: active === "overview" },
    { href: "/instructor/courses", label: "Khoá học", active: active === "courses" },
    { href: "/instructor/submissions", label: "Bài nộp & Feedback", active: active === "submissions" },
    { href: "/instructor/students", label: "Sinh viên", active: active === "students" },
    { href: "/instructor/prompts", label: "Mẫu prompt AI", active: active === "prompts" },
  ];
}

export function institutionAdminNav(active: string): NavItem[] {
  return [
    { href: "/institution-admin", label: "Tổng quan", active: active === "overview" },
    { href: "/institution-admin/users", label: "Người dùng", active: active === "users" },
    { href: "/institution-admin/courses", label: "Khoá học", active: active === "courses" },
    { href: "/institution-admin/analytics", label: "Phân tích", active: active === "analytics" },
  ];
}

export function systemAdminNav(active: string): NavItem[] {
  return [
    { href: "/admin", label: "Tổng quan", active: active === "overview" },
    { href: "/admin/institutions", label: "Cơ sở giáo dục", active: active === "institutions" },
    { href: "/admin/users", label: "Toàn bộ người dùng", active: active === "users" },
    { href: "/admin/research-export", label: "Xuất dữ liệu NC", active: active === "export" },
    { href: "/admin/audit", label: "Nhật ký kiểm toán", active: active === "audit" },
    { href: "/admin/settings", label: "Cấu hình AI", active: active === "settings" },
  ];
}
