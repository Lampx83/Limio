import { cookies } from "next/headers";

export const ACTIVE_ROLE_COOKIE = "fbm-active-role";

// Priority order when no saved preference exists
const ROLE_PRIORITY = ["admin", "instructor", "mentor", "learner"];

export function getActiveRole(roles: string[]): string {
  if (roles.length === 0) return "learner";
  const saved = cookies().get(ACTIVE_ROLE_COOKIE)?.value;
  if (saved && roles.includes(saved)) return saved;
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0]!;
}

export const ROLE_DEFAULT_PATH: Record<string, string> = {
  admin: "/admin/dashboard",
  instructor: "/instructor/dashboard",
  mentor: "/me/dashboard",
  learner: "/me/dashboard",
};
