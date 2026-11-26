/**
 * Bìa sách trên trang bán: vuông góc như cuốn sách thật, có gáy (bóng ở mép trái), cạnh trang ở bên phải và phía dưới, nghiêng nhẹ trong không gian
 * và dựng thẳng lại khi rê chuột vào thẻ chứa nó (CSS `.book3d*` ở globals.css). Thuần trình bày; `alt` rỗng nếu tên sách đã nằm ngay cạnh.
 */
export default function BookCover({
  src,
  alt,
  fallback,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  /** Hiện khi sách chưa có bìa (vd số quyển). */
  fallback?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`book3d block ${className}`}>
      <span className="book3d-body block">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} loading="lazy" className="block w-full object-cover" />
        ) : (
          <span className="flex aspect-[190/260] w-full items-center justify-center">{fallback}</span>
        )}
        <span className="book3d-spine" aria-hidden />
      </span>
    </span>
  );
}
