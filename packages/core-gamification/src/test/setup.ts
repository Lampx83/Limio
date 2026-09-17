import { afterAll, beforeEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";

async function cleanDb() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.note.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.authProvider.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.xpTransaction.deleteMany(),
    prisma.userCourseProgress.deleteMany(),
    prisma.streakRecord.deleteMany(),
    prisma.learningEvent.deleteMany(),
    prisma.answerResponse.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.questionOption.deleteMany(),
    prisma.questionSkillTag.deleteMany(),
    prisma.quizQuestion.deleteMany(),
    prisma.quiz.deleteMany(),
    prisma.contentSkillMapping.deleteMany(),
    prisma.contentItem.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.module.deleteMany(),
    prisma.courseInstructor.deleteMany(),
    prisma.enrollment.deleteMany(),
    // ExamRound.courseId là Restrict, không Cascade — course.deleteMany() bên
    // dưới sẽ vỡ nếu còn round nào trỏ tới. ExamSession trước vì
    // ExamSession.roundId cũng Restrict; ExamRoundAdmin tự mất theo Cascade
    // khi xoá round nên không cần xoá riêng.
    prisma.examSession.deleteMany(),
    prisma.examRound.deleteMany(),
    prisma.course.deleteMany(),
    prisma.skillPrerequisite.deleteMany(),
    prisma.skill.deleteMany(),
    prisma.misconception.deleteMany(),
    // Tournament tree — children first. Tournament.creatorId has no cascade to
    // User, so leaving these behind makes the user delete below fail with a
    // foreign-key error for any test that touches a tournament.
    prisma.missionReviewAssignment.deleteMany(),
    prisma.missionSubmission.deleteMany(),
    prisma.tournamentMission.deleteMany(),
    prisma.tournamentRanking.deleteMany(),
    prisma.tournamentRegistration.deleteMany(),
    prisma.tournamentTeam.deleteMany(),
    prisma.tournamentJudge.deleteMany(),
    prisma.tournament.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
}

beforeEach(cleanDb);

afterAll(async () => {
  await prisma.$disconnect();
});
