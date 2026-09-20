"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Link2,
  ListChecks,
  Plus,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime, fromDateTimeInputValue } from "@/lib/datetime";
import { plainToRichHtml } from "@/lib/richText";
import { tournamentErrorMessage } from "@/lib/tournamentText";
import { isMissionTeamCompatible } from "@feedbackme/core-gamification";
import {
  FILE_TYPES,
  MISSION_MODES,
  MODE_SHORT_LABEL,
  addDaysToInput,
  buildMissionPayload,
  deadlinePresets,
  defaultMissionForm,
  peerSummary,
  stateFromMission,
  validateMissionForm,
  type FormErrors,
  type MissionFormState,
  type MissionLike,
  type MissionModeId,
  type RubricCriterion,
} from "@/lib/tournamentMissionForm";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

const MODE_ICON: Record<MissionModeId, LucideIcon> = {
  quiz: ListChecks,
  manual: UserCheck,
  peer: Users,
  check: Link2,
  course: GraduationCap,
};

export type MissionTemplate = {
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
};
export type SkillGroup = { prefix: string; label: string; count: number };

type ListedMission = { id: string; title: string; orderIndex: number };

type Props = {
  kind: "add" | "edit";
  tournamentId: string;
  tournament: { startsAt: string; endsAt: string; teamSize: number; status: string };
  /** Bắt buộc khi kind = "edit". */
  mission?: MissionLike & { id: string; orderIndex: number };
  missions: ListedMission[];
  templates: MissionTemplate[];
  skillGroups: SkillGroup[];
  /** add: nhiệm vụ vừa tạo (đã nạp lại từ máy chủ nếu được). edit: nhiệm vụ đã cập nhật. */
  onSaved: (mission: any | null) => void;
  onClose: () => void;
};

const inputCls = "input w-full";
const errCls = "mt-1.5 text-sm text-danger-600";
const hintCls = "mt-1.5 text-xs text-muted";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label?: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={`mf-${id}`}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--text))]" htmlFor={`mf-in-${id}`}>
          {label}
        </label>
      )}
      {children}
      {error ? <p className={errCls}>{error}</p> : hint ? <p className={hintCls}>{hint}</p> : null}
    </div>
  );
}

