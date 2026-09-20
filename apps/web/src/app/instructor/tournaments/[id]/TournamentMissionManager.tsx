"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";
import { tournamentErrorMessage } from "@/lib/tournamentText";
import MissionForm, { type MissionTemplate, type SkillGroup } from "./MissionForm";

// ── Types ─────────────────────────────────────────────────────────────────────

type MissionType = "COURSE_LINKED" | "CUSTOM" | "EXTERNAL";
type VerifyMode = "AUTO_GRADE" | "AUTO_CHECK" | "PEER_REVIEW" | "MANUAL_REVIEW";
type RubricCriterion = {
  id: string;
  label: string;
  scale: "1-5" | "pass_fail";
  weight: number;
};

interface Mission {
  id: string;
  title: string;
  description: string;
  points: number;
  orderIndex: number;
  prerequisiteId: string | null;
  conditionType: string | null;
  conditionValue: number | null;
  conditionScope: string | null;
  conditionMinScore: number | null;
  conditionSkillCode: string | null;
  missionType?: MissionType;
  verifyMode?: VerifyMode | null;
  submissionDeadline?: string | Date | null;
  passThreshold?: number | null;
  peerReviewerCount?: number | null;
  reviewQuorum?: number | null;
  peerReviewCaptainsOnly?: boolean;
  reviewWindowEndAt?: string | Date | null;
  rubric?: RubricCriterion[] | null;
  contentPayload?: { url?: string; instructions?: string; markdown?: string } | null;
  autoCheckRule?: { type?: string; config?: Record<string, unknown> } | null;
  isTeamSubmission?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Human-readable label for a conditionType string. */
function conditionLabel(type: string | null): string {
  if (!type) return "Thủ công";
  const MAP: Record<string, string> = {
    lesson_completed_count:       "Hoàn thành bài học",
    quiz_passed_count:            "Vượt bài kiểm tra",
    quiz_passed_min_score:        "Vượt bài kiểm tra đạt điểm tối thiểu",
    quiz_first_pass:              "Đạt ngay lần đầu",
    quiz_passed_perfect:          "Đạt điểm tuyệt đối",
    streak_days:                  "Học liên tục",
    misconception_resolved_count: "Sửa lỗi tư duy",
    skill_mastered_count:         "Thành thạo kỹ năng bất kỳ",
    skill_mastered_in_group:      "Thành thạo kỹ năng trong nhóm",
    assignment_graded_min_score:  "Nộp bài được chấm",
    h5p_completed_count:          "Hoàn thành H5P",
  };
  return MAP[type] ?? type;
}

function verifyModeLabel(v: VerifyMode): string {
  return {
    AUTO_GRADE: "Làm bài kiểm tra",
    AUTO_CHECK: "Nộp liên kết hoặc tệp",
    PEER_REVIEW: "Chấm chéo",
    MANUAL_REVIEW: "Bạn chấm",
  }[v];
}

/** Short condition summary shown on mission card. */
function conditionSummary(m: Mission): string | null {
  if (!m.conditionType || !m.conditionValue) return null;
  const base = `${conditionLabel(m.conditionType)} × ${m.conditionValue}`;
  if (m.conditionMinScore) return `${base} (≥ ${m.conditionMinScore}%)`;
  if (m.conditionSkillCode) return `${base} — nhóm "${m.conditionSkillCode}"`;
  return base;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TournamentMissionManager({
  tournamentId,
  courseId,
  status,
  missions: initialMissions,
  teamSize = 1,
  pendingCounts = {},
  tournamentWindow,
}: {
  tournamentId: string;
  courseId: string | null;
  status: string;
  missions: Mission[];
  teamSize?: number;
  /** Khoảng thời gian của giải (ISO) — form nhiệm vụ dùng để kiểm tra hạn nộp. */
  tournamentWindow: { startsAt: string; endsAt: string };
  /** missionId → số bài đang chờ chấm (status=pending). */
  pendingCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const tournament = { ...tournamentWindow, teamSize, status };

  // Template catalog + skill groups loaded once on mount.
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [skillGroups, setSkillGroups] = useState<SkillGroup[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    fetch(apiUrl("/api/mission-templates"))
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});

    if (courseId) {
      fetch(apiUrl(`/api/courses/${courseId}/skill-groups`))
        .then((r) => r.json())
        .then((d) => setSkillGroups(d.groups ?? []))
        .catch(() => {});
    }
  }, [courseId]);

  const isDraft = status === "draft";
  const canAdd = status === "draft" || status === "published";

