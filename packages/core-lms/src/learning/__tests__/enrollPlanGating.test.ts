import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { enrollInCourse } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

describe("enrollInCourse — khoá chỉ có gói truy cập (không có giá phẳng)", () => {
  it("bật thanh toán: không ghi danh miễn phí được; khoá không có gói/giá thì vẫn tự ghi danh", async () => {
    const owner = await makeUser("gate-owner@e.com");
    const learner = await makeUser("gate-learner@e.com");
    const paid = await createCourse(owner, { title: "Có gói", description: "d", slug: "gate-paid", personalizationEnabled: false });
    const free = await createCourse(owner, { title: "Miễn phí", description: "d", slug: "gate-free", personalizationEnabled: false });
    await publishCourse(owner, paid.courseId);
    await publishCourse(owner, free.courseId);
    await prisma.courseAccessPlan.create({
      data: { courseId: paid.courseId, label: "1 năm", durationMonths: 12, priceCents: 199_000, currency: "VND", createdBy: owner },
    });

    await expect(enrollInCourse(learner, paid.courseId)).rejects.toMatchObject({ code: "payment_required" });
    expect((await enrollInCourse(learner, free.courseId)).created).toBe(true);
  });

  it("thanh toán tắt toàn hệ thống (skipPaymentCheck) thì giữ hành vi cũ; gói đã ẩn không tính là có phí", async () => {
    const owner = await makeUser("gate2-owner@e.com");
    const learner = await makeUser("gate2-learner@e.com");
    const c = await createCourse(owner, { title: "Gói ẩn", description: "d", slug: "gate2", personalizationEnabled: false });
    await publishCourse(owner, c.courseId);
    const plan = await prisma.courseAccessPlan.create({
      data: { courseId: c.courseId, label: "1 năm", durationMonths: 12, priceCents: 199_000, currency: "VND", createdBy: owner },
    });

    expect((await enrollInCourse(learner, c.courseId, undefined, { skipPaymentCheck: true })).created).toBe(true);

    const learner2 = await makeUser("gate2-learner2@e.com");
    await prisma.courseAccessPlan.update({ where: { id: plan.id }, data: { isActive: false } });
    expect((await enrollInCourse(learner2, c.courseId)).created).toBe(true); // không còn gói nào đang bán
  });
});
