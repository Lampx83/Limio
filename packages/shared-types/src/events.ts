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
  CourseCompleted: "course.completed",

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
  // Audio runtime — P1 only
  ExamAudioPlayed: "exam.audio.played",
  ExamAudioCompleted: "exam.audio.completed",
  ExamPassageViewed: "exam.passage.viewed",

  // Feedback
  SkillStateUpdated: "skill.state.updated",
  MisconceptionDetected: "misconception.detected",
  MisconceptionResolved: "misconception.resolved",
  FeedbackDelivered: "feedback.delivered",
  FeedbackRated: "feedback.rated",
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
} as const;

export type LearningEventType =
  (typeof LearningEventType)[keyof typeof LearningEventType];

/** Payload shapes for Phase 0 events. Extend per phase. */
export interface LessonViewedPayload {
  lessonId: string;
  durationSec: number;
  positionSec: number;
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
  passed: boolean;
}

export interface QuizQuestionAnsweredPayload {
  quizId: string;
  attemptId: string;
  questionId: string;
  optionIds: string[];
  isCorrect: boolean;
  confidence?: number;
  responseTimeMs: number;
}

export interface EnrollmentCreatedPayload {
  enrollmentId: string;
  courseId: string;
}

// =====================================================================
// A7 Exam payloads
// =====================================================================

export interface ExamCreatedPayload {
  examId: string;
  courseId: string;
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
  passed: boolean;
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
