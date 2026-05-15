"use client";

import Link from "next/link";
import { DoorOpen, FileText } from "lucide-react";
import type { SessionTab } from "./session-tabs-helpers";

const TABS: Array<{ key: SessionTab; label: string; Icon: typeof FileText }> = [
  { key: "overview", label: "Tổng quan", Icon: FileText },
  { key: "rooms", label: "Phòng thi", Icon: DoorOpen },
];

export default function SessionTabs({
  roundId,
  sessionId,
  active,
}: {
  roundId: string;
  sessionId: string;
  active: SessionTab;
}) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-default">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const base = `/instructor/exam-rounds/${roundId}/sessions/${sessionId}`;
        const href = t.key === "overview" ? base : `${base}?tab=${t.key}`;
        const Icon = t.Icon;
        return (
          <Link
            key={t.key}
            href={href}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? "-mb-px border-blue-500 font-semibold text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon size={14} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
