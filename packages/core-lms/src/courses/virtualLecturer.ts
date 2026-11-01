import { prisma, type PrismaClient } from "@feedbackme/db";
import { logAudit } from "../auth/audit";
import { isAdmin } from "../auth/roles";
import { canEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";

/**
 * Giảng viên ảo (docs/tieu-chi/giang-vien-ao.md). Mức hiệu lực được tính ở MỘT chỗ — trang và API cùng
 * gọi `getEffectiveVirtualLecturer` — để «Không hiện» là chặn thật ở máy chủ, không chỉ ẩn nút.
 */

export const VIRTUAL_LECTURER_MODES = ["BAT_BUOC", "HIEN", "TU_BAT", "AN"] as const;
export type VirtualLecturerModeValue = (typeof VIRTUAL_LECTURER_MODES)[number];

/** Nhãn hiển thị cho từng mức (dùng chung trang cài đặt và danh sách khoá). */
export const VIRTUAL_LECTURER_MODE_LABELS: Record<VirtualLecturerModeValue, string> = {
  BAT_BUOC: "Bắt buộc",
  HIEN: "Hiện",
  TU_BAT: "Em tự bật",
  AN: "Không hiện",
};

export interface VirtualLecturer {
  code: string;
  name: string;
  gender: "female" | "male";
  /** Mã giọng NEU TTS. */
  voice: string;
}

/**
 * Danh sách cố định trong code (AC1): admin chỉ chọn người mặc định, không thêm người. Tên và mã giọng lấy từ
 * 8 giảng viên ảo của Học liệu AI Research.
 */
export const VIRTUAL_LECTURERS: readonly VirtualLecturer[] = [
  { code: "mai-chi", name: "Mai Chi", gender: "female", voice: "maichi" },
  { code: "quang-minh", name: "Quang Minh", gender: "male", voice: "quangminh" },
  { code: "kim-oanh", name: "Kim Oanh", gender: "female", voice: "kimoanh" },
  { code: "huu-duc", name: "Hữu Đức", gender: "male", voice: "huuduc" },
  { code: "ha-my", name: "Hà My", gender: "female", voice: "hamy" },
  { code: "gia-huy", name: "Gia Huy", gender: "male", voice: "giahuy" },
  { code: "bao-trang", name: "Bảo Trang", gender: "female", voice: "baotrang" },
  { code: "tien-dat", name: "Tiến Đạt", gender: "male", voice: "tiendat" },
];

const KEY_ENABLED = "virtual_lecturer.enabled";
const KEY_DEFAULT_MODE = "virtual_lecturer.default_mode";
const KEY_DEFAULT_LECTURER = "virtual_lecturer.default_lecturer";

export interface VirtualLecturerSettings {
  enabled: boolean;
  defaultMode: VirtualLecturerModeValue;
  defaultLecturer: string;
}

const DEFAULT_MODE: VirtualLecturerModeValue = "HIEN";
const DEFAULT_LECTURER_CODE = "mai-chi";

function isMode(v: unknown): v is VirtualLecturerModeValue {
  return typeof v === "string" && (VIRTUAL_LECTURER_MODES as readonly string[]).includes(v);
}

function isLecturerCode(v: unknown): v is string {
  return typeof v === "string" && VIRTUAL_LECTURERS.some((l) => l.code === v);
}

/**
 * Mức hiệu lực. Hàm thuần — mọi quy tắc của AC3 nằm ở đây:
 *  - công tắc hệ thống tắt → «Không hiện» cho tất cả, kể cả giảng viên (AC1);
 *  - mức riêng của khoá thắng mức mặc định hệ thống;
 *  - giảng viên xem khoá mình dạy không bị «Không hiện» che (để kiểm tra), nhưng không bị ép nên chỉ lên «Em tự bật».
 */
export function resolveVirtualLecturerMode(input: {
  systemEnabled: boolean;
  systemDefaultMode: VirtualLecturerModeValue;
  courseMode: VirtualLecturerModeValue | null;
  viewerTeachesCourse: boolean;
}): VirtualLecturerModeValue {
  if (!input.systemEnabled) return "AN";
  const base = input.courseMode ?? input.systemDefaultMode;
  if (base === "AN" && input.viewerTeachesCourse) return "TU_BAT";
  return base;
}

export async function getVirtualLecturerSettings(
  db: PrismaClient = prisma,
): Promise<VirtualLecturerSettings> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: [KEY_ENABLED, KEY_DEFAULT_MODE, KEY_DEFAULT_LECTURER] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const mode = byKey.get(KEY_DEFAULT_MODE);
  const lecturer = byKey.get(KEY_DEFAULT_LECTURER);
  return {
    // Mặc định TẮT — admin phải chủ động bật, tránh bật giọng đọc/chi phí TTS ngoài ý muốn.
    enabled: byKey.get(KEY_ENABLED) === "true",
    defaultMode: isMode(mode) ? mode : DEFAULT_MODE,
    defaultLecturer: isLecturerCode(lecturer) ? lecturer : DEFAULT_LECTURER_CODE,
  };
}

