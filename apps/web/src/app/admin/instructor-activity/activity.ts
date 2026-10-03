import {
  Activity,
  BookOpen,
  ClipboardCheck,
  KeyRound,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * Nhóm hành động của audit log, dùng cho bộ lọc và cho màu/biểu tượng từng dòng.
 * Phân nhóm theo tiền tố của mã action (`course.created` → "course.").
 * `other` là phần còn lại — không có tiền tố, lọc bằng phủ định của mọi nhóm kia.
 */
export const CATEGORIES = [
  {
    id: "course",
    label: "Khoá học",
    prefixes: ["course.", "enrollment."],
    icon: BookOpen,
    tone: "bg-brand-50 text-brand-700",
  },
  {
    id: "access",
    label: "Quyền & vai trò",
    prefixes: ["role.", "org_admin.", "org_member.", "feature.", "instructor_application."],
    icon: KeyRound,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    id: "exam",
    label: "Thi cử",
    prefixes: ["exam."],
    icon: ClipboardCheck,
    tone: "bg-sky-50 text-sky-700",
  },
  {
    id: "security",
    label: "Bảo mật & tài khoản",
    prefixes: ["impersonation.", "user."],
    icon: ShieldAlert,
    tone: "bg-rose-50 text-rose-700",
  },
  {
    id: "other",
    label: "Khác",
    prefixes: [],
    icon: Activity,
    tone: "bg-[rgb(var(--surface-muted))] text-muted",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  prefixes: readonly string[];
  icon: LucideIcon;
  tone: string;
}[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function isCategoryId(v: string | undefined): v is CategoryId {
  return CATEGORIES.some((c) => c.id === v);
}

export function categoryOf(action: string) {
  return (
    CATEGORIES.find((c) => c.prefixes.some((p) => action.startsWith(p))) ??
    CATEGORIES[CATEGORIES.length - 1]!
  );
}

/** Nhãn tiếng Việt cho mã action. Chưa có nhãn thì hiện mã gốc. */
const ACTION_LABELS: Record<string, string> = {
  "course.created": "Tạo khoá học",
  "course.published": "Xuất bản khoá",
  "course.archived": "Lưu trữ khoá",
  "course.deleted": "Xoá khoá",
  "course.duplicated": "Nhân bản khoá",
  "course.personalization.toggled": "Bật/tắt cá nhân hoá",
  "course.public_access.toggled": "Bật/tắt truy cập công khai",
  "course.version.bumped": "Tăng phiên bản khoá",
  "course.access_plan.created": "Tạo gói truy cập",
  "course.access_plan.updated": "Sửa gói truy cập",
  "course.section.feedback_variant.changed": "Đổi kiểu phản hồi của lớp",
  "enrollment.removed": "Xoá học viên khỏi khoá",
  "role.granted": "Được cấp quyền",
  "role.revoked": "Bị thu hồi quyền",
  "org_admin.granted": "Được cấp quản trị tổ chức",
  "org_admin.revoked": "Bị thu quản trị tổ chức",
  "org_member.added": "Thêm thành viên tổ chức",
  "org_member.removed": "Gỡ thành viên tổ chức",
  "org.email_setting_changed": "Đổi cài đặt email tổ chức",
  "feature.override.granted": "Bật tính năng riêng",
  "feature.override.revoked": "Thu hồi tính năng riêng",
  "feature.role_default.set": "Đặt tính năng mặc định theo vai trò",
  "feature.role_default.revoked": "Bỏ tính năng mặc định theo vai trò",
  "instructor_application.approved": "Duyệt đơn giáo viên",
  "instructor_application.rejected": "Từ chối đơn giáo viên",
  "impersonation.started": "Bắt đầu xem dưới vai trò người khác",
  "impersonation.stopped": "Dừng xem dưới vai trò người khác",
  "user.password.changed": "Đổi mật khẩu",
  "user.deleted": "Xoá tài khoản",
  "user.organization_changed": "Đổi tổ chức của tài khoản",
  "user.verification_email_resent": "Gửi lại email xác thực",
  "exam.attempt.extended": "Gia hạn lượt thi",
  "exam.attempt.force_submitted": "Ép nộp bài thi",
  "exam.attempt.disqualified": "Loại thí sinh",
  "exam.message.sent": "Nhắn thí sinh",
  "exam.message.broadcast": "Thông báo phòng thi",
};

const ROLE_LABELS: Record<string, string> = {
  instructor: "giảng viên",
  admin: "quản trị",
  learner: "học viên",
  mentor: "mentor",
  researcher: "nghiên cứu viên",
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Một dòng audit → câu mô tả ngắn: `label` (làm gì) + `detail` (với cái gì).
 * Mã gốc luôn trả kèm để đặt vào tooltip, không hiện ra mặt chính.
 */
export function describeAction(
  action: string,
  payload: unknown,
  targetName: string | null,
): { label: string; detail: string | null } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  let label = ACTION_LABELS[action] ?? action;
  let detail: string | null = null;

  if (action === "role.granted" || action === "role.revoked") {
    const role = str(p.roleName);
    const roleLabel = role ? (ROLE_LABELS[role] ?? role) : null;
    if (action === "role.granted" && p.reason === "auto_on_course_create") {
      label = "Được cấp quyền giảng viên";
      detail = "Tự động khi tạo khoá đầu tiên";
    } else {
      label = `${action === "role.granted" ? "Được cấp" : "Bị thu hồi"} quyền${roleLabel ? ` ${roleLabel}` : ""}`;
      detail = targetName;
    }
    return { label, detail };
  }

  detail =
    str(p.courseTitle) ?? str(p.title) ?? str(p.name) ?? targetName ?? null;
  return { label, detail };
}
