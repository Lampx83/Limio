import Link from "next/link";
import { redirect } from "next/navigation";
import { listLegacyOralImportCandidates, listVanDapExams } from "@feedbackme/core-lms";
import { requireVanDapUser } from "@/lib/vanDapApi";
import { formatDate } from "@/lib/datetime";
import EmptyState from "@/components/ui/EmptyState";
import ImportLegacy from "./ImportLegacy";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Nháp", cls: "text-slate-600" },
  published: { label: "Đã xuất bản", cls: "text-emerald-700" },
  archived: { label: "Lưu trữ", cls: "text-amber-700" },
};

/**
 * Limio Vấn đáp — bản làm lại của vấn đáp AI, đang thử nghiệm và chạy SONG SONG bản cũ
 * (docs/tieu-chi/limio-van-dap.md). Chỉ người có cờ `van_dap.access` vào được (AC0.1).
 */
export default async function VanDapHomePage() {
  const userId = await requireVanDapUser();
  if (!userId) redirect("/instructor/dashboard");

  const [exams, legacy] = await Promise.all([listVanDapExams(userId), listLegacyOralImportCandidates(userId)]);

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Limio Vấn đáp</h1>
          <p className="mt-1 text-sm text-faint">
            Thầy/cô quyết định AI hỏi gì và theo thứ tự nào bằng một dàn câu hỏi duyệt trước; AI chỉ diễn đạt thành câu hỏi.
          </p>
        </div>
        <Link href="/instructor/van-dap/new" className="btn btn-primary btn-sm">
          Tạo đề Limio Vấn đáp
        </Link>
      </div>

      <div className="banner-info mt-4 text-sm" role="note">
        <p className="font-medium">Đang thử nghiệm.</p>
        <p className="mt-0.5">
          Limio Vấn đáp chạy song song &quot;Phòng vấn đáp&quot; hiện có. Đề và buổi vấn đáp cũ không bị đổi; bản mới có đề, dữ
          liệu và mã tham gia riêng.
        </p>
      </div>

      {exams.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="🎙️"
            title="Chưa có đề Limio Vấn đáp nào"
            description="Tạo đề mới, hoặc nhập từ một đề vấn đáp cũ ở bên dưới để giữ lại tài liệu, chủ đề và rubric."
            actions={[{ label: "Tạo đề Limio Vấn đáp", href: "/instructor/van-dap/new", variant: "primary" }]}
          />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {exams.map((e) => {
            const st = STATUS[e.status] ?? STATUS.draft!;
            return (
              <li key={e.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/instructor/van-dap/${e.id}`} className="min-w-0 break-words text-base font-semibold hover:text-brand-700">
                    {e.title}
                  </Link>
                  <span className={`shrink-0 text-xs font-medium ${st.cls}`}>{st.label}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {e.items} ý cần hỏi · {e.scenarios} kịch bản · {e.durationMin} phút · cập nhật {formatDate(e.updatedAt)}
                </p>
                {e.importedFromExamId && <p className="mt-1 text-xs text-slate-500">Nhập từ một đề vấn đáp cũ.</p>}
              </li>
            );
          })}
        </ul>
      )}

      <ImportLegacy candidates={legacy} />
    </main>
  );
}
