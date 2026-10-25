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
  // Annotation theo vùng chọn trong bài (LessonAnnotation). Payload không mang
  // chữ của annotation — xem LessonAnnotationCreatedPayload.
  LessonAnnotationCreated: "lesson.annotation.created",
  LessonAnnotationPublished: "lesson.annotation.published",
  LessonAnnotationReplied: "lesson.annotation.replied",
  LessonAnnotationRemoved: "lesson.annotation.removed",
  // Bài học văn bản tạo/sửa bằng AI (tiêu chí S7 — đo tỉ lệ bài bị sửa tay sau khi AI tạo).
  // Payload không mang chữ của bài; xem LessonContentGeneratedPayload.
  LessonContentGenerated: "lesson.content.generated",
  LessonContentAiEdited: "lesson.content.ai_edited",
  LessonContentRestored: "lesson.content.restored",
  LessonContentConverted: "lesson.content.converted",
  // LANG G4 — một lượt ôn flashcard. Payload: itemId, contentItemId, rating, mode,
  // intervalDays, reviewId. Idempotent qua eventKey `flashcard.reviewed:<userId>:<reviewId>`.
  FlashcardReviewed: "flashcard.reviewed",
  /** In-video quiz cuepoint passed (formative — not a full QuizAttempt). */
  VideoCuepointPassed: "video.cuepoint.passed",
  QuizStarted: "quiz.started",
  QuizSubmitted: "quiz.submitted",
  QuizQuestionAnswered: "quiz.question.answered",
  AssignmentSubmitted: "assignment.submitted",
  AssignmentGraded: "assignment.graded",
  AssignmentSelfRated: "assignment.self_rated",
  AssignmentReflected: "assignment.reflected",
  // Nộp theo nhóm (docs/group-submission-AC.md). "Phần việc của tôi" của một
  // thành viên — payload chỉ mang độ dài, không mang chữ.
  AssignmentContributionNoted: "assignment.contribution.noted",
  // GV chỉnh điểm riêng một thành viên của bài nhóm (score = null ⇒ bỏ chỉnh, về điểm nhóm).
  AssignmentScoreOverridden: "assignment.score.overridden",
  // Nhóm cố định của khoá (CourseTeam). Subject là học viên bị ảnh hưởng;
  // thao tác của GV mang actorId trong payload.
  CourseTeamCreated: "course.team.created",
  CourseTeamJoined: "course.team.joined",
  CourseTeamLeft: "course.team.left",
  CourseTeamCodeRegenerated: "course.team.code_regenerated",
  // Đổi tên nhóm (trưởng nhóm khi chưa khoá, hoặc GV). Payload: teamId, from, to, actorId.
  CourseTeamRenamed: "course.team.renamed",
  CourseTeamCaptainChanged: "course.team.captain_changed",
  CourseTeamMemberMoved: "course.team.member_moved",
  // GV đổi số người tối đa / khoá-mở khoá danh sách nhóm. Subject là GV.
  CourseTeamsSettingsChanged: "course.teams.settings_changed",
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
  // A6 — Certification. Cấp 1 lần khi hoàn thành 100% course (idempotent).
  CertificateIssued: "certificate.issued",
  // A8 — E-portfolio. Ghim/bỏ ghim bài đã chấm, sửa câu giới thiệu, bật/tắt công khai.
  PortfolioItemAdded: "portfolio.item.added",
  PortfolioItemUpdated: "portfolio.item.updated",
  PortfolioItemRemoved: "portfolio.item.removed",
  PortfolioCourseAdded: "portfolio.course.added",
  PortfolioCourseRemoved: "portfolio.course.removed",
  PortfolioVisibilityChanged: "portfolio.visibility.changed",
  CourseInstructorAdded: "course.instructor.added",
  CourseInstructorRemoved: "course.instructor.removed",

  // D — Multi-tenancy. Platform Admin cấp/thu hồi quyền OrgAdmin cho user
  // (bảng OrganizationAdmin, xem packages/core-lms/src/org/admins.ts).
  OrgAdminGranted: "org.admin.granted",
  OrgAdminRevoked: "org.admin.revoked",
  // OrgAdmin (hoặc Platform Admin) gắn/gỡ user khỏi trường (User.organizationId).
  // Gỡ = quay lại "nhóm chung" của platform (organizationId = null), không xoá user.
  OrgMemberAdded: "org.member.added",
  OrgMemberRemoved: "org.member.removed",

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
  // LANG G5a — đề thi thử: phần thi bắt đầu/kết thúc (suy ra từ giờ, phát lười, idempotent).
  ExamSectionStarted: "exam.section.started",
  ExamSectionEnded: "exam.section.ended",
  // LANG G5e — luyện đề (bảng riêng, không phải lượt thi): trả lời một câu đã chấm, và kết thúc buổi.
  ExamPracticeAnswered: "exam.practice.answered",
  ExamPracticeCompleted: "exam.practice.completed",
  // LANG G6 — góp ý bài viết do AI sinh: sinh ra, giảng viên duyệt, giảng viên từ chối.
  WritingFeedbackGenerated: "writing.feedback.generated",
  WritingFeedbackApproved: "writing.feedback.approved",
  WritingFeedbackRejected: "writing.feedback.rejected",
  // LANG G7 — góp ý bài nói do AI sinh (từ bản chữ máy nghe được): sinh ra, giảng viên duyệt, từ chối.
  SpeakingFeedbackGenerated: "speaking.feedback.generated",
  SpeakingFeedbackApproved: "speaking.feedback.approved",
  SpeakingFeedbackRejected: "speaking.feedback.rejected",
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
  ExamCandidateUpdated: "exam.candidate.updated",
  ExamWeightsUpdated: "exam.weights.updated",
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
  StreakFreezeUsed: "streak.freeze.used",
  LeaderboardUpdated: "leaderboard.updated",

  // Tournament
  TournamentCreated: "tournament.created",
  TournamentPublished: "tournament.published",
  TournamentRegistered: "tournament.registered",
  TournamentTeamFormed: "tournament.team.formed",
  TournamentTeamRenamed: "tournament.team.renamed",
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

  // Limio-Live — bài giảng tương tác sinh từ tài liệu bằng AI (H15). Chỉ đo lường việc sinh, sửa
  // bằng AI và tỉ lệ slide bị sửa tay; không đụng nội dung học viên.
  LiveDeckOutlineGenerated: "live.deck.outline_generated",
  // Chỉnh dàn ý bằng AI hoặc soạn lại từ đầu ngay trên trang dàn ý (docs/tieu-chi/dan-y-chinh-bang-ai.md, R11). Không ghi nội dung lời dặn.
  LiveDeckOutlineRevised: "live.deck.outline_revised",
  LiveDeckSlidesGenerated: "live.deck.slides_generated",
  LiveSlideAiEditProposed: "live.slide.ai_edit_proposed",
  LiveSlideAiChatTurn: "live.slide.ai_chat_turn",
  // AI đọc số từ hình biểu đồ (docs/tieu-chi/bieu-do-kho-doc-pptx.md, V12). Khi giảng viên thay hình: ai_edit_accepted
  // với action "chart_from_image".
  LiveSlideChartFromImageProposed: "live.slide.chart_from_image_proposed",
  LiveSlideAiEditAccepted: "live.slide.ai_edit_accepted",
  LiveSlideEditedByUser: "live.slide.edited_by_user",
  LiveSlideVersionRestored: "live.slide.version_restored",

  // Lily, trợ lý ảo của giảng viên. Chỉ đo cách giảng viên dùng Lily để cải thiện kho hướng dẫn và câu hỏi đề xuất.
  // Payload mang CÂU HỎI của giảng viên (tối đa 500 ký tự) nhưng KHÔNG mang câu trả lời của Lily; xem AssistantQuestionAskedPayload.
  AssistantDrawerOpened: "assistant.drawer.opened",
  AssistantQuestionAsked: "assistant.question.asked",
  AssistantLinkClicked: "assistant.link.clicked",
  AssistantConversationReset: "assistant.conversation.reset",

  // Trang Bắt đầu của học viên chưa có khoá (docs/hoc-vien/trang-dau-hoc-vien-AC.md, AC6). Đo xem học viên tự vào
  // có tìm được việc để làm không: nhập mã gì, bấm vào đâu. KHÔNG ghi chính mã (mã là chìa khoá vào lớp/thi).
  OnboardingCodeSubmitted: "onboarding.code.submitted",
  OnboardingStartClicked: "onboarding.start.clicked",
  // CENTER C1 — lịch dạy của lớp (docs/CENTER-schedule-attendance-AC.md). Subject là người
  // thao tác (giảng viên); payload mang id và số liệu, không mang tên học viên.
  ClassScheduleSet: "class.schedule.set",
  ClassMeetingCancelled: "class.meeting.cancelled",
  ClassMeetingUpdated: "class.meeting.updated",
  ClassMeetingMakeupAdded: "class.meeting.makeup_added",
  // CENTER C2 — điểm danh học viên. Subject là HỌC VIÊN được điểm danh (để Feedback Engine và
  // Gamification đọc theo người); giáo viên thao tác nằm trong payload.
  AttendanceStudentMarked: "attendance.student.marked",
  // CENTER C3 — giáo trình dựng sẵn. Subject là giảng viên thao tác.
  CoursePackUsed: "course.pack.used",
  CoursePackUpdated: "course.pack.updated",
  // CENTER C4 — kết thúc buổi, tổng kết gửi lớp, nhận xét cá nhân. Subject là giảng viên thao tác;
  // payload chỉ mang id và số liệu, KHÔNG mang chữ của nhận xét (theo mẫu assistant.question.asked).
  ClassMeetingClosed: "class.meeting.closed",
  MeetingSummarySent: "meeting.summary.sent",
  MeetingNoteDrafted: "meeting.note.drafted",
  MeetingNoteSent: "meeting.note.sent",
  // CENTER C6 — mục tiêu học tập. Chủ thể là HỌC VIÊN có mục tiêu (người đặt hộ nằm trong payload).
  GoalSet: "goal.set",
  GoalChanged: "goal.changed",
  GoalStatusChanged: "goal.status_changed",
  GoalSectionSet: "goal.section_set",
  // Bài giảng slide của bài học (docs/tieu-chi/nghe-giang-slide.md). Subject là người sửa khoá; payload chỉ mang id.
  LessonDeckAttached: "lesson.deck.attached",
  LessonDeckDetached: "lesson.deck.detached",

  // Nghe giảng / Podcast của bài học (docs/tieu-chi/nghe-giang-podcast.md, AC6). Chỉ đo cách học viên nghe:
  // KHÔNG ghi nội dung lời giảng. Ghi sự kiện không bao giờ được chặn hay làm chậm việc phát.
  NarrationStarted: "narration.started",
  NarrationCompleted: "narration.completed",
  NarrationStopped: "narration.stopped",
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

