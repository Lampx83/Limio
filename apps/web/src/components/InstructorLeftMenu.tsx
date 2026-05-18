"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Eye,
  FlaskConical,
  ClipboardList,
  Tag,
  Wrench,
  MessageSquare,
  Trophy,
  Users,
  Brain,
  Sparkles,
  FileText,
  BarChart3,
  ChevronRight,
  Menu,
  X,
  Library,
  PenLine,
  Radio,
  LineChart,
  type LucideIcon,
} from "lucide-react";

type Item = {
  label: string;
  href?: string;
  icon: LucideIcon;
  note?: string;
};

type Group = {
  id: string;
  label: string;
  items: Item[];
};

const PROCTOR_ITEM: Item = {
  label: "Giám sát phòng thi",
  href: "/instructor/my-rooms",
  icon: Eye,
};

const FULL_GROUPS: Group[] = [
  {
    id: "teaching",
    label: "Giảng dạy",
    items: [
      { label: "Khoá học của tôi", href: "/instructor/courses", icon: BookOpen },
      { label: "Đánh giá Assignment", href: "/instructor/assignments", icon: ClipboardList },
      { label: "Skill tagging", href: "/instructor/skill-tagging", icon: Tag },
      { label: "Tournament của tôi", href: "/instructor/tournaments", icon: Trophy },
      { label: "Công cụ giảng dạy", href: "/instructor/teaching-tools", icon: Wrench },
      { label: "Forum Q&A", href: "/instructor/forum", icon: MessageSquare },
    ],
  },
  {
    id: "exam",
    label: "Kiểm tra đánh giá",
    items: [
      { label: "Ngân hàng câu hỏi", href: "/instructor/question-banks", icon: Library },
      { label: "Đề thi", href: "/instructor/exams", icon: FlaskConical },
      { label: "Tổ chức thi", href: "/instructor/exam-rounds", icon: Radio },
      PROCTOR_ITEM,
      { label: "Chấm tự luận", href: "/instructor/grade-essays", icon: PenLine },
      { label: "Phân tích item", href: "/instructor/item-analytics", icon: LineChart },
    ],
  },
  {
    id: "learners",
    label: "Học viên",
    items: [
      { label: "Enrollments", href: "/instructor/enrollments", icon: Users },
      { label: "Learner Insights (BKT)", href: "/instructor/learner-insights", icon: Brain },
    ],
  },
  {
    id: "ai",
    label: "AI & Phân tích",
    items: [
      { label: "AI Feedback Generator", href: "/instructor/feedback-generator", icon: Sparkles },
      { label: "Feedback Templates", href: "/instructor/feedback-templates", icon: FileText },
      { label: "Analytics & Báo cáo", href: "/instructor/analytics", icon: BarChart3 },
    ],
  },
];

// Slim menu for users who are ONLY proctors (no course-instructor binding).
const PROCTOR_ONLY_GROUPS: Group[] = [
  {
    id: "proctor",
    label: "Giám thị",
    items: [PROCTOR_ITEM],
  },
];

const LS_KEY = "fbm-instructor-menu-collapsed";

