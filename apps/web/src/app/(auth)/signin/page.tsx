import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, enabledSsoProviderIds } from "@/lib/auth";
import { signedInRedirectTarget } from "@/lib/callbackUrl";
import { getRegisterEnabled } from "@/lib/site-settings";
import SignInForm from "./SignInForm";

// SignInForm đọc ?callbackUrl= qua useSearchParams — App Router bắt buộc bọc
// Suspense cho client component dùng hook này.
export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string | string[] };
}) {
  // Đã đăng nhập mà vẫn tới đây (vd mở link /signin?callbackUrl=... từ Zalo sang
  // trình duyệt): không bắt nhập lại mật khẩu.
  const session = await auth();
  if (session?.user?.id) redirect(signedInRedirectTarget(searchParams?.callbackUrl));

  const registerEnabled = await getRegisterEnabled();
  return (
    <Suspense fallback={null}>
      <SignInForm ssoProviders={enabledSsoProviderIds} registerEnabled={registerEnabled} />
    </Suspense>
  );
}