/**
 * "Tạo bài từ tài liệu" — giảng viên Áp dụng bài AI viết (Mốc 3). Không mang chữ:
 * nội dung đã nằm ở ContentItem + ContentItemVersion ("generated"); so phiên bản
 * về sau với bản này là đo được bài bị sửa tay bao nhiêu.
 */
export interface LessonContentGeneratedPayload {
  draftId: string;
  lessonIds: string[];
  contentItemIds: string[];
  writing: "keep" | "edit";
  sectionCount: number;
  fallbackCount: number;
  missingParaCount: number;
  /** true = "Làm lại từ dàn ý" thay nội dung khối cũ. */
  replaced: boolean;
}

export interface LessonContentAiEditedPayload {
  lessonId: string;
  /** shorter | simpler | example | spelling */
  action: string;
  layout: string;
}

export interface LessonContentRestoredPayload {
  contentItemId: string;
  versionId: string;
  versionSource: string;
}

export interface LessonContentConvertedPayload {
  contentItemId: string;
  /** script = chạy hàng loạt; editor = giảng viên bấm chuyển khi mở bài. */
  via: "script" | "editor";
}

/**
 * Annotation theo vùng chọn. Như B15, KHÔNG mang nội dung chữ: nó đã nằm
 * nguyên văn ở LessonAnnotation / LessonAnnotationReply, nhân bản sang bảng
 * append-only chỉ làm rộng bề mặt dữ liệu. Event trả lời "ai ghi chú ở bài
 * nào, công khai hay riêng, ai xoá".
 */
