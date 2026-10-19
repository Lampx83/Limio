// Trợ lý trang chủ giảng viên ("Hôm nay thầy/cô muốn làm gì?"). Module thuần: danh mục điểm đến, gợi ý khởi đầu theo
// tình hình của giảng viên, và chuẩn hoá câu trả lời của mô hình. Không tin thẳng đầu ra mô hình: AI chỉ được CHỌN mã
// điểm đến trong danh mục, đường dẫn luôn lấy từ danh mục, nên không có chuyện AI dẫn giảng viên tới trang không tồn tại.

import { stripEmoji } from "./limioLiveOutline";
import { CHAT_MESSAGE_MAX, sanitizeChatHistory, type ChatTurn } from "./limioLiveChat";

export { CHAT_MESSAGE_MAX, sanitizeChatHistory, type ChatTurn };

/** Tên biểu tượng (lucide) để client vẽ; giữ là chuỗi để dữ liệu này đi qua ranh giới server/client được. */
export type AssistantIcon =
  | "grading"
  | "assignment"
  | "forum"
  | "course"
  | "slides"
  | "pptx"
  | "poll"
  | "wordcloud"
  | "board"
  | "drawit"
  | "whiteboard"
  | "timer"
  | "picker"
  | "grouping"
  | "gameshow"
  | "bank"
  | "exam"
  | "organize"
  | "oral"
  | "tournament"
  | "insight"
  | "learners";

export interface AssistantDestination {
  id: string;
  label: string;
  /** Một câu cho AI biết điểm đến này làm được gì, và cho giảng viên đọc ở thẻ gợi ý. */
  description: string;
  href: string;
  icon: AssistantIcon;
}

export const ASSISTANT_DESTINATIONS: readonly AssistantDestination[] = [
  { id: "live_from_document", label: "Soạn bài giảng từ tài liệu", description: "Tải lên tài liệu, AI dựng dàn ý rồi tạo bài giảng tương tác để trình chiếu.", href: "/instructor/limio-live/from-document", icon: "slides" },
  { id: "live_from_pptx", label: "Nhập bài giảng PowerPoint", description: "Đưa tệp PowerPoint có sẵn vào để trình chiếu và thêm tương tác.", href: "/instructor/limio-live/from-pptx", icon: "pptx" },
  { id: "live_decks", label: "Bài giảng của tôi", description: "Mở các bài giảng tương tác đã soạn để chỉnh sửa hoặc trình chiếu.", href: "/instructor/limio-live", icon: "slides" },
  { id: "poll", label: "Bình chọn nhanh", description: "Hỏi cả lớp một câu và xem kết quả ngay trên màn hình.", href: "/instructor/teaching-tools?tool=poll", icon: "poll" },
  { id: "wordcloud", label: "Đám mây từ", description: "Cả lớp nhập từ khoá, các từ được nhắc nhiều hiện to hơn.", href: "/instructor/teaching-tools?tool=wordcloud", icon: "wordcloud" },
  { id: "board", label: "Bảng ý tưởng (Padlet)", description: "Mỗi người ghim một ý lên bảng chung để cùng thu thập và thảo luận.", href: "/instructor/teaching-tools?tool=board", icon: "board" },
  { id: "drawit", label: "Vẽ nhanh (Draw-it)", description: "Cả lớp vẽ minh hoạ một khái niệm rồi so sánh kết quả.", href: "/instructor/teaching-tools?tool=drawit", icon: "drawit" },
  { id: "whiteboard", label: "Bảng trắng", description: "Bảng trắng chung để viết, vẽ sơ đồ cùng lớp.", href: "/instructor/teaching-tools?tool=whiteboard", icon: "whiteboard" },
  { id: "timer", label: "Đếm ngược", description: "Bộ đếm giờ cho hoạt động nhóm hoặc làm bài ngắn.", href: "/instructor/teaching-tools?tool=timer", icon: "timer" },
  { id: "random_picker", label: "Gọi tên ngẫu nhiên", description: "Chọn ngẫu nhiên một học viên để trả lời hoặc trình bày.", href: "/instructor/teaching-tools?tool=random-picker", icon: "picker" },
  { id: "grouping", label: "Chia nhóm", description: "Chia lớp thành các nhóm ngẫu nhiên hoặc theo số lượng.", href: "/instructor/teaching-tools?tool=grouping", icon: "grouping" },
  { id: "gameshow", label: "Gameshow", description: "Trò chơi hỏi đáp có tính điểm để ôn tập sôi nổi trong lớp.", href: "/instructor/gameshow/new", icon: "gameshow" },
  { id: "new_course", label: "Tạo khoá học mới", description: "Dựng một khoá học mới với các chương và bài học.", href: "/instructor/courses/new", icon: "course" },
  { id: "my_courses", label: "Khoá học của tôi", description: "Xem và chỉnh sửa các khoá học đang dạy.", href: "/instructor/courses", icon: "course" },
  { id: "grade_essays", label: "Chấm bài tự luận", description: "Chấm các câu trả lời tự luận đang chờ.", href: "/instructor/grade-essays", icon: "grading" },
  { id: "assignments", label: "Chấm bài tập", description: "Xem các bài tập học viên đã nộp và đang chờ chấm.", href: "/instructor/assignments?view=pending", icon: "assignment" },
  { id: "forum", label: "Trả lời diễn đàn", description: "Giải đáp các câu hỏi học viên đang chờ trên diễn đàn.", href: "/instructor/forum?status=stale", icon: "forum" },
  { id: "stale_learners", label: "Học viên im ắng", description: "Xem những học viên lâu chưa học để nhắn nhủ, nhắc nhở.", href: "/instructor/enrollments?status=stale", icon: "learners" },
  { id: "learner_insights", label: "Học viên đang vướng ở đâu", description: "Xem chủ đề nào cả lớp còn yếu để ôn lại đúng chỗ.", href: "/instructor/learner-insights", icon: "insight" },
  { id: "question_banks", label: "Ngân hàng câu hỏi", description: "Soạn và quản lý câu hỏi dùng cho đề thi và bài kiểm tra.", href: "/instructor/question-banks", icon: "bank" },
  { id: "exams", label: "Thiết kế đề thi", description: "Lập đề thi từ ngân hàng câu hỏi.", href: "/instructor/exams", icon: "exam" },
  { id: "organize", label: "Tổ chức thi", description: "Lập đợt thi, ca thi và phòng thi cho thí sinh.", href: "/instructor/organize", icon: "organize" },
  { id: "oral_exams", label: "Vấn đáp AI", description: "Mở phòng vấn đáp để AI hỏi đáp trực tiếp với học viên.", href: "/instructor/oral-exams", icon: "oral" },
  { id: "tournaments", label: "Đấu trường", description: "Tổ chức cuộc thi nhiều vòng có xếp hạng để tạo động lực học.", href: "/instructor/tournaments", icon: "tournament" },
];

