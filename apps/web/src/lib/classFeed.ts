/**
 * Dòng tin "Lớp đang học gì" ở trang chủ giảng viên: biến LearningEvent thành câu ngắn kiểu
 * "Minh Anh vừa hoàn thành bài 2.3", gộp các dòng giống nhau thành "Minh Anh, Lan và 3 bạn khác".
 *
 * Phần thuần (không đụng DB) để test được; truy vấn nằm ở `classFeedQuery.ts`.
 *
 * Chủ ý chỉ lấy khoảnh khắc tích cực/trung tính: không điểm số, không câu sai, không câu hỏi cho
 * trợ lý AI. Học viên đang gặp khó đã có chỗ riêng ("học viên im ắng" ở dòng trạng thái).
 */

export const FEED_EVENT_TYPES = [
  "lesson.completed",
  "assignment.submitted",
  "quiz.submitted",
  "badge.earned",
  "level.up",
  "enrollment.created",
  "forum.posted",
] as const;

export type FeedKind = (typeof FEED_EVENT_TYPES)[number];

export type FeedTargetKind = "lesson" | "quiz" | "assignment";

export type FeedClassification = {
  kind: FeedKind;
  /** Loại đối tượng cần tra tên (bài học/quiz/bài tập); null nếu tên đã nằm sẵn trong payload. */
  targetKind: FeedTargetKind | null;
  targetId: string | null;
  /** Tên sẵn có trong payload (huy hiệu, cấp). */
  detail: string | null;
};

const PHRASE: Record<FeedKind, string> = {
  "lesson.completed": "vừa hoàn thành bài",
  "assignment.submitted": "vừa nộp bài tập",
  "quiz.submitted": "vừa làm xong quiz",
  "badge.earned": "vừa nhận huy hiệu",
  "level.up": "vừa lên cấp",
  "enrollment.created": "vừa vào khoá",
  "forum.posted": "vừa đăng bài trên diễn đàn",
};

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Sự kiện nào được lên dòng tin, và đối tượng của nó là gì. Loại khác trả null. */
export function classifyFeedEvent(eventType: string, payload: unknown): FeedClassification | null {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  switch (eventType) {
    case "lesson.completed":
      return { kind: eventType, targetKind: "lesson", targetId: str(p.lessonId), detail: null };
    case "assignment.submitted":
      return { kind: eventType, targetKind: "assignment", targetId: str(p.assignmentId), detail: null };
    case "quiz.submitted":
      return { kind: eventType, targetKind: "quiz", targetId: str(p.quizId), detail: null };
    case "badge.earned":
      return { kind: eventType, targetKind: null, targetId: null, detail: str(p.badgeName) };
    case "level.up":
      return { kind: eventType, targetKind: null, targetId: null, detail: str(p.levelName) };
    case "enrollment.created":
    case "forum.posted":
      return { kind: eventType, targetKind: null, targetId: null, detail: null };
    default:
      return null;
  }
}

export type FeedInput = {
  id: string;
  occurredAt: Date;
  userId: string;
  /** Tên hiển thị đã xử lý quyền riêng tư (xem `learnerFeedName`). */
  name: string;
  avatarUrl: string | null;
  courseId: string | null;
  courseTitle: string | null;
  cls: FeedClassification;
  /** Tên bài/quiz/bài tập đã tra; null nếu không tra được. */
  targetTitle: string | null;
};

export type FeedItem = {
  key: string;
  kind: FeedKind;
  phrase: string;
  /** Tên đối tượng (bài học, huy hiệu…) in đậm sau cụm hành động; null khi không có. */
  target: string | null;
  people: { userId: string; name: string; avatarUrl: string | null }[];
  /** Tổng số học viên của dòng (có thể nhiều hơn `people`, vốn bị cắt ở 3). */
  total: number;
  names: string;
  courseId: string | null;
  courseTitle: string | null;
  occurredAt: Date;
};

/** Gộp từ 3 học viên cùng làm một việc trở lên thành một dòng. */
export const FEED_GROUP_MIN = 3;
const AVATARS_SHOWN = 3;

export function joinNames(names: string[], total: number = names.length): string {
  if (names.length === 0) return "";
  if (total <= 1) return names[0]!;
  if (total === 2 && names.length >= 2) return `${names[0]} và ${names[1]}`;
  const rest = total - 2;
  return `${names[0]}, ${names[1] ?? "một bạn"} và ${rest} bạn khác`;
}

/** Tên một học viên trên dòng tin: học viên đã tắt hiển thị công khai (leaderboard opt-out) hoặc không có tên thì ẩn danh. */
export function learnerFeedName(u: { displayName: string | null; leaderboardOptOut: boolean }): string {
  const n = u.displayName?.trim();
  return u.leaderboardOptOut || !n ? "Một học viên" : n;
}

export function buildFeed(inputs: FeedInput[], limit: number): FeedItem[] {
  // Gộp theo (loại việc, khoá, đối tượng); trong mỗi nhóm mỗi học viên chỉ tính một lần, lấy lần mới nhất.
  const groups = new Map<string, Map<string, FeedInput>>();
  for (const e of inputs) {
    const target = e.cls.targetId ?? e.cls.detail ?? "";
    const gk = `${e.cls.kind}|${e.courseId ?? ""}|${target}`;
    const g = groups.get(gk) ?? new Map<string, FeedInput>();
    const prev = g.get(e.userId);
    if (!prev || prev.occurredAt < e.occurredAt) g.set(e.userId, e);
    groups.set(gk, g);
  }

  const items: FeedItem[] = [];
  for (const [gk, g] of Array.from(groups)) {
    const members = Array.from(g.values()).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const sample = members[0]!;
    const target = sample.targetTitle ?? sample.cls.detail;
    const base = {
      kind: sample.cls.kind,
      phrase: PHRASE[sample.cls.kind],
      target,
      courseId: sample.courseId,
      courseTitle: sample.courseTitle,
    };
    const asPerson = (m: FeedInput) => ({ userId: m.userId, name: m.name, avatarUrl: m.avatarUrl });
    if (members.length >= FEED_GROUP_MIN) {
      const people = members.slice(0, AVATARS_SHOWN).map(asPerson);
      items.push({
        ...base,
        key: gk,
        // Câu gộp dùng "đã" thay "vừa": cả nhóm không còn là chuyện vừa xảy ra.
        phrase: base.phrase.replace("vừa ", "đã "),
        people,
        total: members.length,
        names: joinNames(people.map((p) => p.name), members.length),
        occurredAt: sample.occurredAt,
      });
    } else {
      for (const m of members) {
        items.push({
          ...base,
          key: `${gk}|${m.userId}`,
          people: [asPerson(m)],
          total: 1,
          names: m.name,
          occurredAt: m.occurredAt,
        });
      }
    }
  }

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
}
