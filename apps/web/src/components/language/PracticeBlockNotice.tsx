import Link from "next/link";

/**
 * Thẻ thay cho khối "Bài luyện" khi không nhúng được: bài luyện đang tắt, đề không còn dùng được, hoặc người xem ở
 * vỏ thường (không có giao diện nhúng) nên dẫn sang trang luyện đề sẵn có.
 */
export default function PracticeBlockNotice({
  title,
  message,
  href,
  cta,
}: {
  title: string;
  message: string;
  href?: string;
  cta?: string;
}) {
  return (
    <section aria-label={title} className="my-6 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-5">
      <h2 className="text-h4">{title}</h2>
      <p className="text-meta mt-1">{message}</p>
      {href && (
        <Link href={href} className="btn-primary btn-sm mt-3 inline-flex">
          {cta ?? "Mở bài luyện"}
        </Link>
      )}
    </section>
  );
}
