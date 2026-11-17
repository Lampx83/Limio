import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  CertificationError,
  getCertificateByNumber,
  getCertificateEligibility,
  issueCertificateIfEligible,
  getCertificateForUser,
  issueCertificate,
} from "../index";
import { completeLesson } from "../../learning/lessons";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `o-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const learner = await registerUser(
    { email: `l-${slug}@e.com`, password: "password1234", displayName: "Nguyễn Văn An" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `x-${slug}@e.com`, password: "password1234", displayName: "X" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: `Khoá ${slug}`, description: "x", slug });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);
  return { learnerId: learner.userId, outsiderId: outsider.userId, courseId: c.courseId, lessonId: l.lessonId };
}

describe("issueCertificate — A6", () => {
  it("not_enrolled when learner never enrolled", async () => {
    const { outsiderId, courseId } = await setup("cert1");
    await expect(issueCertificate(outsiderId, courseId)).rejects.toBeInstanceOf(CertificationError);
    await expect(issueCertificate(outsiderId, courseId)).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("not_completed when course not finished", async () => {
    const { learnerId, courseId } = await setup("cert2");
    await expect(issueCertificate(learnerId, courseId)).rejects.toMatchObject({ code: "not_completed" });
  });

  it("issues a certificate with snapshot + emits certificate.issued once, idempotent on retry", async () => {
    const { learnerId, courseId, lessonId } = await setup("cert3");
    await completeLesson(learnerId, lessonId);

    const cert1 = await issueCertificate(learnerId, courseId);
    expect(cert1.userNameSnapshot).toBe("Nguyễn Văn An");
    expect(cert1.certNumber).toMatch(/^FBM-[0-9A-F]+$/);
    expect(cert1.issuerName).toBe("Limio Learning"); // course has no Organization

    const cert2 = await issueCertificate(learnerId, courseId);
    expect(cert2.id).toBe(cert1.id);
    expect(cert2.certNumber).toBe(cert1.certNumber);

    const rows = await prisma.certificate.findMany({ where: { userId: learnerId, courseId } });
    expect(rows).toHaveLength(1);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.CertificateIssued },
    });
    expect(events).toHaveLength(1);
    expect((events[0]?.payload as { certNumber: string }).certNumber).toBe(cert1.certNumber);
  });

  it("issuerName is 'Limio × <org>' when the course belongs to an Organization", async () => {
    const { learnerId, courseId, lessonId } = await setup("cert5");
    const org = await prisma.organization.create({
      data: { code: `HUST-CERT5-${Date.now()}`, name: "HUST" },
    });
    await prisma.course.update({ where: { id: courseId }, data: { organizationId: org.id } });
    await completeLesson(learnerId, lessonId);

    const cert = await issueCertificate(learnerId, courseId);
    expect(cert.issuerName).toBe("Limio × HUST");
  });

  it("getCertificateForUser / getCertificateByNumber read back the issued row", async () => {
    const { learnerId, courseId, lessonId } = await setup("cert4");
    await completeLesson(learnerId, lessonId);
    const issued = await issueCertificate(learnerId, courseId);

    const byUser = await getCertificateForUser(learnerId, courseId);
    expect(byUser?.id).toBe(issued.id);

    const byNumber = await getCertificateByNumber(issued.certNumber);
    expect(byNumber?.id).toBe(issued.id);

    expect(await getCertificateByNumber("FBM-DOESNOTEXIST")).toBeNull();
  });
});

describe("ngưỡng hoàn thành theo khoá (MICRO4ASIA 90%) — A6", () => {
  async function setupTen(slug: string, minPct: number) {
    const owner = await registerUser(
      { email: `o-${slug}@e.com`, password: "password1234", displayName: "GV" },
      BASE,
    );
    const learner = await registerUser(
      { email: `l-${slug}@e.com`, password: "password1234", displayName: "Trần Thị Bình" },
      BASE,
    );
    const c = await createCourse(owner.userId, { title: `Khoá ${slug}`, description: "x", slug });
    const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
    const lessonIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const l = await createLesson(owner.userId, m.moduleId, { title: `L${i}`, orderIndex: i });
      lessonIds.push(l.lessonId);
    }
    await publishCourse(owner.userId, c.courseId);
    await prisma.course.update({ where: { id: c.courseId }, data: { certificateMinCompletionPct: minPct } });
    await enrollInCourse(learner.userId, c.courseId);
    return { learnerId: learner.userId, courseId: c.courseId, lessonIds };
  }

  it("mặc định khoá mới vẫn đòi 100%", async () => {
    const { courseId } = await setup("cert-default");
    const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(c.certificateMinCompletionPct).toBe(100);
  });

  it("Given ngưỡng 90%, When học 8/10 bài, Then chưa được cấp; When học bài thứ 9, Then được cấp dù chưa hoàn thành khoá", async () => {
    const { learnerId, courseId, lessonIds } = await setupTen("cert-m4a-90", 90);
    for (const id of lessonIds.slice(0, 8)) await completeLesson(learnerId, id);

    expect(await getCertificateEligibility(learnerId, courseId)).toEqual({
      completionPct: 80,
      minCompletionPct: 90,
      eligible: false,
    });
    expect(await issueCertificateIfEligible(learnerId, courseId)).toBeNull();
    await expect(issueCertificate(learnerId, courseId)).rejects.toMatchObject({ code: "not_completed" });

    const r = await completeLesson(learnerId, lessonIds[8]!);
    expect(r.courseCompleted).toBe(false); // hoàn thành khoá vẫn là 100%
    const cert = await issueCertificateIfEligible(learnerId, courseId);
    expect(cert?.userNameSnapshot).toBe("Trần Thị Bình");
    expect((await getCertificateEligibility(learnerId, courseId)).eligible).toBe(true);
  });

  it("Given ngưỡng 100% (mặc định), When học 9/10 bài, Then chưa được cấp", async () => {
    const { learnerId, courseId, lessonIds } = await setupTen("cert-default-100", 100);
    for (const id of lessonIds.slice(0, 9)) await completeLesson(learnerId, id);
    expect(await issueCertificateIfEligible(learnerId, courseId)).toBeNull();
  });
});
