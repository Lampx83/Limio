"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Launches an LTI 1.3 tool. We POST to /api/lti/launch to get the tool's OIDC
 * login init URL, then either:
 *   - render it in an iframe (when the tool supports iframe embedding), or
 *   - open in a new window (fallback for tools blocking framing).
 */
export default function LtiLaunch({
  toolId,
  resourceLinkId,
  courseId,
  lessonId,
  title,
}: {
  toolId: string;
  resourceLinkId: string;
  courseId?: string;
  lessonId?: string;
  title?: string;
}) {
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const res = await fetch(apiUrl("/api/lti/launch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, resourceLinkId, courseId, lessonId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "launch_failed");
        return;
      }
      const data = (await res.json()) as { url: string };
      setLaunchUrl(data.url);
    }
    void init();
  }, [toolId, resourceLinkId, courseId, lessonId]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
        Lỗi khởi chạy LTI tool: {error}
      </div>
    );
  }

  if (!launchUrl) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-faint">
        <span className="inline-flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "300ms" }} />
        </span>
        Đang khởi chạy LTI tool...
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {title && (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-muted">
          <span></span>
          {title}
        </p>
      )}
      <iframe
        src={launchUrl}
        title={title ?? "LTI tool"}
        className="h-[80vh] w-full overflow-hidden rounded-xl border border-token shadow-card"
        allow="fullscreen; microphone; camera; midi; autoplay; clipboard-write"
      />
      <p className="text-xs text-faint">
        Tool không hiển thị?{" "}
        <a
          href={launchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          Mở trong tab mới
        </a>
      </p>
    </div>
  );
}
