// Server-safe helpers shared by RoundTabs.tsx (client) and page.tsx (server).
// Kept in a separate file so the "use client" directive on RoundTabs.tsx
// doesn't force the entire module — including this parse function — to be
// client-only.
export type RoundTab = "overview" | "sessions" | "cohorts" | "admins";

export function parseRoundTab(raw: string | undefined): RoundTab {
  if (raw === "sessions" || raw === "cohorts" || raw === "admins") return raw;
  return "overview";
}
