import type { Metadata } from "next";
import { getCertificateByNumber } from "@feedbackme/core-lms";
import { formatVN } from "@/lib/datetime";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type Props = { params: { certNumber: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cert = await getCertificateByNumber(params.certNumber);
  return {
    title: cert ? `Xác thực chứng nhận — ${cert.userNameSnapshot}` : "Không tìm thấy chứng nhận",
    robots: { index: false, follow: false },
  };
}

// A6 — Trang xác thực công khai, không đòi hỏi đăng nhập: bất kỳ ai cầm mã
// chứng nhận (in trên PDF, hoặc dán link vào LinkedIn) đều tra được. Chỉ trả
// về đúng những gì bản thân tấm chứng nhận đã công khai — tên, khoá học,
// ngày cấp — không có điểm số hay dữ liệu learner model nào khác (§5.4).
export default async function VerifyCertificatePage({ params }: Props) {
  const cert = await getCertificateByNumber(params.certNumber);

  if (!cert) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 lg:px-6">
        <EmptyState
          title="Không tìm thấy chứng nhận"
          description={`Không có chứng nhận nào ứng với mã "${params.certNumber}".`}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 lg:px-6">
      <div className="card p-8 text-center">
        <p className="banner-success inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide">
          ✓ Chứng nhận hợp lệ
        </p>
        <p className="mt-6 text-h1">{cert.userNameSnapshot}</p>
        <p className="mt-2 text-body text-muted">đã hoàn thành khóa học</p>
        <p className="mt-1 text-h3">{cert.courseTitleSnapshot}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-token pt-6 text-left text-sm">
          <div>
            <p className="text-meta">Cấp ngày</p>
            <p className="mt-1 font-semibold">
              {formatVN(cert.issuedAt, { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-meta">Mã chứng nhận</p>
            <p className="mt-1 font-mono text-xs">{cert.certNumber}</p>
          </div>
        </div>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-caption">
        {cert.issuerLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cert.issuerLogoUrl} alt="" className="h-4 w-4 object-contain" />
        )}
        Cấp bởi {cert.issuerName}
      </p>
    </main>
  );
}
