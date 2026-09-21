/**
 * Event names emitted into the LearningEvent table.
 * See CLAUDE.md §4.2 and SPEC.docx §6.1.
 *
 * Format: <domain>.<entity>.<verb_past_tense>
 * Idempotent — payload schema-validated per type.
 */
export const LearningEventType = {
  // LMS
  LessonViewed: "lesson.viewed",
  LessonCompleted: "lesson.completed",
  LessonEngaged: "lesson.engaged",
  EnrollmentSectionChanged: "enrollment.section_changed",
  AiTutorAsked: "ai.tutor.asked",
  /** In-video quiz cuepoint passed (formative — not a full QuizAttempt). */
  VideoCuepointPassed: "video.cuepoint.passed",
  QuizStarted: "quiz.started",
  QuizSubmitted: "quiz.submitted",
  QuizQuestionAnswered: "quiz.question.answered",
  AssignmentSubmitted: "assignment.submitted",
  AssignmentGraded: "assignment.graded",
  AssignmentSelfRated: "assignment.self_rated",
  AssignmentReflected: "assignment.reflected",
  ForumPosted: "forum.posted",
  ForumUpvoted: "forum.upvoted",
  ForumAnswered: "forum.answered",
  EnrollmentCreated: "enrollment.created",
  EnrollmentStatusChanged: "enrollment.status_changed",
  // Bán khoá học có thời hạn (CourseAccessPlan) — mua lần đầu hoặc gia hạn.
  EnrollmentAccessExtended: "enrollment.access.extended",
  // Cron reaper phát hiện accessExpiresAt đã qua, chuyển status -> expired.
  EnrollmentAccessExpired: "enrollment.access.expired",
  // Cron nhắc hạn đã gửi email — chống gửi trùng qua accessExpiryReminderSentAt.
  EnrollmentAccessReminderSent: "enrollment.access.reminder_sent",
  CourseCompleted: "course.completed",
  CourseInstructorAdded: "course.instructor.added",
  CourseInstructorRemoved: "course.instructor.removed",

  // Session — không gắn courseId (đăng nhập không thuộc một khoá cụ thể).
  /** Đăng nhập thành công, mọi provider. Payload chỉ mang phân loại thô — xem SessionStartedPayload. */
  SessionStarted: "session.started",

  // A7 Exam
  ExamCreated: "exam.created",
  ExamPublished: "exam.published",
  ExamStarted: "exam.started",
  ExamQuestionAnswered: "exam.question.answered",
  ExamAutosaved: "exam.autosaved",
  ExamSubmitted: "exam.submitted",
  ExamAutoSubmitted: "exam.auto_submitted",
  ExamGraded: "exam.graded",
  ExamRegraded: "exam.regraded",
  ExamIncidentFlagged: "exam.incident.flagged",
  // A5.3.5 — Instructor live actions
  ExamAttemptExtended: "exam.attempt.extended",
  ExamAttemptForceSubmitted: "exam.attempt.force_submitted",
  ExamAttemptSessionReset: "exam.attempt.session_reset",
  ExamAttemptDisqualified: "exam.attempt.disqualified",
  ExamMessageSent: "exam.message.sent",
  ExamMessageBroadcast: "exam.message.broadcast",
  ExamAttemptHeartbeatLost: "exam.attempt.heartbeat_lost",
  // A5.8 — Code-based access lifecycle
  ExamCandidateCreated: "exam.candidate.created",
  ExamCandidateCodeClaimed: "exam.candidate.code_claimed",
  // Tổ chức thi (đợt / ca / phòng / thí sinh) — audit mọi thay đổi do người dùng
  // thực hiện. Payload KHÔNG chứa mã truy cập (mã mở, mã dự thi, mã giám thị).
  ExamRoundCreated: "exam.round.created",
  ExamRoundUpdated: "exam.round.updated",
  ExamRoundDeleted: "exam.round.deleted",
  ExamRoundAdminAdded: "exam.round.admin_added",
  ExamRoundAdminRemoved: "exam.round.admin_removed",
  ExamSessionCreated: "exam.session.created",
  ExamSessionUpdated: "exam.session.updated",
  ExamSessionDeleted: "exam.session.deleted",
  ExamSessionOpened: "exam.session.opened",
  ExamSessionClosed: "exam.session.closed",
  ExamSessionRevealPolicyChanged: "exam.session.reveal_policy_changed",
  ExamRoomCreated: "exam.room.created",
  ExamRoomUpdated: "exam.room.updated",
  ExamRoomDeleted: "exam.room.deleted",
  ExamCandidatesAdded: "exam.candidates.added",
  ExamCandidatesMoved: "exam.candidates.moved",
  ExamCandidateRemoved: "exam.candidate.removed",
  ExamCandidateAttendanceSet: "exam.candidate.attendance_set",
  ExamProctorInvited: "exam.proctor.invited",
  ExamShareLinkOpened: "exam.share_link.opened",
  // Audio runtime — P1 only
  ExamAudioPlayed: "exam.audio.played",
  ExamAudioCompleted: "exam.audio.completed",
  ExamPassageViewed: "exam.passage.viewed",
  // A6.1 — Vấn đáp AI: tài liệu GV upload cho giảng viên ảo (chưa phải AI turn).
  ExamOralMaterialUploaded: "exam.oral_material.uploaded",
  ExamOralMaterialDeleted: "exam.oral_material.deleted",
  // A6.2 — cắt + embed tài liệu cho pgvector search (RAG, xem A6.3).
  ExamOralMaterialEmbedded: "exam.oral_material.embedded",
  // A6.7 — chủ đề giao cho từng sinh viên: GV thêm/xoá chủ đề, và hệ thống GIAO một
  // chủ đề khi sinh viên bắt đầu lượt thi (để rebuild được "ai nhận chủ đề nào").
  ExamOralTopicCreated: "exam.oral_topic.created",
  ExamOralTopicDeleted: "exam.oral_topic.deleted",
  ExamOralTopicAssigned: "exam.oral_topic.assigned",
  // A6.3 — 1 lượt hỏi/đáp trong buổi vấn đáp AI. `ended` trong payload phân
  // biệt lượt bình thường với lượt kết thúc buổi thi.
  ExamOralAttemptTurnRecorded: "exam.oral_attempt.turn_recorded",
  // A6.4 — chấm điểm buổi vấn đáp: AI đề xuất, rồi GV duyệt/sửa.
  ExamOralEvaluationGenerated: "exam.oral_evaluation.generated",
  ExamOralEvaluationGraded: "exam.oral_evaluation.graded",

  // Feedback
  SkillStateUpdated: "skill.state.updated",
  MisconceptionDetected: "misconception.detected",
  MisconceptionResolved: "misconception.resolved",
  FeedbackDelivered: "feedback.delivered",
  FeedbackRated: "feedback.rated",
  /** B9.2 — learner opened a lesson the feedback routed them to (uptake). */
  FeedbackRemediationClicked: "feedback.remediation.clicked",
  AdaptivePathUpdated: "adaptive.path.updated",

  // Gamification
  XpAwarded: "xp.awarded",
  LevelUp: "level.up",
  BadgeEarned: "badge.earned",
  QuestCompleted: "quest.completed",
  StreakExtended: "streak.extended",
  StreakBroken: "streak.broken",
  LeaderboardUpdated: "leaderboard.updated",

  // Tournament
  TournamentCreated: "tournament.created",
  TournamentPublished: "tournament.published",
  TournamentRegistered: "tournament.registered",
  TournamentTeamFormed: "tournament.team.formed",
  TournamentStarted: "tournament.started",
  TournamentEnded: "tournament.ended",
  TournamentMissionUnlocked: "tournament.mission.unlocked",
  TournamentMissionCompleted: "tournament.mission.completed",
  TournamentRankingUpdated: "tournament.ranking.updated",
  TournamentDisqualified: "tournament.disqualified",
  TournamentPrizeDistributed: "tournament.prize.distributed",

  // C5.x — Custom missions
  TournamentMissionSubmitted: "tournament.mission.submitted",
  TournamentMissionVerified: "tournament.mission.verified",
  TournamentMissionReviewAssigned: "tournament.mission.review.assigned",
  TournamentMissionReviewUnassigned: "tournament.mission.review.unassigned",
  TournamentMissionReviewed: "tournament.mission.reviewed",
  TournamentMissionReviewAwarded: "tournament.mission.review.awarded",
  TournamentMissionReviewFlagged: "tournament.mission.review.flagged",
  TournamentMissionReviewWindowExtended: "tournament.mission.review.window_extended",
  TournamentMissionReviewFallbackManual: "tournament.mission.review.fallback_manual",
  TournamentMissionSpeedRunBlocked: "tournament.mission.speed_run_blocked",
} as const;

