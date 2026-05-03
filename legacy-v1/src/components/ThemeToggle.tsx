"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "fbm_theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = t === "dark" || (t === "system" && sysDark);
  root.classList.toggle("dark", isDark);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(saved);
    setMounted(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const cur = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
      if (cur === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function setAndPersist(t: Theme) {
    setTheme(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  // Avoid hydration mismatch: render placeholder until mounted
  if (!mounted) {
    return (
      <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 p-0.5 opacity-0">
        <button className="px-2 py-1 text-xs">L</button>
      </div>
    );
  }

  const Btn = ({
    value,
    label,
    icon,
  }: {
    value: Theme;
    label: string;
    icon: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => setAndPersist(value)}
      title={label}
      aria-label={label}
      aria-pressed={theme === value}
      className={`flex items-center justify-center w-7 h-7 rounded transition ${
        theme === value
          ? "bg-brand-600 text-white"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
      <Btn
        value="light"
        label="Sáng"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        }
      />
      <Btn
        value="dark"
        label="Tối"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        }
      />
      <Btn
        value="system"
        label="Theo hệ thống"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
        }
      />
    </div>
  );
}
