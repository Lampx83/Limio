import { Eye } from "lucide-react";
import EnterProctorCodeForm from "./EnterProctorCodeForm";

export const dynamic = "force-dynamic";

/**
 * Cửa vào của giám thị — không cần tài khoản, chỉ cần mã phòng do người tổ
 * chức gửi. Mã này KHÁC mã thí sinh: xem proctor-access.ts.
 */
export default function ProctorEntryPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-6 py-10">
      <div className="text-center">
        <Eye className="mx-auto h-12 w-12 text-slate-700" />
        <h1 className="mt-3 text-2xl font-bold">Giám thị coi thi</h1>
        <p className="mt-2 text-sm text-faint">
          Nhập mã giám thị của phòng bạn được phân công. Mã này do người tổ chức
          gửi riêng — không phải mã thí sinh dùng để vào thi.
        </p>
      </div>
      <EnterProctorCodeForm />
    </main>
  );
}
