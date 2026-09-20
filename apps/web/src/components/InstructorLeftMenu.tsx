"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ComponentType } from "react";
import { useActiveNavSectionOverride } from "@/lib/activeNavSection";
import PanelToggle from "@/components/ui/PanelToggle";
import Tooltip from "@/components/ui/Tooltip";
import { WordCloudIcon } from "@/components/icons/WordCloudIcon";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Eye,
  FlaskConical,
  ClipboardList,
  MessageSquare,
  Trophy,
  Users,
  Brain,
  BarChart3,
  Menu,
  X,
  Loader2,
  CalendarCheck,
  Library,
  Coins,
  Presentation,
  FolderOpen,
  Crown,
  Bot,
  Clock,
  PenTool,
  Gamepad2,
  ListChecks,
  Shuffle,
  StickyNote,
  createLucideIcon,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/** Điểm "A+" khoanh tròn bằng nét bút — icon module Kiểm tra đánh giá (lucide không có sẵn hình này). */
const GradeAPlus = createLucideIcon("GradeAPlus", [
  ["path", { d: "M4.6 17 8 7.2 11.4 17", key: "a-legs" }],
  ["path", { d: "M5.8 13.7h4.4", key: "a-bar" }],
  ["path", { d: "M17 9.6v4.8", key: "plus-v" }],
  ["path", { d: "M14.6 12h4.8", key: "plus-h" }],
  // Vòng khoanh tay: hơi lệch, hai đầu nét chồng lên nhau như khi thầy cô khoanh điểm.
  [
    "path",
    {
      d: "M3.4 7.6C6.2 3.6 16.6 3 20.6 7c2.8 2.8 1.8 9.4-3 12.4-4.8 3-12 1.6-14.2-4C1.4 12.2 2.8 8.4 6 5",
      key: "circle",
    },
  ],
]);

/** Icon Word Cloud của bài giảng tương tác — bọc lại để nhận className (màu) như icon lucide. */
function WordCloudMenuIcon({ size = 14, className, strokeWidth }: LucideProps) {
  return (
    <span className={`inline-flex ${className ?? ""}`}>
      <WordCloudIcon size={Number(size) * 1.2} strokeWidth={strokeWidth} />
    </span>
  );
}

type Item = {
  label: string;
  href?: string;
  icon: LucideIcon | ComponentType<LucideProps>;
  note?: string;
  /** Nhãn nhỏ, không tương tác — chỉ để nhóm trực quan các item trong 1 module dài (vd LMS). */
  section?: string;
};

type ModuleColors = {
  /** Nền icon rail lúc module đang active — hình vuông bo góc, icon trắng. */
  rail: string;
  itemActiveBg: string;
  itemActiveText: string;
  itemIconBg: string;
  itemIconFg: string;
  headerText: string;
};

type ModuleDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Ghi đè cỡ icon rail mặc định (23px) — 1 số icon (vd GraduationCap) có
   * phần glyph chiếm ít diện tích hơn nên nhìn nhỏ hơn hẳn dù cùng font-size. */
  iconSize?: number;
  /** Module dự tính thu phí (Limio-Live, Vấn đáp AI) — icon rail có viền vàng
   * + huy hiệu crown, sidebar có pill "Premium" cạnh tên module. */
  premium?: boolean;
  /** Mô tả ngắn 1 dòng dưới tên module ở sidebar (và trong tooltip của icon rail). */
  tagline?: string;
  colors: ModuleColors;
  /** Path prefix để tự nhận diện module đang active từ URL — rail là điều
   * hướng thật (Link), không phải state client thuần, nên F5/deep-link vẫn
   * đúng module. */
  matchPrefixes: string[];
  items: Item[];
};

const PROCTOR_ITEM: Item = {
  label: "Giám sát phòng thi",
  href: "/instructor/my-rooms",
  icon: Eye,
};

