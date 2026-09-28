import { describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { registerUser } from "../register";
import {
  approveInstructorApplication,
  createInstructorApplication,
  listInstructorApplications,
  rejectInstructorApplication,
} from "../instructorApplication";
import * as templates from "../../email/templates";

const BASE_URL = "http://localhost:3000";
const APPLICATION = {
  institution: "ĐH Kinh tế Quốc dân",
  subject: "Toán ứng dụng",
  motivation: "Muốn mở lớp ôn thi",
  verificationUrl: "https://example.edu.vn/giang-vien/abc",
};

async function makeAdmin() {
  const admin = await prisma.user.create({
    data: { email: "admin@example.com", displayName: "Admin", passwordHash: "x" },
  });
  const role = await prisma.role.upsert({
    where: { name: RoleName.Admin },
    update: {},
    create: { name: RoleName.Admin },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  return admin;
}

async function rolesOf(userId: string) {
  const rows = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
  return rows.map((r) => r.role.name).sort();
}

describe("instructor application", () => {
  it("đăng ký kèm đơn: tài khoản là học viên, đơn ở trạng thái pending", async () => {
    const r = await registerUser(
      {
        email: "gv@example.com",
        password: "password1234",
        displayName: "Cô Lan",
        instructorApplication: APPLICATION,
      },
      BASE_URL,
    );
    expect(await rolesOf(r.userId)).toEqual([RoleName.Learner]);
    const apps = await prisma.instructorApplication.findMany({ where: { userId: r.userId } });
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ status: "pending", institution: APPLICATION.institution });
  });

  it("đăng ký thường: không tạo đơn", async () => {
    const r = await registerUser(
      { email: "hv@example.com", password: "password1234", displayName: "Học viên" },
      BASE_URL,
    );
    expect(await prisma.instructorApplication.count({ where: { userId: r.userId } })).toBe(0);
  });

  it("đơn thiếu trường/đơn vị bị từ chối và không tạo tài khoản", async () => {
    await expect(
      registerUser(
        {
          email: "thieu@example.com",
          password: "password1234",
          displayName: "X",
          instructorApplication: { institution: "", subject: "Toán" },
        },
        BASE_URL,
      ),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(await prisma.user.count({ where: { email: "thieu@example.com" } })).toBe(0);
  });

  it("không cho nộp đơn thứ hai khi còn đơn chờ duyệt", async () => {
    const r = await registerUser(
      { email: "dup@example.com", password: "password1234", displayName: "Dup", instructorApplication: APPLICATION },
      BASE_URL,
    );
    await expect(createInstructorApplication(r.userId, APPLICATION)).rejects.toMatchObject({
      code: "already_pending",
    });
  });

  it("duyệt: cấp role instructor, ghi audit, gửi email chúc mừng", async () => {
    const admin = await makeAdmin();
    const r = await registerUser(
      { email: "ok@example.com", password: "password1234", displayName: "Cô Ok", instructorApplication: APPLICATION },
      BASE_URL,
    );
    const app = (await listInstructorApplications("pending"))[0]!;
    const send = vi.spyOn(templates, "sendTemplatedEmail");

    const res = await approveInstructorApplication(admin.id, app.id, BASE_URL);

    expect(await rolesOf(r.userId)).toEqual([RoleName.Instructor, RoleName.Learner].sort());
    const after = await prisma.instructorApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect(after).toMatchObject({ status: "approved", reviewedByUserId: admin.id });
    expect(after.reviewedAt).not.toBeNull();
    expect(
      await prisma.auditLog.count({ where: { action: "instructor_application.approved", targetUserId: r.userId } }),
    ).toBe(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ key: "instructor.application_approved", to: "ok@example.com" }),
    );
    expect(res.emailSent).toBe(true);
    send.mockRestore();
  });

  it("duyệt lần hai không gửi thêm email và báo already_reviewed", async () => {
    const admin = await makeAdmin();
    await registerUser(
      { email: "twice@example.com", password: "password1234", displayName: "Twice", instructorApplication: APPLICATION },
      BASE_URL,
    );
    const app = (await listInstructorApplications("pending"))[0]!;
    await approveInstructorApplication(admin.id, app.id, BASE_URL);
    const send = vi.spyOn(templates, "sendTemplatedEmail");
    await expect(approveInstructorApplication(admin.id, app.id, BASE_URL)).rejects.toMatchObject({
      code: "already_reviewed",
    });
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });

  it("từ chối: không cấp role, lưu lý do, gửi email kèm lý do, có thể nộp lại", async () => {
    const admin = await makeAdmin();
    const r = await registerUser(
      { email: "no@example.com", password: "password1234", displayName: "Cô No", instructorApplication: APPLICATION },
      BASE_URL,
    );
    const app = (await listInstructorApplications("pending"))[0]!;
    const send = vi.spyOn(templates, "sendTemplatedEmail");

    await rejectInstructorApplication(admin.id, app.id, "Chưa xác minh được đơn vị.");

    expect(await rolesOf(r.userId)).toEqual([RoleName.Learner]);
    const after = await prisma.instructorApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect(after).toMatchObject({ status: "rejected", rejectionReason: "Chưa xác minh được đơn vị." });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "instructor.application_rejected",
        variables: expect.objectContaining({ reason: "Chưa xác minh được đơn vị." }),
      }),
    );
    send.mockRestore();

    // Nộp lại được sau khi bị từ chối.
    await expect(createInstructorApplication(r.userId, APPLICATION)).resolves.toMatchObject({
      status: "pending",
    });
  });

  it("từ chối bắt buộc có lý do", async () => {
    const admin = await makeAdmin();
    await registerUser(
      { email: "nr@example.com", password: "password1234", displayName: "NR", instructorApplication: APPLICATION },
      BASE_URL,
    );
    const app = (await listInstructorApplications("pending"))[0]!;
    await expect(rejectInstructorApplication(admin.id, app.id, "   ")).rejects.toMatchObject({
      code: "reason_required",
    });
  });
});