  async function removeMission(missionId: string) {
    if (!confirm("Xoá nhiệm vụ này?")) return;
    setDeleting(missionId);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournament-missions/${missionId}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setMissions((prev) => prev.filter((m) => m.id !== missionId));
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(tournamentErrorMessage(d, "Chưa xoá được nhiệm vụ. Vui lòng thử lại."));
      }
    } catch {
      setError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setDeleting(null);
    }
  }

  // Form vẫn mở để hiện màn hình "Đã thêm nhiệm vụ"; chỉ cập nhật danh sách phía sau.
  function onMissionAdded(m: Mission | null) {
    if (m) setMissions((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  function onMissionUpdated(m: Mission) {
    setMissions((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
    setEditingId(null);
    router.refresh();
  }

  const canEdit = status !== "ended";

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Nhiệm vụ</h2>
        <span className="text-sm text-muted">{missions.length} nhiệm vụ</span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger-600">{error}</p>
      )}

      {/* Mission list */}
      {missions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
          Chưa có nhiệm vụ nào. Thêm nhiệm vụ đầu tiên bên dưới.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {missions.map((m) => {
            const prereq = m.prerequisiteId
              ? missions.find((x) => x.id === m.prerequisiteId)
              : null;
            const summary = conditionSummary(m);
            if (editingId === m.id) {
              return (
                <li key={m.id}>
                  <MissionForm
                    kind="edit"
                    tournamentId={tournamentId}
                    tournament={tournament}
                    mission={m}
                    missions={missions}
                    templates={templates}
                    skillGroups={skillGroups}
                    onSaved={(updated) => {
                      if (updated) onMissionUpdated(updated as Mission);
                      else setEditingId(null);
                    }}
                    onClose={() => { setEditingId(null); setError(null); }}
                  />
                </li>
              );
            }
            return (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-700">
                    {m.orderIndex}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    {m.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {m.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-xs text-faint">
                        {m.points} điểm
                      </span>
                      {m.missionType && m.missionType !== "COURSE_LINKED" && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent-700">
                          {m.verifyMode ? verifyModeLabel(m.verifyMode) : "Tự thiết kế"}
                          {m.missionType === "EXTERNAL" && " · làm ở trang khác"}
                        </span>
                      )}
                      {summary && (
                        <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand-700">
                          {summary}
                        </span>
                      )}
                      {prereq && (
                        <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-xs text-faint">
                          Cần xong trước: {prereq.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  {m.verifyMode === "AUTO_GRADE" && (
                    <Link
                      href={`/instructor/tournaments/${tournamentId}/missions/${m.id}/quiz`}
                      className="text-xs text-brand-700 hover:underline"
                      prefetch={false}
                    >
                      Sửa câu hỏi →
                    </Link>
                  )}
                  {m.verifyMode && (() => {
                    const needsGrading =
                      m.verifyMode === "MANUAL_REVIEW" ||
                      m.verifyMode === "PEER_REVIEW";
                    const pending = pendingCounts[m.id] ?? 0;
                    const label =
                      m.verifyMode === "MANUAL_REVIEW"
                        ? "Chấm bài"
                        : m.verifyMode === "PEER_REVIEW"
                          ? "Quản lý chấm chéo"
                          : "Xem bài nộp";
                    return (
                      <Link
                        href={`/instructor/tournaments/${tournamentId}/missions/${m.id}/submissions`}
                        className={
                          needsGrading
                            ? "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                            : "text-xs text-brand-700 hover:underline"
                        }
                        prefetch={false}
                      >
                        {label}
                        {needsGrading && pending > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-brand-700">
                            {pending}
                          </span>
                        )}
                        <span aria-hidden>→</span>
                      </Link>
                    );
                  })()}
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => { setEditingId(m.id); setError(null); }}
                        className="text-xs text-brand-700 hover:underline"
                      >
                        Sửa
                      </button>
                    )}
                    {isDraft && (
                      <button
                        onClick={() => removeMission(m.id)}
                        disabled={deleting === m.id}
                        className="text-xs text-danger-600 hover:text-danger-700 disabled:opacity-50"
                      >
                        {deleting === m.id ? "..." : "Xoá"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add mission */}
      {canAdd && (
        <div className="mt-4">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-secondary btn-sm">
              Thêm nhiệm vụ
            </button>
          ) : (
            <MissionForm
              kind="add"
              tournamentId={tournamentId}
              tournament={tournament}
              missions={missions}
              templates={templates}
              skillGroups={skillGroups}
              onSaved={onMissionAdded}
              onClose={() => { setShowForm(false); setError(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