async function writeSetting(db: PrismaClient, key: string, value: string) {
  await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Chỉ admin nền tảng. Chỉ ghi AuditLog khi có giá trị đổi thật. */
export async function setVirtualLecturerSettings(
  actorUserId: string,
  patch: Partial<VirtualLecturerSettings>,
  db: PrismaClient = prisma,
): Promise<VirtualLecturerSettings> {
  if (!(await isAdmin(actorUserId, db))) throw new CourseAuthzError("forbidden");
  if (patch.defaultMode !== undefined && !isMode(patch.defaultMode)) {
    throw new CourseError("validation_failed", { field: "defaultMode" });
  }
  if (patch.defaultLecturer !== undefined && !isLecturerCode(patch.defaultLecturer)) {
    throw new CourseError("validation_failed", { field: "defaultLecturer" });
  }

  const before = await getVirtualLecturerSettings(db);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (patch.enabled !== undefined && patch.enabled !== before.enabled) {
    await writeSetting(db, KEY_ENABLED, String(patch.enabled));
    changes.enabled = { from: before.enabled, to: patch.enabled };
  }
  if (patch.defaultMode !== undefined && patch.defaultMode !== before.defaultMode) {
    await writeSetting(db, KEY_DEFAULT_MODE, patch.defaultMode);
    changes.defaultMode = { from: before.defaultMode, to: patch.defaultMode };
  }
  if (patch.defaultLecturer !== undefined && patch.defaultLecturer !== before.defaultLecturer) {
    await writeSetting(db, KEY_DEFAULT_LECTURER, patch.defaultLecturer);
    changes.defaultLecturer = { from: before.defaultLecturer, to: patch.defaultLecturer };
  }
  if (Object.keys(changes).length > 0) {
    await logAudit({ action: "virtual_lecturer.settings.changed", actorUserId, payload: { changes } }, db);
  }
  return getVirtualLecturerSettings(db);
}

/** Chỉ admin nền tảng (AC1: đặt ở /admin/courses). `null` = «Theo mặc định hệ thống». */
export async function setCourseVirtualLecturerMode(
  actorUserId: string,
  courseId: string,
  mode: VirtualLecturerModeValue | null,
  db: PrismaClient = prisma,
): Promise<void> {
  if (!(await isAdmin(actorUserId, db))) throw new CourseAuthzError("forbidden");
  if (mode !== null && !isMode(mode)) throw new CourseError("validation_failed", { field: "mode" });
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { virtualLecturerMode: true },
  });
  if (!course) throw new CourseAuthzError("not_found");
  if (course.virtualLecturerMode === mode) return;
  await db.course.update({ where: { id: courseId }, data: { virtualLecturerMode: mode } });
  // Payload chỉ mang id và giá trị cũ/mới (AC1).
  await logAudit(
    {
      action: "course.virtual_lecturer.changed",
      actorUserId,
      payload: { courseId, from: course.virtualLecturerMode, to: mode },
    },
    db,
  );
}

export interface EffectiveVirtualLecturer {
  mode: VirtualLecturerModeValue;
  lecturerCode: string;
}

/**
 * Mức hiệu lực cho một người xem (`null` = khách). Trang học và API phục vụ phần giảng viên ảo cùng gọi hàm này;
 * `mode === "AN"` thì API phải trả 403.
 */
export async function getEffectiveVirtualLecturer(
  courseId: string,
  viewerUserId: string | null,
  db: PrismaClient = prisma,
): Promise<EffectiveVirtualLecturer> {
  const [settings, course, teaches] = await Promise.all([
    getVirtualLecturerSettings(db),
    db.course.findUnique({ where: { id: courseId }, select: { virtualLecturerMode: true } }),
    viewerUserId ? canEditCourse(viewerUserId, courseId, db) : Promise.resolve(false),
  ]);
  if (!course) throw new CourseAuthzError("not_found");
  return {
    mode: resolveVirtualLecturerMode({
      systemEnabled: settings.enabled,
      systemDefaultMode: settings.defaultMode,
      courseMode: course.virtualLecturerMode,
      viewerTeachesCourse: teaches,
    }),
    lecturerCode: settings.defaultLecturer,
  };
}
