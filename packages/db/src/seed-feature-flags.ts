/**
 * Seed D1 feature-permission catalog. Idempotent (upsert by key).
 * Xem CLAUDE.md / phương án phân quyền theo tính năng cho ý nghĩa từng key.
 */
import { PrismaClient, Prisma } from "./generated/client";

const prisma = new PrismaClient();

interface FlagSeed {
  key: string;
  group:
    | "teaching_tools"
    | "lms"
    | "assessment"
    | "ai_oral"
    | "ai_tutor"
    | "tournament"
    | "limio_live";
  name: string;
  description: string;
  valueType: "boolean" | "int" | "string_array";
  // Prisma.JsonNull cho JSON literal `null` (khác NULL cột DB) — dùng khi
  // key chưa có default có ý nghĩa (vd override số, chưa set = chưa ghi đè).
  defaultValue: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  sellable: boolean;
}

const FLAGS: FlagSeed[] = [
  // --- Limio-Live (module 4 — bài giảng tương tác) ---
  {
    key: "limio_live.access",
    group: "limio_live",
    name: "Dùng Limio-Live",
    description:
      "Soạn và trình chiếu bài giảng tương tác kiểu Nearpod. Mở đại trà cho mọi giảng viên — cờ vẫn giữ lại để có thể khoá riêng 1 tài khoản khi cần (abuse, quá tải hạ tầng...).",
    valueType: "boolean",
    defaultValue: true,
    sellable: true,
  },
  // --- Công cụ giảng dạy ---
  {
    key: "teaching_tools.access",
    group: "teaching_tools",
    name: "Dùng công cụ giảng dạy",
    description:
      "Bảng tương tác, whiteboard, đồng hồ đếm ngược, quick poll, word cloud, random picker, grouping. Gate gốc cho toàn bộ drawer.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  // --- LMS ---
  {
    key: "lms.course.publish",
    group: "lms",
    name: "Publish khoá học",
    description: "Tách khỏi quyền edit — admin có thể cho sửa nội dung nhưng không được tự publish.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "lms.course.archive_or_duplicate",
    group: "lms",
    name: "Archive / nhân bản khoá học",
    description: "Hành động phá huỷ/nhân bản, siết hơn quyền edit thường.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "lms.course.invite_coinstructor",
    group: "lms",
    name: "Mời đồng giảng viên",
    description: "Admin platform có thể revoke quyền mời người khác vào course của 1 owner cụ thể.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "lms.bank.share_cross_course",
    group: "lms",
    name: "Chia sẻ ngân hàng câu hỏi cross-course",
    description: "Rủi ro rò rỉ đề thi giữa các course — mặc định tắt, cấp thủ công.",
    valueType: "boolean",
    defaultValue: false,
    sellable: true,
  },
  {
    key: "lms.enrollment.direct_payment",
    group: "lms",
    name: "Bật thanh toán trực tiếp cho enrollment",
    description: "Chỉ instructor được duyệt mới bật thanh toán trực tiếp cho course của họ.",
    valueType: "boolean",
    defaultValue: false,
    sellable: true,
  },
  // --- Kiểm tra đánh giá ---
  {
    key: "assessment.exam.live_moderate",
    group: "assessment",
    name: "Làm giám thị thi trực tuyến",
    description: "Permission 'được là giám thị' tầng trên — gán vào phòng cụ thể vẫn qua cơ chế proctorRoomIds hiện có.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "assessment.exam.access_mode.change",
    group: "assessment",
    name: "Đổi access mode của đề thi",
    description: "Ảnh hưởng bảo mật đề thi — siết riêng khỏi quyền edit exam thường.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "assessment.bank.create",
    group: "assessment",
    name: "Tạo ngân hàng câu hỏi",
    description: "Hạn chế instructor mới/thử việc tạo ngân hàng câu hỏi.",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "assessment.blueprint.use",
    group: "assessment",
    name: "Dùng blueprint (đề tự sinh)",
    description: "Tính năng nâng cao — bật dần theo nhu cầu đào tạo.",
    valueType: "boolean",
    defaultValue: false,
    sellable: true,
  },
  // --- Vấn đáp AI ---
  {
    key: "ai_oral.access",
    group: "ai_oral",
    name: "Dùng vấn đáp AI",
    description: "Đóng gate còn thiếu ở instructor/oral-exams (trước đây chỉ check session, không check role).",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  // --- AI Tutor ---
  {
    key: "ai.tutor.access",
    group: "ai_tutor",
    name: "Dùng AI tutor",
    description: "Bật/tắt AI tutor cho 1 user cụ thể (vd khoá khi abuse).",
    valueType: "boolean",
    defaultValue: true,
    sellable: false,
  },
  {
    key: "ai.tokens.monthly_override",
    group: "ai_tutor",
    name: "Ghi đè hạn mức token AI/tháng",
    description:
      "Dùng chung cho cả AI tutor lẫn vấn đáp AI vì AiTokenBalance khoá theo userId, không tách theo tính năng. null = dùng default theo role.",
    valueType: "int",
    defaultValue: Prisma.JsonNull,
    sellable: true,
  },
  // --- Tournament ---
  {
    key: "tournament.create.global",
    group: "tournament",
    name: "Tạo tournament không gắn course",
    description: "Mặc định chỉ admin (theo code hiện tại) — cấp riêng cho 1 instructor được tin cậy.",
    valueType: "boolean",
    defaultValue: false,
    sellable: true,
  },
  {
    key: "tournament.mission.custom_content",
    group: "tournament",
    name: "Custom mission với nội dung ngoài course",
    description: "Mission dùng nội dung ngoài course — xem project_tournament_custom_missions.",
    valueType: "boolean",
    defaultValue: false,
    sellable: true,
  },
  {
    key: "tournament.grading.cross_instance",
    group: "tournament",
    name: "Chấm tournament của người khác tạo",
    description: "Ghi đè pattern creator-or-admin mặc định.",
    valueType: "boolean",
    defaultValue: false,
    sellable: false,
  },
];

async function main() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {
        group: f.group,
        name: f.name,
        description: f.description,
        valueType: f.valueType,
        defaultValue: f.defaultValue,
        sellable: f.sellable,
      },
      create: f,
    });
  }
  console.log(`Seeded ${FLAGS.length} feature flags.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
