/**
 * Nhúng một khối JSON-LD (schema.org) vào trang.
 *
 * Dùng `dangerouslySetInnerHTML` là bắt buộc: React sẽ escape `<`, `&`, `"`
 * nếu render object qua children, khiến crawler không parse được JSON. Bù lại
 * phải tự chặn chuỗi `</script` trong dữ liệu — tiêu đề khoá học do giảng viên
 * nhập nên coi như untrusted.
 */
export default function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
