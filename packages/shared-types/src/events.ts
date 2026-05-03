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
  QuizStarted: "quiz.started",
  QuizSubmitted: "quiz.submitted",
  QuizQuestionAnswered: "quiz.question.answered",
  AssignmentSubmitted: "assignment.submitted",
  AssignmentGraded: "assignment.graded",
  ForumPosted: "forum.posted",
  ForumUpvoted: "forum.upvoted",
  ForumAnswered: "forum.answered",
  EnrollmentCreated: "enrollment.created",
  CourseCompleted: "course.completed",

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
