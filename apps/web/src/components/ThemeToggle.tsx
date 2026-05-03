"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "fbm-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const wantsDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", wantsDark);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
    // Listen for system preference change when in system mode.
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem(STORAGE_KEY) ?? "system") === "system") {
        applyTheme("system");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function pick(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
    applyTheme(next);
  }

  // Render a placeholder with the same dimensions before mount, so layout doesn't shift.
  if (!mounted) {
    return <div className="h-8 w-[88px]" aria-hidden />;
  }

  const items: Array<{ value: Theme; label: string; icon: string }> = [
    { value: "light", label: "Light", icon: "☀" },
    { value: "system", label: "System", icon: "◐" },
    { value: "dark", label: "Dark", icon: "☾" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-0.5"
    >
      {items.map((it) => {
        const active = theme === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={it.label}
            onClick={() => pick(it.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
              active
                ? "bg-brand-gradient text-white shadow-sm"
                : "text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
            }`}
          >
            <span aria-hidden>{it.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