export type LearningEventType =
  (typeof LearningEventType)[keyof typeof LearningEventType];

/**
 * A5.8 (Q7) — Discriminator for event consumers in Module B (Feedback Engine)
 * and Module C (Gamification). Candidate-emitted events have `userId=null`
 * because anonymous test-takers don't own a `User` row → no LearnerSkillState,
 * no XP ledger, no badges. Consumers MUST filter these out before mutating
 * learner-side state. Pattern at start of every handler:
 *
 *     if (!isLearnerEvent(event)) return;
 *
 * `LearningEvent` still records the row (with candidateId set) so item
 * analytics (P2.5) can read it. Only learner-state mutation is gated.
 */
export function isLearnerEvent(event: {
  userId: string | null;
}): event is { userId: string } {
  return event.userId !== null;
}

/** Payload shapes for Phase 0 events. Extend per phase. */
export interface LessonViewedPayload {
  lessonId: string;
  durationSec: number;
  positionSec: number;
}

/**
 * B11 — một lượt ngồi đọc bài đã khép lại. Phát khi người học rời bài (đóng
 * tab, chuyển trang, hoặc ẩn tab đủ lâu), KHÔNG phát theo từng nhịp heartbeat:
 * mỗi nhịp một event thì một lớp 60 người đọc 30 phút sinh ra hàng nghìn dòng
 * mà chẳng nói thêm được gì so với một dòng tổng kết.
 */
