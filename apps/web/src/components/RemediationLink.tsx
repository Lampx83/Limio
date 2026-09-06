"use client";

import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";

/**
 * B9.2 — a remediation link that records that the learner took it.
 *
 * The measurement must never cost the learner the navigation: the request is
 * fired with `keepalive` so it survives the page unload, nothing is awaited,
 * and a failure is swallowed. Uptake data going missing is a research problem;
 * a link that hesitates is a learner problem, and the learner wins.
 */
export default function RemediationLink({
  deliveryId,
  lessonId,
  href,
  children,
  className,
}: {
  deliveryId: string;
  lessonId: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  function record() {
    try {
      void fetch(apiUrl(`/api/feedback-deliveries/${deliveryId}/remediation-click`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
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
