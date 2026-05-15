"use client";

import Link from "next/link";
import { FileText, GraduationCap, Layers, Users } from "lucide-react";
import type { RoundTab } from "./round-tabs-helpers";

const TABS: Array<{ key: RoundTab; label: string; Icon: typeof FileText }> = [
  { key: "overview", label: "Tổng quan", Icon: FileText },
  { key: "sessions", label: "Ca thi", Icon: Layers },
  { key: "cohorts", label: "Phòng thi", Icon: GraduationCap },
  { key: "admins", label: "Trưởng đợt", Icon: Users },
];

export default function RoundTabs({
  roundId,
  active,
}: {
  roundId: string;
  active: RoundTab;
}): React.JSX.Element {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-default">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const href =
          t.key === "overview"
            ? `/instructor/exam-rounds/${roundId}`
            : `/instructor/exam-rounds/${roundId}?tab=${t.key}`;
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
