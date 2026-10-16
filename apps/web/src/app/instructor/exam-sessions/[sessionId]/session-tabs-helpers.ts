export type SessionTab = "overview" | "rooms" | "results";

export function parseSessionTab(raw: string | undefined): SessionTab {
  if (raw === "rooms" || raw === "results") return raw;
  return "overview";
}