export default function InstructorLeftMenu({
  isInstructor = true,
  isProctor = false,
}: {
  isInstructor?: boolean;
  isProctor?: boolean;
}) {
  const pathname = usePathname();
  // Slim menu only when the user has zero instructor binding but is proctor.
  // Otherwise (instructor, instructor+proctor, or admin) we render the full
  // menu — the "Giám sát phòng thi" item is always present in the full menu.
  const GROUPS =
    !isInstructor && isProctor ? PROCTOR_ONLY_GROUPS : FULL_GROUPS;
  void isProctor; // visibility only matters for slim mode; full mode shows item always
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    // Course-scoped exam editor lives at /instructor/courses/<id>/exams/<examId>
    // but conceptually belongs to "Đề thi" — highlight that item instead of
    // "Khoá học của tôi", which would otherwise win on prefix match.
    if (/^\/instructor\/courses\/[^/]+\/exams(\/|$)/.test(pathname)) {
      return href === "/instructor/exams";
    }
    if (href === "/instructor/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const nav = (
    <nav className="flex flex-col gap-1 py-5">
      {/* Workspace + Dashboard entry */}
      <div className="mb-3 px-4">
        <Link
          href="/instructor/dashboard"
          aria-current={isActive("/instructor/dashboard") ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
            isActive("/instructor/dashboard")
              ? "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-50 shadow-sm dark:border-amber-700/60 dark:from-amber-950/50 dark:to-amber-950/20"
              : "border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 hover:from-amber-100 hover:to-amber-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-amber-950/10 dark:hover:from-amber-950/50"
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
            <LayoutDashboard size={16} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Workspace
            </div>
            <div className="truncate text-sm font-semibold text-amber-900 dark:text-amber-100">
              Giảng viên
            </div>
          </div>
        </Link>
      </div>

      {GROUPS.map((g, idx) => {
        const isCollapsed = !!collapsed[g.id];
        return (
          <div key={g.id} className="px-3">
            {idx > 0 && <div className="mx-1 my-2 h-px bg-token" />}
            <button
              type="button"
              onClick={() => toggle(g.id)}
              className="group flex w-full items-center gap-2 px-1 pt-3 pb-1.5 text-left"
            >
              <span className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-400">
                {g.label}
              </span>
              <ChevronRight
                size={12}
                className={`text-brand-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              />
            </button>
            {!isCollapsed && (
              <ul className="mt-1 space-y-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  const baseRow =
                    "group/item relative flex items-center gap-2.5 rounded-lg pl-3 pr-2 py-2 text-sm transition-colors";

                  if (!it.href) {
                    return (
                      <li key={it.label}>
                        <div
                          className={`${baseRow} cursor-not-allowed text-faint`}
                          title={it.note ?? "Đang phát triển"}
                          aria-disabled
                        >
                          <Icon size={16} className="shrink-0 opacity-60" />
                          <span className="flex-1 truncate">{it.label}</span>
                          <span
                            className="shrink-0 rounded-sm bg-amber-100/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            title={it.note ?? "Đang phát triển"}
                          >
                            Soon
                          </span>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={it.label}>
                      <Link
                        href={it.href}
                        className={`${baseRow} ${
                          active
                            ? "bg-amber-50 font-semibold text-amber-700 shadow-sm dark:bg-amber-950/40 dark:text-amber-200"
                            : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                        }`}
                      >
                        {active && (
                          <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-amber-500" />
                        )}
                        <Icon
                          size={16}
                          className={`shrink-0 ${active ? "text-amber-600 dark:text-amber-300" : ""}`}
                          strokeWidth={active ? 2.5 : 2}
                        />
                        <span className="flex-1 truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  // Trang course editor `/instructor/courses/{id}` đã có nhiều layer
  // navigation (tab, EditorSidebar, breadcrumb) → ẩn workspace menu để đỡ
  // loạn. Khoá-mức `/new` và sub-pages khác KHÔNG match. User vẫn có thể
  // mở menu qua nút floating (luôn hiện trên route này, không chỉ mobile).
  const isCourseEditor = /^\/instructor\/courses\/[^/]+(?:\?|$)/.test(
    pathname,
  ) && !/^\/instructor\/courses\/new(?:\?|$)/.test(pathname);

  return (
    <>
      {/* Floating menu toggle — mobile mặc định; trên course editor cũng
          hiện để GV có cách mở lại workspace menu. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Mở menu giảng viên"
        className={`fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-105 ${
          isCourseEditor ? "" : "lg:hidden"
        }`}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Drawer — show via mobileOpen on mobile, also reused on course editor desktop */}
      {mobileOpen && (
        <div
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm ${isCourseEditor ? "" : "lg:hidden"}`}
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden on course editor */}
      {!isCourseEditor && (
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] lg:block">
          {nav}
        </aside>
      )}
    </>
  );
}
