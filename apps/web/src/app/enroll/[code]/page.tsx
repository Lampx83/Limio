import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import JoinSectionButton from "@/components/JoinSectionButton";

export const dynamic = "force-dynamic";

export default async function EnrollByCodePage({
  params,
}: {
  params: { code: string };
}) {
  const session = await auth();
  const code = params.code.trim().toUpperCase();

  const section = await prisma.courseSection.findUnique({
    where: { inviteCode: code },
    select: {
      name: true,
      isDefault: true,
      course: { select: { title: true, description: true } },
    },
  });

  if (!section || section.isDefault) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-h1">Link không hợp lệ</h1>
        <p className="text-body text-slate-600">
          Link mời này không còn tồn tại hoặc đã bị thu hồi. Liên hệ giảng viên để lấy link mới.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="w-full rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white shadow-lg">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">Lời mời tham gia lớp học</p>
        <h1 className="mt-2 text-2xl font-bold">{section.course.title}</h1>
        <p className="mt-1 text-sm opacity-90">Lớp: {section.name}</p>
        <div className="mt-6">
          <JoinSectionButton code={code} isLoggedIn={!!session?.user?.id} />
        </div>
      </div>
    </main>
  );
}
