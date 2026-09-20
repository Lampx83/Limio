// Luật thuần của form nhiệm vụ đấu trường: trạng thái form, kiểm tra từng bước và dựng payload API.
// Giao diện (MissionForm.tsx) chỉ hiển thị; mọi quy tắc nằm ở đây để test được.

import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from "./datetime";

export type MissionModeId = "quiz" | "manual" | "peer" | "check" | "course";

export const MISSION_MODES: { id: MissionModeId; label: string; description: string }[] = [
  { id: "quiz", label: "Làm bài kiểm tra", description: "Học viên làm trắc nghiệm, hệ thống tự chấm." },
  { id: "manual", label: "Nộp bài, bạn chấm", description: "Học viên nộp bài, bạn chấm Đạt hoặc Chưa đạt." },
  { id: "peer", label: "Nộp bài, bạn học chấm chéo", description: "Học viên chấm bài của nhau theo tiêu chí bạn đặt." },
  { id: "check", label: "Nộp liên kết hoặc tệp", description: "Hệ thống tự kiểm tra liên kết hoặc loại tệp." },
  { id: "course", label: "Tự tính theo việc học trong khoá", description: "Ghi nhận khi học viên hoàn thành bài học hoặc đạt điểm." },
];

export const MODE_SHORT_LABEL: Record<MissionModeId, string> = {
  quiz: "Làm bài kiểm tra",
  manual: "Bạn chấm",
  peer: "Chấm chéo",
  check: "Nộp liên kết hoặc tệp",
  course: "Tự tính theo việc học",
};

export type RubricCriterion = { id: string; label: string; scale: "1-5" | "pass_fail"; weight: number };

