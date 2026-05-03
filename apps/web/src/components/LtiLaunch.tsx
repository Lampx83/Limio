"use client";

import { useEffect, useState } from "react";

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
      const res = await fetch("/api/lti/launch", {
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
      <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
        Lỗi khởi chạy LTI tool: {error}
      </p>
    );
  }

  if (!launchUrl) {
    return <p className="text-sm text-slate-500">Đang khởi chạy LTI tool...</p>;
  }

  return (
    <div className="space-y-2">
      {title && (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          🔗 {title}
        </p>
      )}
      <iframe
        src={launchUrl}
        title={title ?? "LTI tool"}
        className="h-[80vh] w-full rounded border border-slate-300 dark:border-slate-700"
        allow="fullscreen; microphone; camera; midi; autoplay; clipboard-write"
      />
      <p className="text-xs text-slate-500">
        Tool không hiển thị?{" "}
        <a
          href={launchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-700 dark:hover:text-slate-300"
        >
          Mở trong tab mới
        </a>
      </p>
    </div>
  );
}
