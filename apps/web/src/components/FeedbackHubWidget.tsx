"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import { isExamPath } from "@/lib/feedback-hub-paths";

type HubApi = { hideFab?: (hide: boolean) => void };

/**
 * Nạp widget góp ý của Feedback Hub (chỉ được render khi máy chủ đã cấu hình hub và người dùng đã đăng nhập).
 * Nút đặt góc dưới-TRÁI vì góc dưới-phải đã dành cho trợ lý AI. Ẩn khi vào trang làm bài thi.
 */
export default function FeedbackHubWidget({ hub, project, basePath }: { hub: string; project: string; basePath: string }) {
  const pathname = usePathname() ?? "";
  const sync = useCallback(() => {
    (window as unknown as { FeedbackHub?: HubApi }).FeedbackHub?.hideFab?.(isExamPath(pathname));
  }, [pathname]);
  useEffect(sync, [sync]);

  return (
    <Script
      id="feedback-hub-widget"
      src={`${hub}/widget.js`}
      strategy="afterInteractive"
      onReady={sync}
      data-project={project}
      data-token-url={`${basePath}/api/feedback-token`}
      data-position="bottom-left"
      data-offset-x="20"
      data-offset-y="20"
      data-locale="vi"
      data-color-scheme="light"
    />
  );
}
