/**
 * A7.8 — Safe Exam Browser (SEB) detection.
 *
 * Strict-proctoring exams require the candidate to run the exam inside SEB
 * (https://safeexambrowser.org). SEB announces itself two ways:
 *   1. User-Agent suffix: "...SEB/<version>"
 *   2. Custom header: `X-SafeExamBrowser-Version: <version>`
 *
 * Either signal is sufficient for the **hint** layer (this file). Full
 * authenticity (verifying the SHA256 ConfigKey / BrowserExamKey hash to defeat
 * fake-UA bypass) is P3.5 strict — out of scope here.
 *
 * Helpers are pure / framework-agnostic so they can be called from middleware,
 * server components, and route handlers without pulling in Next.js types.
 */

export interface SebDetection {
  isSeb: boolean;
  version: string | null;
}

/** Inspect raw headers (Headers, Request, NextRequest all work) for SEB markers. */
export function detectSeb(headers: {
  get(name: string): string | null;
}): SebDetection {
  const fromHeader = headers.get("x-safeexambrowser-version");
  if (fromHeader && fromHeader.trim().length > 0) {
    return { isSeb: true, version: fromHeader.trim() };
  }
  const ua = headers.get("user-agent") ?? "";
  const m = /\bSEB\/([0-9.]+)/i.exec(ua);
  if (m) return { isSeb: true, version: m[1] ?? null };
  return { isSeb: false, version: null };
}

/** Should we gate this proctoring level? Centralized so policy can evolve. */
export function requiresSeb(level: "none" | "basic" | "strict"): boolean {
  return level === "strict";
}
