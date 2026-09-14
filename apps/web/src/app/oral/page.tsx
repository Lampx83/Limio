import { Mic } from "lucide-react";
import OralJoinForm from "./OralJoinForm";

export const dynamic = "force-dynamic";

/** Cổng vào cho SV được giảng viên đọc mã tham gia thay vì bấm link trực tiếp. */
export default function OralJoinPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="text-center">
        <Mic className="mx-auto mb-3 h-8 w-8 text-amber-600" />
        <h1 className="text-xl font-semibold">Vào buổi vấn đáp AI</h1>
        <p className="mt-1 text-sm text-faint">
          Nhập mã giảng viên cung cấp. Bạn cần đăng nhập bằng tài khoản của
          mình trước.
        </p>
      </div>
      <OralJoinForm />
    </main>
  );
}
