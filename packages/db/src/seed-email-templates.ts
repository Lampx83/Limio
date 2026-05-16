/**
 * Seed initial email templates as GLOBAL defaults (organizationId = NULL).
 * Idempotent — upserts by `key` within the global scope.
 *
 * Per-organization overrides are created lazily through the admin UI
 * (one row per (org, key) when an org admin first saves a change).
 * sendTemplatedEmail() prefers org-specific row, then falls back to
 * this global row, then to hard-coded defaults.
 *
 * 7 templates are wired to existing send sites (auth, exam, cohort).
 * 6 templates are pre-defined but not yet wired (welcome, grade,
 * deadline reminder, level up, badge, weekly digest).
 *
 * Body uses Handlebars syntax: {{variableName}}.
 */
import { PrismaClient, type Prisma } from "./generated/client";

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

const TEMPLATES: TemplateSeed[] = [
  // ============ AUTH ============
  {
    key: "auth.verify_email",
    name: "Xác thực email đăng ký",
    description: "Gửi khi học viên đăng ký tài khoản mới. Link có hiệu lực 24h.",
    category: "auth",
    subject: "Xác thực email cho Limio.vn",
    bodyHtml: `<p>Xin chào {{displayName}},</p>
<p>Cảm ơn bạn đã đăng ký Limio.vn. Vui lòng nhấn vào nút bên dưới để xác thực email (link có hiệu lực <strong>24 giờ</strong>):</p>
<p><a href="{{verificationUrl}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Xác thực email</a></p>
<p>Nếu nút không hoạt động, copy link sau vào trình duyệt:<br/><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
<p>Nếu bạn không tạo tài khoản này, hãy bỏ qua email.</p>`,
    bodyText: `Xin chào {{displayName}},

Nhấn link sau để xác thực email (TTL 24h):
{{verificationUrl}}`,
    variables: [
      { name: "displayName", label: "Tên người dùng", example: "Nguyễn Văn A", required: true },
      {
        name: "verificationUrl",
        label: "Link xác thực",
        example: "https://limio.vn/auth/verify?token=abc123",
        required: true,
      },
    ],
  },
  {
    key: "auth.password_reset",
    name: "Quên mật khẩu",
    description: "Gửi khi user yêu cầu đặt lại mật khẩu. Link có hiệu lực 1h.",
    category: "auth",
    subject: "Yêu cầu đặt lại mật khẩu cho Limio.vn",
    bodyHtml: `<p>Xin chào {{displayName}},</p>
<p>Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản này. Nhấn nút bên dưới để đặt lại (link có hiệu lực <strong>1 giờ</strong>):</p>
<p><a href="{{resetUrl}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Đặt lại mật khẩu</a></p>
<p>Nếu nút không hoạt động, copy link sau:<br/><a href="{{resetUrl}}">{{resetUrl}}</a></p>
<p>Nếu bạn không yêu cầu đặt lại, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>`,
    bodyText: `Xin chào {{displayName}},

Nhấn link sau để đặt lại mật khẩu (TTL 1h):
{{resetUrl}}

Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    variables: [
      { name: "displayName", label: "Tên người dùng", example: "Nguyễn Văn A", required: true },
      {
        name: "resetUrl",
        label: "Link đặt lại mật khẩu",
        example: "https://limio.vn/auth/reset?token=abc123",
        required: true,
      },
    ],
  },

  // ============ EXAM ============
  {
    key: "exam.access_code",
    name: "Mã dự thi cho thí sinh",
    description:
      "Gửi mã dự thi sau khi GV bấm 'Gửi mã' ở trang quản lý thí sinh. Có giờ mở/đóng kỳ thi.",
    category: "exam",
    subject: "[{{examTitle}}] Mã dự thi của bạn",
    bodyHtml: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#1e293b;margin:0 0 16px;">Mã dự thi</h2>
  <p>Xin chào <strong>{{candidateName}}</strong>,</p>
  <p>Bạn được mời tham gia kỳ thi <strong>{{examTitle}}</strong>. Mã dự thi cá nhân của bạn:</p>
  <div style="text-align:center;background:#f1f5f9;border:2px dashed #94a3b8;border-radius:8px;padding:24px;margin:24px 0;">
    <div style="font-family:'Courier New',monospace;font-size:32px;letter-spacing:6px;font-weight:bold;color:#0f172a;">{{accessCode}}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:6px 0;color:#64748b;">Mở thi:</td><td style="padding:6px 0;"><strong>{{examOpensAt}}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Đóng thi:</td><td style="padding:6px 0;"><strong>{{examClosesAt}}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Thời lượng:</td><td style="padding:6px 0;"><strong>{{examDurationMin}} phút</strong></td></tr>
  </table>
  <p style="text-align:center;margin:24px 0;">
    <a href="{{claimUrl}}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Vào thi</a>
  </p>
  <p style="font-size:13px;color:#64748b;">Hoặc copy link: <a href="{{claimUrl}}">{{claimUrl}}</a></p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="font-size:13px;color:#dc2626;"><strong>Lưu ý:</strong> Mã dự thi là cá nhân — không chia sẻ cho người khác.</p>
</div>`,
    bodyText: `Mã dự thi cho {{examTitle}}

Xin chào {{candidateName}},

Mã dự thi của bạn: {{accessCode}}

Mở thi:    {{examOpensAt}}
Đóng thi:  {{examClosesAt}}
Thời lượng: {{examDurationMin}} phút

Vào thi tại: {{claimUrl}}

Lưu ý: Mã dự thi là cá nhân — không chia sẻ cho người khác.`,
    variables: [
      { name: "candidateName", label: "Tên thí sinh", example: "Nguyễn Văn A", required: true },
      { name: "examTitle", label: "Tên kỳ thi", example: "Kỳ thi cuối kỳ — Kỹ năng mềm", required: true },
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
    subject: "Bạn được mời làm giám thị trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p>
<p>Bạn được mời làm <strong>giám thị phòng thi</strong> trên hệ thống Limio.vn.</p>
<p>Nhấn nút bên dưới để đặt mật khẩu (link có hiệu lực <strong>1 giờ</strong>):</p>
<p><a href="{{resetUrl}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Đặt mật khẩu</a></p>
<p>Sau khi đặt mật khẩu, đăng nhập tại Limio và bấm <strong>"Giám sát phòng thi"</strong> trong menu trái để xem danh sách phòng bạn được phân công.</p>`,
    bodyText: `Xin chào {{name}},

Bạn được mời làm giám thị phòng thi trên Limio.vn.

Nhấn link sau để đặt mật khẩu (TTL 1h):
{{resetUrl}}

Sau khi đặt mật khẩu, đăng nhập tại Limio và bấm "Giám sát phòng thi"
trong menu trái để xem danh sách phòng bạn được phân công.`,
    variables: [
      { name: "name", label: "Tên giám thị", example: "Trần Thị B", required: true },
      { name: "resetUrl", label: "Link đặt mật khẩu", example: "https://limio.vn/auth/reset?token=abc", required: true },
    ],
  },
  {
    key: "exam.proctor_invite_bulk",
    name: "Mời giám thị (bulk import)",
    description: "Gửi khi GV upload file kỳ thi có cột email giám thị.",
    category: "exam",
    subject: "Bạn được mời làm giám thị trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p>
<p>Bạn được mời làm <strong>giám thị phòng thi</strong> trên Limio.vn.</p>
<p>Đặt mật khẩu tại đây (TTL 1h): <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{name}},

Bạn được mời làm giám thị phòng thi trên Limio.vn.
Đặt mật khẩu: {{resetUrl}}`,
    variables: [
      { name: "name", label: "Tên giám thị", example: "Trần Thị B", required: true },
      { name: "resetUrl", label: "Link đặt mật khẩu", example: "https://limio.vn/auth/reset?token=abc", required: true },
    ],
  },
  {
    key: "exam.instructor_invite_bulk",
    name: "Mời GV phụ trách lớp (bulk exam upload)",
    description: "Gửi khi GV upload file kỳ thi có cột email GV phụ trách lớp.",
    category: "exam",
    subject: "Bạn được mời làm GV phụ trách lớp trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p>
<p>Bạn được mời làm <strong>giáo viên phụ trách lớp học</strong> trên Limio.vn.</p>
<p>Đặt mật khẩu (TTL 1h): <a href="{{resetUrl}}">{{resetUrl}}</a></p>`,
    bodyText: `Xin chào {{name}},

Bạn được mời làm giáo viên phụ trách lớp học trên Limio.vn.
Đặt mật khẩu: {{resetUrl}}`,
    variables: [
      { name: "name", label: "Tên GV", example: "Lê Văn C", required: true },
      { name: "resetUrl", label: "Link đặt mật khẩu", example: "https://limio.vn/auth/reset?token=abc", required: true },
    ],
  },

  // ============ COHORT ============
  {
    key: "cohort.instructor_invite",
    name: "Mời GV phụ trách lớp (cohort)",
    description:
      "Gửi khi admin gán email GV cho 1 cohort (đơn lẻ hoặc bulk upload cohort).",
    category: "cohort",
    subject: "Bạn được mời làm GV phụ trách lớp trên Limio.vn",
    bodyHtml: `<p>Xin chào {{name}},</p>
<p>Bạn được mời làm <strong>giáo viên phụ trách 1 lớp học</strong> trên hệ thống Limio.vn.</p>
<p>Nhấn nút bên dưới để đặt mật khẩu (link có hiệu lực <strong>1 giờ</strong>):</p>
<p><a href="{{resetUrl}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Đặt mật khẩu</a></p>
<p>Sau khi đặt mật khẩu, đăng nhập tại Limio để xem các lớp bạn được phân công.</p>`,
    bodyText: `Xin chào {{name}},

Bạn được mời làm giáo viên phụ trách 1 lớp học trên hệ thống Limio.vn.

Nhấn link sau để đặt mật khẩu (TTL 1h):
{{resetUrl}}

Sau khi đặt mật khẩu, đăng nhập tại Limio để xem các lớp bạn được phân công.`,
    variables: [
      { name: "name", label: "Tên GV", example: "Lê Văn C", required: true },
      { name: "resetUrl", label: "Link đặt mật khẩu", example: "https://limio.vn/auth/reset?token=abc", required: true },
    ],
  },

  // ============ COURSE (chưa wire) ============
  {
    key: "course.welcome",
    name: "Welcome khi enroll khoá học",
    description: "[Chưa active] Gửi sau khi học viên enroll thành công vào 1 khoá.",
    category: "course",
    subject: "Chào mừng bạn đến với {{courseTitle}}!",
    bodyHtml: `<p>Xin chào {{learnerName}},</p>
<p>Chào mừng bạn đến với khoá học <strong>{{courseTitle}}</strong> trên Limio.vn!</p>
<p>Bạn có thể bắt đầu học ngay tại đây: <a href="{{courseUrl}}">{{courseUrl}}</a></p>
<p>Chúc bạn học vui!</p>`,
    bodyText: `Xin chào {{learnerName}},

Chào mừng bạn đến với khoá học {{courseTitle}}.
Bắt đầu học tại: {{courseUrl}}`,
    variables: [
      { name: "learnerName", label: "Tên học viên", example: "Nguyễn Văn A", required: true },
      { name: "courseTitle", label: "Tên khoá học", example: "Lập trình Python cơ bản", required: true },
      { name: "courseUrl", label: "Link khoá học", example: "https://limio.vn/courses/python", required: true },
    ],
  },

  // ============ EXAM (chưa wire) ============
  {
    key: "exam.grade_published",
    name: "Thông báo điểm thi đã chấm",
    description: "[Chưa active] Gửi cho thí sinh sau khi điểm thi được chấm + publish.",
    category: "exam",
    subject: "[{{examTitle}}] Kết quả thi của bạn đã có",
    bodyHtml: `<p>Xin chào {{candidateName}},</p>
<p>Kết quả kỳ thi <strong>{{examTitle}}</strong> của bạn đã được công bố.</p>
<p><strong>Điểm: {{score}} / {{maxScore}}</strong></p>
<p>Xem chi tiết: <a href="{{resultUrl}}">{{resultUrl}}</a></p>`,
    bodyText: `Xin chào {{candidateName}},

Kết quả kỳ thi {{examTitle}}: {{score}} / {{maxScore}}
Xem chi tiết: {{resultUrl}}`,
    variables: [
      { name: "candidateName", label: "Tên thí sinh", example: "Nguyễn Văn A", required: true },
      { name: "examTitle", label: "Tên kỳ thi", example: "Kỳ thi cuối kỳ", required: true },
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
    bodyHtml: `<p>Xin chào {{candidateName}},</p>
<p>Kỳ thi <strong>{{examTitle}}</strong> sẽ mở vào <strong>{{examOpensAt}}</strong> (còn {{hoursUntilOpen}} giờ nữa).</p>
<p>Nhớ chuẩn bị mã dự thi: <strong>{{accessCode}}</strong></p>
<p>Link vào thi: <a href="{{claimUrl}}">{{claimUrl}}</a></p>`,
    bodyText: `Xin chào {{candidateName}},

Kỳ thi {{examTitle}} sẽ mở vào {{examOpensAt}} (còn {{hoursUntilOpen}} giờ).
Mã dự thi: {{accessCode}}
Link: {{claimUrl}}`,
    variables: [
      { name: "candidateName", label: "Tên thí sinh", example: "Nguyễn Văn A", required: true },
      { name: "examTitle", label: "Tên kỳ thi", example: "Kỳ thi cuối kỳ", required: true },
      { name: "examOpensAt", label: "Giờ mở thi", example: "08:00, 20/05/2026", required: true },
      { name: "hoursUntilOpen", label: "Số giờ còn lại", example: "24", required: true },
      { name: "accessCode", label: "Mã dự thi", example: "X65DMJZD", required: true },
      { name: "claimUrl", label: "Link vào thi", example: "https://limio.vn/exam/X65DMJZD", required: true },
    ],
  },

  // ============ GAMIFICATION (chưa wire) ============
  {
    key: "gamification.level_up",
    name: "Lên level mới",
    description: "[Chưa active] Gửi khi user đạt level mới.",
    category: "gamification",
    subject: "🎉 Chúc mừng! Bạn vừa đạt cấp {{newLevel}}",
    bodyHtml: `<p>Xin chào {{learnerName}},</p>
<p>Chúc mừng bạn vừa đạt <strong>Cấp {{newLevel}}</strong> — {{levelTitle}}!</p>
<p>Tổng XP hiện tại: <strong>{{totalXp}}</strong></p>
<p>Xem hồ sơ: <a href="{{profileUrl}}">{{profileUrl}}</a></p>`,
    bodyText: `Chúc mừng {{learnerName}}!

Bạn vừa đạt Cấp {{newLevel}} - {{levelTitle}}.
Tổng XP: {{totalXp}}
Hồ sơ: {{profileUrl}}`,
    variables: [
      { name: "learnerName", label: "Tên học viên", example: "Nguyễn Văn A", required: true },
      { name: "newLevel", label: "Cấp mới", example: "5", required: true },
      { name: "levelTitle", label: "Tên cấp", example: "Học viên chuyên cần", required: true },
      { name: "totalXp", label: "Tổng XP", example: "1250", required: true },
      { name: "profileUrl", label: "Link hồ sơ", example: "https://limio.vn/profile", required: true },
    ],
  },
  {
    key: "gamification.badge_earned",
    name: "Nhận badge mới",
    description: "[Chưa active] Gửi khi user nhận badge.",
    category: "gamification",
    subject: "🏆 Bạn vừa nhận huy hiệu: {{badgeName}}",
    bodyHtml: `<p>Xin chào {{learnerName}},</p>
<p>Bạn vừa nhận được huy hiệu <strong>{{badgeName}}</strong>!</p>
<blockquote style="border-left:4px solid #2563eb;padding-left:12px;color:#475569;">{{badgeDescription}}</blockquote>
<p>Xem bộ sưu tập huy hiệu: <a href="{{badgesUrl}}">{{badgesUrl}}</a></p>`,
    bodyText: `Xin chào {{learnerName}},

Bạn vừa nhận huy hiệu: {{badgeName}}
{{badgeDescription}}

Xem tại: {{badgesUrl}}`,
    variables: [
      { name: "learnerName", label: "Tên học viên", example: "Nguyễn Văn A", required: true },
      { name: "badgeName", label: "Tên huy hiệu", example: "Người mở đầu", required: true },
      { name: "badgeDescription", label: "Mô tả huy hiệu", example: "Hoàn thành bài học đầu tiên", required: true },
      { name: "badgesUrl", label: "Link bộ sưu tập", example: "https://limio.vn/profile/badges", required: true },
    ],
  },

  // ============ NOTIFICATION (chưa wire) ============
  {
    key: "notification.weekly_digest",
    name: "Tóm tắt tuần",
    description: "[Chưa active] Digest hàng tuần gửi cho user (Chủ Nhật).",
    category: "notification",
    subject: "Tóm tắt tuần qua trên Limio.vn",
    bodyHtml: `<p>Xin chào {{learnerName}},</p>
<p>Tuần này bạn đã:</p>
<ul>
  <li>Hoàn thành <strong>{{lessonsCompleted}}</strong> bài học</li>
  <li>Làm <strong>{{quizzesTaken}}</strong> bài quiz</li>
  <li>Kiếm được <strong>{{xpEarned}} XP</strong></li>
  <li>Duy trì streak <strong>{{streakDays}} ngày</strong></li>
</ul>
<p>Tiếp tục phát huy nhé! <a href="{{dashboardUrl}}">Vào học ngay</a></p>`,
    bodyText: `Xin chào {{learnerName}},

Tuần này:
- {{lessonsCompleted}} bài học hoàn thành
- {{quizzesTaken}} quiz đã làm
- {{xpEarned}} XP kiếm được
- Streak {{streakDays}} ngày

Vào học: {{dashboardUrl}}`,
    variables: [
      { name: "learnerName", label: "Tên học viên", example: "Nguyễn Văn A", required: true },
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