export interface LessonEngagedPayload {
  lessonId: string;
  /** Số giây tab thực sự hiện và bài đang mở, trong riêng lượt này. */
  activeSec: number;
  /** Cuộn sâu nhất trong lượt này, 0–100. */
  scrollPct: number;
  /** Tỉ lệ video xem được cao nhất trong lượt này, 0–100. Không có video thì 0. */
  videoPct: number;
  /** Tổng số giây cộng dồn của bài này sau khi tính cả lượt vừa rồi. */
  totalActiveSec: number;
}

export interface LessonCompletedPayload {
  lessonId: string;
  reason: "watched_threshold" | "marked_complete";
}

export interface QuizStartedPayload {
  quizId: string;
  attemptId: string;
}

export interface QuizSubmittedPayload {
  quizId: string;
  attemptId: string;
  scorePct: number;
  /** Chỉ có ở event cũ (trước khi bỏ ngưỡng đạt của quiz); event mới không ghi. */
  passed?: boolean;
}

export interface QuizQuestionAnsweredPayload {
  quizId: string;
  attemptId: string;
  questionId: string;
  optionIds: string[];
  isCorrect: boolean;
  confidence?: number;
  /** Mili-giây từ lúc bắt đầu cả lượt làm bài — KHÔNG phải thời gian câu này. */
  responseTimeMs: number;
  /** B12 — thời gian thật của riêng câu này. Null khi máy khách không gửi. */
  latencyMs: number | null;
  /** Số lần người học sửa lại đáp án của câu này trước khi nộp. */
  revisionCount: number;
}

