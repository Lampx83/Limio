"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOAL_PACE_LABEL, LANGUAGE_SKILL_LABEL, MASTERY_LABEL_TEXT } from "@feedbackme/shared-types";
import type { GoalProgress } from "@feedbackme/core-feedback";
import type { GoalView, SectionGoalView } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import GoalForm, { goalErrorText, type GoalFormValues } from "@/components/goals/GoalForm";

export interface LearnerGoalRow {
  userId: string;
  displayName: string;
  goal: GoalView | null;
  source: "personal" | "section" | "none";
  effectiveGoal: { targetLevel: string; targetDate: string | null; hoursPerWeek: number | null } | null;
  progress: GoalProgress | null;
}

const dmy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "chưa có hạn");

const PACE_CHIP: Record<string, string> = {
  ahead: "chip-success",
  on_track: "chip-success",
  behind: "chip-danger",
  overdue: "chip-danger",
  too_early: "chip",
  no_hours_target: "chip",
};

/**
 * CENTER C6.4, C6.6 — mục tiêu của lớp và mục tiêu từng học viên, cho giáo viên. Tiến độ chỉ là gợi ý (nhãn và nhận định),
 * không có số mastery. Người chỉ dạy được xem và đặt hộ cho học viên của lớp mình; mục tiêu của lớp chỉ người quản khoá.
 */
export default function SectionGoalsCard({
  sectionId,
  courseId,
  canManage,
  sectionGoal,
  rows,
}: {
  sectionId: string;
  courseId: string;
  canManage: boolean;
  sectionGoal: SectionGoalView | null;
  rows: LearnerGoalRow[];
}) {
  const router = useRouter();
  const [editingClass, setEditingClass] = useState(false);
  const [settingFor, setSettingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveClass = async (v: GoalFormValues): Promise<string | null> => {
    const r = await fetch(apiUrl(`/api/sections/${sectionId}/goal`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: { framework: v.framework, targetLevel: v.targetLevel, targetDate: v.targetDate || null, hoursPerWeek: v.hoursPerWeek } }),
    });
    if (!r.ok) return goalErrorText(((await r.json().catch(() => ({}))) as { error?: string }).error);
    setEditingClass(false);
    router.refresh();
    return null;
  };

  const clearClass = async () => {
    if (!window.confirm("Bỏ mục tiêu của lớp? Mục tiêu riêng của học viên không bị đổi.")) return;
    const r = await fetch(apiUrl(`/api/sections/${sectionId}/goal`), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: null }) });
    if (!r.ok) setError(goalErrorText(((await r.json().catch(() => ({}))) as { error?: string }).error));
    else router.refresh();
  };

  const setForLearner = (userId: string) => async (v: GoalFormValues): Promise<string | null> => {
    const r = await fetch(apiUrl("/api/goals"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, courseId, framework: v.framework, targetLevel: v.targetLevel, targetDate: v.targetDate, hoursPerWeek: v.hoursPerWeek }),
    });
    if (!r.ok) return goalErrorText(((await r.json().catch(() => ({}))) as { error?: string }).error);
    setSettingFor(null);
    router.refresh();
    return null;
  };

  return (
    <section className="card mt-6 space-y-4 p-4" aria-label="Mục tiêu học tập">
      <div>
        <h2 className="text-h3">Mục tiêu học tập</h2>
        <p className="text-meta text-muted">
          Mục tiêu của lớp là gợi ý cho học viên, mỗi em có thể dùng hoặc tự đặt riêng. Tiến độ chỉ là gợi ý, không phải đánh giá.
        </p>
      </div>
      {error && <p className="banner-danger text-sm" role="alert">{error}</p>}

      <div className="rounded-lg border border-token p-3">
        <p className="text-sm font-semibold">Mục tiêu của lớp</p>
        {editingClass ? (
          <div className="mt-2">
            <GoalForm
              dateOptional
              initial={sectionGoal ? { framework: sectionGoal.framework, targetLevel: sectionGoal.targetLevel, targetDate: sectionGoal.targetDate ?? "", hoursPerWeek: sectionGoal.hoursPerWeek } : undefined}
              submitLabel="Lưu mục tiêu của lớp"
              onCancel={() => setEditingClass(false)}
              onSubmit={saveClass}
            />
          </div>
        ) : sectionGoal ? (
          <p className="mt-1 text-sm">
            {sectionGoal.targetLevel} · hạn {dmy(sectionGoal.targetDate)}
            {sectionGoal.hoursPerWeek != null ? ` · ${sectionGoal.hoursPerWeek} giờ/tuần` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Lớp chưa đặt mục tiêu.</p>
        )}
        {canManage && !editingClass && (
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEditingClass(true)}>
              {sectionGoal ? "Đổi mục tiêu của lớp" : "Đặt mục tiêu của lớp"}
            </button>
            {sectionGoal && (
              <button type="button" className="btn-ghost btn-sm" onClick={clearClass}>
                Bỏ mục tiêu của lớp
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-meta text-muted">
              <th className="py-2 pr-3 font-medium">Học viên</th>
              <th className="py-2 pr-3 font-medium">Mục tiêu</th>
              <th className="py-2 pr-3 font-medium">Nhận định</th>
              <th className="py-2 font-medium">Tiến độ theo nhãn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-token align-top">
                <td className="py-2 pr-3 font-medium">{r.displayName}</td>
                <td className="py-2 pr-3">
                  {r.effectiveGoal ? (
                    <>
                      {r.effectiveGoal.targetLevel} · {dmy(r.effectiveGoal.targetDate)}
                      {r.effectiveGoal.hoursPerWeek != null ? ` · ${r.effectiveGoal.hoursPerWeek} giờ/tuần` : ""}
                      {r.source === "section" && <span className="chip-brand ml-1 text-xs">theo lớp</span>}
                    </>
                  ) : (
                    <span className="text-muted">Chưa có</span>
                  )}
                  {!r.goal && settingFor !== r.userId && (
                    <button type="button" className="btn-ghost btn-sm ml-2" onClick={() => setSettingFor(r.userId)}>
                      Đặt mục tiêu
                    </button>
                  )}
                  {settingFor === r.userId && (
                    <div className="mt-2 min-w-72">
                      <GoalForm submitLabel="Lưu mục tiêu cho học viên" onCancel={() => setSettingFor(null)} onSubmit={setForLearner(r.userId)} />
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {r.progress ? <span className={`${PACE_CHIP[r.progress.pace.status]} text-xs`}>{GOAL_PACE_LABEL[r.progress.pace.status]}</span> : "—"}
                </td>
                <td className="py-2">
                  {r.progress?.skills?.some((s) => s.lessonsTotal > 0) ? (
                    <span className="flex flex-wrap gap-1">
                      {r.progress.skills.filter((s) => s.lessonsTotal > 0).map((s) => (
                        <span key={s.skill} className="chip text-xs">
                          {LANGUAGE_SKILL_LABEL[s.skill]}: {MASTERY_LABEL_TEXT[s.label]}
                        </span>
                      ))}
                    </span>
                  ) : r.progress?.overall ? (
                    <span className="chip text-xs">Tổng quan: {MASTERY_LABEL_TEXT[r.progress.overall.label]}</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-muted">Lớp chưa có học viên.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
