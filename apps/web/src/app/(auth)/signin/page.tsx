import { Suspense } from "react";
import SignInForm from "./SignInForm";

// SignInForm đọc ?callbackUrl= qua useSearchParams — App Router bắt buộc bọc
// Suspense cho client component dùng hook này.
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
