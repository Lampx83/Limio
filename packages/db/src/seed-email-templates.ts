/**
 * Seed email templates as GLOBAL defaults (organizationId = NULL).
 * Idempotent — chạy an toàn mỗi lần deploy (xem CMD của image migrator).
 *
 * Per-organization overrides are created lazily through the admin UI
 * (one row per (org, key) when an org admin first saves a change).
 * sendTemplatedEmail() prefers org-specific row, then falls back to
 * this global row, then to hard-coded defaults (core-lms/email/templates.ts).
 *
 * Body là phần NỘI DUNG (fragment) — khung thương hiệu bao quanh (logo, thẻ, chân thư)
 * do core-lms `wrapEmail` thêm lúc gửi, nên sửa khung một chỗ là đổi mọi email.
 * Nội dung dựng bằng các linh kiện trong ./emailUi (nút, hộp mã, bảng thông tin…).
 * Cú pháp biến: Handlebars {{variableName}}.
 *
 * Chạy lại KHÔNG ghi đè template mà admin đã sửa (updatedByUserId khác null).
 */
import { PrismaClient, type Prisma } from "./generated/client";
import { ui } from "./emailUi";

const prisma = new PrismaClient();

type VariableSpec = {
  name: string;
  label: string;
  example: string;
  required?: boolean;
};

type TemplateSeed = {
  key: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: VariableSpec[];
};

const V = {
  displayName: { name: "displayName", label: "Tên người dùng", example: "Nguyễn Văn A", required: true },
  name: { name: "name", label: "Tên người được mời", example: "Trần Thị B", required: true },
  resetUrl: { name: "resetUrl", label: "Link đặt mật khẩu", example: "https://limio.vn/reset?token=abc", required: true },
  learnerName: { name: "learnerName", label: "Tên học viên", example: "Nguyễn Văn A", required: true },
  candidateName: { name: "candidateName", label: "Tên thí sinh", example: "Nguyễn Văn A", required: true },
  courseTitle: { name: "courseTitle", label: "Tên khoá học", example: "Lập trình Python cơ bản", required: true },
  examTitle: { name: "examTitle", label: "Tên kỳ thi", example: "Kỳ thi cuối kỳ", required: true },
} as const;

const hello = (v: string) => ui.p(`Xin chào <strong>{{${v}}}</strong>,`);
const resetNote = ui.note("⏱ Liên kết đặt mật khẩu có hiệu lực trong <strong>1 giờ</strong> và chỉ dùng được một lần.");
const ignoreSmall = ui.small("Nếu bạn không biết lý do mình nhận được thư này, hãy bỏ qua nó một cách an toàn.");

