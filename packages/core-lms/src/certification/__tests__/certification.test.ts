import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  CertificationError,
  getCertificateByNumber,
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
