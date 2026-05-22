"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";
import { isMissionTeamCompatible } from "@feedbackme/core-gamification";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

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
  submissionDeadline?: string | null;
  passThreshold?: number | null;
  peerReviewerCount?: number | null;
  reviewWindowEndAt?: string | null;
}

interface MissionTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  emoji: string | null;
  conditionType: string;
  defaultValue: number;
  defaultMinScore: number | null;
  hasMinScore: boolean;
  requiresSkillGroup: boolean;
}

interface SkillGroup {
  prefix: string;
  label: string;
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Human-readable label for a conditionType string. */
function conditionLabel(type: string | null): string {
  if (!type) return "Thủ công";
  const MAP: Record<string, string> = {
    lesson_completed_count:       "Hoàn thành bài học",
    quiz_passed_count:            "Vượt quiz",
    quiz_passed_min_score:        "Vượt quiz điểm tối thiểu",
    quiz_first_pass:              "Pass ngay lần đầu",
    quiz_passed_perfect:          "Đạt điểm tuyệt đối",
    streak_days:                  "Học liên tục",
    misconception_resolved_count: "Sửa lỗi tư duy",
    skill_mastered_count:         "Master skill bất kỳ",
    skill_mastered_in_group:      "Master skill trong nhóm",
    assignment_graded_min_score:  "Nộp bài được chấm",
    h5p_completed_count:          "Hoàn thành H5P",
  };
  return MAP[type] ?? type;
}

function verifyModeLabel(v: VerifyMode): string {
  return {
    AUTO_GRADE:    "Quiz",
    AUTO_CHECK:    "Kiểm tra tự động",
    PEER_REVIEW:   "Bạn học chấm",
    MANUAL_REVIEW: "Giảng viên chấm",
  }[v];
}

function verifyModeDescription(v: VerifyMode): string {
  return {
    AUTO_GRADE:    "Học viên làm quiz, hệ thống chấm theo đáp án có sẵn",
    AUTO_CHECK:    "Kiểm tra URL khớp regex, định dạng file, hoặc gọi webhook",
    PEER_REVIEW:   "N bạn học cùng đợt chấm theo rubric, lấy điểm median",
    MANUAL_REVIEW: "Bạn chấm tay qua flow Assignment có sẵn",
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
}: {
  tournamentId: string;
  courseId: string | null;
  status: string;
  missions: Mission[];
  teamSize?: number;
}) {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
    const res = await fetch(apiUrl(`/api/tournament-missions/${missionId}`), {
      method: "DELETE",
    });
    setDeleting(null);
    if (res.ok) {
      setMissions((prev) => prev.filter((m) => m.id !== missionId));
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "delete_failed");
    }
  }

  function onMissionAdded(m: Mission) {
    setMissions((prev) => [...prev, m]);
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Nhiệm vụ</h2>
        <span className="text-sm text-muted">{missions.length} nhiệm vụ</span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger-600">Lỗi: {error}</p>
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
                        {m.points} pts
                      </span>
                      {m.missionType && m.missionType !== "COURSE_LINKED" && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent-700">
                          {m.missionType === "CUSTOM" ? "Tự thiết kế" : "Liên kết ngoài"}
                          {m.verifyMode && ` · ${verifyModeLabel(m.verifyMode)}`}
                        </span>
                      )}
                      {summary && (
                        <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand-700">
                          {summary}
                        </span>
                      )}
                      {prereq && (
                        <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-xs text-faint">
                          🔒 Cần: {prereq.title}
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
                    >
                      Sửa câu hỏi →
                    </Link>
                  )}
                  {m.verifyMode === "MANUAL_REVIEW" && (
                    <span className="text-xs text-faint">
                      Chấm trong tab Assignment
                    </span>
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
              + Thêm nhiệm vụ
            </button>
          ) : (
            <AddMissionForm
              tournamentId={tournamentId}
              missions={missions}
              templates={templates}
              skillGroups={skillGroups}
              onAdded={onMissionAdded}
              onCancel={() => { setShowForm(false); setError(null); }}
              setError={setError}
              teamSize={teamSize}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── AddMissionForm ─────────────────────────────────────────────────────────

function AddMissionForm({
  tournamentId,
  missions,
  templates,
  skillGroups,
  onAdded,
  onCancel,
  setError,
  teamSize,
}: {
  tournamentId: string;
  missions: Mission[];
  templates: MissionTemplate[];
  skillGroups: SkillGroup[];
  onAdded: (m: Mission) => void;
  onCancel: () => void;
  teamSize: number;
  setError: (e: string | null) => void;
}) {
  // ── Form state ────────────────────────────────────────────────────────
  const [missionType, setMissionType] = useState<MissionType>("COURSE_LINKED");
  const [verifyMode, setVerifyMode] = useState<VerifyMode | "">("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState("100");
  const [prereqId, setPrereqId] = useState("");

  // COURSE_LINKED: template + condition fields
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const [conditionValue, setConditionValue] = useState("");
  const [conditionMinScore, setConditionMinScore] = useState("");
  const [conditionSkillCode, setConditionSkillCode] = useState("");
  const [conditionScope, setConditionScope] = useState<"course" | "global">("course");

  // Custom mission fields
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [autoCheckType, setAutoCheckType] = useState<"url_pattern" | "file_format" | "webhook">("url_pattern");
  const [autoCheckRegex, setAutoCheckRegex] = useState("");
  const [autoCheckMime, setAutoCheckMime] = useState("");
  const [autoCheckWebhook, setAutoCheckWebhook] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([
    { id: "clarity", label: "Mức độ rõ ràng", scale: "1-5", weight: 1 },
  ]);
  const [peerReviewerCount, setPeerReviewerCount] = useState("3");
  const [reviewWindowEndAt, setReviewWindowEndAt] = useState("");
  const [passThreshold, setPassThreshold] = useState("0.6");
  const [isTeamSubmission, setIsTeamSubmission] = useState(false);

  const [busy, setBusy] = useState(false);

  // Reset verifyMode when switching missionType.
  function switchType(t: MissionType) {
    setMissionType(t);
    if (t === "COURSE_LINKED") setVerifyMode("");
    else if (t === "EXTERNAL" && verifyMode === "AUTO_GRADE") setVerifyMode("");
    else if (t === "EXTERNAL" && verifyMode === "PEER_REVIEW") setVerifyMode("");
  }

  // When template changes, seed defaults
  function handleTemplateChange(tmplId: string) {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl) {
      setConditionValue(String(tmpl.defaultValue));
      setConditionMinScore(tmpl.defaultMinScore ? String(tmpl.defaultMinScore) : "");
      setConditionSkillCode("");
      // Pre-fill title from template if empty
      if (!title) setTitle(tmpl.name);
      if (!desc) setDesc(plainToRichHtml(tmpl.description));
    } else {
      setConditionValue("");
      setConditionMinScore("");
      setConditionSkillCode("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      title,
      description: desc,
      points: parseInt(points, 10) || 100,
      missionType,
    };
    if (prereqId) payload.prerequisiteId = prereqId;

    if (missionType === "COURSE_LINKED") {
      if (selectedTemplateId) payload.templateId = selectedTemplateId;
      if (conditionValue) payload.conditionValue = parseInt(conditionValue, 10);
      if (conditionMinScore) payload.conditionMinScore = parseInt(conditionMinScore, 10);
      if (conditionSkillCode) payload.conditionSkillCode = conditionSkillCode;
      payload.conditionScope = conditionScope;
    } else {
      payload.verifyMode = verifyMode;
      payload.submissionDeadline = submissionDeadline
        ? new Date(submissionDeadline).toISOString()
        : null;
      // For CUSTOM: description field (rich-text HTML) IS the content; no
      // separate contentPayload.markdown. EXTERNAL only stores the URL.
      if (missionType === "EXTERNAL") {
        payload.contentPayload = { url: externalUrl };
      }
      if (verifyMode === "AUTO_CHECK") {
        payload.autoCheckRule = {
          type: autoCheckType,
          config:
            autoCheckType === "url_pattern"
              ? { regex: autoCheckRegex }
              : autoCheckType === "file_format"
                ? { mime: autoCheckMime.split(",").map((s) => s.trim()).filter(Boolean) }
                : { endpoint: autoCheckWebhook },
        };
      }
      if (verifyMode === "PEER_REVIEW") {
        payload.rubric = rubric;
        payload.peerReviewerCount = parseInt(peerReviewerCount, 10) || 3;
        payload.reviewWindowEndAt = reviewWindowEndAt
          ? new Date(reviewWindowEndAt).toISOString()
          : null;
        payload.passThreshold = parseFloat(passThreshold);
      }
      if (verifyMode === "MANUAL_REVIEW") {
        payload.passThreshold = parseFloat(passThreshold);
      }
      // COLLECTIVE team submission — only sent when team-based + non-quiz.
      if (
        teamSize > 1 &&
        verifyMode &&
        verifyMode !== "AUTO_GRADE" &&
        isTeamSubmission
      ) {
        payload.isTeamSubmission = true;
      }
    }

    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/missions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (res.ok) {
      const { missionId } = await res.json();
      // AUTO_GRADE → jump straight to the quiz editor so instructor can add
      // questions to the auto-created hidden Quiz.
      if (verifyMode === "AUTO_GRADE") {
        window.location.href = `/instructor/tournaments/${tournamentId}/missions/${missionId}/quiz`;
        return;
      }
      // Otherwise refresh the mission list inline.
      const listRes = await fetch(apiUrl(`/api/tournaments/${tournamentId}/missions`));
      if (listRes.ok) {
        const { missions: fresh } = await listRes.json();
        const added = fresh.find((m: Mission) => m.id === missionId);
        if (added) onAdded(added);
      }
    } else {
      const d = await res.json().catch(() => ({}));
      const details = d.details
        ? typeof d.details === "string"
          ? d.details
          : JSON.stringify(d.details)
        : d.error ?? "add_failed";
      setError(details);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 overflow-hidden rounded-2xl border-2 border-brand-200 bg-[rgb(var(--surface))] shadow-md"
    >
      {/* Form header */}
      <div className="flex items-center justify-between border-b border-token bg-brand-soft/40 px-5 py-3">
        <h3 className="text-sm font-bold text-brand-800">Thêm nhiệm vụ mới</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Đóng"
          className="text-faint hover:text-[rgb(var(--text))]"
        >
          ✕
        </button>
      </div>

      <div className="space-y-6 p-5">
      {/* ═══ Step 1 — Type ═══════════════════════════════════════════ */}
      <FormSection step={1} title="Loại nhiệm vụ">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            { v: "COURSE_LINKED", t: "Hành vi học tập", d: "Auto theo nội dung khoá" },
            { v: "CUSTOM",        t: "Tự thiết kế",     d: "Soạn nội dung riêng" },
            { v: "EXTERNAL",      t: "Liên kết ngoài",   d: "Trỏ URL/tool 3rd-party" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => switchType(opt.v)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left text-xs transition-all ${
                missionType === opt.v
                  ? "border-brand-500 bg-brand-soft text-brand-800 shadow-sm"
                  : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
              }`}
            >
              <p className="font-semibold">{opt.t}</p>
              <p className="mt-0.5 text-faint">{opt.d}</p>
            </button>
          ))}
        </div>

        {missionType !== "COURSE_LINKED" && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted">
              Cách xác minh hoàn thành
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(missionType === "EXTERNAL"
                ? (["AUTO_CHECK", "MANUAL_REVIEW"] as const)
                : (["AUTO_GRADE", "AUTO_CHECK", "PEER_REVIEW", "MANUAL_REVIEW"] as const)
              ).map((vm) => (
                <button
                  key={vm}
                  type="button"
                  onClick={() => setVerifyMode(vm)}
                  className={`rounded-lg border-2 px-3 py-2 text-left text-xs transition-all ${
                    verifyMode === vm
                      ? "border-accent-500 bg-accent-soft text-accent-800 shadow-sm"
                      : "border-token bg-[rgb(var(--surface))] hover:border-accent-300"
                  }`}
                >
                  <p className="font-semibold">{verifyModeLabel(vm)}</p>
                  <p className="mt-0.5 text-faint">{verifyModeDescription(vm)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      {/* ═══ Step 2 — Basic info ═══════════════════════════════════ */}
      <FormSection step={2} title="Thông tin">
      <div>
        <label className="label text-xs" htmlFor="nm-title">Tiêu đề nhiệm vụ</label>
        <input
          id="nm-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder={
            missionType === "COURSE_LINKED"
              ? "Ví dụ: Hoàn thành 5 quiz"
              : missionType === "EXTERNAL"
                ? "Ví dụ: Solve LeetCode #1"
                : "Ví dụ: Viết bài về AI ethics"
          }
          className="input mt-1 text-sm"
        />
      </div>

      {missionType === "EXTERNAL" && (
        <div>
          <label className="label text-xs" htmlFor="nm-url">URL ngoài</label>
          <input
            id="nm-url"
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            required
            placeholder="https://leetcode.com/problems/..."
            className="input mt-1 text-sm"
          />
        </div>
      )}

      <div>
        <label className="label text-xs" htmlFor="nm-desc">
          {missionType === "CUSTOM"
            ? "Nội dung / đề bài"
            : missionType === "EXTERNAL"
              ? "Hướng dẫn"
              : "Mô tả"}
        </label>
        <div className="mt-1">
          <RichTextEditor
            value={desc}
            onChange={setDesc}
            placeholder={
              missionType === "CUSTOM"
                ? "Đề bài chi tiết, hướng dẫn, attachment..."
                : missionType === "EXTERNAL"
                  ? "Hướng dẫn học viên làm gì ở link bên ngoài..."
                  : "Hướng dẫn cho học viên..."
            }
            minHeight={missionType !== "COURSE_LINKED" ? 140 : 80}
          />
        </div>
      </div>
      </FormSection>

      {/* ═══ Step 3 — Verify config (only when non-COURSE_LINKED) ═══════ */}
      {missionType !== "COURSE_LINKED" && (
        <FormSection step={3} title="Cấu hình chấm điểm">
        <div className="space-y-3">
          <div>
            <label className="label text-xs">Hạn nộp</label>
            <input
              type="datetime-local"
              value={submissionDeadline}
              onChange={(e) => setSubmissionDeadline(e.target.value)}
              required
              className="input mt-1 text-sm"
            />
          </div>

          {/* AUTO_CHECK config */}
          {verifyMode === "AUTO_CHECK" && (
            <div className="space-y-2 rounded-lg bg-[rgb(var(--surface))] p-2">
              <label className="label text-xs">Quy tắc kiểm tra</label>
              <select
                value={autoCheckType}
                onChange={(e) => setAutoCheckType(e.target.value as typeof autoCheckType)}
                className="select text-sm"
              >
                <option value="url_pattern">URL khớp regex</option>
                <option value="file_format">File đúng định dạng</option>
                <option value="webhook">Webhook 3rd-party</option>
              </select>
              {autoCheckType === "url_pattern" && (
                <input
                  value={autoCheckRegex}
                  onChange={(e) => setAutoCheckRegex(e.target.value)}
                  required
                  placeholder="^https://github\\.com/.+/pull/\\d+$"
                  className="input text-sm font-mono"
                />
              )}
              {autoCheckType === "file_format" && (
                <input
                  value={autoCheckMime}
                  onChange={(e) => setAutoCheckMime(e.target.value)}
                  required
                  placeholder="application/pdf, image/png"
                  className="input text-sm"
                />
              )}
              {autoCheckType === "webhook" && (
                <input
                  type="url"
                  value={autoCheckWebhook}
                  onChange={(e) => setAutoCheckWebhook(e.target.value)}
                  required
                  placeholder="https://your-service.example/verify"
                  className="input text-sm"
                />
              )}
            </div>
          )}

          {/* PEER_REVIEW config */}
          {verifyMode === "PEER_REVIEW" && (
            <div className="space-y-3 rounded-lg bg-[rgb(var(--surface))] p-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Số reviewer / bài</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={peerReviewerCount}
                    onChange={(e) => setPeerReviewerCount(e.target.value)}
                    className="input mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs">Ngưỡng đạt</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(e.target.value)}
                    required
                    placeholder="0.6"
                    className="input mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs">Đóng vòng chấm</label>
                  <input
                    type="datetime-local"
                    value={reviewWindowEndAt}
                    onChange={(e) => setReviewWindowEndAt(e.target.value)}
                    required
                    className="input mt-1 text-sm"
                  />
                </div>
              </div>
              <RubricBuilder rubric={rubric} setRubric={setRubric} />
            </div>
          )}

          {/* MANUAL_REVIEW config */}
          {verifyMode === "MANUAL_REVIEW" && (
            <div>
              <label className="label text-xs">Ngưỡng đạt</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={passThreshold}
                onChange={(e) => setPassThreshold(e.target.value)}
                required
                placeholder="0.6"
                className="input mt-1 text-sm"
              />
              <p className="mt-1 text-xs text-faint">
                Học viên nộp qua flow Assignment ẩn; bạn chấm trong queue Assignment có sẵn.
              </p>
            </div>
          )}

          {/* COLLECTIVE submission toggle — chỉ hiện cho team tournament + non-quiz */}
          {teamSize > 1 && verifyMode && verifyMode !== "AUTO_GRADE" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3">
              <input
                type="checkbox"
                checked={isTeamSubmission}
                onChange={(e) => setIsTeamSubmission(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <div className="min-w-0 text-xs">
                <p className="font-semibold">Nộp theo nhóm (chỉ captain nộp 1 lần)</p>
                <p className="mt-0.5 text-faint">
                  Khi bật, cả đội cùng được tính hoàn thành từ 1 submission của captain. Phù hợp project, presentation, báo cáo chung.
                  Khi tắt (mặc định), mỗi thành viên nộp riêng và SUM điểm.
                </p>
              </div>
            </label>
          )}

          {verifyMode === "AUTO_GRADE" && (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
              💡 Sau khi tạo mission, bạn sẽ được chuyển sang trang soạn câu hỏi quiz.
            </p>
          )}
        </div>
        </FormSection>
      )}

      {/* ═══ Step 3 (COURSE_LINKED) — Điều kiện hoàn thành ═══════════ */}
      {missionType === "COURSE_LINKED" && templates.length > 0 && (
        <FormSection step={3} title="Điều kiện hoàn thành">
        <div>
          <p className="mb-2 text-xs text-muted">
            Chọn loại điều kiện để tự điền ngưỡng mặc định:
            {teamSize > 1 && (
              <span className="ml-1 text-[11px] text-amber-700 dark:text-amber-400">
                · Tournament team-based — đã ẩn các loại không phù hợp cho nhóm.
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates
              .filter((t) => isMissionTeamCompatible(t.conditionType, teamSize))
              .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTemplateChange(t.id === selectedTemplateId ? "" : t.id)}
                className={`flex items-start gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs transition-all ${
                  selectedTemplateId === t.id
                    ? "border-brand-500 bg-brand-soft text-brand-800 shadow-sm"
                    : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
                }`}
              >
                <span className="text-base leading-none">{t.emoji ?? "📋"}</span>
                <span className="font-medium leading-tight">{t.name}</span>
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <p className="mt-2 text-xs text-muted">{selectedTemplate.description}</p>
          )}
        </div>
      </FormSection>
      )}

      {/* ── Condition params (separate sub-section) ── */}
      {missionType === "COURSE_LINKED" && selectedTemplate && (
        <FormSection step={4} title="Ngưỡng đạt">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* conditionValue */}
          <div>
            <label className="label text-xs">
              {selectedTemplate.conditionType === "streak_days" ? "Số ngày liên tục" : "Số lượng cần đạt"}
            </label>
            <input
              type="number"
              min={1}
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              required
              className="input mt-1 text-sm"
            />
          </div>

          {/* conditionMinScore — only when hasMinScore */}
          {selectedTemplate.hasMinScore && (
            <div>
              <label className="label text-xs">Điểm tối thiểu (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={conditionMinScore}
                onChange={(e) => setConditionMinScore(e.target.value)}
                required
                className="input mt-1 text-sm"
                placeholder="85"
              />
            </div>
          )}

          {/* conditionSkillCode — only when requiresSkillGroup */}
          {selectedTemplate.requiresSkillGroup && (
            <div className="col-span-2">
              <label className="label text-xs">
                Nhóm skill
                {skillGroups.length === 0 && (
                  <span className="ml-1 text-warning-600">
                    (Chưa có skill được tag trong khoá học này)
                  </span>
                )}
              </label>
              {skillGroups.length > 0 ? (
                <select
                  value={conditionSkillCode}
                  onChange={(e) => setConditionSkillCode(e.target.value)}
                  required
                  className="select mt-1 text-sm"
                >
                  <option value="">— Chọn nhóm —</option>
                  {skillGroups.map((g) => (
                    <option key={g.prefix} value={g.prefix}>
                      {g.label} ({g.count} skill)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={conditionSkillCode}
                  onChange={(e) => setConditionSkillCode(e.target.value)}
                  required
                  placeholder="vd: zh_tech.vocab"
                  className="input mt-1 text-sm"
                />
              )}
            </div>
          )}

          {/* conditionScope */}
          <div>
            <label className="label text-xs">Phạm vi tính</label>
            <select
              value={conditionScope}
              onChange={(e) => setConditionScope(e.target.value as "course" | "global")}
              className="select mt-1 text-sm"
            >
              <option value="course">Trong khoá học này</option>
              <option value="global">Toàn platform</option>
            </select>
          </div>
        </div>
        </FormSection>
      )}

      {/* ═══ Step cuối — Tuỳ chọn nâng cao ══════════════════════════ */}
      <FormSection
        step={missionType === "COURSE_LINKED" ? (selectedTemplate ? 5 : 4) : 4}
        title="Tuỳ chọn nâng cao"
        optional
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label text-xs" htmlFor="nm-pts">Điểm thưởng</label>
            <input
              id="nm-pts"
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="input mt-1 text-sm"
            />
          </div>
          <div>
            <label className="label text-xs" htmlFor="nm-prereq">Cần hoàn thành trước</label>
            <select
              id="nm-prereq"
              value={prereqId}
              onChange={(e) => setPrereqId(e.target.value)}
              className="select mt-1 text-sm"
            >
              <option value="">— Không có —</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.orderIndex}. {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-token bg-[rgb(var(--surface))] px-5 py-3">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          Hủy
        </button>
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang thêm..." : "Thêm nhiệm vụ"}
        </button>
      </div>
    </form>
  );
}

// ── FormSection ──────────────────────────────────────────────────────
function FormSection({
  step,
  title,
  optional,
  children,
}: {
  step: number;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-token pb-5 last:border-b-0 last:pb-0">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700">
          {step}
        </span>
        <h4 className="text-sm font-bold text-[rgb(var(--text))]">{title}</h4>
        {optional && (
          <span className="text-xs text-faint">(không bắt buộc)</span>
        )}
      </header>
      {children}
    </section>
  );
}

// ── RubricBuilder ─────────────────────────────────────────────────────────

function RubricBuilder({
  rubric,
  setRubric,
}: {
  rubric: RubricCriterion[];
  setRubric: (r: RubricCriterion[]) => void;
}) {
  function update(i: number, patch: Partial<RubricCriterion>) {
    setRubric(rubric.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add() {
    setRubric([
      ...rubric,
      {
        id: `c${rubric.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
        label: "",
        scale: "1-5",
        weight: 1,
      },
    ]);
  }
  function remove(i: number) {
    setRubric(rubric.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label text-xs">Rubric chấm</label>
        <button type="button" onClick={add} className="text-xs text-brand-700 hover:underline">
          + Tiêu chí
        </button>
      </div>
      <div className="mt-1 grid grid-cols-[1fr_110px_90px_28px] gap-1.5 text-[10px] uppercase tracking-wide text-faint">
        <span>Tiêu chí</span>
        <span>Thang điểm</span>
        <span>Trọng số</span>
        <span></span>
      </div>
      <ul className="mt-1 space-y-1.5">
        {rubric.map((c, i) => (
          <li key={c.id} className="grid grid-cols-[1fr_110px_90px_28px] items-center gap-1.5">
            <input
              value={c.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="vd: Độ rõ ràng"
              required
              className="input text-sm"
            />
            <select
              value={c.scale}
              onChange={(e) => update(i, { scale: e.target.value as RubricCriterion["scale"] })}
              className="select text-sm"
            >
              <option value="1-5">1–5 điểm</option>
              <option value="pass_fail">Pass / Fail</option>
            </select>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={c.weight}
              onChange={(e) => update(i, { weight: parseFloat(e.target.value) || 1 })}
              aria-label="Trọng số"
              className="input text-sm"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={rubric.length === 1}
              aria-label="Xoá tiêu chí"
              className="text-danger-600 disabled:opacity-30"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-faint">
        Trọng số là số tương đối — không cần cộng bằng 1, hệ thống tự chuẩn hoá.
      </p>
    </div>
  );
}
