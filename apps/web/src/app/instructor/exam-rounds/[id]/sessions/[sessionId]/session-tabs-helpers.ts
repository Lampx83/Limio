export type SessionTab = "overview" | "rooms";

export function parseSessionTab(raw: string | undefined): SessionTab {
  if (raw === "rooms") return "rooms";
  return "overview";
}
