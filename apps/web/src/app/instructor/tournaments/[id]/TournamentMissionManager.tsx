"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

// ── Types ─────────────────────────────────────────────────────────────────────

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
}: {
  tournamentId: string;
  courseId: string | null;
  status: string;
  missions: Mission[];
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
                        {m.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-xs text-faint">
                        {m.points} pts
                      </span>
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
                {isDraft && (
                  <button
                    onClick={() => removeMission(m.id)}
                    disabled={deleting === m.id}
                    className="flex-shrink-0 text-xs text-danger-600 hover:text-danger-700 disabled:opacity-50"
                  >
                    {deleting === m.id ? "..." : "Xoá"}
                  </button>
                )}
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
}: {
  tournamentId: string;
  missions: Mission[];
  templates: MissionTemplate[];
  skillGroups: SkillGroup[];
  onAdded: (m: Mission) => void;
  onCancel: () => void;
  setError: (e: string | null) => void;
}) {
  // ── Form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState("100");
  const [prereqId, setPrereqId] = useState("");

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Condition fields — seeded from template defaults, overrideable
  const [conditionValue, setConditionValue] = useState("");
  const [conditionMinScore, setConditionMinScore] = useState("");
  const [conditionSkillCode, setConditionSkillCode] = useState("");
  const [conditionScope, setConditionScope] = useState<"course" | "global">("course");

  const [busy, setBusy] = useState(false);

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
      if (!desc) setDesc(tmpl.description);
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
    };
    if (prereqId) payload.prerequisiteId = prereqId;
    if (selectedTemplateId) payload.templateId = selectedTemplateId;
    if (conditionValue) payload.conditionValue = parseInt(conditionValue, 10);
    if (conditionMinScore) payload.conditionMinScore = parseInt(conditionMinScore, 10);
    if (conditionSkillCode) payload.conditionSkillCode = conditionSkillCode;
    payload.conditionScope = conditionScope;

    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/missions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (res.ok) {
      const { missionId } = await res.json();
      // Fetch the fresh mission list to get the new item with full fields
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
      className="card mt-2 space-y-4 border-brand-200"
    >
      <h3 className="text-sm font-semibold">Thêm nhiệm vụ mới</h3>

      {/* ── Step 1: Pick template ── */}
      {templates.length > 0 && (
        <div>
          <label className="label text-xs">
            Loại điều kiện
            <span className="ml-1 text-faint">(chọn để tự điền ngưỡng mặc định)</span>
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTemplateChange(t.id === selectedTemplateId ? "" : t.id)}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                  selectedTemplateId === t.id
                    ? "border-brand-400 bg-brand-soft text-brand-800"
                    : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
                }`}
              >
                <span className="text-base leading-none">{t.emoji ?? "📋"}</span>
                <span className="font-medium leading-tight">{t.name}</span>
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <p className="mt-1.5 text-xs text-muted">{selectedTemplate.description}</p>
          )}
        </div>
      )}

      {/* ── Condition params ── */}
      {selectedTemplate && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[rgb(var(--surface-muted))] p-3">
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
      )}

      {/* ── Basic info ── */}
      <div>
        <label className="label text-xs" htmlFor="nm-title">Tiêu đề nhiệm vụ</label>
        <input
          id="nm-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Ví dụ: Hoàn thành 5 quiz"
          className="input mt-1 text-sm"
        />
      </div>

      <div>
        <label className="label text-xs" htmlFor="nm-desc">Mô tả</label>
        <textarea
          id="nm-desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          required
          rows={2}
          placeholder="Hướng dẫn cho học viên..."
          className="textarea mt-1 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
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

      <div className="flex items-center justify-end gap-2 border-t border-token pt-3">
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
