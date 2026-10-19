"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Chỉ hiện khi chủ hồ sơ mở trang từ trình soạn (`?from=me`); khách xem công khai không thấy.
export default function PreviewBackLink() {
  const from = useSearchParams().get("from");
  if (from !== "me") return null;
  return (
    <div className="mb-3">
      <Link href="/me/portfolio" className="btn btn-secondary btn-sm">
        ← Quay lại chỉnh sửa
      </Link>
    </div>
  );
}