/**
 * B14 — người học đổi lớp. Ghi lại vì với một khoá đang chạy thực nghiệm, đổi
 * lớp là đổi luôn nhóm đối chứng, và `Enrollment.sectionId` chỉ giữ trạng thái
 * cuối chứ không giữ lịch sử.
 */
export interface EnrollmentSectionChangedPayload {
  enrollmentId: string;
  courseId: string;
  fromSectionId: string;
  toSectionId: string;
  via: "invite_link" | "instructor";
}

/**
 * B15 — người học hỏi trợ giảng AI một lượt.
 *
 * KHÔNG mang nội dung câu hỏi. Nội dung đã nằm nguyên văn ở `AiMessage`; nhân
 * bản nó sang một bảng append-only vĩnh viễn là tăng gấp đôi bề mặt dữ liệu
 * nhạy cảm mà không trả lời thêm được câu hỏi nào. Cái dòng event này cần trả
 * lời là "em ấy có hỏi không, hỏi bao nhiêu, ở bài nào, vào lúc nào".
 */
export interface AiTutorAskedPayload {
  lessonId: string;
  conversationId: string;
  /** Số ký tự câu hỏi — đo mức đầu tư mà không lưu lại chữ nào. */
  questionLength: number;
  /** Lượt thứ mấy trong hội thoại này. Lượt 5 khác hẳn lượt 1. */
  turnIndex: number;
}

export interface EnrollmentCreatedPayload {
  enrollmentId: string;
  courseId: string;
  // A6 — CourseSection (invite-link) the enrollment landed in. Optional:
  // additive field, older EnrollmentCreated rows predate CourseSection.
  sectionId?: string;
}

/**
 * Mua/gia hạn truy cập khoá học theo CourseAccessPlan. `newExpiresAt: null`
 * nghĩa là gói vĩnh viễn — không phải "vẫn giữ hạn cũ".
 */
export interface EnrollmentAccessExtendedPayload {
  enrollmentId: string;
  courseId: string;
  accessPlanId: string | null;
  durationMonths: number | null;
  previousExpiresAt: string | null;
  newExpiresAt: string | null;
}

export interface EnrollmentAccessExpiredPayload {
  enrollmentId: string;
  courseId: string;
  expiredAt: string;
}

export interface EnrollmentAccessReminderSentPayload {
  enrollmentId: string;
  courseId: string;
  accessExpiresAt: string;
}

// =====================================================================
// A7 Exam payloads
// =====================================================================

export interface ExamCreatedPayload {
  examId: string;
  courseId: string;
}

// A6.1 — Vấn đáp AI
export interface ExamOralMaterialUploadedPayload {
  examId: string;
  materialId: string;
  type: "document" | "topic_list" | "rubric";
}

export interface ExamOralMaterialDeletedPayload {
  examId: string;
  materialId: string;
}

export interface ExamOralMaterialEmbeddedPayload {
  examId: string;
  materialId: string;
  chunkCount: number;
  tokensUsed: number;
}

export interface ExamOralTopicCreatedPayload {
  examId: string;
  topicId: string;
}

export interface ExamOralTopicDeletedPayload {
  examId: string;
  topicId: string;
}

export interface ExamOralTopicAssignedPayload {
  examId: string;
  attemptId: string;
  topicId: string;
}

export interface ExamOralAttemptTurnRecordedPayload {
  examId: string;
  attemptId: string;
  questionsAsked: number;
  ended: boolean;
}

export interface ExamOralEvaluationGeneratedPayload {
  examId: string;
  attemptId: string;
  aiSuggestedScore: number | null;
}

