"use client";

import Script from "next/script";
import { feedbackContext, readActiveRole } from "@/lib/feedback-hub-paths";

type Hub = { init: (o: Record<string, unknown>) => unknown };

/**
 * Nạp widget góp ý của Feedback Hub. KHÔNG vẽ nút nổi (góc màn hình của Limio đã kín nút menu và thanh CTA di động):
 * widget mở từ mục "Góp ý" trong menu người dùng (FeedbackMenuItem, gắn `data-feedbackhub-open`).
 */
export default function FeedbackHubWidget({ hub, project, basePath, role }: { hub: string; project: string; basePath: string; role: string }) {
  return (
    <Script
      id="feedback-hub-widget"
      src={`${hub}/widget.js`}
      strategy="afterInteractive"
      onReady={() => {
        (window as unknown as { FeedbackHub?: Hub }).FeedbackHub?.init({
          project,
          hub,
          tokenUrl: `${basePath}/api/feedback-token`,
          fab: false,
          trigger: "[data-feedbackhub-open]",
          locale: "vi",
          colorScheme: "light",
          getContext: () =>
            feedbackContext(
              window.location.pathname.slice(basePath.length),
              readActiveRole(document.cookie) ?? role,
              `${window.innerWidth}x${window.innerHeight}`,
            ),
        });
      }}
    />
  );
}
