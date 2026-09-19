"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActiveNavSectionOverride } from "@/lib/activeNavSection";
import PanelToggle from "@/components/ui/PanelToggle";
import {
  LayoutDashboard,
  GraduationCap,
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
  Menu,
  X,
  CalendarCheck,
  Library,
  LayoutGrid,
  Mic,
  Coins,
  Presentation,
  Plus,
  FolderOpen,
  Crown,
  Bot,
  type LucideIcon,
} from "lucide-react";

type Item = {
  label: string;
  href?: string;
  icon: LucideIcon;
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
    icon: GraduationCap,
    iconSize: 27,
    colors: {
      rail: "bg-amber-500",
      itemActiveBg: "bg-amber-50 dark:bg-amber-950/40",
      itemActiveText: "text-amber-700 dark:text-amber-200",
      itemIconBg: "bg-amber-100 dark:bg-amber-950/40",
      itemIconFg: "text-amber-600 dark:text-amber-300",
      headerText: "text-amber-700 dark:text-amber-400",
    },
    matchPrefixes: [
      "/instructor/courses",
      "/catalog",
      "/instructor/assignments",
      "/instructor/skill-tagging",
      "/instructor/forum",
      "/instructor/enrollments",
      "/instructor/learner-insights",
      "/instructor/feedback-generator",
      "/instructor/feedback-templates",
    ],
    items: [
      { label: "Khoá học của tôi", href: "/instructor/courses", icon: BookOpen, section: "Giảng dạy" },
      // Catalog là trang công khai, đặt ngay dưới "Khoá học của tôi" vì hai mục
      // trả lời cùng một câu hỏi ở hai phạm vi: khoá tôi phụ trách, và mọi khoá
      // đang mở. Giảng viên còn dùng nó để xem khoá mình hiện ra sao với người
      // học trước khi publish.
      { label: "Catalog khoá học", href: "/catalog", icon: LayoutGrid, section: "Giảng dạy" },
      { label: "Đánh giá Assignment", href: "/instructor/assignments", icon: ClipboardList, section: "Giảng dạy" },
      { label: "Skill tagging", href: "/instructor/skill-tagging", icon: Tag, section: "Giảng dạy" },
      { label: "Forum Q&A", href: "/instructor/forum", icon: MessageSquare, section: "Giảng dạy" },
      { label: "Enrollments", href: "/instructor/enrollments", icon: Users, section: "Học viên" },
      { label: "Learner Insights (BKT)", href: "/instructor/learner-insights", icon: Brain, section: "Học viên" },
      { label: "AI Feedback Generator", href: "/instructor/feedback-generator", icon: Sparkles, section: "AI hỗ trợ" },
      { label: "Feedback Templates", href: "/instructor/feedback-templates", icon: FileText, section: "AI hỗ trợ" },
    ],
  },
  {
    // Limio-Live gate bằng feature flag riêng (limio_live.access, mặc định
    // TẮT — bật dần theo GV thí điểm), khác teaching_tools.access ở module LMS.
    // Vẫn hiện icon module cho mọi giảng viên; GV chưa được bật sẽ bị
    // requireFeature() redirect về dashboard khi bấm vào.
    id: "limio-live",
    label: "Limio-Live",
    icon: Presentation,
    premium: true,
    colors: {
      rail: "bg-gradient-to-br from-pink-400 to-pink-600",
      itemActiveBg: "bg-pink-50 dark:bg-pink-950/40",
      itemActiveText: "text-pink-700 dark:text-pink-200",
      itemIconBg: "bg-pink-100 dark:bg-pink-950/40",
      itemIconFg: "text-pink-600 dark:text-pink-300",
      headerText: "text-pink-700 dark:text-pink-400",
    },
    matchPrefixes: ["/instructor/limio-live", "/instructor/teaching-tools"],
    items: [
      { label: "Bài giảng của tôi", href: "/instructor/limio-live", icon: Presentation, section: "Bài giảng" },
      { label: "Tạo bài giảng mới", href: "/instructor/limio-live?new=1", icon: Plus, section: "Bài giảng" },
      { label: "Thư viện mẫu", icon: FolderOpen, note: "Chợ chia sẻ mẫu bài giảng — đang phát triển (P2)", section: "Bài giảng" },
      // Quick poll, word cloud, đếm giờ, kịch bản lớp học... đều là công cụ
      // chạy trực tiếp trên lớp — cùng bản chất "live" với Limio-Live, không
      // phải nội dung/khoá học tĩnh của LMS.
      { label: "Công cụ giảng dạy", href: "/instructor/teaching-tools", icon: Wrench, section: "Công cụ live" },
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
      rail: "bg-gradient-to-br from-violet-400 to-violet-600",
      itemActiveBg: "bg-violet-50 dark:bg-violet-950/40",
      itemActiveText: "text-violet-700 dark:text-violet-200",
      itemIconBg: "bg-violet-100 dark:bg-violet-950/40",
      itemIconFg: "text-violet-600 dark:text-violet-300",
      headerText: "text-violet-700 dark:text-violet-400",
    },
    matchPrefixes: ["/instructor/oral-exams"],
    items: [{ label: "Phòng thi vấn đáp", href: "/instructor/oral-exams", icon: Mic }],
  },
  {
    id: "exam",
    label: "Kiểm tra đánh giá",
    icon: ClipboardList,
    colors: {
      rail: "bg-blue-500",
      itemActiveBg: "bg-blue-50 dark:bg-blue-950/40",
      itemActiveText: "text-blue-700 dark:text-blue-200",
      itemIconBg: "bg-blue-100 dark:bg-blue-950/40",
      itemIconFg: "text-blue-600 dark:text-blue-300",
      headerText: "text-blue-700 dark:text-blue-400",
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
    label: "Tournament",
    icon: Trophy,
    colors: {
      rail: "bg-orange-500",
      itemActiveBg: "bg-orange-50 dark:bg-orange-950/40",
      itemActiveText: "text-orange-700 dark:text-orange-200",
      itemIconBg: "bg-orange-100 dark:bg-orange-950/40",
      itemIconFg: "text-orange-600 dark:text-orange-300",
      headerText: "text-orange-700 dark:text-orange-400",
    },
    matchPrefixes: ["/instructor/tournaments"],
    items: [{ label: "Tournament của tôi", href: "/instructor/tournaments", icon: Trophy }],
  },
  {
    id: "analytics",
    label: "Phân tích và Báo cáo",
    icon: BarChart3,
    colors: {
      rail: "bg-teal-500",
      itemActiveBg: "bg-teal-50 dark:bg-teal-950/40",
      itemActiveText: "text-teal-700 dark:text-teal-200",
      itemIconBg: "bg-teal-100 dark:bg-teal-950/40",
      itemIconFg: "text-teal-600 dark:text-teal-300",
      headerText: "text-teal-700 dark:text-teal-400",
    },
    matchPrefixes: ["/instructor/analytics", "/me/ai-tokens"],
    items: [
      { label: "Analytics và Báo cáo", href: "/instructor/analytics", icon: BarChart3 },
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

export default function InstructorLeftMenu({
  isInstructor = true,
  isProctor = false,
}: {
  isInstructor?: boolean;
  isProctor?: boolean;
}) {
  const pathname = usePathname();
  const navOverride = useActiveNavSectionOverride();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Bấm module → rail + cột tên mục đổi NGAY (lạc quan), không đợi route mới tải xong;
  // pathname đổi (kể cả bị redirect về chỗ khác) thì bỏ trạng thái chờ, lấy theo URL thật.
  const [pendingModuleId, setPendingModuleId] = useState<string | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setPendingModuleId(null);
  }, [pathname]);

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
          className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-105 lg:hidden"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ItemList items={PROCTOR_ONLY_ITEMS} isActive={isActive} colors={NEUTRAL_COLORS} />
            </aside>
          </div>
        )}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] p-3 lg:block">
          <ItemList items={PROCTOR_ONLY_ITEMS} isActive={isActive} colors={NEUTRAL_COLORS} />
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
    <div className="w-56 shrink-0 overflow-y-auto border-r border-token bg-[rgb(var(--surface))] px-3 py-5">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <p className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${activeModule.colors.headerText}`}>
          {activeModule.label}
        </p>
        {activeModule.premium && (
          <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900 dark:from-amber-700 dark:to-amber-600 dark:text-amber-50">
            <Crown size={9} strokeWidth={2.5} />
            Premium
          </span>
        )}
      </div>
      <ItemList items={activeModule.items} isActive={isActive} colors={activeModule.colors} />
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
        className={`fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-105 ${
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
  rail: "bg-amber-500",
  itemActiveBg: "bg-amber-50 dark:bg-amber-950/40",
  itemActiveText: "text-amber-700 dark:text-amber-200",
  itemIconBg: "bg-amber-100 dark:bg-amber-950/40",
  itemIconFg: "text-amber-600 dark:text-amber-300",
  headerText: "text-amber-700 dark:text-amber-400",
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
    <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-token bg-[rgb(var(--surface-muted))] py-4">
      <RailButton
        href="/instructor/dashboard"
        label="Trang chủ"
        icon={LayoutDashboard}
        isActive={activeModuleId === "home"}
        railClass="bg-[rgb(var(--text))]"
        onSelect={() => onSelect("home")}
        onHover={onHover}
      />
      <div className="my-1 h-px w-8 bg-token" />
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
  isActive,
  railClass,
  premium,
  onSelect,
  onHover,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  iconSize?: number;
  isActive: boolean;
  railClass: string;
  premium?: boolean;
  onSelect: () => void;
  onHover: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      onMouseEnter={() => onHover(href)}
      onFocus={() => onHover(href)}
      title={premium ? `${label} — Premium` : label}
      aria-label={premium ? `${label} — Premium` : label}
      aria-current={isActive ? "page" : undefined}
      prefetch={false}
      className="group relative flex h-12 w-12 items-center justify-center rounded-xl transition-transform hover:scale-105"
    >
      {/* Đơn sắc lúc chưa chọn — chỉ module đang active mới lên màu riêng,
          tránh rail lúc nào cũng "sặc sỡ" cả 6 màu cùng lúc. */}
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 ${
          isActive ? `${railClass} shadow-sm` : "group-hover:bg-[rgb(var(--surface))]"
        }`}
      >
        <Icon size={iconSize} className={isActive ? "text-white" : "text-[rgb(var(--text-muted))]"} strokeWidth={isActive ? 2.25 : 2} />
      </span>
      {premium && (
        // Huy hiệu vàng cố định (cùng tông pill "Premium" ở sidebar) — không
        // dùng gradient brand vì nó xung đột với màu riêng của từng module
        // (hồng Limio-Live, tím Vấn đáp AI). Vàng đứng riêng nên hợp cả hai.
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm ring-2 ring-[rgb(var(--surface-muted))]">
          <Crown size={10} className="text-amber-950" fill="currentColor" strokeWidth={2} />
        </span>
      )}
    </Link>
  );
}

// ── Danh sách item của module đang chọn — tối đa 1 cấp, không còn collapse
// vì mỗi module giờ đã đủ hẹp để không cần thu gọn nữa.
function ItemList({
  items,
  isActive,
  colors,
}: {
  items: Item[];
  isActive: (href?: string) => boolean;
  colors: ModuleColors;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((it, idx) => {
        const showSection = it.section && it.section !== items[idx - 1]?.section;
        return (
          <li key={it.label}>
            {showSection && (
              <p className={`mb-1 mt-3 px-1.5 text-[10px] font-bold uppercase tracking-wide text-faint first:mt-0`}>
                {it.section}
              </p>
            )}
            <ItemRow item={it} active={isActive(it.href)} colors={colors} />
          </li>
        );
      })}
    </ul>
  );
}

function ItemRow({ item, active, colors }: { item: Item; active: boolean; colors: ModuleColors }) {
  const Icon = item.icon;
  const baseRow = "group/item relative flex items-center gap-2.5 rounded-full pl-1.5 pr-3 py-1 text-sm transition-colors";
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
      className={`${baseRow} ${
        active ? `${colors.itemActiveBg} ${colors.itemActiveText} font-semibold shadow-sm` : "text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
      }`}
      prefetch={false}
    >
      {active && <span className={`absolute inset-y-1 left-0 w-1 rounded-r-full ${colors.rail}`} />}
      <span className={iconCircle}>
        <Icon size={14} className={colors.itemIconFg} strokeWidth={active ? 2.5 : 2} />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}