export const FILE_TYPES: { id: string; label: string; mime: string[] }[] = [
  { id: "pdf", label: "PDF", mime: ["application/pdf"] },
  { id: "image", label: "Ảnh", mime: ["image/png", "image/jpeg", "image/gif", "image/webp"] },
  {
    id: "word",
    label: "Word",
    mime: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  {
    id: "excel",
    label: "Excel",
    mime: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  { id: "video", label: "Video", mime: ["video/mp4", "video/quicktime", "video/webm"] },
];

export type MissionFormState = {
  mode: MissionModeId | null;
  title: string;
  description: string; // HTML từ trình soạn thảo
  points: string;
  external: boolean;
  externalUrl: string;
  contentExtra: Record<string, unknown> | null; // phần contentPayload có sẵn ngoài url (giữ nguyên khi sửa)
  // Tự tính theo khoá
  templateId: string;
  conditionType: string;
  conditionValue: string;
  conditionMinScore: string;
  conditionSkillCode: string;
  conditionScope: "course" | "global";
  // Hạn
  deadline: string; // "YYYY-MM-DDTHH:mm" giờ VN
  // Kiểm tra tự động
  checkKind: "link" | "file" | "raw";
  checkLinkText: string;
  checkFileTypes: string[];
  checkRaw: { type?: string; config?: Record<string, unknown> } | null;
  // Chấm chéo
  reviewers: string;
  quorum: string;
  peerPass: string; // phần trăm
  reviewWindowEndAt: string;
  rubric: RubricCriterion[];
  captainsOnly: boolean;
  // Giảng viên chấm
  manualPassThreshold: number;
  // Tuỳ chọn thêm
  prerequisiteId: string;
  isTeamSubmission: boolean;
};

export const DEFAULT_RUBRIC: RubricCriterion[] = [
  { id: "noi-dung", label: "Nội dung", scale: "1-5", weight: 2 },
  { id: "trinh-bay", label: "Trình bày", scale: "1-5", weight: 1 },
];

export function defaultMissionForm(): MissionFormState {
  return {
    mode: null,
    title: "",
    description: "",
    points: "100",
    external: false,
    externalUrl: "",
    contentExtra: null,
    templateId: "",
    conditionType: "",
    conditionValue: "",
    conditionMinScore: "",
    conditionSkillCode: "",
    conditionScope: "course",
    deadline: "",
    checkKind: "link",
    checkLinkText: "",
    checkFileTypes: ["pdf"],
    checkRaw: null,
    reviewers: "2",
    quorum: "2",
    peerPass: "60",
    reviewWindowEndAt: "",
    rubric: DEFAULT_RUBRIC.map((c) => ({ ...c })),
    captainsOnly: false,
    manualPassThreshold: 0.6,
    prerequisiteId: "",
    isTeamSubmission: false,
  };
}

export type FormContext = {
  now: Date;
  tournamentStart: Date;
  tournamentEnd: Date;
  teamSize: number;
  template: { hasMinScore: boolean; requiresSkillGroup: boolean } | null;
  /** Hạn nộp hiện có của nhiệm vụ đang sửa: nếu không đổi thì không kiểm tra lại mốc thời gian. */
  unchangedDeadline: string | null;
};

export type FormErrors = Partial<Record<
  | "mode" | "title" | "description" | "points" | "externalUrl"
  | "templateId" | "conditionValue" | "conditionMinScore" | "conditionSkillCode"
  | "deadline" | "checkLinkText" | "checkFileTypes"
  | "reviewers" | "quorum" | "peerPass" | "rubric" | "reviewWindowEndAt",
  string
>>;

const isBlankHtml = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length === 0;

const isInt = (s: string) => /^-?\d+$/.test(s.trim());

const usesSubmission = (m: MissionModeId | null) => !!m && m !== "course";
const canBeExternal = (m: MissionModeId | null) => m === "manual" || m === "check";

function inputToDate(s: string): Date | null {
  const iso = fromDateTimeInputValue(s);
  return iso ? new Date(iso) : null;
}

export function validateMissionForm(step: 1 | 2 | 3, s: MissionFormState, ctx: FormContext): FormErrors {
  const e: FormErrors = {};

  if (step === 1) {
    if (!s.mode) e.mode = "Chọn một cách làm để tiếp tục.";
    return e;
  }

  if (step === 2) {
    if (!s.title.trim()) e.title = "Nhập tên nhiệm vụ.";
    if (isBlankHtml(s.description)) e.description = "Nhập hướng dẫn cho học viên.";
    if (!isInt(s.points) || Number(s.points) < 0) e.points = "Nhập số điểm từ 0 trở lên.";

    if (s.external && canBeExternal(s.mode)) {
      let ok = false;
      try {
        const u = new URL(s.externalUrl.trim());
        ok = u.protocol === "http:" || u.protocol === "https:";
      } catch {
        ok = false;
      }
      if (!ok) e.externalUrl = "Nhập liên kết bắt đầu bằng https://";
    }

    if (s.mode === "course") {
      if (!s.templateId) e.templateId = "Chọn điều kiện hoàn thành.";
      if (!isInt(s.conditionValue) || Number(s.conditionValue) < 1) e.conditionValue = "Nhập số lượng từ 1 trở lên.";
      if (ctx.template?.hasMinScore) {
        if (!isInt(s.conditionMinScore) || Number(s.conditionMinScore) < 1 || Number(s.conditionMinScore) > 100) {
          e.conditionMinScore = "Nhập điểm tối thiểu từ 1 đến 100.";
        }
      }
      if (ctx.template?.requiresSkillGroup && !s.conditionSkillCode.trim()) {
        e.conditionSkillCode = "Chọn nhóm kỹ năng.";
      }
    }
    return e;
  }

  // step 3
  if (usesSubmission(s.mode)) {
    const d = inputToDate(s.deadline);
    if (!s.deadline || !d) {
      e.deadline = "Chọn hạn nộp.";
    } else if (s.deadline !== ctx.unchangedDeadline) {
      if (d <= ctx.now) e.deadline = "Hạn nộp phải sau thời điểm hiện tại.";
      else if (d < ctx.tournamentStart) {
        e.deadline = `Hạn nộp trước lúc giải bắt đầu (${formatDateTime(ctx.tournamentStart)}). Chọn muộn hơn.`;
      } else if (d > ctx.tournamentEnd) {
        e.deadline = `Hạn nộp sau lúc giải kết thúc (${formatDateTime(ctx.tournamentEnd)}) nên học viên sẽ không nộp được. Chọn sớm hơn.`;
      }
    }
  }

  if (s.mode === "check") {
    if (s.checkKind === "link" && !s.checkLinkText.trim()) e.checkLinkText = "Nhập chữ mà liên kết phải chứa, ví dụ github.com.";
    if (s.checkKind === "file" && s.checkFileTypes.length === 0) e.checkFileTypes = "Chọn ít nhất một loại tệp.";
  }

  if (s.mode === "peer") {
    const reviewers = Number(s.reviewers);
    if (!isInt(s.reviewers) || reviewers < 1 || reviewers > 50) e.reviewers = "Nhập số bạn chấm mỗi bài từ 1 đến 50.";
    if (!isInt(s.quorum) || Number(s.quorum) < 1) e.quorum = "Nhập số lượt chấm tối thiểu từ 1 trở lên.";
    else if (!e.reviewers && Number(s.quorum) > reviewers) {
      e.quorum = "Số lượt chốt điểm không được lớn hơn số bạn chấm mỗi bài.";
    }
    if (!isInt(s.peerPass) || Number(s.peerPass) < 1 || Number(s.peerPass) > 100) e.peerPass = "Nhập điểm đạt từ 1 đến 100%.";
    if (s.rubric.length === 0 || s.rubric.some((c) => !c.label.trim())) e.rubric = "Mỗi tiêu chí cần có tên, và cần ít nhất một tiêu chí.";
    const window = inputToDate(s.reviewWindowEndAt);
    const deadline = inputToDate(s.deadline);
    if (!s.reviewWindowEndAt || !window) e.reviewWindowEndAt = "Chọn hạn chấm.";
    else if (deadline && window <= deadline) e.reviewWindowEndAt = "Hạn chấm phải sau hạn nộp.";
  }

  return e;
}

const escapeRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const unescapeRegex = (t: string) => t.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");

export type PayloadOptions = {
  teamSize: number;
  kind: "add" | "edit";
  /** Sửa nhiệm vụ tự tính theo khoá: chỉ gửi điều kiện khi được phép sửa. */
  editConditions?: boolean;
};

export function buildMissionPayload(s: MissionFormState, opts: PayloadOptions): Record<string, unknown> {
  const mode = s.mode!;
  const p: Record<string, unknown> = {
    title: s.title.trim(),
    description: s.description,
    points: Math.round(Number(s.points)),
  };
  if (s.prerequisiteId) p.prerequisiteId = s.prerequisiteId;
  else if (opts.kind === "edit") p.prerequisiteId = null;

  if (mode === "course") {
    if (opts.kind === "add") {
      p.missionType = "COURSE_LINKED";
      p.templateId = s.templateId;
    }
    if (opts.kind === "add" || opts.editConditions) {
      p.conditionValue = Math.round(Number(s.conditionValue));
      if (s.conditionMinScore.trim()) p.conditionMinScore = Math.round(Number(s.conditionMinScore));
      if (s.conditionSkillCode.trim()) p.conditionSkillCode = s.conditionSkillCode.trim();
      p.conditionScope = s.conditionScope;
    }
    return p;
  }

  const external = s.external && canBeExternal(mode);
  if (opts.kind === "add") {
    p.missionType = external ? "EXTERNAL" : "CUSTOM";
    p.verifyMode = { quiz: "AUTO_GRADE", manual: "MANUAL_REVIEW", peer: "PEER_REVIEW", check: "AUTO_CHECK" }[mode];
  }
  p.submissionDeadline = fromDateTimeInputValue(s.deadline);
  if (external) p.contentPayload = { ...(s.contentExtra ?? {}), url: s.externalUrl.trim() };

  if (mode === "manual") p.passThreshold = s.manualPassThreshold;

  if (mode === "check") {
    if (s.checkKind === "raw" && s.checkRaw) {
      p.autoCheckRule = s.checkRaw;
    } else if (s.checkKind === "file") {
      const mime = FILE_TYPES.filter((t) => s.checkFileTypes.includes(t.id)).flatMap((t) => t.mime);
      p.autoCheckRule = { type: "file_format", config: { mime } };
    } else {
      p.autoCheckRule = { type: "url_pattern", config: { regex: escapeRegex(s.checkLinkText.trim()) } };
    }
  }

  if (mode === "peer") {
    p.rubric = s.rubric.map((c) => ({ id: c.id, label: c.label.trim(), scale: c.scale, weight: c.weight }));
    p.peerReviewerCount = Math.round(Number(s.reviewers));
    p.reviewQuorum = Math.round(Number(s.quorum));
    p.reviewWindowEndAt = fromDateTimeInputValue(s.reviewWindowEndAt);
    p.passThreshold = Math.round(Number(s.peerPass)) / 100;
    p.peerReviewCaptainsOnly = s.captainsOnly;
  }

  const teamEligible = opts.teamSize > 1 && (mode === "manual" || mode === "peer" || mode === "check");
  if (teamEligible) {
    if (opts.kind === "edit") p.isTeamSubmission = s.isTeamSubmission;
    else if (s.isTeamSubmission) p.isTeamSubmission = true;
  }
  return p;
}

// ── Đọc lại một nhiệm vụ đã có để sửa ────────────────────────────────────────

export type MissionLike = {
  title: string;
  description: string;
  points: number;
  prerequisiteId: string | null;
  conditionType?: string | null;
  conditionValue?: number | null;
  conditionScope?: string | null;
  conditionMinScore?: number | null;
  conditionSkillCode?: string | null;
  missionType?: "COURSE_LINKED" | "CUSTOM" | "EXTERNAL";
  verifyMode?: "AUTO_GRADE" | "AUTO_CHECK" | "PEER_REVIEW" | "MANUAL_REVIEW" | null;
  submissionDeadline?: string | Date | null;
  passThreshold?: number | null;
  peerReviewerCount?: number | null;
  reviewQuorum?: number | null;
  peerReviewCaptainsOnly?: boolean;
  reviewWindowEndAt?: string | Date | null;
  rubric?: RubricCriterion[] | null;
  contentPayload?: { url?: string; [k: string]: unknown } | null;
  autoCheckRule?: { type?: string; config?: Record<string, unknown> } | null;
  isTeamSubmission?: boolean;
};

export function modeOfMission(m: Pick<MissionLike, "missionType" | "verifyMode">): MissionModeId {
  if (m.missionType === "COURSE_LINKED" || !m.verifyMode) return "course";
  return { AUTO_GRADE: "quiz", MANUAL_REVIEW: "manual", PEER_REVIEW: "peer", AUTO_CHECK: "check" }[m.verifyMode] as MissionModeId;
}

const toInput = (d: string | Date | null | undefined) => (d ? toDateTimeInputValue(d) : "");

export function stateFromMission(m: MissionLike): MissionFormState {
  const base = defaultMissionForm();
  const mode = modeOfMission(m);
  const s: MissionFormState = {
    ...base,
    mode,
    title: m.title,
    description: m.description ?? "",
    points: String(m.points),
    prerequisiteId: m.prerequisiteId ?? "",
    isTeamSubmission: Boolean(m.isTeamSubmission),
    captainsOnly: Boolean(m.peerReviewCaptainsOnly),
    deadline: toInput(m.submissionDeadline),
    conditionType: m.conditionType ?? "",
    conditionValue: m.conditionValue != null ? String(m.conditionValue) : "",
    conditionMinScore: m.conditionMinScore != null ? String(m.conditionMinScore) : "",
    conditionSkillCode: m.conditionSkillCode ?? "",
    conditionScope: m.conditionScope === "global" ? "global" : "course",
  };

  if (m.missionType === "EXTERNAL") {
    const { url, ...rest } = m.contentPayload ?? {};
    s.external = true;
    s.externalUrl = typeof url === "string" ? url : "";
    s.contentExtra = Object.keys(rest).length ? rest : null;
  }

  if (mode === "manual" && m.passThreshold != null) s.manualPassThreshold = m.passThreshold;

  if (mode === "peer") {
    s.reviewers = String(m.peerReviewerCount ?? 3);
    s.quorum = m.reviewQuorum != null ? String(m.reviewQuorum) : s.reviewers;
    s.peerPass = m.passThreshold != null ? String(Math.round(m.passThreshold * 100)) : "60";
    s.reviewWindowEndAt = toInput(m.reviewWindowEndAt);
    if (m.rubric && m.rubric.length > 0) s.rubric = m.rubric.map((c) => ({ ...c }));
  }

  if (mode === "check" && m.autoCheckRule) {
    const rule = m.autoCheckRule;
    const cfg = (rule.config ?? {}) as Record<string, unknown>;
    s.checkRaw = rule;
    s.checkKind = "raw";
    if (rule.type === "url_pattern" && typeof cfg.regex === "string" && cfg.regex) {
      const text = unescapeRegex(cfg.regex);
      if (escapeRegex(text) === cfg.regex) {
        s.checkKind = "link";
        s.checkLinkText = text;
      }
    } else if (rule.type === "file_format" && Array.isArray(cfg.mime)) {
      const mimes = cfg.mime.filter((x): x is string => typeof x === "string");
      const covered = FILE_TYPES.filter((t) => t.mime.every((x) => mimes.includes(x)));
      const coveredMimes = new Set(covered.flatMap((t) => t.mime));
      if (covered.length > 0 && mimes.every((x) => coveredMimes.has(x))) {
        s.checkKind = "file";
        s.checkFileTypes = covered.map((t) => t.id);
      }
    }
  }
  return s;
}

// ── Tiện ích hiển thị ────────────────────────────────────────────────────────

export function peerSummary(s: MissionFormState): string {
  return (
    `Mỗi bài có ${s.reviewers} bạn chấm, chốt điểm khi có ít nhất ${s.quorum} lượt, ` +
    `đạt khi điểm trung bình từ ${s.peerPass}%. Tiêu chí: ${s.rubric.map((c) => c.label || "…").join(", ")}.`
  );
}

export function addDaysToInput(input: string, days: number): string {
  const iso = fromDateTimeInputValue(input);
  if (!iso) return "";
  return toDateTimeInputValue(new Date(new Date(iso).getTime() + days * 86_400_000));
}

/** Mốc hạn nộp chọn nhanh, chỉ giữ những mốc nằm trong thời gian giải và sau hiện tại. */
export function deadlinePresets(start: Date, end: Date, now: Date): { label: string; value: string }[] {
  const dm = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
  const endOfDay = (d: Date) => `${toDateTimeInputValue(d).slice(0, 10)}T23:59`;
  const candidates = [
    { value: endOfDay(new Date((start.getTime() + end.getTime()) / 2)), label: "Giữa giải" },
    { value: endOfDay(new Date(end.getTime() - 86_400_000)), label: "Gần cuối giải" },
    { value: toDateTimeInputValue(end), label: "Đúng lúc kết thúc giải" },
  ];
  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      if (seen.has(c.value)) return false;
      seen.add(c.value);
      const d = inputToDate(c.value);
      return !!d && d >= start && d <= end && d > now;
    })
    .map((c) => ({ value: c.value, label: c.label === "Đúng lúc kết thúc giải" ? c.label : `${c.label} (${dm(c.value)})` }));
}
