// Server-safe helpers shared by RoundTabs.tsx (client) and page.tsx (server).
// Kept in a separate file so the "use client" directive on RoundTabs.tsx
// doesn't force the entire module — including this parse function — to be
// client-only.
// "admins" (Trưởng đợt) đã gỡ khỏi giao diện: ?tab=admins rơi về Tổng quan.
export type RoundTab = "overview" | "sessions" | "cohorts" | "results";

export function parseRoundTab(raw: string | undefined): RoundTab {
  if (raw === "sessions" || raw === "cohorts" || raw === "results") return raw;
  return "overview";
}