export interface LessonAnnotationCreatedPayload {
  annotationId: string;
  lessonId: string;
  contentItemId: string;
  quoteLength: number;
  bodyLength: number;
  published: boolean;
}

export interface LessonAnnotationPublishedPayload {
  annotationId: string;
  lessonId: string;
  /** false = tác giả thu hồi về riêng tư. */
  published: boolean;
}

export interface LessonAnnotationRepliedPayload {
  annotationId: string;
  replyId: string;
  lessonId: string;
  /** Tác giả annotation — để dựng "ai được hồi đáp" mà không phải join. */
  annotationAuthorId: string;
}

export interface LessonAnnotationRemovedPayload {
  /** "annotation" hoặc "reply". */
  kind: "annotation" | "reply";
  targetId: string;
  lessonId: string;
  /** "author" tự xoá; "moderator" là giảng viên gỡ nội dung công khai. */
  by: "author" | "moderator";
}

export interface EnrollmentCreatedPayload {
  enrollmentId: string;
  courseId: string;
  // A6 — CourseSection (invite-link) the enrollment landed in. Optional:
  // additive field, older EnrollmentCreated rows predate CourseSection.
  sectionId?: string;
}

/** A6 — cấp chứng nhận hoàn thành khoá học (1 lần / user / course). */
export interface CertificateIssuedPayload {
  certificateId: string;
  courseId: string;
  certNumber: string;
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

export interface ExamSectionStartedPayload {
  examId: string;
  attemptId: string;
  sectionId: string;
  /** Vị trí phần trong đề, từ 0. */
  sectionIndex: number;
  languageSkill: string | null;
  /** Giờ phần bắt đầu theo đồng hồ máy chủ (không phải lúc sự kiện được ghi). */
  startedAt: string;
}

export interface ExamSectionEndedPayload extends ExamSectionStartedPayload {
  endedAt: string;
  /** Vì sao phần kết thúc: hết giờ phần hay học viên nộp sớm. */
  reason: "time_up" | "submitted_early";
}

export interface ExamPracticeAnsweredPayload {
  examId: string;
  sessionId: string;
  questionId: string;
  correct: boolean;
  score: number | null;
  maxScore: number;
  /** Kỹ năng của phần chứa câu hỏi (nghe/nói/đọc/viết), null nếu phần chưa gán. */
  languageSkill: string | null;
  /** Thẻ kỹ năng của câu hỏi — để sau này nuôi mô hình người học mà không phải làm lại. */
  skillIds: string[];
}

export interface ExamPracticeCompletedPayload {
  examId: string;
  sessionId: string;
  questionCount: number;
  correct: number;
  total: number;
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

// ── Limio-Live (H15) ────────────────────────────────────────────────────────

export interface LiveDeckOutlineGeneratedPayload {
  deckId: string;
  minutes: number;
  slideCount: number;
  sourceChars: number;
  /** Số cảnh báo kèm theo dàn ý (lệch số slide, thiếu tương tác...). */
  warningCount: number;
  /** Nguồn của bài: tài liệu, mô tả chủ đề (kiến thức chung), mô tả kèm trang tìm trên internet. Thiếu = bản ghi cũ (tài liệu). */
  sourceKind?: "document" | "topic" | "topic_web";
  /** Có bật tìm nguồn internet: số trang đã đọc (0 = không tìm được, bài rơi về "topic"). */
  webSourceCount?: number;
  /** Bài nhập từ file trình chiếu. */
  sourceFormat?: "pptx";
  /** Cách chuyển: giữ ý (không AI) hoặc soạn lại mạch (AI). */
  importMode?: "keep" | "restructure";
  /** Ngôn ngữ nội dung slide ghi lúc tạo bài (DECK_LANGUAGES); null = chưa nhận được. Thiếu = bản ghi cũ. */
  language?: string | null;
  /** Có yêu cầu của giảng viên đi cùng tài liệu (trang Tạo bài giảng một ô). Thiếu = bản ghi cũ. */
  hasIntent?: boolean;
  /** Số slide tương tác hệ thống bổ sung để đủ mức tối thiểu. Thiếu = bản ghi cũ. */
  interactionsAdded?: number;
  /** Số slide trong file gốc. */
  importedSlides?: number;
  /** Số hình đã lưu. */
  imageCount?: number;
}

export interface LiveDeckSlidesGeneratedPayload {
  deckId: string;
  /** "first" = tạo lần đầu; "sync" = cập nhật theo dàn ý đã sửa. */
  mode: "first" | "sync";
  slideCount: number;
  /** Số slide AI viết hỏng nên dựng từ dàn ý. */
  fallbackCount: number;
  /** Bài có nguồn internet: số ảnh lấy từ trang nguồn đã gắn vào slide Chữ và hình. */
  webImageCount?: number;
  /** Ngôn ngữ AI được yêu cầu viết (ngôn ngữ của bài); null = theo ngôn ngữ của nguồn. Thiếu = bản ghi cũ. */
  language?: string | null;
  regenerated?: number;
  created?: number;
  removed?: number;
  kept?: number;
}

export interface LiveDeckOutlineRevisedPayload {
  deckId: string;
  /** "revise": chỉnh dàn ý hiện tại theo lời dặn; "restart": soạn lại từ văn bản nguồn. */
  mode: "revise" | "restart";
  slideCountBefore: number;
  slideCountAfter: number;
  /** Số ký tự lời dặn (0 = soạn lại không kèm lời dặn mới). Không ghi nội dung. */
  instructionChars: number;
  warningCount: number;
}

/** Một lượt hỏi đáp với AI về slide (tab Nhờ AI). Không ghi nội dung câu hỏi hay câu trả lời. */
export interface LiveSlideAiChatTurnPayload {
  deckId: string;
  slideId: string;
  /** Kiểu trả lời sau khi chuẩn hoá: trả lời bằng lời, hỏi lại, đề xuất sửa. */
  kind: "answer" | "clarify" | "propose";
  /** Số lượt trước đó trong cuộc trò chuyện (0 = câu đầu tiên). */
  historyTurns: number;
  /** Câu trả lời bằng lời có kèm gợi ý sửa (hiện nút "Làm theo gợi ý này"). */
  hasSuggestion: boolean;
}

export interface LiveSlideAiEditProposedPayload {
  deckId: string;
  slideId: string;
  /** "custom" = yêu cầu riêng giảng viên gõ (nội dung yêu cầu không ghi vào sự kiện). */
  action: "shorter" | "example" | "simpler" | "to_quiz" | "rewrite" | "custom";
}

export interface LiveSlideChartFromImageProposedPayload {
  deckId: string;
  slideId: string;
  /** "ok" hoặc lý do không dùng được kết quả (not_chart, too_many_labels, too_many_series). Không ghi số liệu. */
  outcome: "ok" | "not_chart" | "too_many_labels" | "too_many_series";
  labels: number;
  /** Số giá trị AI ước lượng theo trục (hình không ghi số). */
  estimated: number;
}

export interface LiveSlideAiEditAcceptedPayload {
  deckId: string;
  slideId: string;
  action: string | null;
  slideType: string;
}

export interface LiveSlideEditedByUserPayload {
  deckId: string;
  slideId: string;
  slideType: string;
  /** Dòng dàn ý mà slide AI sinh này thuộc về. */
  outlineId: string | null;
}

export interface LiveSlideVersionRestoredPayload {
  deckId: string;
  slideId: string;
  versionId: string;
  versionSource: string;
}

/** Giảng viên nhập câu hỏi, bấm câu đề xuất ở lời chào, hay bấm câu gợi ý tiếp theo dưới câu trả lời. */
export type AssistantQuestionSource = "typed" | "suggestion" | "followup";

/**
 * Kết cục của một lượt hỏi. `declined_*`: câu trả lời cố định của bộ lọc (không tốn lượt AI hoặc bị thay sau khi gọi
 * mô hình); `error`: không có câu trả lời (xem `errorCode`).
 */
export type AssistantQuestionOutcome = "answered" | "declined_technical" | "declined_off_topic" | "declined_leak" | "error";

/** Mọi sự kiện Lily đều mang `conversationId` (do trình duyệt sinh, đổi khi bấm "Cuộc trò chuyện mới") và trang đang đứng. */
export interface AssistantEventBase {
  conversationId: string | null;
  /** Đường dẫn trang giảng viên đang đứng (không kèm query), vd "/instructor/courses". */
  page: string | null;
}

export interface AssistantDrawerOpenedPayload extends AssistantEventBase {
  /** Đã có tin nào trong cuộc trò chuyện chưa (mở lại đoạn dở hay mở mới). */
  hasHistory: boolean;
}

export interface AssistantQuestionAskedPayload extends AssistantEventBase {
  source: AssistantQuestionSource;
  /** Câu hỏi của giảng viên, tối đa 500 ký tự. */
  text: string;
  /** Số lượt trước đó trong cuộc trò chuyện (0 = câu đầu tiên). */
  historyTurns: number;
  outcome: AssistantQuestionOutcome;
  /** Chỉ khi outcome = "error": mã lỗi trả về trình duyệt. */
  errorCode?: string;
  /** Tiêu đề các mục hướng dẫn được chọn đưa cho mô hình (rỗng = chưa khớp mục nào). */
  guideTitles: string[];
  /** Mã điểm đến Lily gợi ý bấm vào (đã qua danh mục, nên là mã thật). */
  actionIds: string[];
  followUpCount: number;
  /** Từ lúc nhận câu hỏi đến lúc có kết quả, mili giây. */
  latencyMs: number;
}

export interface AssistantLinkClickedPayload extends AssistantEventBase {
  /** Mã điểm đến trong danh mục của Lily. */
  destinationId: string;
  href: string;
}

export interface AssistantConversationResetPayload extends AssistantEventBase {
  /** Số tin đã có khi bấm "Cuộc trò chuyện mới". */
  messageCount: number;
}

/** Loại mã ô "Nhập mã" trên trang Bắt đầu nhận ra (`none` = không khớp, `ambiguous` = khớp nhiều loại). */
export type OnboardingCodeKind =
  | "section"
  | "exam"
  | "exam_assigned"
  | "oral"
  | "gameshow"
  | "live"
  | "board"
  | "whiteboard"
  | "access_code"
  | "none"
  | "ambiguous";

export interface OnboardingCodeSubmittedPayload {
  /** Độ dài mã sau khi chuẩn hoá — đủ để biết học viên gõ sai kiểu gì mà không lộ mã. */
  length: number;
  kind: OnboardingCodeKind;
  /** Khớp đúng loại nhưng phiên đã kết thúc / ca thi đã đóng. */
  ended: boolean;
}

export interface OnboardingStartClickedPayload {
  target: "sample" | "catalog_course" | "catalog_all";
  courseId?: string;
}

// ── CENTER C1 — lịch dạy của lớp ──────────────────────────────────────────

export interface ClassScheduleSetPayload {
  sectionId: string;
  courseId: string;
  totalMeetings: number;
  slotCount: number;
  /** Số buổi tạo mới / cập nhật tại chỗ / xoá trong lần áp dụng này. */
  created: number;
  updated: number;
  removed: number;
}

export interface ClassMeetingCancelledPayload {
  meetingId: string;
  sectionId: string;
  courseId: string;
  /** Độ dài lý do, không mang chữ. */
  reasonLength: number;
}

export interface ClassMeetingUpdatedPayload {
  meetingId: string;
  sectionId: string;
  courseId: string;
  /** Tên các trường đã đổi: startsAt | endsAt | room | plannedTeacherId. */
  changed: string[];
}

export interface ClassMeetingMakeupAddedPayload {
  meetingId: string;
  sectionId: string;
  courseId: string;
  makeupOfId: string | null;
}

// ── CENTER C2 — điểm danh học viên ───────────────────────────────────────

export type AttendanceStatusValue = "present" | "late" | "absent" | "excused";

export interface AttendanceStudentMarkedPayload {
  meetingId: string;
  sectionId: string;
  courseId: string;
  status: AttendanceStatusValue;
  /** Trạng thái trước đó; null khi đây là lần đánh dấu đầu tiên. */
  previousStatus: AttendanceStatusValue | null;
  /** Giáo viên thao tác. */
  markedById: string;
}

// ── CENTER C4 — tổng kết buổi và nhận xét ────────────────────────────────

export interface ClassMeetingClosedPayload {
  meetingId: string;
  sectionId: string;
  courseId: string;
  /** Buổi có giáo án khi đóng hay không (tổng kết chỉ có giờ buổi sau và bài tập khi false). */
  hasPlan: boolean;
}

export interface MeetingSummarySentPayload {
  meetingId: string;
  sectionId: string;
  courseId: string;
  /** Kết quả của lần gửi này (không tính người đã nhận ở lần trước). */
  sent: number;
  failed: number;
  skipped: number;
}

export interface MeetingNoteDraftedPayload {
  meetingId: string;
  noteId: string;
  /** rule_template | llm — nguồn của bản nháp. */
  source: string;
  /** Chỉ độ dài, không mang chữ nhận xét. */
  bodyLength: number;
}

export interface MeetingNoteSentPayload {
  meetingId: string;
  noteId: string;
  /** Học viên nhận (người nhận nhận xét, không phải chủ thể event). */
  learnerId: string;
  bodyLength: number;
  correction: boolean;
}

// ── CENTER C6 — mục tiêu học tập ─────────────────────────────────────────

export interface GoalSetPayload {
  goalId: string;
  courseId: string | null;
  framework: string;
  targetLevel: string;
  targetDate: string;
  hoursPerWeek: number | null;
  /** Người đặt: chính học viên hay giáo viên đặt hộ. */
  setById: string;
  /** Mục tiêu này chép từ mục tiêu của lớp (học viên bấm "Dùng mục tiêu này"). */
  fromSection: boolean;
}

export interface GoalChangedPayload {
  goalId: string;
  changedById: string;
  /** Từng trường đã đổi: giá trị cũ và mới. */
  changes: Record<string, { from: string | number | null; to: string | number | null }>;
}

export interface GoalStatusChangedPayload {
  goalId: string;
  changedById: string;
  from: string;
  to: string;
}

export interface GoalSectionSetPayload {
  sectionId: string;
  courseId: string;
  /** null = đã bỏ mục tiêu của lớp. */
  framework: string | null;
  targetLevel: string | null;
  targetDate: string | null;
}

// ── CENTER C3 — giáo trình dựng sẵn ──────────────────────────────────────

export interface CoursePackUsedPayload {
  packId: string;
  packVersion: number;
  /** Khoá mới được sao ra. */
  courseId: string;
}

export interface CoursePackUpdatedPayload {
  packId: string;
  fromVersion: number | null;
  toVersion: number;
  courseId: string;
  updatedSessions: number[];
  /** Buổi không cập nhật vì đã dạy hoặc đã có hoạt động của học viên. */
  skippedSessions: number[];
}

export type NarrationEventKind = "lecture" | "podcast";

export interface NarrationStartedPayload {
  lessonId: string;
  kind: NarrationEventKind;
  /** true = nghe tiếp từ vị trí đã nhớ, false = nghe từ đầu. */
  resumed: boolean;
}

export interface NarrationCompletedPayload {
  lessonId: string;
  kind: NarrationEventKind;
}

export interface NarrationStoppedPayload {
  lessonId: string;
  kind: NarrationEventKind;
  /** Phần trăm xa nhất đã nghe tới (0–100) trong lần nghe này. */
  percent: number;
  speed: number;
}

export interface LessonDeckAttachedPayload {
  lessonId: string;
  deckId: string;
  /** Bài giảng cũ bị thay (null = bài học chưa có bài giảng). */
  replacedDeckId: string | null;
}

export interface LessonDeckDetachedPayload {
  lessonId: string;
  deckId: string;
}
