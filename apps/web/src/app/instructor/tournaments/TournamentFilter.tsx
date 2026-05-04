"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function TournamentFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "all");

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const params = new URLSearchParams(searchParams);
    if (newStatus === "all") {
      params.delete("status");
    } else {
      params.set("status", newStatus);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
        Trạng thái:
      </span>
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Tất cả" },
          { value: "draft", label: "Nháp" },
          { value: "published", label: "Đã publish" },
          { value: "active", label: "Đang diễn ra" },
          { value: "ended", label: "Đã kết thúc" },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              status === option.value
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-token bg-[rgb(var(--surface))] text-muted hover:text-[rgb(var(--text))]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
