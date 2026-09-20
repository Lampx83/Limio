// Luật thuần của form tạo đấu trường: mặc định, kiểm tra và dựng dữ liệu gửi API.

import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from "./datetime";

export type TournamentFormState = {
  title: string;
  description: string; // HTML
  courseId: string; // id khoá học, "PLATFORM" = toàn hệ thống, "" = chưa chọn
  startsAt: string; // "YYYY-MM-DDTHH:mm" giờ VN
  endsAt: string;
  mode: "solo" | "team";
  teamSize: string;
  allowLateRegistration: boolean;
  /** Khi nào người ngoài đội xem được bài nộp của các đội (showcase). */
  showcaseMode: "always" | "after_end";
};

const DAY = 86_400_000;

export function endFromDuration(startsAt: string, days: number): string {
  const iso = fromDateTimeInputValue(startsAt);
  if (!iso) return "";
  return toDateTimeInputValue(new Date(new Date(iso).getTime() + days * DAY));
}

/** Mặc định: bắt đầu 8h sáng ngày mai (giờ VN), kéo dài 1 tuần, thi cá nhân. */
export function defaultTournamentForm(now: Date, defaultCourseId: string): TournamentFormState {
  const today = toDateTimeInputValue(now).slice(0, 10);
  const startsAt = endFromDuration(`${today}T08:00`, 1);
  return {
    title: "",
    description: "",
    courseId: defaultCourseId,
    startsAt,
    endsAt: endFromDuration(startsAt, 7),
    mode: "solo",
    teamSize: "3",
    allowLateRegistration: true,
    showcaseMode: "after_end",
  };
}

export type TournamentFormErrors = Partial<Record<"title" | "description" | "courseId" | "startsAt" | "endsAt" | "teamSize", string>>;

const blankHtml = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length === 0;

export function validateTournamentForm(
  s: TournamentFormState,
  ctx: { now: Date },
): { errors: TournamentFormErrors; warnings: TournamentFormErrors } {
  const errors: TournamentFormErrors = {};
  const warnings: TournamentFormErrors = {};

  if (!s.title.trim()) errors.title = "Nhập tên đấu trường.";
  if (blankHtml(s.description)) errors.description = "Nhập mô tả ngắn: mục tiêu và luật chơi.";
  if (!s.courseId) errors.courseId = "Chọn khoá học cho đấu trường.";

  const startIso = fromDateTimeInputValue(s.startsAt);
  const endIso = fromDateTimeInputValue(s.endsAt);
  if (!startIso) errors.startsAt = "Chọn thời điểm bắt đầu.";
  if (!endIso) errors.endsAt = "Chọn thời điểm kết thúc.";
  if (startIso && endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (end <= start) errors.endsAt = "Thời điểm kết thúc phải sau thời điểm bắt đầu.";
    else if (end <= ctx.now) errors.endsAt = `Thời điểm kết thúc đã qua (${formatDateTime(end)}). Chọn một mốc trong tương lai.`;
    if (start < ctx.now && !errors.endsAt) {
      warnings.startsAt = "Thời điểm bắt đầu đã qua. Giải sẽ mở ngay khi bạn công bố.";
    }
  }

  if (s.mode === "team") {
    const n = Number(s.teamSize);
    if (!/^\d+$/.test(s.teamSize.trim()) || n < 2 || n > 10) errors.teamSize = "Nhập số người mỗi đội từ 2 đến 10.";
  }

  return { errors, warnings };
}

/** XP thưởng không nhập ở đây: chia thưởng làm ở tab Giải thưởng sau khi tạo. */
export function buildCreateTournamentPayload(s: TournamentFormState): Record<string, unknown> {
  const p: Record<string, unknown> = {
    title: s.title.trim(),
    description: s.description,
    startsAt: fromDateTimeInputValue(s.startsAt),
    endsAt: fromDateTimeInputValue(s.endsAt),
    teamSize: s.mode === "team" ? Math.round(Number(s.teamSize)) : 1,
    allowLateRegistration: s.allowLateRegistration,
    showcaseMode: s.showcaseMode,
  };
  if (s.courseId && s.courseId !== "PLATFORM") p.courseId = s.courseId;
  return p;
}
