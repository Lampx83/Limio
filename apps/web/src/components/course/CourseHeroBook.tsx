import { libraryByline } from "@/lib/libraryView";

/**
 * Phần "sách" của banner trang khoá (docs/tieu-chi/trang-khoa-hoc-banner-sach.md, AC1–AC2). Khoá không có thông tin sách và
 * không có ảnh thì cả hai thành phần này không dựng gì — banner như cũ.
 */

/** Dòng "Nhà xuất bản · Tác giả · Lần xuất bản" dưới tên khoá; trường trống bỏ, cả ba trống thì không dựng. */
export function CourseBookLine({ publisher, authors, edition }: { publisher: string | null; authors: string | null; edition: string | null }) {
  // Dữ liệu đã được chuẩn hoá khi lưu, nhưng cắt khoảng trắng lần nữa để chuỗi toàn dấu cách không thành dòng rỗng có dấu "·".
  const text = libraryByline({ publisher: publisher?.trim() || null, authors: authors?.trim() || null, edition: edition?.trim() || null });
  if (!text) return null;
  return <p className="mt-2 text-sm text-white/85">{text}</p>;
}

/** Ảnh bìa ở cột phải banner: tỉ lệ bìa sách, bo nhẹ, đổ bóng; chỉ hiện từ `lg` (1024 px): dưới đó hai ô tiến độ/XP bên trái cần cả bề ngang, thêm cột ảnh thì chúng bị ép hẹp, chữ xuống từng từ. Ảnh trang trí nên alt rỗng. */
export function CourseHeroCover({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div className="hidden shrink-0 lg:block" data-testid="course-hero-cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-52 w-auto max-w-[10rem] rounded-sm object-cover shadow-xl ring-1 ring-black/10" />
    </div>
  );
}
