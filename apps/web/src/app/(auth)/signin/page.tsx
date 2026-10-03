import { Suspense } from "react";
import { enabledSsoProviderIds } from "@/lib/auth";
import { getRegisterEnabled } from "@/lib/site-settings";
import SignInForm from "./SignInForm";

// SignInForm đọc ?callbackUrl= qua useSearchParams — App Router bắt buộc bọc
// Suspense cho client component dùng hook này.
export default async function SignInPage() {
  const registerEnabled = await getRegisterEnabled();
  return (
    <Suspense fallback={null}>
      <SignInForm ssoProviders={enabledSsoProviderIds} registerEnabled={registerEnabled} />
    </Suspense>
  );
}