// 6 module theo mockup đã chốt với GV — mỗi module 1 màu accent riêng để nhận
// ra ngay bằng mắt, không cần đọc chữ. "Học viên" + "AI Feedback
// Generator/Feedback Templates" gộp vào LMS theo yêu cầu (những thứ này vẫn
// là dữ liệu/công cụ của khoá học, tách riêng thành module chỉ vì "có chữ AI"
// sẽ khó tìm hơn).
const MODULES: ModuleDef[] = [
  {
    id: "lms",
    label: "LMS",
    tagline: "Bài giảng Elearning",
    icon: GraduationCap,
    iconSize: 27,
    colors: {
      rail: "bg-gradient-to-br from-lime-500 to-pink-500",
      itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
      itemActiveText: "text-lime-700 dark:text-lime-200",
      itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
      itemIconFg: "text-lime-600 dark:text-lime-300",
      headerText: "text-lime-700 dark:text-lime-400",
    },
    matchPrefixes: [
      "/instructor/courses",
      "/catalog",
      "/instructor/assignments",
      "/instructor/skill-tagging",
      "/instructor/forum",
      "/instructor/enrollments",
      "/instructor/feedback-generator",
      "/instructor/feedback-templates",
    ],
    items: [
      { label: "Khoá học của tôi", href: "/instructor/courses", icon: BookOpen },
      { label: "Assignment", href: "/instructor/assignments", icon: ClipboardList },
      { label: "Forum Q&A", href: "/instructor/forum", icon: MessageSquare },
    ],
  },
  {
    // Limio-Live gate bằng feature flag riêng (limio_live.access, mặc định
    // TẮT — bật dần theo GV thí điểm), khác teaching_tools.access ở module LMS.
    // Vẫn hiện icon module cho mọi giảng viên; GV chưa được bật sẽ bị
    // requireFeature() redirect về dashboard khi bấm vào.
    id: "limio-live",
    label: "Limio-Live",
    tagline: "Dạy học trực tiếp",
    icon: Presentation,
    premium: true,
    colors: {
      rail: "bg-gradient-to-br from-lime-500 to-pink-500",
      itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
      itemActiveText: "text-lime-700 dark:text-lime-200",
      itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
      itemIconFg: "text-lime-600 dark:text-lime-300",
      headerText: "bg-gradient-to-r from-lime-600 to-pink-500 bg-clip-text text-transparent",
    },
    matchPrefixes: ["/instructor/limio-live", "/instructor/teaching-tools", "/instructor/gameshow"],
    items: [
      { label: "Bài giảng của tôi", href: "/instructor/limio-live", icon: Presentation, section: "Bài giảng tương tác" },
      { label: "Thư viện mẫu", icon: FolderOpen, note: "Chợ chia sẻ mẫu bài giảng — đang phát triển (P2)", section: "Bài giảng tương tác" },
      // Mỗi công cụ 1 dòng menu (mở thẳng qua ?tool=...), gom theo mục đích, ≤5 mục/nhóm.
      { label: "Vote", href: "/instructor/teaching-tools?tool=poll", icon: BarChart3, section: "Hoạt động nhanh" },
      { label: "Word Cloud", href: "/instructor/teaching-tools?tool=wordcloud", icon: WordCloudMenuIcon, section: "Hoạt động nhanh" },
      { label: "Padlet", href: "/instructor/teaching-tools?tool=board", icon: StickyNote, section: "Hoạt động nhanh" },
      { label: "Whiteboard", href: "/instructor/teaching-tools?tool=whiteboard", icon: PenTool, section: "Hoạt động nhanh" },
      { label: "Đếm ngược", href: "/instructor/teaching-tools?tool=timer", icon: Clock, section: "Điều hành lớp học" },
      { label: "Gọi tên", href: "/instructor/teaching-tools?tool=random-picker", icon: Shuffle, section: "Điều hành lớp học" },
      { label: "Phân nhóm", href: "/instructor/teaching-tools?tool=grouping", icon: Users, section: "Điều hành lớp học" },
      { label: "Gameshow", href: "/instructor/gameshow/new", icon: Gamepad2, section: "Điều hành lớp học" },
      { label: "Template", icon: Library, note: "Mẫu thiết kế sư phạm — đang phát triển", section: "Thiết kế sư phạm" },
      { label: "Soạn kịch bản", icon: ListChecks, note: "Soạn kịch bản hoạt động — đang phát triển", section: "Thiết kế sư phạm" },
    ],
  },
  {
    // A6.5 — Vấn đáp AI tách khỏi "Kiểm tra đánh giá" (thi viết) thành module
    // riêng: soạn đề, mở ca thi, giám sát live, chấm điểm đều là quy trình
    // khác hẳn thi viết (không câu hỏi/ngân hàng, chấm theo hội thoại chứ
        // không theo từng câu). Chỉ MỘT mục: vấn đáp không có bước "Tổ chức thi"
    // riêng như thi viết — nút "Mở buổi vấn đáp" nằm thẳng trên trang quản lý
    // từng đề (xem OralSessionControl), đi qua "Phòng thi vấn đáp" là đủ.
    id: "oral",
    label: "Vấn đáp AI",
    icon: Bot,
    premium: true,
    colors: {
      rail: "bg-gradient-to-br from-lime-500 to-pink-500",
      itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
      itemActiveText: "text-lime-700 dark:text-lime-200",
      itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
      itemIconFg: "text-lime-600 dark:text-lime-300",
      headerText: "text-lime-700 dark:text-lime-400",
    },
    matchPrefixes: ["/instructor/oral-exams"],
    items: [{ label: "Phòng vấn đáp", href: "/instructor/oral-exams", icon: Bot }],
  },
  {
    id: "exam",
    label: "Kiểm tra đánh giá",
    icon: GradeAPlus,
    iconSize: 28,
    colors: {
      rail: "bg-gradient-to-br from-lime-500 to-pink-500",
      itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
      itemActiveText: "text-lime-700 dark:text-lime-200",
      itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
      itemIconFg: "text-lime-600 dark:text-lime-300",
      headerText: "text-lime-700 dark:text-lime-400",
    },
    // "Giám sát phòng thi" ĐÃ BỎ khỏi menu này: giám thị nay vào bằng mã ở
    // /giam-thi, không cần tài khoản.
    matchPrefixes: ["/instructor/question-banks", "/instructor/exams", "/instructor/organize"],
    items: [
      // Thứ tự bám theo trình tự làm việc thật: soạn câu → gom thành gói đề →
      // mang đi tổ chức → coi thi.
      { label: "Ngân hàng câu hỏi", href: "/instructor/question-banks", icon: Library },
      { label: "Đề thi", href: "/instructor/exams", icon: FlaskConical },
      { label: "Tổ chức thi", href: "/instructor/organize", icon: CalendarCheck },
    ],
  },
  {
    id: "tournament",
    label: "Đấu trường",
    icon: Trophy,
    colors: {
      rail: "bg-gradient-to-br from-lime-500 to-pink-500",
      itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
      itemActiveText: "text-lime-700 dark:text-lime-200",
      itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
      itemIconFg: "text-lime-600 dark:text-lime-300",
      headerText: "text-lime-700 dark:text-lime-400",
    },
    matchPrefixes: ["/instructor/tournaments"],
    items: [{ label: "Đấu trường của tôi", href: "/instructor/tournaments", icon: Trophy }],
  },
  {
    id: "analytics",
    label: "Phân tích và Báo cáo",
    icon: BarChart3,
    colors: {
      rail: "bg-gradient-to-br from-lime-500 to-pink-500",
      itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
      itemActiveText: "text-lime-700 dark:text-lime-200",
      itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
      itemIconFg: "text-lime-600 dark:text-lime-300",
      headerText: "text-lime-700 dark:text-lime-400",
    },
    matchPrefixes: ["/instructor/analytics", "/instructor/learner-insights", "/me/ai-tokens"],
    items: [
      { label: "Analytics và Báo cáo", href: "/instructor/analytics", icon: BarChart3 },
      { label: "Nắm kiến thức", href: "/instructor/learner-insights", icon: Brain },
      { label: "Token AI", href: "/me/ai-tokens", icon: Coins },
    ],
  },
];

