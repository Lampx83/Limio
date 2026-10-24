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
  { id: "live_from_document", label: "Soạn bài giảng từ tài liệu", description: "Tải lên tài liệu, AI dựng dàn ý rồi tạo slide tương tác để trình chiếu.", href: "/instructor/limio-live/from-document", icon: "slides" },
  { id: "live_from_pptx", label: "Nhập bài giảng PowerPoint", description: "Đưa tệp PowerPoint có sẵn vào để trình chiếu và thêm tương tác.", href: "/instructor/limio-live/from-pptx", icon: "pptx" },
  { id: "live_decks", label: "Slide của tôi", description: "Mở các slide tương tác đã soạn để chỉnh sửa hoặc trình chiếu.", href: "/instructor/limio-live", icon: "slides" },
  { id: "teaching_tools", label: "Hoạt động trên lớp", description: "Bộ công cụ làm lớp sôi nổi: bình chọn, đám mây từ, bảng ý tưởng, chia nhóm, gọi tên, đếm ngược.", href: "/instructor/teaching-tools", icon: "poll" },
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
  { id: "teaching_schedule", label: "Lịch dạy", description: "Xem các buổi dạy trong tuần của mọi lớp; đặt lịch từng lớp ở trang lớp trong khoá học.", href: "/instructor/lich-day", icon: "organize" },
  { id: "pack_library", label: "Giáo trình dựng sẵn", description: "Chọn giáo trình đã soạn sẵn giáo án từng buổi, sao về khoá của thầy/cô rồi chỉ việc dạy.", href: "/instructor/giao-trinh", icon: "course" },
  { id: "grade_essays", label: "Chấm bài tự luận", description: "Chấm các câu trả lời tự luận đang chờ.", href: "/instructor/grade-essays", icon: "grading" },
  { id: "assignments", label: "Chấm bài tập", description: "Xem các bài tập học viên đã nộp và đang chờ chấm.", href: "/instructor/assignments?view=pending", icon: "assignment" },
  { id: "forum", label: "Trả lời diễn đàn", description: "Giải đáp các câu hỏi học viên đang chờ trên diễn đàn.", href: "/instructor/forum?status=stale", icon: "forum" },
  { id: "stale_learners", label: "Học viên im ắng", description: "Xem những học viên lâu chưa học để nhắn nhủ, nhắc nhở.", href: "/instructor/enrollments?status=stale", icon: "learners" },
  { id: "learner_insights", label: "Học viên đang vướng ở đâu", description: "Xem chủ đề nào cả lớp còn yếu để ôn lại đúng chỗ.", href: "/instructor/learner-insights", icon: "insight" },
  { id: "question_banks", label: "Ngân hàng câu hỏi", description: "Soạn và quản lý câu hỏi dùng cho đề thi và bài kiểm tra.", href: "/instructor/question-banks", icon: "bank" },
  { id: "exams", label: "Thiết kế đề thi", description: "Lập đề thi từ ngân hàng câu hỏi.", href: "/instructor/exams", icon: "exam" },
  { id: "quick_exam", label: "Link thi nhanh", description: "Tạo nhanh một buổi kiểm tra trên lớp: chọn đề, gửi link cho cả lớp làm ngay.", href: "/instructor/organize/quick", icon: "exam" },
  { id: "organize", label: "Tổ chức thi", description: "Lập đợt thi, ca thi và phòng thi cho thí sinh.", href: "/instructor/organize", icon: "organize" },
  { id: "exam_history", label: "Lịch sử thi", description: "Xem lại các buổi và đợt thi đã tổ chức cùng kết quả.", href: "/instructor/exam-history", icon: "organize" },
  { id: "oral_exam_new", label: "Soạn đề vấn đáp", description: "Soạn đề cho phòng vấn đáp AI: câu hỏi, tiêu chí và thời gian.", href: "/instructor/oral-exams/new", icon: "oral" },
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
  href: string;
}

/** Câu gửi cho Limio khi giảng viên bấm "Chưa có ý tưởng?". Nút này nằm dưới ô nhập, không phải một thẻ. */
export const IDEA_PROMPT = "Hôm nay tôi chưa có ý tưởng. Hãy xem tình hình của tôi và gợi ý những việc nên làm.";

/**
 * Các thẻ "hôm nay làm gì": chỉ vài việc soạn thường làm, để giảng viên không bị ngợp. Việc đang chờ (bài chưa chấm,
 * câu hỏi chưa trả lời) KHÔNG nằm ở đây vì danh sách "Cần xử lý gấp" ngay bên dưới đã nêu, kể cả sắp theo độ ưu tiên.
 */
export function buildStarters(ctx: AssistantContext): AssistantStarter[] {
  const latest = ctx.courses?.[0];
  return [
    { id: "new_course", title: "Soạn khoá học e-learning", subtitle: "Dựng khoá mới với chương và bài học.", icon: "course", href: destinationById("new_course")!.href },
    { id: "new_live", title: "Soạn slide tương tác", subtitle: "Dựng slide để trình chiếu từ tài liệu.", icon: "slides", href: destinationById("live_from_document")!.href },
    { id: "class_activity", title: "Làm lớp sôi nổi hơn", subtitle: "Bình chọn, đám mây từ, chia nhóm, gameshow.", icon: "poll", href: destinationById("teaching_tools")!.href },
    { id: "class_quiz", title: "Tạo bài kiểm tra trên lớp", subtitle: "Gửi link thi nhanh cho cả lớp làm ngay.", icon: "exam", href: destinationById("quick_exam")!.href },
    { id: "grade", title: "Chấm bài", subtitle: "Xem bài học viên đã nộp và chấm nhanh.", icon: "grading", href: destinationById("assignments")!.href },
    ...(latest
      ? [{ id: "open_course", title: `Mở khoá "${latest.title.replace(/\s+/g, " ").trim().slice(0, 40)}"`, subtitle: "Khoá bạn vừa chỉnh sửa gần đây.", icon: "course" as const, href: `/instructor/courses/${encodeURIComponent(latest.id)}` }]
      : []),
  ];
}

// ── Chuẩn hoá câu trả lời của mô hình ───────────────────────────────────────

export const ASSISTANT_REPLY_MAX = 2400;
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
