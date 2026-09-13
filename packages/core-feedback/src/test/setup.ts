import { afterAll, beforeEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";

async function cleanDb() {
  await prisma.$transaction([
    prisma.feedbackDelivery.deleteMany(),
    prisma.feedbackTemplate.deleteMany(),
    prisma.misconceptionFlag.deleteMany(),
    prisma.learnerSkillState.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.note.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.streakRecord.deleteMany(),
    prisma.xpTransaction.deleteMany(),
    prisma.userCourseProgress.deleteMany(),
    prisma.aiTokenOrder.deleteMany(),
    // AiTokenPackage không treo vào User nên không cascade khi xoá user — không
    // dọn ở đây thì gói của test trước dồn sang test sau.
    prisma.aiTokenPackage.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.authProvider.deleteMany(),
    prisma.learningEvent.deleteMany(),
    // A6.3 — oralExamTurn.e2e.test.ts goes through publishExam(), which creates
    // an ExamRound (independent of Exam, FK'd directly to Course — see
    // core-lms/src/test/setup.ts's identical comment). Exam.deleteMany()
    // cascades ExamAttempt/OralExamTurn/OralExamMaterial(+Chunk)/ExamQuestion
    // etc., so no need to list those individually here.
    prisma.exam.deleteMany(),
    prisma.examRound.deleteMany(),
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