const BY_ID = new Map(ASSISTANT_DESTINATIONS.map((d) => [d.id, d] as const));
export const destinationById = (id: string) => BY_ID.get(id);

/** Số khoá tối đa đưa vào danh mục điểm đến của một lượt (giữ prompt gọn với giảng viên dạy rất nhiều khoá). */
const MAX_COURSE_DESTINATIONS = 15;
export const COURSE_DEST_PREFIX = "course:";

/** Mỗi khoá của giảng viên là một điểm đến riêng: Limio dẫn thẳng vào khoá được nhắc tên thay vì trang danh sách chung. */
export function courseDestinations(courses: readonly { id: string; title: string }[] | undefined): AssistantDestination[] {
  return (courses ?? []).slice(0, MAX_COURSE_DESTINATIONS).map((c) => ({
    id: `${COURSE_DEST_PREFIX}${c.id}`,
    label: `Khoá "${c.title.replace(/\s+/g, " ").trim().slice(0, 80)}"`,
    description: "Mở khoá học này để chỉnh sửa nội dung, xem học viên và cài đặt.",
    href: `/instructor/courses/${encodeURIComponent(c.id)}`,
    icon: "course",
  }));
}

// ── Gợi ý khởi đầu: thẻ nhìn thấy ngay khi vào trang ────────────────────────

export interface AssistantContext {
  courseTitles: string[];
  /** Khoá đang dạy (id + tên) để Limio dẫn thẳng vào đúng khoá; chỉ route trợ lý cần, thẻ gợi ý thì không. */
  courses?: { id: string; title: string }[];
  pendingEssays: number;
  pendingAssignments: number;
  staleForumThreads: number;
  staleLearners: number;
}

export interface AssistantStarter {
  id: string;
  title: string;
  subtitle: string;
  icon: AssistantIcon;
  /** Có `href` thì thẻ là đường dẫn thẳng; ngược lại bấm vào là hỏi AI bằng `prompt`. */
  href?: string;
  prompt?: string;
  /** Việc đang chờ giảng viên (hiện dấu nhấn và đưa lên đầu). */
  urgent?: boolean;
}

const MAX_STARTERS = 6;

/**
 * Các thẻ "hôm nay làm gì". Việc đang chờ (bài chưa chấm, câu hỏi chưa trả lời) đứng đầu vì đó là thứ giảng viên
 * phải làm dù có ý tưởng hay không; phần còn lại là việc thường làm, và thẻ cuối luôn là "chưa có ý tưởng" để hỏi AI.
 */
