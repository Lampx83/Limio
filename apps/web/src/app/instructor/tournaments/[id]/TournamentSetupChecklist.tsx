"use client";

import { Check, Circle, CircleDot } from "lucide-react";
import type { SetupStep, SetupTab } from "@/lib/tournamentSetup";

export default function TournamentSetupChecklist({
  steps,
  onGoTab,
}: {
  steps: SetupStep[];
  onGoTab: (tab: SetupTab) => void;
}) {
  const todo = steps.filter((s) => s.state === "todo" && s.id !== "publish").length;
  return (
    <section className="rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4" aria-label="Các bước thiết lập">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Thiết lập đấu trường</h2>
        <p className="text-sm text-muted">
          {todo === 0 ? "Đã đủ để công bố." : `Còn ${todo} việc cần làm trước khi công bố.`}
        </p>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const Icon = s.state === "done" ? Check : s.state === "todo" ? CircleDot : Circle;
          const body = (
            <>
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  s.state === "done"
                    ? "border-success-600 bg-success-50 text-success-700"
                    : s.state === "todo"
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-token text-muted"
                }`}
              >
                <Icon size={12} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {i + 1}. {s.label}
                  {s.state === "optional" && <span className="ml-2 text-xs font-normal text-muted">Tuỳ chọn</span>}
                </span>
                <span className="block text-xs text-muted">{s.hint}</span>
              </span>
            </>
          );
          return (
            <li key={s.id}>
              {s.tab ? (
                <button
                  type="button"
                  onClick={() => onGoTab(s.tab!)}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[rgb(var(--surface))]"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-3 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
