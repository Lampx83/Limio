"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isExamPath } from "@/lib/feedback-hub-paths";

/** Mục "Góp ý" cho menu người dùng. Chỉ hiện khi widget Feedback Hub đã nạp (hub bật + đã đăng nhập) và không ở trang thi. */
export default function FeedbackMenuItem({ onClick }: { onClick?: () => void }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname() ?? "";
  useEffect(() => setReady(Boolean((window as unknown as { FeedbackHub?: { __loaded?: boolean } }).FeedbackHub?.__loaded)), []);
  if (!ready || isExamPath(pathname)) return null;
  return (
    <button
      type="button"
      data-feedbackhub-open
      onClick={onClick}
      className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-brand-600"
    >
      Góp ý cho Limio
    </button>
  );
}
