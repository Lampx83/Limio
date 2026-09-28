import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@feedbackme/db";
import { CertificationError, issueCertificate } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { CertificatePdfDocument, buildCertificatePdfFilename } from "@/lib/certificatePdf";

export const runtime = "nodejs";

// A6 — Tải PDF chứng nhận thật (khác bản in trình duyệt trước đây). Chỉ chủ
// sở hữu (đã đăng nhập, đúng userId) mới tải được — không phải trang public,
// khác /verify/[certNumber] vốn không đòi hỏi đăng nhập.
export async function GET(
  _req: Request,
  { params }: { params: { courseSlug: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({
    where: { slug: params.courseSlug },
    select: { id: true, title: true },
  });
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  let certificate;
  try {
    certificate = await issueCertificate(userId, course.id);
  } catch (e) {
    if (e instanceof CertificationError) {
      return NextResponse.json({ error: e.code }, { status: 409 });
    }
    throw e;
  }

  const [skillBadges, engagement] = await Promise.all([
    prisma.userBadge.findMany({
      where: {
        userId,
        badge: { category: "skill" },
        context: { path: ["courseId"], equals: course.id },
      },
      include: { badge: { select: { name: true } } },
    }),
    // Thời lượng học thật — cùng loại tín hiệu "7 hours 34 minutes" mà chứng
    // nhận LinkedIn Learning hiển thị, lấy từ activeSec đã cộng dồn (B11).
    prisma.lessonEngagement.aggregate({
      where: { userId, courseId: course.id },
      _sum: { activeSec: true },
    }),
  ]);

  const siteOrigin = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const verifyUrl = `${siteOrigin}/verify/${certificate.certNumber}`;
  // issuerLogoUrl snapshot là đường dẫn tương đối (/api/org-logos/...) —
  // react-pdf render phía server (Node fetch), cần URL tuyệt đối.
  const issuerLogoUrl = certificate.issuerLogoUrl ? `${siteOrigin}${certificate.issuerLogoUrl}` : null;

  const buf = await renderToBuffer(
    CertificatePdfDocument({
      userName: certificate.userNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      issuerName: certificate.issuerName,
      issuerLogoUrl,
      skillBadgeNames: skillBadges.map((sb) => sb.badge.name),
      issuedAt: certificate.issuedAt,
      totalStudySec: engagement._sum.activeSec ?? 0,
      certNumber: certificate.certNumber,
      verifyUrl,
    }),
  );

  const filename = buildCertificatePdfFilename(course.title, certificate.userNameSnapshot);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(buf.length),
    },
  });
}