const TEMPLATES: TemplateSeed[] = [
  // ============ AUTH ============
  {
    key: "auth.verify_email",
    name: "Xác thực email đăng ký",
    description: "Gửi khi học viên đăng ký tài khoản mới. Link có hiệu lực 24h.",
    category: "auth",
    subject: "Xác thực email để bắt đầu học trên Limio",
    bodyHtml: [
      ui.title("Xác thực email của bạn"),
      hello("displayName"),
      ui.p("Cảm ơn bạn đã đăng ký Limio. Chỉ còn một bước nữa: hãy xác thực địa chỉ email để kích hoạt tài khoản và bắt đầu học."),
      ui.button("verificationUrl", "Xác thực email"),
      ui.note("⏱ Liên kết có hiệu lực trong <strong>24 giờ</strong>."),
      ui.linkFallback("verificationUrl"),
      ui.small("Nếu bạn không tạo tài khoản này, hãy bỏ qua email — sẽ không có gì thay đổi."),
    ].join("\n"),
    bodyText: `Xin chào {{displayName}},

Cảm ơn bạn đã đăng ký Limio. Hãy xác thực email để kích hoạt tài khoản (liên kết có hiệu lực 24 giờ):
{{verificationUrl}}

Nếu bạn không tạo tài khoản này, hãy bỏ qua email.`,
    variables: [
      V.displayName,
      { name: "verificationUrl", label: "Link xác thực", example: "https://limio.vn/verify?token=abc123", required: true },
    ],
  },
  {
    key: "auth.password_reset",
    name: "Quên mật khẩu",
    description: "Gửi khi user yêu cầu đặt lại mật khẩu. Link có hiệu lực 1h.",
    category: "auth",
    subject: "Đặt lại mật khẩu Limio của bạn",
    bodyHtml: [
      ui.title("Đặt lại mật khẩu"),
      hello("displayName"),
      ui.p("Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Limio của bạn. Nhấn nút bên dưới để tạo mật khẩu mới."),
      ui.button("resetUrl", "Đặt lại mật khẩu"),
      resetNote,
      ui.linkFallback("resetUrl"),
      ui.small("Bạn không yêu cầu đặt lại? Hãy bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn."),
    ].join("\n"),
    bodyText: `Xin chào {{displayName}},

Nhấn liên kết sau để đặt lại mật khẩu (có hiệu lực 1 giờ):
{{resetUrl}}

Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.`,
    variables: [V.displayName, V.resetUrl],
  },

  // ============ EXAM ============
  {
    key: "exam.access_code",
    name: "Mã dự thi cho thí sinh",
    description: "Gửi mã dự thi sau khi GV bấm 'Gửi mã' ở trang quản lý thí sinh. Có giờ mở/đóng kỳ thi.",
    category: "exam",
    subject: "[{{examTitle}}] Mã dự thi của bạn",
    bodyHtml: [
      ui.title("Mã dự thi của bạn"),
      hello("candidateName"),
      ui.p("Bạn được mời tham gia kỳ thi <strong>{{examTitle}}</strong>. Đây là mã dự thi cá nhân của bạn:"),
      ui.codeCard("Mã dự thi", "accessCode"),
      ui.facts([
        ["Mở thi", "{{examOpensAt}}"],
        ["Đóng thi", "{{examClosesAt}}"],
        ["Thời lượng", "{{examDurationMin}} phút"],
      ]),
      ui.button("claimUrl", "Vào thi"),
      ui.note("🔒 Mã dự thi là của riêng bạn — vui lòng <strong>không chia sẻ</strong> cho người khác.", "warn"),
      ui.linkFallback("claimUrl"),
    ].join("\n"),
    bodyText: `Mã dự thi cho {{examTitle}}

Xin chào {{candidateName}},

Mã dự thi của bạn: {{accessCode}}

Mở thi:      {{examOpensAt}}
Đóng thi:    {{examClosesAt}}
Thời lượng:  {{examDurationMin}} phút

Vào thi tại: {{claimUrl}}

Lưu ý: mã dự thi là cá nhân — không chia sẻ cho người khác.`,
    variables: [
      V.candidateName,
      V.examTitle,
      { name: "accessCode", label: "Mã dự thi", example: "X65DMJZD", required: true },
      { name: "examOpensAt", label: "Giờ mở thi", example: "08:00, 20/05/2026", required: true },
      { name: "examClosesAt", label: "Giờ đóng thi", example: "10:00, 20/05/2026", required: true },
      { name: "examDurationMin", label: "Thời lượng (phút)", example: "90", required: true },
      { name: "claimUrl", label: "Link vào thi", example: "https://limio.vn/exam/X65DMJZD", required: true },
    ],
  },
  {
    key: "exam.proctor_invite",
    name: "Mời giám thị coi thi",
    description: "Gửi khi GV thêm email giám thị mới vào một phòng thi.",
    category: "exam",
    subject: "Bạn được mời làm giám thị trên Limio",
    bodyHtml: [
      ui.title("Bạn được mời làm giám thị"),
      hello("name"),
      ui.p("Bạn vừa được phân công làm <strong>giám thị phòng thi</strong> trên Limio. Hãy đặt mật khẩu để đăng nhập và xem phòng thi của mình."),
      ui.button("resetUrl", "Đặt mật khẩu"),
      resetNote,
      ui.p("Sau khi đăng nhập, chọn <strong>“Giám sát phòng thi”</strong> ở menu bên trái để xem các phòng bạn phụ trách."),
      ui.linkFallback("resetUrl"),
      ignoreSmall,
    ].join("\n"),
    bodyText: `Xin chào {{name}},

Bạn được mời làm giám thị phòng thi trên Limio.

Đặt mật khẩu (có hiệu lực 1 giờ):
{{resetUrl}}

Sau khi đăng nhập, chọn "Giám sát phòng thi" ở menu bên trái để xem các phòng bạn phụ trách.`,
    variables: [V.name, V.resetUrl],
  },
  {
    key: "exam.proctor_invite_bulk",
    name: "Mời giám thị (bulk import)",
    description: "Gửi khi GV upload file kỳ thi có cột email giám thị.",
    category: "exam",
    subject: "Bạn được mời làm giám thị trên Limio",
    bodyHtml: [
      ui.title("Bạn được mời làm giám thị"),
      hello("name"),
      ui.p("Bạn vừa được thêm làm <strong>giám thị phòng thi</strong> trên Limio. Hãy đặt mật khẩu để đăng nhập."),
      ui.button("resetUrl", "Đặt mật khẩu"),
      resetNote,
      ui.linkFallback("resetUrl"),
      ignoreSmall,
    ].join("\n"),
    bodyText: `Xin chào {{name}},

Bạn được mời làm giám thị phòng thi trên Limio.
Đặt mật khẩu: {{resetUrl}}`,
    variables: [V.name, V.resetUrl],
  },
  {
    key: "exam.instructor_invite_bulk",
    name: "Mời GV phụ trách lớp (bulk exam upload)",
    description: "Gửi khi GV upload file kỳ thi có cột email GV phụ trách lớp.",
    category: "exam",
    subject: "Bạn được mời làm giảng viên phụ trách lớp trên Limio",
    bodyHtml: [
      ui.title("Bạn được mời phụ trách lớp học"),
      hello("name"),
      ui.p("Bạn vừa được thêm làm <strong>giảng viên phụ trách lớp học</strong> trên Limio. Hãy đặt mật khẩu để bắt đầu."),
      ui.button("resetUrl", "Đặt mật khẩu"),
      resetNote,
      ui.linkFallback("resetUrl"),
      ignoreSmall,
    ].join("\n"),
    bodyText: `Xin chào {{name}},

Bạn được mời làm giảng viên phụ trách lớp học trên Limio.
Đặt mật khẩu: {{resetUrl}}`,
    variables: [V.name, V.resetUrl],
  },
  {
    key: "exam.grade_published",
    name: "Thông báo điểm thi đã chấm",
    description: "[Chưa active] Gửi cho thí sinh sau khi điểm thi được chấm + publish.",
    category: "exam",
    subject: "[{{examTitle}}] Kết quả thi của bạn đã có",
    bodyHtml: [
      ui.title("Kết quả thi của bạn đã có"),
      hello("candidateName"),
      ui.p("Kết quả kỳ thi <strong>{{examTitle}}</strong> đã được công bố."),
      ui.codeCard("Điểm số", "score"),
      ui.facts([
        ["Kỳ thi", "{{examTitle}}"],
        ["Thang điểm", "{{maxScore}}"],
      ]),
      ui.button("resultUrl", "Xem chi tiết kết quả"),
      ui.linkFallback("resultUrl"),
    ].join("\n"),
    bodyText: `Xin chào {{candidateName}},

Kết quả kỳ thi {{examTitle}}: {{score}} / {{maxScore}}
Xem chi tiết: {{resultUrl}}`,
    variables: [
      V.candidateName,
      V.examTitle,
      { name: "score", label: "Điểm đạt được", example: "8.5", required: true },
      { name: "maxScore", label: "Điểm tối đa", example: "10", required: true },
      { name: "resultUrl", label: "Link xem chi tiết", example: "https://limio.vn/exam/result/xyz", required: true },
    ],
  },
  {
    key: "exam.deadline_reminder",
    name: "Nhắc lịch thi sắp tới",
    description: "[Chưa active] Gửi 24h trước giờ mở thi để nhắc thí sinh.",
    category: "exam",
    subject: "Nhắc lịch: {{examTitle}} mở thi sau {{hoursUntilOpen}} giờ",
    bodyHtml: [
      ui.title("Sắp đến giờ thi"),
      hello("candidateName"),
      ui.p("Kỳ thi <strong>{{examTitle}}</strong> sắp bắt đầu. Hãy chuẩn bị sẵn mã dự thi của bạn:"),
      ui.codeCard("Mã dự thi", "accessCode"),
      ui.facts([
        ["Mở thi lúc", "{{examOpensAt}}"],
        ["Còn lại", "{{hoursUntilOpen}} giờ"],
      ]),
      ui.button("claimUrl", "Vào thi"),
      ui.linkFallback("claimUrl"),
    ].join("\n"),
    bodyText: `Xin chào {{candidateName}},

Kỳ thi {{examTitle}} sẽ mở vào {{examOpensAt}} (còn {{hoursUntilOpen}} giờ).
Mã dự thi: {{accessCode}}
Vào thi: {{claimUrl}}`,
    variables: [
      V.candidateName,
      V.examTitle,
      { name: "examOpensAt", label: "Giờ mở thi", example: "08:00, 20/05/2026", required: true },
      { name: "hoursUntilOpen", label: "Số giờ còn lại", example: "24", required: true },
      { name: "accessCode", label: "Mã dự thi", example: "X65DMJZD", required: true },
      { name: "claimUrl", label: "Link vào thi", example: "https://limio.vn/exam/X65DMJZD", required: true },
    ],
  },

  // ============ COHORT ============
  {
    key: "cohort.instructor_invite",
    name: "Mời GV phụ trách lớp (cohort)",
    description: "Gửi khi admin gán email GV cho 1 cohort (đơn lẻ hoặc bulk upload cohort).",
    category: "cohort",
    subject: "Bạn được mời làm giảng viên phụ trách lớp trên Limio",
    bodyHtml: [
      ui.title("Bạn được mời phụ trách lớp học"),
      hello("name"),
      ui.p("Bạn vừa được phân công làm <strong>giảng viên phụ trách một lớp học</strong> trên Limio. Hãy đặt mật khẩu để đăng nhập và xem các lớp của mình."),
      ui.button("resetUrl", "Đặt mật khẩu"),
      resetNote,
      ui.linkFallback("resetUrl"),
      ignoreSmall,
    ].join("\n"),
    bodyText: `Xin chào {{name}},

Bạn được mời làm giảng viên phụ trách một lớp học trên Limio.

Đặt mật khẩu (có hiệu lực 1 giờ):
{{resetUrl}}

Sau khi đăng nhập, bạn sẽ thấy các lớp được phân công.`,
    variables: [V.name, V.resetUrl],
  },

  // ============ COURSE ============
  {
    key: "course.co_instructor_invite",
    name: "Mời đồng giảng viên khoá học",
    description: "Gửi khi GV thêm email một người chưa có tài khoản làm đồng giảng viên khoá học.",
    category: "course",
    subject: "Bạn được thêm làm đồng giảng viên khoá “{{courseTitle}}”",
    bodyHtml: [
      ui.title("Bạn là đồng giảng viên"),
      ui.p("Xin chào,"),
      ui.p("Bạn vừa được thêm làm <strong>đồng giảng viên</strong> của khoá học <strong>{{courseTitle}}</strong> trên Limio. Hãy đặt mật khẩu để đăng nhập và cùng quản lý khoá học."),
      ui.button("resetUrl", "Đặt mật khẩu"),
      resetNote,
      ui.linkFallback("resetUrl"),
      ignoreSmall,
    ].join("\n"),
    bodyText: `Xin chào,

Bạn vừa được thêm làm đồng giảng viên khoá {{courseTitle}} trên Limio.

Đặt mật khẩu (có hiệu lực 1 giờ):
{{resetUrl}}`,
    variables: [V.courseTitle, V.resetUrl],
  },
  {
    key: "course.welcome",
    name: "Welcome khi enroll khoá học",
    description: "Gửi sau khi học viên enroll thành công vào 1 khoá.",
    category: "course",
    subject: "Chào mừng bạn đến với {{courseTitle}}!",
    bodyHtml: [
      ui.title("Chào mừng bạn đến với khoá học"),
      hello("learnerName"),
      ui.p("Bạn đã ghi danh thành công vào khoá học <strong>{{courseTitle}}</strong>. Mọi bài học đã sẵn sàng — hãy bắt đầu ngay khi bạn muốn."),
      ui.button("courseUrl", "Bắt đầu học"),
      ui.linkFallback("courseUrl"),
      ui.small("Chúc bạn có một hành trình học tập thật hiệu quả."),
    ].join("\n"),
    bodyText: `Xin chào {{learnerName}},

Bạn đã ghi danh thành công vào khoá {{courseTitle}}.
Bắt đầu học tại: {{courseUrl}}`,
    variables: [
      V.learnerName,
      V.courseTitle,
      { name: "courseUrl", label: "Link khoá học", example: "https://limio.vn/learn/python", required: true },
    ],
  },
  {
    key: "course.access_expiring",
    name: "Nhắc sắp hết hạn truy cập khoá học",
    description: "Gửi tự động (cron hằng ngày) trước khi quyền truy cập khoá học của học viên hết hạn.",
    category: "course",
    subject: "Khoá “{{courseTitle}}” của bạn sắp hết hạn truy cập",
    bodyHtml: [
      ui.title("Khoá học sắp hết hạn"),
      hello("learnerName"),
      ui.p("Quyền truy cập khoá học của bạn sắp kết thúc. Hãy hoàn thành phần còn lại hoặc gia hạn sớm để việc học không bị gián đoạn."),
      ui.facts([
        ["Khoá học", "{{courseTitle}}"],
        ["Hết hạn vào", "{{expiresAtDate}}"],
      ]),
      ui.note("Sau ngày này bạn sẽ không thể xem nội dung khoá học nữa.", "warn"),
    ].join("\n"),
    bodyText: `Xin chào {{learnerName}},

Quyền truy cập khoá {{courseTitle}} của bạn sẽ hết hạn vào {{expiresAtDate}}. Hãy gia hạn sớm để không bị gián đoạn việc học.`,
    variables: [
      V.learnerName,
      V.courseTitle,
      { name: "expiresAtDate", label: "Ngày hết hạn", example: "30/10/2026", required: true },
    ],
  },

  // ============ GAMIFICATION ============
  {
    key: "gamification.level_up",
    name: "Lên level mới",
    description: "Gửi khi user đạt level mới.",
    category: "gamification",
    subject: "🎉 Chúc mừng! Bạn vừa đạt cấp {{newLevel}}",
    bodyHtml: [
      ui.title("🎉 Bạn vừa lên cấp {{newLevel}}!"),
      hello("learnerName"),
      ui.p("Nỗ lực của bạn đã được ghi nhận. Bạn vừa đạt danh hiệu <strong>{{levelTitle}}</strong>."),
      ui.facts([
        ["Cấp hiện tại", "Cấp {{newLevel}}"],
        ["Danh hiệu", "{{levelTitle}}"],
        ["Tổng XP", "{{totalXp}}"],
      ]),
      ui.button("profileUrl", "Xem hồ sơ của bạn"),
    ].join("\n"),
    bodyText: `Chúc mừng {{learnerName}}!

Bạn vừa đạt Cấp {{newLevel}} - {{levelTitle}}.
Tổng XP: {{totalXp}}
Hồ sơ: {{profileUrl}}`,
    variables: [
      V.learnerName,
      { name: "newLevel", label: "Cấp mới", example: "5", required: true },
      { name: "levelTitle", label: "Tên cấp", example: "Học viên chuyên cần", required: true },
      { name: "totalXp", label: "Tổng XP", example: "1250", required: true },
      { name: "profileUrl", label: "Link hồ sơ", example: "https://limio.vn/profile", required: true },
    ],
  },
  {
    key: "gamification.badge_earned",
    name: "Nhận badge mới",
    description: "Gửi khi user nhận badge.",
    category: "gamification",
    subject: "🏆 Bạn vừa nhận huy hiệu: {{badgeName}}",
    bodyHtml: [
      ui.title("🏆 Huy hiệu mới: {{badgeName}}"),
      hello("learnerName"),
      ui.p("Chúc mừng! Bạn vừa mở khoá một huy hiệu mới:"),
      ui.note("<strong>{{badgeName}}</strong><br>{{badgeDescription}}"),
      ui.button("badgesUrl", "Xem bộ sưu tập huy hiệu"),
    ].join("\n"),
    bodyText: `Xin chào {{learnerName}},

Bạn vừa nhận huy hiệu: {{badgeName}}
{{badgeDescription}}

Xem tại: {{badgesUrl}}`,
    variables: [
      V.learnerName,
      { name: "badgeName", label: "Tên huy hiệu", example: "Người mở đầu", required: true },
      { name: "badgeDescription", label: "Mô tả huy hiệu", example: "Hoàn thành bài học đầu tiên", required: true },
      { name: "badgesUrl", label: "Link bộ sưu tập", example: "https://limio.vn/profile#badges", required: true },
    ],
  },

  // ============ NOTIFICATION ============
  {
    key: "notification.weekly_digest",
    name: "Tóm tắt tuần",
    description: "[Chưa active] Digest hàng tuần gửi cho user (Chủ Nhật).",
    category: "notification",
    subject: "Tóm tắt tuần qua của bạn trên Limio",
    bodyHtml: [
      ui.title("Tóm tắt tuần của bạn"),
      hello("learnerName"),
      ui.p("Đây là những gì bạn đã làm được trong tuần qua:"),
      ui.facts([
        ["Bài học hoàn thành", "{{lessonsCompleted}}"],
        ["Quiz đã làm", "{{quizzesTaken}}"],
        ["XP kiếm được", "{{xpEarned}}"],
        ["Chuỗi ngày học", "{{streakDays}} ngày"],
      ]),
      ui.button("dashboardUrl", "Tiếp tục học"),
    ].join("\n"),
    bodyText: `Xin chào {{learnerName}},

Tuần này: {{lessonsCompleted}} bài học, {{quizzesTaken}} quiz, {{xpEarned}} XP, chuỗi {{streakDays}} ngày.
Tiếp tục học: {{dashboardUrl}}`,
    variables: [
      V.learnerName,
      { name: "lessonsCompleted", label: "Số bài học hoàn thành", example: "5", required: true },
      { name: "quizzesTaken", label: "Số quiz đã làm", example: "3", required: true },
      { name: "xpEarned", label: "XP kiếm được trong tuần", example: "240", required: true },
      { name: "streakDays", label: "Số ngày streak hiện tại", example: "7", required: true },
      { name: "dashboardUrl", label: "Link dashboard", example: "https://limio.vn/dashboard", required: true },
    ],
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const tpl of TEMPLATES) {
    // Global row = organizationId NULL. Partial unique index guarantees
    // at most one such row per key, but Prisma can't represent that —
    // use findFirst + manual upsert.
    const existing = await prisma.emailTemplate.findFirst({
      where: { organizationId: null, key: tpl.key },
    });

    const data = {
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      bodyText: tpl.bodyText ?? null,
      variables: tpl.variables as unknown as Prisma.InputJsonValue,
    };

    if (existing) {
      // Only refresh metadata on rerun. Do NOT overwrite subject/body if
      // an admin has edited the global default (updatedByUserId set).
      const shouldOverwriteBody = existing.updatedByUserId === null;
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: shouldOverwriteBody
          ? data
          : {
              name: data.name,
              description: data.description,
              category: data.category,
              variables: data.variables,
            },
      });
      updated++;
    } else {
      await prisma.emailTemplate.create({
        data: { organizationId: null, key: tpl.key, ...data },
      });
      created++;
    }
  }

  console.log(
    `Email templates: ${created} created, ${updated} updated (total ${TEMPLATES.length})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
