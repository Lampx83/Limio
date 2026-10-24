import Link from "next/link";

export const metadata = { title: "Huỷ nhận email lớp học", robots: { index: false } };

export default function ClassEmailUnsubscribedPage({ searchParams }: { searchParams: { status?: string } }) {
  const ok = searchParams.status === "ok";
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-h2">{ok ? "Đã tắt email lớp học" : "Liên kết không hợp lệ"}</h1>
      <p className="mt-3 text-body text-muted">
        {ok
          ? "Địa chỉ email này sẽ không nhận email tổng kết và nhận xét sau buổi học nữa. Các nội dung này vẫn xem được trong ứng dụng, ở mục Lịch học."
          : "Liên kết này đã hết hạn hoặc bị sửa. Tổng kết và nhận xét vẫn xem được ngay trong ứng dụng."}
      </p>
      <Link href="/me/lich-hoc" className="btn-primary mt-6 inline-block">
        Mở Lịch học
      </Link>
    </main>
  );
}
