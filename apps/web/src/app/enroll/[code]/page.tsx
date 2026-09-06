import Link from "next/link";
import { previewSectionInvite } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import JoinSectionButton from "@/components/JoinSectionButton";

export const dynamic = "force-dynamic";

export default async function EnrollByCodePage({
  params,
}: {
  params: { code: string };
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const code = params.code.trim().toUpperCase();

  const invite = await previewSectionInvite(userId, code);

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-h1">Link không hợp lệ</h1>
        <p className="text-body text-slate-600">
          Link mời này không còn tồn tại hoặc đã bị thu hồi. Liên hệ giảng viên để lấy link mới.
        </p>
      </main>
    );
  }

  // Đã ở đúng lớp này rồi — không dựng ra một nút "tham gia" chẳng làm gì, vì
  // bấm xong vẫn báo thành công và người học không hiểu vừa xảy ra chuyện gì.
  if (invite.alreadyHere) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="w-full rounded-2xl border border-token bg-[rgb(var(--surface))] p-8">
          <h1 className="text-2xl font-bold">{invite.courseTitle}</h1>
          <p className="mt-2 text-sm text-muted">
            Bạn đã ở lớp <strong>{invite.sectionName}</strong> rồi.
          </p>
          <Link href={`/learn/${invite.courseSlug}`} className="btn-primary mt-6 inline-block">
            Vào học
          </Link>
        </div>
      </main>
    );
  }

  const moving = invite.current !== null;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="w-full rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white shadow-lg">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          {moving ? "Chuyển lớp" : "Lời mời tham gia lớp học"}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{invite.courseTitle}</h1>
        <p className="mt-1 text-sm opacity-90">Lớp: {invite.sectionName}</p>

        {/*
          Người đã ghi danh khoá này bằng đường khác — thường là qua link giới
          thiệu khoá, và khi đó họ đang nằm ở lớp mặc định. Trước đây trang vẫn
          hiện nút "Tham gia lớp học", bấm xong báo thành công nhưng lớp giữ
          nguyên: thao tác im lặng không làm gì, tệ hơn cả báo lỗi. Giờ nói rõ
          họ đang ở đâu và sắp đi đâu, rồi để họ tự quyết.
        */}
        {moving && (
          <div className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-sm">
            {/* Lớp mặc định không có tên đọc lên nghe được — nó là chỗ trống,
                không phải một lớp. Nói thẳng ra thế thay vì ghép tên nó vào
                câu "bạn đang ở lớp …". */}
            {invite.current!.isDefault ? (
              <p>Bạn đã ghi danh khoá này nhưng chưa được xếp vào lớp nào.</p>
            ) : (
              <p>
                Bạn đang ở lớp <strong>{invite.current!.sectionName}</strong>.
              </p>
            )}
            <p className="mt-1 opacity-90">
              Bấm nút dưới đây để chuyển sang <strong>{invite.sectionName}</strong>. Toàn bộ
              tiến độ và bài đã làm của bạn được giữ nguyên.
            </p>
          </div>
        )}

        <div className="mt-6">
          <JoinSectionButton
            code={code}
            isLoggedIn={!!userId}
            mode={moving ? "move" : "join"}
          />
        </div>
      </div>
    </main>
  );
}