export interface ExamOralEvaluationGradedPayload {
  examId: string;
  attemptId: string;
  instructorScore: number;
  status: "approved" | "overridden";
}

export interface ExamPublishedPayload {
  examId: string;
  courseId: string;
  questionCount: number;
  totalPoints: number;
}

export interface ExamStartedPayload {
  examId: string;
  attemptId: string;
  durationSec: number;
}

export interface ExamQuestionAnsweredPayload {
  examId: string;
  attemptId: string;
  questionId: string;
  passageId?: string;
  /** Server-canonical answer (shape per question type). */
  answerJson: unknown;
  /** Dedup key — hash(answerJson). */
  answerHash: string;
  /** Milliseconds since attempt start when this answer was saved. */
  elapsedMs: number;
}

export interface ExamAutosavedPayload {
  attemptId: string;
  questionId: string;
  answerHash: string;
}

export interface ExamSubmittedPayload {
  examId: string;
  attemptId: string;
  /** Total points awarded across already-auto-graded questions. */
  autoScore: number;
  /** True when no manual grading is pending. */
  fullyGraded: boolean;
}

export interface ExamAutoSubmittedPayload {
  examId: string;
  attemptId: string;
  reason: "timer_expired" | "close_window_passed";
  autoScore: number;
  fullyGraded: boolean;
}

export interface ExamGradedPayload {
  examId: string;
  attemptId: string;
  score: number;
  scorePct: number;
  // Không còn `passed`: đề thi trả về điểm, việc đạt hay không do quy chế bên
  // ngoài quyết định. Sự kiện cũ trong DB vẫn còn khoá này — không ai đọc nó.
}

export interface ExamRegradedPayload {
  attemptId: string;
  answerId: string;
  questionId: string;
  oldScore: number | null;
  newScore: number;
  changedBy: string;
  reason?: string;
}

export interface ExamIncidentFlaggedPayload {
  attemptId: string;
  incidentId: string;
  type:
    | "tab_blur"
    | "fullscreen_exit"
    | "paste"
    | "multi_tab"
    | "network_lost"
    | "multi_face";
  payload?: Record<string, unknown>;
}

/** Audio events — P1 only, types declared now for forward-compat. */
export interface ExamAudioPlayedPayload {
  attemptId: string;
  passageId: string;
  assetId: string;
  playNumber: number;
}

export interface ExamAudioCompletedPayload {
  attemptId: string;
  passageId: string;
  assetId: string;
  playNumber: number;
}

export interface ExamPassageViewedPayload {
  attemptId: string;
  passageId: string;
  dwellMs: number;
}

export interface VideoCuepointPassedPayload {
  /** ContentItem.id of the video this cuepoint belongs to. */
  contentItemId: string;
  /** Lesson the video lives in (denormalized for query convenience). */
  lessonId: string;
  /** Cuepoint timestamp in seconds. */
  atSec: number;
  /** Quiz that was rendered at this cuepoint. */
  quizId: string;
  /** Number of questions in the quiz. */
  questionCount: number;
  /** Total ms from cuepoint pause until learner pressed submit (sum of attempts). */
  totalDurationMs?: number;
  /** How many submissions before all questions were correct (≥ 1). */
  attemptCount: number;
}

/**
 * Emitted once per successful sign-in (mọi provider). Cố tình chỉ mang phân
 * loại thô — không có User-Agent nguyên văn, không có IP — để trả lời được
 * "sinh viên học lúc nào, từ thiết bị loại gì" mà không dựng thêm một nguồn
 * fingerprinting mới. Xem privacy-by-default, CLAUDE.md §5.4.
 */
export interface SessionStartedPayload {
  device: "mobile" | "tablet" | "desktop" | "unknown";
  /** Tên họ trình duyệt thô — "Chrome" | "Safari" | "Firefox" | "Edge" | "Other" | "unknown". */
  browser: string;
  provider: "credentials" | "google" | "microsoft" | (string & {});
}
