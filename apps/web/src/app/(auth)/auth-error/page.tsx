import Link from "next/link";
import { getT } from "@/lib/i18n/server";

// Trang lỗi đăng nhập thay cho trang "Server error" mặc định của Auth.js.
// Auth.js gộp nhiều lỗi phía người dùng (cookie PKCE mất do mở link trong
// Messenger/Zalo hoặc bấm quay lại, phiên đăng nhập quá 15 phút...) vào
// `error=Configuration`, khiến sinh viên tưởng hệ thống hỏng. Trang này nói
// đúng điều nên làm: thử lại bằng trình duyệt thật, hoặc dùng email + mật khẩu.
// Cố tình là route riêng, KHÔNG trỏ về /api/auth/error (sẽ tạo vòng lặp redirect).
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const t = await getT();
  const denied = searchParams.error === "AccessDenied";
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <div className="card text-center">
        <h1 className="h-display text-2xl font-bold">
          {denied ? t("auth.error.deniedTitle") : t("auth.error.title")}
        </h1>
        {denied ? (
          <p className="mt-3 text-sm text-muted">
            {t("auth.error.deniedBody")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              {t("auth.error.body")}
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-left text-sm">
              <li>
                {t("auth.error.step1Pre")} <strong>&quot;{t("auth.error.step1Strong")}&quot;</strong>.
              </li>
              <li>{t("auth.error.step2")}</li>
              <li>
                {t("auth.error.step3")}
              </li>
            </ol>
          </>
        )}
        <Link href="/signin" className="btn-primary mt-6 inline-block w-full">
          {t("auth.error.back")}
        </Link>
      </div>
    </main>
  );
}