/**
 * Đề thi viết và vấn đáp AI dùng CHUNG 1 route (`/instructor/courses/{id}/exams/{examId}`)
 * — chỉ exam.kind (server-side, qua SetActiveNavSection) mới phân biệt được
 * nên đi với module "exam" hay "oral". Không có override (route khác, hoặc
 * lỗi fetch kind) → mặc định "exam" như hành vi cũ.
 */
function resolveActiveModuleId(pathname: string, navOverride: string | null): string {
  if (/^\/instructor\/courses\/[^/]+\/exams(\/|$)/.test(pathname)) {
    return navOverride === "/instructor/oral-exams" ? "oral" : "exam";
  }
  if (pathname === "/instructor/dashboard") return "home";
  for (const m of MODULES) {
    if (m.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return m.id;
    }
  }
  return "home";
}

// Slim menu for users who are ONLY proctors (no course-instructor binding).
const PROCTOR_ONLY_ITEMS: Item[] = [PROCTOR_ITEM];

// useSearchParams cần Suspense (Next 14) — bọc ở đây để 2 layout dùng chung khỏi phải tự bọc.
export default function InstructorLeftMenu(props: { isInstructor?: boolean; isProctor?: boolean }) {
  return (
    <Suspense fallback={null}>
      <InstructorLeftMenuInner {...props} />
    </Suspense>
  );
}

