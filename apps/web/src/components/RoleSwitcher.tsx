"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  learner: "Học viên",
  instructor: "Giảng viên",
  admin: "Quản trị",
  mentor: "Mentor",
};

const ROLE_DEFAULT_PATH: Record<string, string> = {
  admin: "/admin/dashboard",
  instructor: "/instructor/dashboard",
  mentor: "/me/dashboard",
  learner: "/me/dashboard",
};

export default function RoleSwitcher({
  roles,
  activeRole,
  variant = "header",
}: {
  roles: string[];
  activeRole: string;
  variant?: "header" | "menu";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (roles.length <= 1) return null;

  async function switchTo(role: string) {
    if (role === activeRole || busy) return;
    setBusy(true);
    await fetch("/api/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    router.push(ROLE_DEFAULT_PATH[role] ?? "/me/dashboard");
    router.refresh();
    setBusy(false);
  }

  if (variant === "menu") {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-1">
        {roles.map((role) => {
          const isActive = role === activeRole;
          return (
            <button
              key={role}
              onClick={() => switchTo(role)}
              disabled={busy || isActive}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${
                isActive
                  ? "bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--text))] shadow-sm"
                  : "text-muted hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--text))]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${isActive ? "bg-brand-500" : "bg-transparent border border-muted"}`}
              />
              {ROLE_LABELS[role] ?? role}
              {isActive && (
                <span className="ml-auto text-[10px] text-muted">Hiện tại</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // header variant: compact pill tabs
  return (
    <div
      className={`flex items-center rounded-full border border-token bg-[rgb(var(--surface-muted))] p-0.5 gap-0.5 transition-opacity ${busy ? "opacity-60" : ""}`}
    >
      {roles.map((role) => {
        const isActive = role === activeRole;
        return (
          <button
            key={role}
            onClick={() => switchTo(role)}
            disabled={busy || isActive}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              isActive
                ? "bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm"
                : "text-muted hover:text-[rgb(var(--text))]"
            }`}
          >
            {ROLE_LABELS[role] ?? role}
          </button>
        );
      })}
    </div>
  );
}
