import { listInstructorApplications } from "@feedbackme/core-lms";
import ApplicationsClient from "./ApplicationsClient";

export const dynamic = "force-dynamic";

export default async function InstructorApplicationsPage() {
  const [pending, reviewed] = await Promise.all([
    listInstructorApplications("pending"),
    listInstructorApplications("all").then((rows) => rows.filter((r) => r.status !== "pending").slice(0, 30)),
  ]);

  const serialize = (a: (typeof pending)[number]) => ({
    id: a.id,
    status: a.status,
    institution: a.institution,
    subject: a.subject,
    motivation: a.motivation,
    verificationUrl: a.verificationUrl,
    rejectionReason: a.rejectionReason,
    createdAt: a.createdAt.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
    reviewerName: a.reviewer?.displayName ?? null,
    user: {
      displayName: a.user.displayName,
      email: a.user.email,
      emailVerified: !!a.user.emailVerifiedAt,
    },
  });

  return (
    <main>
      <header className="mb-6">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">Đơn đăng ký giáo viên</h1>
        <p className="mt-1 text-sm text-muted">
          Người dùng chọn “Tôi muốn dạy” khi đăng ký. Trong lúc chờ họ dùng tài khoản học viên;
          duyệt xong họ được cấp quyền giáo viên và nhận email chúc mừng.
        </p>
      </header>
      <ApplicationsClient pending={pending.map(serialize)} reviewed={reviewed.map(serialize)} />
    </main>
  );
}
