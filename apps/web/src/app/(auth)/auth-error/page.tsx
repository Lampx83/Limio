import Link from "next/link";

// Trang lỗi đăng nhập thay cho trang "Server error" mặc định của Auth.js.
// Auth.js gộp nhiều lỗi phía người dùng (cookie PKCE mất do mở link trong
// Messenger/Zalo hoặc bấm quay lại, phiên đăng nhập quá 15 phút...) vào
// `error=Configuration`, khiến sinh viên tưởng hệ thống hỏng. Trang này nói
// đúng điều nên làm: thử lại bằng trình duyệt thật, hoặc dùng email + mật khẩu.
// Cố tình là route riêng, KHÔNG trỏ về /api/auth/error (sẽ tạo vòng lặp redirect).
export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const denied = searchParams.error === "AccessDenied";
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <div className="card text-center">
        <h1 className="h-display text-2xl font-bold">
          {denied ? "Không thể đăng nhập tài khoản này" : "Đăng nhập chưa thành công"}
        </h1>
        {denied ? (
          <p className="mt-3 text-sm text-muted">
            Tài khoản này không được phép đăng nhập. Hãy thử tài khoản khác hoặc
            liên hệ giảng viên.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              Lỗi này thường do phiên đăng nhập bị gián đoạn — không phải tài
              khoản của bạn có vấn đề. Hãy thử lại theo cách sau:
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-left text-sm">
              <li>
                Nếu bạn mở liên kết từ Messenger, Zalo hoặc Facebook: chạm menu
                (⋮) rồi chọn <strong>&quot;Mở bằng Chrome/Safari&quot;</strong>.
              </li>
              <li>Chỉ bấm &quot;Đăng nhập với Google&quot; một lần, không bấm quay lại giữa chừng.</li>
              <li>
                Hoặc đăng nhập bằng email + mật khẩu (chọn &quot;Quên mật khẩu?&quot;
                nếu chưa đặt).
              </li>
            </ol>
          </>
        )}
        <Link href="/signin" className="btn-primary mt-6 inline-block w-full">
          Quay lại trang đăng nhập
        </Link>
      </div>
    </main>
  );
}
