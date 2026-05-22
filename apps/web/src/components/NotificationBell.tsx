"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Star,
  CheckCircle2,
  MessageSquare,
  Trophy,
  XCircle,
  Award,
  TrendingUp,
  ArrowUpRight,
  Inbox,
  PenLine,
  Eye,
  HelpCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

type Noti = {
  id: string;
  type: string;
  title: string;
  body?: string;
  link: string;
  iconKey: string;
  createdAt: string;
};

const ICON: Record<string, { Icon: typeof Bell; cls: string }> = {
  review:       { Icon: Star,         cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  graded:       { Icon: CheckCircle2, cls: "bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300" },
  reply:        { Icon: MessageSquare,cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  mission_ok:   { Icon: Trophy,       cls: "bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300" },
  mission_fail: { Icon: XCircle,      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  badge:        { Icon: Award,        cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  level_up:     { Icon: ArrowUpRight, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  rank:         { Icon: TrendingUp,   cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  inbox:           { Icon: Inbox,      cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  essay:           { Icon: PenLine,    cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  mission_review:  { Icon: Eye,        cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  question:        { Icon: HelpCircle, cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
};

function relative(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}n`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function NotificationBell({
  initialUnread,
  initialLastSeen,
  role = "learner",
}: {
  initialUnread: number;
  initialLastSeen: string | null;
  role?: "learner" | "instructor" | "admin" | "mentor";
}) {
  const qs = `?role=${role}`;
  const allHref =
    role === "instructor" ? "/instructor/notifications" : "/me/notifications";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [lastSeen, setLastSeen] = useState<string | null>(initialLastSeen);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/notifications${qs}`));
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setUnread(data.unread);
        setLastSeen(data.lastSeenAt);
      }
    } finally {
      setLoading(false);
    }
  }

  async function markSeen() {
    await fetch(apiUrl(`/api/notifications/seen${qs}`), { method: "POST" });
    setUnread(0);
    setLastSeen(new Date().toISOString());
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      load();
      if (unread > 0) markSeen();
    }
  }

  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `${unread} thông báo chưa đọc` : "Thông báo"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--text-muted))] transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
      >
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-2xl">
          <header className="flex items-center justify-between border-b border-token px-4 py-3">
            <p className="text-sm font-semibold">Thông báo</p>
            <Link
              href={allHref}
              onClick={() => setOpen(false)}
              className="text-xs text-brand-700 hover:underline dark:text-brand-300"
            >
              Xem tất cả
            </Link>
          </header>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items === null ? (
              <div className="p-6 text-center text-sm text-faint">Đang tải...</div>
            ) : items && items.length > 0 ? (
              <ul className="divide-y divide-token">
                {items.map((n) => {
                  const ic = ICON[n.iconKey] ?? ICON.review!;
                  const Icon = ic.Icon;
                  const isNew = new Date(n.createdAt).getTime() > lastSeenMs;
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.link}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[rgb(var(--surface-muted))] ${isNew ? "bg-brand-soft/40" : ""}`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ic.cls}`}
                        >
                          <Icon size={16} strokeWidth={2.5} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="truncate text-xs text-muted">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] text-faint">
                            {relative(n.createdAt)}
                          </p>
                        </div>
                        {isNew && (
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="text-3xl">🔕</div>
                <p className="mt-3 text-sm font-medium">Chưa có thông báo</p>
                <p className="mt-1 text-xs text-muted">
                  Tin mới về bài tập, peer review, forum sẽ hiện ở đây.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