function Chip({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        on
          ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
          : "border-token bg-[rgb(var(--surface))] hover:border-brand-400"
      }`}
    >
      {children}
    </button>
  );
}

const WEIGHTS = [
  { value: 1, label: "Bình thường" },
  { value: 2, label: "Cao" },
  { value: 3, label: "Rất cao" },
];

export default function MissionForm({
  kind,
  tournamentId,
  tournament,
  mission,
  missions,
  templates,
  skillGroups,
  onSaved,
  onClose,
}: Props) {
  const router = useRouter();
  const isEdit = kind === "edit";
  const [s, setS] = useState<MissionFormState>(() => (isEdit && mission ? stateFromMission(mission) : defaultMissionForm()));
  const originalDeadline = useRef(isEdit && mission ? stateFromMission(mission).deadline : null);
  const [step, setStep] = useState<1 | 2 | 3>(isEdit ? 2 : 1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; mode: MissionModeId } | null>(null);
  const [showPeerAdv, setShowPeerAdv] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const start = useMemo(() => new Date(tournament.startsAt), [tournament.startsAt]);
  const end = useMemo(() => new Date(tournament.endsAt), [tournament.endsAt]);
  const teamSize = tournament.teamSize;
  const mode = s.mode;

  const compatibleTemplates = templates.filter((t) => isMissionTeamCompatible(t.conditionType, teamSize));
  const template =
    templates.find((t) => t.id === s.templateId) ??
    (s.conditionType ? templates.find((t) => t.conditionType === s.conditionType) ?? null : null);
  const editConditions = isEdit && tournament.status === "draft";
  const conditionsLocked = isEdit && mode === "course" && !editConditions;

  const stepLabels: Record<1 | 2 | 3, string> = {
    1: "Cách làm",
    2: "Nội dung",
    3: mode === "course" ? "Tuỳ chọn thêm" : "Hạn và cách chấm",
  };
  const visibleSteps: (1 | 2 | 3)[] = isEdit ? [2, 3] : [1, 2, 3];

  function set(patch: Partial<MissionFormState>) {
    setS((prev) => ({ ...prev, ...patch }));
  }
  function clearErr(...keys: (keyof FormErrors)[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }

  function ctxFor() {
    return {
      now: new Date(),
      tournamentStart: start,
      tournamentEnd: end,
      teamSize,
      template: template ? { hasMinScore: template.hasMinScore, requiresSkillGroup: template.requiresSkillGroup } : null,
      unchangedDeadline: originalDeadline.current,
    };
  }

  function pickTemplate(id: string) {
    const next = templates.find((t) => t.id === id);
    const prev = templates.find((t) => t.id === s.templateId);
    const patch: Partial<MissionFormState> = { templateId: id, conditionType: next?.conditionType ?? "" };
    if (next) {
      patch.conditionValue = String(next.defaultValue);
      patch.conditionMinScore = next.defaultMinScore ? String(next.defaultMinScore) : "";
      patch.conditionSkillCode = "";
      // Điền sẵn tên/mô tả từ mẫu, nhưng không ghi đè thứ giảng viên đã tự gõ.
      if (!s.title.trim() || (prev && s.title === prev.name)) patch.title = next.name;
      const prevDesc = prev ? plainToRichHtml(prev.description) : null;
      if (!s.description.trim() || (prevDesc !== null && s.description === prevDesc)) {
        patch.description = plainToRichHtml(next.description);
      }
    }
    set(patch);
    clearErr("templateId", "conditionValue", "conditionMinScore", "conditionSkillCode");
  }

  function setDeadline(value: string) {
    const auto = s.deadline ? addDaysToInput(s.deadline, 3) : "";
    const patch: Partial<MissionFormState> = { deadline: value };
    // Hạn chấm mặc định = hạn nộp + 3 ngày, chỉ tự đổi khi giảng viên chưa chỉnh tay.
    if (s.mode === "peer" && (!s.reviewWindowEndAt || s.reviewWindowEndAt === auto)) {
      patch.reviewWindowEndAt = addDaysToInput(value, 3);
    }
    set(patch);
    clearErr("deadline", "reviewWindowEndAt");
  }

  function focusFirstError(e: FormErrors) {
    const first = Object.keys(e)[0];
    if (first) setTimeout(() => document.getElementById(`mf-${first}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
  }

  function goNext() {
    const e = validateMissionForm(step, s, ctxFor());
    setErrors(e);
    if (Object.keys(e).length > 0) {
      focusFirstError(e);
      return;
    }
    if (step === 1) {
      // Vào bước 3 lần đầu với chấm chéo: điền sẵn hạn chấm nếu đã có hạn nộp.
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }

  function goBack() {
    setErrors({});
    if (step === 3) setStep(2);
    else if (step === 2 && !isEdit) setStep(1);
  }

  async function submit() {
    // Kiểm tra lại toàn bộ (phòng khi bước trước bị đổi): quay về bước đầu tiên có lỗi.
    for (const st of (isEdit ? [2, 3] : [1, 2, 3]) as (1 | 2 | 3)[]) {
      const e = validateMissionForm(st, s, ctxFor());
      if (Object.keys(e).length > 0) {
        setErrors(e);
        setStep(st);
        focusFirstError(e);
        return;
      }
    }
    setBusy(true);
    setSubmitError(null);
    const payload = buildMissionPayload(s, { teamSize, kind, editConditions });
    try {
      const res = await fetch(
        isEdit ? apiUrl(`/api/tournament-missions/${mission!.id}`) : apiUrl(`/api/tournaments/${tournamentId}/missions`),
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(tournamentErrorMessage(d, isEdit ? "Chưa lưu được nhiệm vụ. Vui lòng thử lại." : "Chưa thêm được nhiệm vụ. Vui lòng thử lại."));
        return;
      }
      if (isEdit) {
        onSaved(d.mission ?? null);
        return;
      }
      const missionId: string = d.missionId;
      let added: unknown = null;
      try {
        const listRes = await fetch(apiUrl(`/api/tournaments/${tournamentId}/missions`));
        if (listRes.ok) {
          const { missions: fresh } = await listRes.json();
          added = fresh.find((m: { id: string }) => m.id === missionId) ?? null;
        }
      } catch {
        // Đã tạo xong; danh sách sẽ được nạp lại bằng router.refresh() bên dưới.
      }
      onSaved(added);
      if (!added) router.refresh();
      setCreated({ id: missionId, mode: s.mode! });
    } catch {
      setSubmitError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setBusy(false);
    }
  }

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault(); // Enter trong ô nhập chỉ đi tiếp, không tạo ngoài ý muốn
    if (step < 3) goNext();
  }

  function resetForNext() {
    setS(defaultMissionForm());
    setErrors({});
    setSubmitError(null);
    setCreated(null);
    setShowPeerAdv(false);
    setShowMore(false);
    setStep(1);
  }

  // ── Xem trước ─────────────────────────────────────────────────────────────
  const dlIso = fromDateTimeInputValue(s.deadline);
  const preview = (
    <div className="mt-4 rounded-xl border border-dashed border-token bg-[rgb(var(--surface))] px-4 py-3">
      <p className="text-xs text-muted">Học viên sẽ thấy</p>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{s.title.trim() || "Tên nhiệm vụ"}</p>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">
            {s.description.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() || "Chưa có hướng dẫn"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs">
          {Number.isFinite(Number(s.points)) && s.points !== "" ? Math.round(Number(s.points)) : 0} điểm
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {mode && <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5">{MODE_SHORT_LABEL[mode]}</span>}
        <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5">
          {mode === "course" ? "Không có hạn nộp" : dlIso ? `Hạn nộp ${formatDateTime(dlIso)}` : "Chưa đặt hạn nộp"}
        </span>
      </div>
    </div>
  );

  // ── Các bước ──────────────────────────────────────────────────────────────
  const step1 = (
    <div id="mf-mode">
      <p className="mb-3 text-sm font-medium">Học viên hoàn thành nhiệm vụ này bằng cách nào?</p>
      <div className="space-y-2">
        {MISSION_MODES.map((m) => {
          const Icon = MODE_ICON[m.id];
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                set({ mode: m.id, external: canBeExternalMode(m.id) ? s.external : false });
                clearErr("mode");
              }}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                on
                  ? "border-brand-400 bg-brand-50 dark:bg-brand-900/30"
                  : "border-token bg-[rgb(var(--surface))] hover:border-brand-400"
              }`}
            >
              <Icon size={20} className="mt-0.5 shrink-0 text-brand-600" />
              <span>
                <span className="block font-medium">{m.label}</span>
                <span className="block text-sm text-muted">{m.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      {errors.mode && <p className={errCls}>{errors.mode}</p>}
    </div>
  );

  const step2 = (
    <div className="space-y-4">
      {isEdit && mode && (
        <p className="rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-muted">
          Cách làm: <span className="font-medium text-[rgb(var(--text))]">{MODE_SHORT_LABEL[mode]}</span>. Không đổi được sau khi tạo.
        </p>
      )}

      {mode === "course" && !conditionsLocked && (
        <>
          <Field id="templateId" label="Điều kiện hoàn thành" error={errors.templateId}
            hint={teamSize > 1 ? "Đấu trường theo đội: đã ẩn các điều kiện chỉ tính cho từng cá nhân." : undefined}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {compatibleTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={s.templateId === t.id}
                  onClick={() => pickTemplate(s.templateId === t.id ? "" : t.id)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    s.templateId === t.id
                      ? "border-brand-400 bg-brand-50 dark:bg-brand-900/30"
                      : "border-token bg-[rgb(var(--surface))] hover:border-brand-400"
                  }`}
                >
                  <span className="block font-medium">{t.name}</span>
                </button>
              ))}
            </div>
            {template && <p className={hintCls}>{template.description}</p>}
          </Field>
        </>
      )}

      <Field id="title" label="Tên nhiệm vụ" error={errors.title}>
        <input
          id="mf-in-title"
          className={inputCls}
          value={s.title}
          maxLength={200}
          placeholder="Ví dụ: Giải hệ phương trình bậc nhất"
          onChange={(e) => {
            set({ title: e.target.value });
            clearErr("title");
          }}
        />
      </Field>

      <Field id="description" label="Đề bài hoặc hướng dẫn cho học viên" error={errors.description}>
        <RichTextEditor
          value={s.description}
          onChange={(v: string) => {
            set({ description: v });
            clearErr("description");
          }}
          placeholder="Học viên cần làm gì, nộp gì, tiêu chí nào được tính."
        />
      </Field>

      {mode === "course" && (template || conditionsLocked) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {conditionsLocked ? (
            <p className="text-sm text-muted sm:col-span-2">
              Điều kiện hoàn thành đã khoá vì đấu trường đã công bố (có thể đã có người đạt). Muốn đổi, hãy tạo nhiệm vụ mới.
            </p>
          ) : (
            <>
              <Field id="conditionValue" label={template?.conditionType === "streak_days" ? "Số ngày liên tục" : "Số lượng cần đạt"} error={errors.conditionValue}>
                <input id="mf-in-conditionValue" type="number" min={1} className={inputCls} value={s.conditionValue}
                  onChange={(e) => { set({ conditionValue: e.target.value }); clearErr("conditionValue"); }} />
              </Field>
              {template?.hasMinScore && (
                <Field id="conditionMinScore" label="Điểm tối thiểu (%)" error={errors.conditionMinScore}>
                  <input id="mf-in-conditionMinScore" type="number" min={1} max={100} className={inputCls} value={s.conditionMinScore}
                    onChange={(e) => { set({ conditionMinScore: e.target.value }); clearErr("conditionMinScore"); }} />
                </Field>
              )}
              {template?.requiresSkillGroup && (
                <Field id="conditionSkillCode" label="Nhóm kỹ năng" error={errors.conditionSkillCode}
                  hint={skillGroups.length === 0 ? "Khoá học này chưa có kỹ năng nào được gắn nhãn." : undefined}>
                  {skillGroups.length > 0 ? (
                    <select id="mf-in-conditionSkillCode" className="select w-full" value={s.conditionSkillCode}
                      onChange={(e) => { set({ conditionSkillCode: e.target.value }); clearErr("conditionSkillCode"); }}>
                      <option value="">Chọn nhóm</option>
                      {skillGroups.map((g) => (
                        <option key={g.prefix} value={g.prefix}>{g.label} ({g.count} kỹ năng)</option>
                      ))}
                    </select>
                  ) : (
                    <input id="mf-in-conditionSkillCode" className={inputCls} value={s.conditionSkillCode} placeholder="Ví dụ: zh_tech.vocab"
                      onChange={(e) => { set({ conditionSkillCode: e.target.value }); clearErr("conditionSkillCode"); }} />
                  )}
                </Field>
              )}
              <Field id="scope" label="Tính trong phạm vi">
                <select id="mf-in-scope" className="select w-full" value={s.conditionScope}
                  onChange={(e) => set({ conditionScope: e.target.value as "course" | "global" })}>
                  <option value="course">Khoá học này</option>
                  <option value="global">Toàn hệ thống</option>
                </select>
              </Field>
            </>
          )}
        </div>
      )}

      {canBeExternalMode(mode) && (
        <div id="mf-externalUrl">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={s.external}
              onChange={(e) => { set({ external: e.target.checked }); clearErr("externalUrl"); }} />
            Nhiệm vụ làm ở trang web khác
          </label>
          {s.external && (
            <input id="mf-in-externalUrl" type="url" className={`${inputCls} mt-2`} placeholder="https://" value={s.externalUrl}
              onChange={(e) => { set({ externalUrl: e.target.value }); clearErr("externalUrl"); }} />
          )}
          {errors.externalUrl && <p className={errCls}>{errors.externalUrl}</p>}
        </div>
      )}

      <div className="max-w-[220px]">
        <Field id="points" label="Điểm cộng vào bảng xếp hạng" error={errors.points} hint="Có thể đặt 0 nếu chỉ để luyện tập.">
          <input id="mf-in-points" type="number" min={0} className={inputCls} value={s.points}
            onChange={(e) => { set({ points: e.target.value }); clearErr("points"); }} />
        </Field>
      </div>
    </div>
  );

  const presets = deadlinePresets(start, end, new Date());

  const rubricEditor = (
    <div id="mf-rubric">
      <label className="mb-1.5 block text-sm font-medium">Tiêu chí chấm</label>
      <ul className="space-y-2">
        {s.rubric.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <input className="input min-w-[140px] flex-1" value={c.label} placeholder="Tên tiêu chí" aria-label="Tên tiêu chí"
              onChange={(e) => { updateCrit(i, { label: e.target.value }); clearErr("rubric"); }} />
            <select className="select" aria-label="Thang điểm" value={c.scale}
              onChange={(e) => updateCrit(i, { scale: e.target.value as RubricCriterion["scale"] })}>
              <option value="1-5">Thang 1 đến 5</option>
              <option value="pass_fail">Đạt / Chưa đạt</option>
            </select>
            <select className="select" aria-label="Mức quan trọng" value={String(c.weight)}
              onChange={(e) => updateCrit(i, { weight: Number(e.target.value) })}>
              {WEIGHTS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
              {!WEIGHTS.some((w) => w.value === c.weight) && <option value={c.weight}>Tuỳ chỉnh ({c.weight})</option>}
            </select>
            <button type="button" aria-label="Xoá tiêu chí" disabled={s.rubric.length === 1}
              onClick={() => set({ rubric: s.rubric.filter((_, x) => x !== i) })}
              className="rounded p-1.5 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30">
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary btn-sm mt-2 inline-flex items-center gap-1.5"
        onClick={() => set({ rubric: [...s.rubric, { id: `c-${Math.random().toString(36).slice(2, 8)}`, label: "", scale: "1-5", weight: 1 }] })}>
        <Plus size={14} /> Thêm tiêu chí
      </button>
      {errors.rubric && <p className={errCls}>{errors.rubric}</p>}
    </div>
  );

  function updateCrit(i: number, patch: Partial<RubricCriterion>) {
    set({ rubric: s.rubric.map((c, x) => (x === i ? { ...c, ...patch } : c)) });
  }

  const step3 = (
    <div className="space-y-4">
      {mode !== "course" && (
        <Field id="deadline" label="Hạn nộp" error={errors.deadline}
          hint="Hạn nộp phải nằm trong thời gian diễn ra giải, vì sau khi giải kết thúc hệ thống không nhận bài nữa.">
          <input id="mf-in-deadline" type="datetime-local" className="input w-full max-w-[260px]" value={s.deadline}
            onChange={(e) => setDeadline(e.target.value)} />
          {presets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Chip key={p.value} on={s.deadline === p.value} onClick={() => setDeadline(p.value)}>{p.label}</Chip>
              ))}
            </div>
          )}
        </Field>
      )}

      {mode === "quiz" && (
        <p className="rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-muted">
          Sau khi tạo, bạn thêm câu hỏi ở màn hình kế tiếp. Nhiệm vụ chưa có câu hỏi thì học viên chưa làm được.
        </p>
      )}

      {mode === "manual" && (
        <p className="rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-muted">
          Bạn chấm từng bài ở trang Bài nộp. Học viên nhận kết quả Đạt hoặc Chưa đạt và được điểm nhiệm vụ khi Đạt.
        </p>
      )}

      {mode === "course" && (
        <p className="rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-muted">
          Nhiệm vụ này không có hạn nộp. Hệ thống tự ghi nhận khi học viên đạt điều kiện ở bước trước.
        </p>
      )}

      {mode === "check" && (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Hệ thống kiểm tra gì</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={s.checkKind === "link"} onClick={() => set({ checkKind: "link" })}>Liên kết</Chip>
              <Chip on={s.checkKind === "file"} onClick={() => set({ checkKind: "file" })}>Tệp đính kèm</Chip>
              {s.checkRaw && <Chip on={s.checkKind === "raw"} onClick={() => set({ checkKind: "raw" })}>Cấu hình có sẵn</Chip>}
            </div>
          </div>
          {s.checkKind === "link" && (
            <Field id="checkLinkText" error={errors.checkLinkText}>
              <input id="mf-in-checkLinkText" className={inputCls} placeholder="Liên kết phải chứa, ví dụ github.com" value={s.checkLinkText}
                onChange={(e) => { set({ checkLinkText: e.target.value }); clearErr("checkLinkText"); }} />
            </Field>
          )}
          {s.checkKind === "file" && (
            <Field id="checkFileTypes" error={errors.checkFileTypes}>
              <div className="flex flex-wrap gap-1.5">
                {FILE_TYPES.map((t) => (
                  <Chip key={t.id} on={s.checkFileTypes.includes(t.id)}
                    onClick={() => {
                      set({ checkFileTypes: s.checkFileTypes.includes(t.id) ? s.checkFileTypes.filter((x) => x !== t.id) : [...s.checkFileTypes, t.id] });
                      clearErr("checkFileTypes");
                    }}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
          {s.checkKind === "raw" && (
            <p className="rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-muted">
              Nhiệm vụ này dùng cấu hình kiểm tra nâng cao đã thiết lập trước đó, được giữ nguyên. Chọn Liên kết hoặc Tệp đính kèm nếu muốn thay bằng cách đơn giản hơn.
            </p>
          )}
        </div>
      )}

      {mode === "peer" && (
        <div>
          <div className="rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{peerSummary(s)}</div>
          <button type="button" onClick={() => setShowPeerAdv((v) => !v)} className="btn-secondary btn-sm mt-2 inline-flex items-center gap-1.5">
            <SlidersHorizontal size={14} /> Tuỳ chỉnh cách chấm chéo
          </button>
          {(showPeerAdv || errors.reviewers || errors.quorum || errors.peerPass || errors.rubric || errors.reviewWindowEndAt) && (
            <div className="mt-3 space-y-4 border-t border-token pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field id="reviewers" label="Mỗi bài có bao nhiêu bạn chấm" error={errors.reviewers}>
                  <input id="mf-in-reviewers" type="number" min={1} max={50} className={inputCls} value={s.reviewers}
                    onChange={(e) => { set({ reviewers: e.target.value }); clearErr("reviewers", "quorum"); }} />
                </Field>
                <Field id="quorum" label="Chốt điểm khi có ít nhất … lượt chấm" error={errors.quorum}>
                  <input id="mf-in-quorum" type="number" min={1} max={50} className={inputCls} value={s.quorum}
                    onChange={(e) => { set({ quorum: e.target.value }); clearErr("quorum"); }} />
                </Field>
                <Field id="peerPass" label="Đạt khi điểm trung bình từ (%)" error={errors.peerPass}>
                  <input id="mf-in-peerPass" type="number" min={1} max={100} className={inputCls} value={s.peerPass}
                    onChange={(e) => { set({ peerPass: e.target.value }); clearErr("peerPass"); }} />
                </Field>
              </div>
              <p className={hintCls}>
                Ví dụ: mỗi bài 3 bạn chấm, chốt khi có ít nhất 2 lượt. Bài nào chưa đủ 2 lượt thì bạn vẫn chốt tay được.
              </p>
              {rubricEditor}
              <Field id="reviewWindowEndAt" label="Hạn chấm (mặc định 3 ngày sau hạn nộp)" error={errors.reviewWindowEndAt}>
                <input id="mf-in-reviewWindowEndAt" type="datetime-local" className="input w-full max-w-[260px]" value={s.reviewWindowEndAt}
                  onChange={(e) => { set({ reviewWindowEndAt: e.target.value }); clearErr("reviewWindowEndAt"); }} />
              </Field>
              {teamSize > 1 && (
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={s.captainsOnly}
                    onChange={(e) => set({ captainsOnly: e.target.checked })} />
                  <span>Chỉ đội trưởng đi chấm bài của đội khác</span>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <button type="button" onClick={() => setShowMore((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-brand-700">
          {showMore || mode === "course" ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Tuỳ chọn thêm
        </button>
        {(showMore || mode === "course") && (
          <div className="mt-3 space-y-3 border-t border-token pt-3">
            <div className="max-w-sm">
              <Field id="prereq" label="Phải xong nhiệm vụ nào trước">
                <select id="mf-in-prereq" className="select w-full" value={s.prerequisiteId} onChange={(e) => set({ prerequisiteId: e.target.value })}>
                  <option value="">Không cần, mở ngay từ đầu</option>
                  {missions.filter((m) => m.id !== mission?.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.orderIndex}. {m.title}</option>
                  ))}
                </select>
              </Field>
            </div>
            {teamSize > 1 && (mode === "manual" || mode === "peer" || mode === "check") && (
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={s.isTeamSubmission}
                  onChange={(e) => set({ isTeamSubmission: e.target.checked })} />
                <span>
                  Cả đội nộp chung một bài
                  <span className="block text-xs text-muted">Chỉ đội trưởng bấm nộp, cả đội cùng nhận điểm.</span>
                </span>
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Hoàn tất ──────────────────────────────────────────────────────────────
  if (created) {
    const quiz = created.mode === "quiz";
    return (
      <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center shadow-card">
        <CircleCheck size={32} className="mx-auto text-success-600" />
        <p className="mt-2 text-base font-semibold">Đã thêm nhiệm vụ</p>
        <p className="mt-1 text-sm text-muted">
          {quiz
            ? "Nhiệm vụ đã có trong danh sách, nhưng chưa có câu hỏi nên học viên chưa làm được."
            : "Nhiệm vụ đã có trong danh sách của đấu trường."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {quiz && (
            <Link href={`/instructor/tournaments/${tournamentId}/missions/${created.id}/quiz`} prefetch={false} className="btn-primary btn-sm">
              Thêm câu hỏi ngay
            </Link>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={resetForNext}>Thêm nhiệm vụ khác</button>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Xong</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onFormSubmit} className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4" noValidate>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{isEdit ? `Sửa nhiệm vụ ${mission?.orderIndex ?? ""}` : "Thêm nhiệm vụ"}</h3>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-1 text-muted hover:text-[rgb(var(--text))]">
          <X size={18} />
        </button>
      </div>

      <ol className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {visibleSteps.map((st, idx) => {
          const on = st === step;
          const done = st < step;
          return (
            <li key={st} className={`flex items-center gap-2 ${on ? "font-medium text-[rgb(var(--text))]" : "text-muted"}`}>
              <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border text-xs ${
                done ? "border-success-600 bg-success-50 text-success-700" : on ? "border-brand-400 bg-brand-50 text-brand-700" : "border-token"
              }`}>
                {done ? <Check size={12} /> : idx + 1}
              </span>
              {stepLabels[st]}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        {step === 1 && step1}
        {step === 2 && step2}
        {step === 3 && step3}
      </div>

      {step > 1 && preview}

      {submitError && <p className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">{submitError}</p>}

      <div className="mt-4 flex items-center justify-between gap-2">
        <div>
          {step > (isEdit ? 2 : 1) ? (
            <button type="button" onClick={goBack} disabled={busy} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
              <ArrowLeft size={14} /> Quay lại
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">Huỷ</button>
          )}
        </div>
        {step < 3 ? (
          <button type="button" onClick={goNext} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            Tiếp <ArrowRight size={14} />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={busy} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <Check size={14} /> {busy ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo nhiệm vụ"}
          </button>
        )}
      </div>
    </form>
  );
}

function canBeExternalMode(m: MissionModeId | null): boolean {
  return m === "manual" || m === "check";
}
