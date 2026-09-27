"use client";

import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";

/**
 * B4 — link một bước lộ trình, ghi lại rằng học viên đã bấm (AC-2.14).
 *
 * Cùng nguyên tắc với RemediationLink: `keepalive`, không await, nuốt lỗi.
 * Mất một event uptake là chuyện của nghiên cứu; link khựng lại là chuyện của
 * học viên, và học viên được ưu tiên.
 */
export default function PathStepLink({
  lessonId,
  kind,
  surface,
  href,
  children,
  className,
}: {
  lessonId: string;
  kind: "review" | "next" | "practice" | "skim";
  surface: "course_home" | "quiz_result";
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  function record() {
    try {
      void fetch(apiUrl("/api/learning-path/click"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, kind, surface }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Never let instrumentation break navigation.
    }
  }

  return (
    <Link href={href} className={className} onClick={record}>
      {children}
    </Link>
  );
}