export function buildStarters(ctx: AssistantContext): AssistantStarter[] {
  const out: AssistantStarter[] = [];
  const pending = (id: string, count: number, title: string, subtitle: string) => {
    const d = destinationById(id)!;
    out.push({ id, title: `${count} ${title}`, subtitle, icon: d.icon, href: d.href, urgent: true });
  };
  if (ctx.pendingEssays > 0) pending("grade_essays", ctx.pendingEssays, "bài tự luận chờ chấm", "Chấm xong để học viên nhận được phản hồi.");
  if (ctx.pendingAssignments > 0) pending("assignments", ctx.pendingAssignments, "bài tập chờ chấm", "Học viên đã nộp và đang đợi nhận xét.");
  if (ctx.staleForumThreads > 0) pending("forum", ctx.staleForumThreads, "câu hỏi chưa được trả lời", "Đã quá hai ngày trên diễn đàn.");

  const evergreen: AssistantStarter[] = [
    { id: "lesson_prep", title: "Chuẩn bị bài giảng", subtitle: "Dựng bài giảng tương tác từ tài liệu có sẵn.", icon: "slides", href: destinationById("live_from_document")!.href },
    { id: "class_activity", title: "Làm lớp sôi nổi hơn", subtitle: "Bình chọn, đám mây từ, chia nhóm, gameshow.", icon: "poll", prompt: "Tôi sắp lên lớp. Gợi ý cho tôi vài hoạt động ngắn để cả lớp tham gia." },
    { id: "assess", title: "Ra đề, kiểm tra", subtitle: "Soạn ngân hàng câu hỏi và tổ chức thi.", icon: "exam", href: destinationById("question_banks")!.href },
    ctx.courseTitles.length === 0
      ? { id: "first_course", title: "Tạo khoá học đầu tiên", subtitle: "Bắt đầu từ một khoá trống rồi thêm bài học.", icon: "course", href: destinationById("new_course")!.href }
      : { id: "insight", title: "Xem lớp đang vướng ở đâu", subtitle: "Biết chủ đề nào cần ôn lại trước buổi tới.", icon: "insight", href: destinationById("learner_insights")!.href },
  ];
  const idea: AssistantStarter = {
    id: "no_idea",
    title: "Chưa có ý tưởng? Limio gợi ý",
    subtitle: "Để Limio xem tình hình các khoá rồi đề xuất việc nên làm.",
    icon: "wordcloud",
    prompt: "Hôm nay tôi chưa có ý tưởng. Hãy xem tình hình của tôi và gợi ý những việc nên làm.",
  };

  const room = MAX_STARTERS - 1 - out.length;
  return [...out, ...evergreen.slice(0, Math.max(room, 0)), idea].slice(0, MAX_STARTERS);
}

// ── Chuẩn hoá câu trả lời của mô hình ───────────────────────────────────────

export const ASSISTANT_REPLY_MAX = 1500;
const ACTIONS_MAX = 3;
const FOLLOWUPS_MAX = 3;
const FOLLOWUP_MAX_CHARS = 120;

export interface AssistantAction {
  id: string;
  label: string;
  href: string;
  icon: AssistantIcon;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
  followUps: string[];
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? stripEmoji(v).replace(/\s+([.,;:!?])(?=\s|$)/g, "$1").trim().slice(0, max) : "";

/** Đầu ra thô của mô hình → trả lời an toàn: mã lạ bị bỏ, trùng bị gộp, đường dẫn luôn lấy từ danh mục. */
export function normalizeAssistantReply(raw: unknown, extra: readonly AssistantDestination[] = []): AssistantReply {
  const lookup = (id: string) => BY_ID.get(id) ?? extra.find((d) => d.id === id);
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const actions: AssistantAction[] = [];
  for (const id of Array.isArray(o.actions) ? o.actions : []) {
    const d = typeof id === "string" ? lookup(id) : undefined;
    if (d && !actions.some((a) => a.id === d.id)) actions.push({ id: d.id, label: d.label, href: d.href, icon: d.icon });
    if (actions.length >= ACTIONS_MAX) break;
  }
  const followUps = [
    ...new Set((Array.isArray(o.followUps) ? o.followUps : []).map((x) => clean(x, FOLLOWUP_MAX_CHARS)).filter(Boolean)),
  ].slice(0, FOLLOWUPS_MAX);
  return {
    reply: clean(o.reply, ASSISTANT_REPLY_MAX) || "Limio chưa trả lời được câu này. Thầy/cô thử nói lại theo cách khác nhé.",
    actions,
    followUps,
  };
}

/** Tình hình giảng viên dưới dạng văn bản cho mô hình. Chỉ nêu số liệu có thật; mục bằng 0 thì bỏ. */
export function describeSituation(ctx: AssistantContext): string {
  const lines: string[] = [];
  lines.push(
    ctx.courseTitles.length > 0
      ? `Đang dạy ${ctx.courseTitles.length} khoá: ${ctx.courseTitles.slice(0, 8).join("; ")}.`
      : "Chưa dạy khoá nào trên Limio (người dùng mới).",
  );
  if (ctx.pendingEssays > 0) lines.push(`${ctx.pendingEssays} bài tự luận đang chờ chấm.`);
  if (ctx.pendingAssignments > 0) lines.push(`${ctx.pendingAssignments} bài tập đã nộp đang chờ chấm.`);
  if (ctx.staleForumThreads > 0) lines.push(`${ctx.staleForumThreads} câu hỏi diễn đàn chưa được trả lời quá 48 giờ.`);
  if (ctx.staleLearners > 0) lines.push(`${ctx.staleLearners} học viên không hoạt động quá 14 ngày.`);
  return lines.join("\n");
}
