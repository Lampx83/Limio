/**
 * Các "khu" của menu admin gồm nhiều trang cùng một việc. Mỗi khu là MỘT mục trên menu trái;
 * các trang con hiện thành thanh tab ở đầu trang (`AdminSectionTabs`). URL của từng trang giữ nguyên.
 * Thêm trang vào khu: thêm vào `tabs` ở đây rồi đặt `<AdminSectionTabs section="..." />` ở đầu trang đó.
 */
export interface AdminSectionTab {
  label: string;
  href: string;
}

export interface AdminSection {
  label: string;
  tabs: AdminSectionTab[];
}

export const ADMIN_SECTIONS = {
  instructors: {
    label: "Giảng viên",
    tabs: [
      { label: "Đơn đăng ký", href: "/admin/instructor-applications" },
      { label: "Hoạt động", href: "/admin/instructor-activity" },
    ],
  },
  content: {
    label: "Khoá học",
    tabs: [
      { label: "Khoá học", href: "/admin/courses" },
      { label: "Nhóm danh mục", href: "/admin/catalog-sections" },
      { label: "Skill", href: "/admin/skills" },
      { label: "Tiến độ học liệu", href: "/admin/tien-do-hoc-lieu" },
    ],
  },
  commerce: {
    label: "Gói & hạn mức",
    tabs: [
      { label: "Gói tài khoản", href: "/admin/plans" },
      { label: "Token AI", href: "/admin/ai-tokens" },
      { label: "Dung lượng", href: "/admin/storage" },
    ],
  },
} satisfies Record<string, AdminSection>;

export type AdminSectionId = keyof typeof ADMIN_SECTIONS;

/** Đường dẫn thuộc tab nào: đúng trang đó hoặc trang con của nó (vd /admin/courses/<id>/access-plans thuộc "Khoá học"). */
export function pathInTab(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function pathInSection(pathname: string, id: AdminSectionId): boolean {
  return ADMIN_SECTIONS[id].tabs.some((t) => pathInTab(pathname, t.href));
}