function InstructorLeftMenuInner({
  isInstructor = true,
  isProctor = false,
}: {
  isInstructor?: boolean;
  isProctor?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navOverride = useActiveNavSectionOverride();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Bấm module → rail + cột tên mục đổi NGAY (lạc quan), không đợi route mới tải xong;
  // pathname đổi (kể cả bị redirect về chỗ khác) thì bỏ trạng thái chờ, lấy theo URL thật.
  const [pendingModuleId, setPendingModuleId] = useState<string | null>(null);
  // Tương tự cho mục trong cột tên mục: sáng ngay + quay spinner tới khi trang mới sẵn sàng
  // (trang nặng như Công cụ giảng dạy có thể mất vài giây, trước đây bấm xong không thấy gì).
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setPendingModuleId(null);
    setPendingHref(null);
  }, [pathname, searchParams]);

  // Cột tên mục của module gấp/mở được (rail icon luôn hiện). Trang soạn
  // Limio-Live cần bề ngang nhất nên mặc định gấp và nhớ lựa chọn riêng.
  const isLiveEditor =
    /^\/instructor\/limio-live\/[^/]+(?:\?|$)/.test(pathname) && !/^\/instructor\/limio-live\/[^/]+\/present/.test(pathname);
  const collapseKey = isLiveEditor ? "nav.sidebar.collapsed.editor" : "nav.sidebar.collapsed";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isLiveEditor);
  useEffect(() => {
    try {
      const v = localStorage.getItem(collapseKey);
      setSidebarCollapsed(v === null ? isLiveEditor : v === "1");
    } catch {
      setSidebarCollapsed(isLiveEditor);
    }
  }, [collapseKey, isLiveEditor]);
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem(collapseKey, next ? "1" : "0");
    } catch {
      /* không lưu được thì thôi */
    }
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (pendingHref) return href === pendingHref;
    // Mục có ?tool=... (công cụ giảng dạy): sáng khi đúng path + đúng tool; mục gốc
    // /instructor/teaching-tools chỉ sáng khi CHƯA chọn công cụ nào.
    if (href.includes("?tool=")) {
      const [base, query] = href.split("?");
      return pathname === base && new URLSearchParams(query).get("tool") === searchParams.get("tool");
    }
    if (/^\/instructor\/courses\/[^/]+\/exams(\/|$)/.test(pathname)) {
      return href === (navOverride ?? "/instructor/exams");
    }
    if (href === "/instructor/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Menu rút gọn chỉ cho người không dạy khoá nào mà được gán coi thi —
  // không có module gì để chuyển, giữ nguyên danh sách phẳng như cũ.
  if (!isInstructor && isProctor) {
    void isInstructor;
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Mở menu giảng viên"
          className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-lime-600 text-white shadow-lg transition-transform hover:scale-105 lg:hidden"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ItemList items={PROCTOR_ONLY_ITEMS} isActive={isActive} colors={NEUTRAL_COLORS} pendingHref={pendingHref} onNavigate={setPendingHref} />
            </aside>
          </div>
        )}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] p-3 lg:block">
          <ItemList items={PROCTOR_ONLY_ITEMS} isActive={isActive} colors={NEUTRAL_COLORS} pendingHref={pendingHref} onNavigate={setPendingHref} />
        </aside>
      </>
    );
  }

  const activeModuleId = pendingModuleId ?? resolveActiveModuleId(pathname, navOverride);
  const activeModule = MODULES.find((m) => m.id === activeModuleId) ?? null;

  // Trang course editor `/instructor/courses/{id}` đã có nhiều layer
  // navigation (tab, EditorSidebar, breadcrumb) → ẩn workspace menu để đỡ
  // loạn. Khoá-mức `/new` và sub-pages khác KHÔNG match. User vẫn có thể
  // mở menu qua nút floating (luôn hiện trên route này, không chỉ mobile).
  const isCourseEditor = /^\/instructor\/courses\/[^/]+(?:\?|$)/.test(pathname) && !/^\/instructor\/courses\/new(?:\?|$)/.test(pathname);
  // Trang trình chiếu Limio-Live — chiếu lên máy chiếu, sidebar chỉ tổ nội
  // dung. Cùng cơ chế "ẩn + nút floating để mở lại" như course editor.
  const isPresentMode = /^\/instructor\/limio-live\/[^/]+\/present(?:\/|\?|$)/.test(pathname);
  const isImmersive = isCourseEditor || isPresentMode;

  const rail = (
    <ModuleRail activeModuleId={activeModuleId} onSelect={setPendingModuleId} onHover={(href) => router.prefetch(href)} />
  );
  const railDesktop = (
    <ModuleRail
      activeModuleId={activeModuleId}
      onSelect={setPendingModuleId}
      onHover={(href) => router.prefetch(href)}
      footer={
        activeModule ? (
          <PanelToggle
            side="left"
            collapsed={sidebarCollapsed}
            onClick={toggleSidebar}
            label={sidebarCollapsed ? "Mở rộng menu module" : "Thu gọn menu module"}
          />
        ) : null
      }
    />
  );
  const sidebarContent = activeModule ? (
    <div className="w-56 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] py-5 pl-5 pr-3">
      {/* Module chia section (vd Limio-Live): chừa thêm khoảng trắng giữa tên
          module và nhãn section đầu tiên để hai tầng tiêu đề không dính nhau. */}
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-1 ${
          activeModule.items.some((it) => it.section) ? "mb-8" : "mb-4"
        }`}
      >
        <p className={`text-[19px] font-extrabold leading-tight tracking-tight ${activeModule.colors.headerText}`}>
          {activeModule.label}
        </p>
        {activeModule.premium && (
          <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 dark:from-amber-700 dark:to-amber-600 dark:text-amber-50">
            <Crown size={9} strokeWidth={2.5} />
            Premium
          </span>
        )}
        {activeModule.tagline && (
          <p className="basis-full text-[14px] font-medium leading-tight text-muted">{activeModule.tagline}</p>
        )}
      </div>
      <ItemList items={activeModule.items} isActive={isActive} colors={activeModule.colors} pendingHref={pendingHref} onNavigate={setPendingHref} />
    </div>
  ) : null;

  return (
    <>
      {/* Floating menu toggle — mobile mặc định; trên course editor/present
          cũng hiện để GV có cách mở lại workspace menu. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Mở menu giảng viên"
        className={`fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-lime-600 text-white shadow-lg transition-transform hover:scale-105 ${
          isImmersive ? "" : "lg:hidden"
        }`}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Drawer — show via mobileOpen on mobile, also reused on course editor/present desktop */}
      {mobileOpen && (
        <div
          className={`fixed inset-0 z-40 animate-overlay-in bg-black/40 backdrop-blur-sm ${isImmersive ? "" : "lg:hidden"}`}
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 flex h-full w-80 animate-drawer-in-left border-r border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {rail}
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden on course editor/present. Rail luôn 1 cột
          64px; cột module chỉ hiện khi KHÔNG ở "home" (trang chủ không cần
          sub-nav riêng, nhường chỗ cho nội dung). */}
      {!isImmersive && (
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 lg:flex">
          {railDesktop}
          {/* Cột tên mục thu/mở bằng chuyển động bề ngang (không gỡ khỏi DOM → mượt). */}
          {activeModule && (
            <div
              className={`shrink-0 overflow-hidden transition-[width,opacity,visibility] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                sidebarCollapsed ? "invisible w-0 opacity-0" : "w-56 opacity-100"
              }`}
              aria-hidden={sidebarCollapsed}
            >
              <div key={activeModuleId} className="flex h-full w-56 animate-nav-swap-in">{sidebarContent}</div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}

const NEUTRAL_COLORS: ModuleColors = {
  rail: "bg-gradient-to-br from-lime-500 to-pink-500",
  itemActiveBg: "bg-lime-50 dark:bg-lime-950/40",
  itemActiveText: "text-lime-700 dark:text-lime-200",
  itemIconBg: "bg-lime-100 dark:bg-lime-950/40",
  itemIconFg: "text-lime-600 dark:text-lime-300",
  headerText: "text-lime-700 dark:text-lime-400",
};

// ── Rail — cột icon dọc luôn hiện, "Trang chủ" ghim riêng phía trên rồi tới
// 6 module. Đây là điều hướng THẬT (Link), không phải state client — F5 hay
// deep-link vào thẳng 1 trang vẫn tự sáng đúng icon nhờ resolveActiveModuleId.
function ModuleRail({
  activeModuleId,
  footer,
  onSelect,
  onHover,
}: {
  activeModuleId: string;
  footer?: React.ReactNode;
  onSelect: (id: string) => void;
  onHover: (href: string) => void;
}) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-3 overflow-y-auto border-r border-token bg-[rgb(var(--surface-muted))] py-5 lg:overflow-visible">
      <RailButton
        href="/instructor/dashboard"
        label="Trang chủ"
        icon={LayoutDashboard}
        iconSize={28}
        hero
        isActive={activeModuleId === "home"}
        railClass="bg-gradient-to-br from-lime-500 to-pink-500"
        description="Tổng quan việc cần xử lý"
        onSelect={() => onSelect("home")}
        onHover={onHover}
      />
      <div className="my-1.5 h-px w-8 bg-token" />
      {MODULES.map((m) => (
        <RailButton
          key={m.id}
          href={m.items.find((it) => it.href)?.href ?? "/instructor/dashboard"}
          label={m.label}
          icon={m.icon}
          iconSize={m.iconSize}
          isActive={activeModuleId === m.id}
          railClass={m.colors.rail}
          premium={m.premium}
          description={m.tagline ?? (m.premium ? "Tính năng Premium" : undefined)}
          onSelect={() => onSelect(m.id)}
          onHover={onHover}
        />
      ))}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </div>
  );
}

function RailButton({
  href,
  label,
  icon: Icon,
  iconSize = 23,
  hero,
  isActive,
  railClass,
  premium,
  description,
  onSelect,
  onHover,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  iconSize?: number;
  /** Nút Trang chủ: to hơn và bo góc lớn hơn để tách khỏi 6 module bên dưới. */
  hero?: boolean;
  isActive: boolean;
  railClass: string;
  premium?: boolean;
  description?: string;
  onSelect: () => void;
  onHover: (href: string) => void;
}) {
  const box = hero ? "h-14 w-14 rounded-2xl" : "h-12 w-12 rounded-xl";
  // Bấm module → tooltip biến mất ngay (không kẹt lại đè lên cột tên mục), hiện lại khi rê chuột ra rồi vào.
  const [tipHidden, setTipHidden] = useState(false);
  return (
    <Tooltip label={label} description={description} side="right" suppressed={tipHidden}>
      <Link
        href={href}
        onClick={(e) => {
        setTipHidden(true);
        (e.currentTarget as HTMLElement).blur();
        onSelect();
      }}
      onMouseLeave={() => setTipHidden(false)}
        onMouseEnter={() => onHover(href)}
        onFocus={() => onHover(href)}
        aria-label={premium ? `${label} — Premium` : label}
        aria-current={isActive ? "page" : undefined}
        prefetch={false}
        className={`group relative flex items-center justify-center transition-transform hover:scale-105 ${box}`}
      >
        {/* Đơn sắc lúc chưa chọn — chỉ module đang active mới lên màu riêng,
            tránh rail lúc nào cũng "sặc sỡ" cả 6 màu cùng lúc. */}
        <span
          className={`flex items-center justify-center transition-colors duration-200 ${box} ${
            isActive
              ? `${railClass} shadow-sm`
              : hero
                ? "bg-[rgb(var(--surface))] shadow-sm ring-1 ring-[rgb(var(--border))]"
                : "group-hover:bg-[rgb(var(--surface))]"
          } ${hero && isActive ? "shadow-md" : ""}`}
        >
          <Icon size={iconSize} className={isActive ? "text-white" : "text-[rgb(var(--text-muted))]"} strokeWidth={isActive ? 1.75 : 1.5} />
        </span>
      </Link>
    </Tooltip>
  );
}

// ── Danh sách item của module đang chọn — tối đa 1 cấp, không còn collapse
// vì mỗi module giờ đã đủ hẹp để không cần thu gọn nữa.
function ItemList({
  items,
  isActive,
  colors,
  pendingHref,
  onNavigate,
}: {
  items: Item[];
  isActive: (href?: string) => boolean;
  colors: ModuleColors;
  pendingHref: string | null;
  onNavigate: (href: string) => void;
}) {
  // Gom theo nhóm (giữ thứ tự xuất hiện); tiêu đề nhóm chỉ là nhãn — luôn hiện hết, không gấp được.
  const groups: Array<{ section: string | null; items: Item[] }> = [];
  for (const it of items) {
    const sec = it.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === sec) last.items.push(it);
    else groups.push({ section: sec, items: [it] });
  }

  return (
    <div className="space-y-8">
      {groups.map((g, gi) => (
        <section key={g.section ?? gi}>
          {g.section && (
            <p className="mb-2.5 px-1.5 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--text-muted))]">
              {g.section}
            </p>
          )}
          <ul className="space-y-2">
            {g.items.map((it) => (
              <li key={it.label}>
                <ItemRow item={it} active={isActive(it.href)} colors={colors} pending={!!it.href && it.href === pendingHref} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  active,
  colors,
  pending,
  onNavigate,
}: {
  item: Item;
  active: boolean;
  colors: ModuleColors;
  pending: boolean;
  onNavigate: (href: string) => void;
}) {
  const Icon = item.icon;
  const baseRow = "group/item relative flex items-center gap-2.5 rounded-full pl-1.5 pr-3 py-1.5 text-sm transition-colors";
  const iconCircle = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.itemIconBg}`;

  if (!item.href) {
    return (
      <div className={`${baseRow} cursor-not-allowed text-faint`} title={item.note ?? "Đang phát triển"} aria-disabled>
        <span className={iconCircle + " opacity-50"}>
          <Icon size={14} className={colors.itemIconFg} />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        <span
          className="shrink-0 rounded-full bg-amber-100/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          title={item.note ?? "Đang phát triển"}
        >
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={() => onNavigate(item.href!)}
      aria-busy={pending}
      className={`${baseRow} ${
        active ? `${colors.itemActiveBg} ${colors.itemActiveText} font-semibold shadow-sm` : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
      }`}
      prefetch={false}
    >
      {active && <span className={`absolute inset-y-1 left-0 w-1 rounded-r-full ${colors.rail}`} />}
      <span className={iconCircle}>
        {pending ? (
          <Loader2 size={14} className={`${colors.itemIconFg} animate-spin`} />
        ) : (
          <Icon size={14} className={colors.itemIconFg} strokeWidth={active ? 2.5 : 2} />
        )}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}
