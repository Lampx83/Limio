import { afterAll, beforeEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";

async function cleanDb() {
  // Order respects FK constraints. AuditLog → VerificationToken → UserRole →
  // AuthProvider → LearningEvent → Quiz attempt chain → Course chain → User → Role.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.note.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.streakRecord.deleteMany(),
    prisma.xpTransaction.deleteMany(),
    prisma.userCourseProgress.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.authProvider.deleteMany(),
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
    prisma.course.deleteMany(),
    prisma.skillPrerequisite.deleteMany(),
    prisma.skill.deleteMany(),
    prisma.misconception.deleteMany(),
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
