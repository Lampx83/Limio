import { redirect } from "next/navigation";
import { getStorageUsageReport, isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatBytes } from "@/lib/formatBytes";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  lesson_video: "Video bài giảng",
  lesson_image: "Ảnh bài giảng",
  lesson_pdf: "PDF bài giảng",
  lesson_html: "HTML bài giảng",
  lesson_transcript: "Phụ đề bài giảng",
  submission: "Bài nộp của học viên",
  exam_asset: "Ảnh/âm thanh đề thi",
  oral_material: "Tài liệu thi vấn đáp",
  proctor_snapshot: "Ảnh giám sát thi",
  avatar: "Ảnh đại diện",
  org_branding: "Logo/chữ ký tổ chức",
  platform_branding: "Chữ ký nền tảng",
  whiteboard_page: "Trang bảng trắng",
  board_attachment: "Đính kèm bảng thảo luận",
  live_slide: "Slide Limio Live",
  live_resource: "Tài nguyên Limio Live",
  tmp: "Tạm",
  other: "Khác",
};

export default async function AdminStoragePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?next=/admin/storage");
  if (!(await isAdmin(userId))) redirect("/");

  const r = await getStorageUsageReport({ topN: 20 });
  const pct = (n: number) => (r.totalBytes > 0 ? Math.round((n / r.totalBytes) * 100) : 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Dung lượng lưu trữ</h1>
      <p className="mt-1 text-meta">
        Đang ở giai đoạn đo: chỉ thống kê, chưa giới hạn ai. Dung lượng của bài
        nộp và tài liệu bài giảng tính cho chủ khoá, kể cả khi người upload là
        giảng viên đồng giảng.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-token p-4">
          <div className="text-caption">Tổng đã ghi sổ</div>
          <div className="text-h2">{formatBytes(r.totalBytes)}</div>
          <div className="text-caption">{r.totalFiles.toLocaleString("vi-VN")} file</div>
        </div>
        <div className="rounded-lg border border-token p-4">
          <div className="text-caption">Chưa gán được cho ai</div>
          <div className="text-h2">{formatBytes(r.unattributed.bytes)}</div>
          <div className="text-caption">{r.unattributed.files.toLocaleString("vi-VN")} file</div>
        </div>
        <div className="rounded-lg border border-token p-4">
          <div className="text-caption">Gói SCORM / H5P</div>
          <div className="text-h2">{formatBytes(r.packages.scormBytes + r.packages.h5pBytes)}</div>
          <div className="text-caption">bảng riêng, chưa vào sổ ghi</div>
        </div>
      </div>

      {r.totalFiles === 0 && (
        <div className="banner-info mt-4">
          Sổ ghi còn trống. Chạy <code>pnpm backfill:stored-files</code> trên
          server để đưa các file đã có vào sổ; file upload mới tự được ghi.
        </div>
      )}

      <h2 className="text-h3 mt-8">Theo loại file</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-caption">
            <tr className="border-b border-token">
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2 text-right">Số file</th>
              <th className="px-3 py-2 text-right">Dung lượng</th>
              <th className="px-3 py-2 text-right">Tỉ lệ</th>
            </tr>
          </thead>
          <tbody>
            {r.byKind.map((k) => (
              <tr key={k.kind} className="border-b border-token">
                <td className="px-3 py-2">{KIND_LABEL[k.kind] ?? k.kind}</td>
                <td className="px-3 py-2 text-right">{k.files.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">{formatBytes(k.bytes)}</td>
                <td className="px-3 py-2 text-right">{pct(k.bytes)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-h3 mt-8">Người dùng nhiều dung lượng nhất</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-caption">
            <tr className="border-b border-token">
              <th className="px-3 py-2">Người dùng</th>
              <th className="px-3 py-2 text-right">Số file</th>
              <th className="px-3 py-2 text-right">Dung lượng</th>
            </tr>
          </thead>
          <tbody>
            {r.topUsers.map((u) => (
              <tr key={u.userId} className="border-b border-token">
                <td className="px-3 py-2">
                  {u.displayName ?? "(đã xoá)"}
                  {u.email && <span className="ml-2 text-caption">{u.email}</span>}
                </td>
                <td className="px-3 py-2 text-right">{u.files.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">{formatBytes(u.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
