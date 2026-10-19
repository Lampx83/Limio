import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  ExamNetworkValidationError,
  getOrgExamNetwork,
  updateOrgExamNetwork,
} from "../../org/exam-network";
import {
  evaluateNetwork,
  examNetworkRulesForExam,
  parseIpRules,
} from "../ip-policy";
import { createExam } from "../";

const BASE = "http://localhost:3000";

describe("parseIpRules", () => {
  it("nhận IP đơn và CIDR, bỏ dòng trống, chú thích và dòng trùng", () => {
    const r = parseIpRules([
      "203.0.113.0/24  # phòng máy A",
      "",
      "198.51.100.7",
      "198.51.100.7",
      "   ",
      "2001:db8::/32",
    ]);
    expect(r.invalid).toEqual([]);
    expect(r.rules).toEqual(["203.0.113.0/24", "198.51.100.7", "2001:db8::/32"]);
  });

  it("báo từng dòng sai, không lẫn vào dòng đúng", () => {
    const r = parseIpRules(["10.0.0.0/33", "300.1.1.1", "abc", "1.2.3.4/x", "1.2.3.4"]);
    expect(r.rules).toEqual(["1.2.3.4"]);
    expect(r.invalid).toEqual(["10.0.0.0/33", "300.1.1.1", "abc", "1.2.3.4/x"]);
  });
});

describe("evaluateNetwork", () => {
  const rules = ["203.0.113.0/24", "198.51.100.7", "2001:db8:abcd::/48"];

  it("danh sách rỗng: luôn cho vào (kể cả không biết IP)", () => {
    expect(evaluateNetwork("8.8.8.8", [])).toEqual({ allowed: true });
    expect(evaluateNetwork(null, [])).toEqual({ allowed: true });
  });

  it("IP trong dải CIDR và IP đơn được vào; ngoài dải bị chặn", () => {
    expect(evaluateNetwork("203.0.113.200", rules).allowed).toBe(true);
    expect(evaluateNetwork("198.51.100.7", rules).allowed).toBe(true);
    expect(evaluateNetwork("203.0.114.1", rules)).toMatchObject({
      allowed: false,
      reason: "ip_not_allowed",
    });
    expect(evaluateNetwork("198.51.100.8", rules).allowed).toBe(false);
  });

  it("ranh giới dải: địa chỉ đầu và cuối của /24 đều vào", () => {
    expect(evaluateNetwork("203.0.113.0", rules).allowed).toBe(true);
    expect(evaluateNetwork("203.0.113.255", rules).allowed).toBe(true);
    expect(evaluateNetwork("203.0.112.255", rules).allowed).toBe(false);
  });

  it("IPv6 theo CIDR, và IPv4-mapped IPv6 coi như IPv4", () => {
    expect(evaluateNetwork("2001:db8:abcd:1::5", rules).allowed).toBe(true);
    expect(evaluateNetwork("2001:db8:abce::1", rules).allowed).toBe(false);
    expect(evaluateNetwork("::ffff:203.0.113.9", rules).allowed).toBe(true);
    expect(evaluateNetwork("[2001:db8:abcd::1]", rules).allowed).toBe(true);
  });

  it("có quy tắc mà không biết/không đọc được IP: từ chối (đóng cửa khi không chắc)", () => {
    expect(evaluateNetwork(null, rules)).toMatchObject({ allowed: false, reason: "ip_unknown" });
    expect(evaluateNetwork("unknown", rules)).toMatchObject({
      allowed: false,
      reason: "ip_unknown",
    });
  });

  it("họ địa chỉ khác nhau không khớp nhầm", () => {
    expect(evaluateNetwork("::1", ["127.0.0.1"]).allowed).toBe(false);
    expect(evaluateNetwork("127.0.0.1", ["::1"]).allowed).toBe(false);
  });
});

async function setup(slug: string) {
  const admin = await registerUser(
    { email: `ipp-admin-${slug}@e.com`, password: "password1234", displayName: "Admin" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `ipp-out-${slug}@e.com`, password: "password1234", displayName: "Out" },
    BASE,
  );
  const org = await prisma.organization.create({
    data: { code: `IPP-${slug}-${Date.now()}`, name: "Trường IP" },
  });
  await prisma.organizationAdmin.create({
    data: { organizationId: org.id, userId: admin.userId },
  });
  return { adminId: admin.userId, outsiderId: outsider.userId, orgId: org.id };
}

describe("updateOrgExamNetwork", () => {
  it("OrgAdmin lưu được danh sách, đọc lại đúng, và sửa là có audit", async () => {
    const s = await setup("save");
    const saved = await updateOrgExamNetwork(s.adminId, s.orgId, [
      "203.0.113.0/24 # phòng máy",
      "198.51.100.7",
    ]);
    expect(saved).toEqual(["203.0.113.0/24", "198.51.100.7"]);
    expect(await getOrgExamNetwork(s.adminId, s.orgId)).toEqual(saved);

    await updateOrgExamNetwork(s.adminId, s.orgId, ["203.0.113.0/24"]);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "org.exam_network_changed", actorUserId: s.adminId },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit).not.toBeNull();
    // Ghi lại bản cũ và bản mới để truy ai đổi gì.
    expect(audit!.payload).toMatchObject({
      organizationId: s.orgId,
      from: ["203.0.113.0/24", "198.51.100.7"],
      to: ["203.0.113.0/24"],
    });
  });

  it("xoá hết dòng = tắt giới hạn", async () => {
    const s = await setup("clear");
    await updateOrgExamNetwork(s.adminId, s.orgId, ["203.0.113.0/24"]);
    expect(await updateOrgExamNetwork(s.adminId, s.orgId, [])).toEqual([]);
    expect(await getOrgExamNetwork(s.adminId, s.orgId)).toEqual([]);
  });

  it("có dòng sai: từ chối cả lượt, không lưu gì, trả đúng dòng sai", async () => {
    const s = await setup("invalid");
    await updateOrgExamNetwork(s.adminId, s.orgId, ["203.0.113.0/24"]);
    await expect(
      updateOrgExamNetwork(s.adminId, s.orgId, ["198.51.100.1", "999.1.1.1"]),
    ).rejects.toBeInstanceOf(ExamNetworkValidationError);
    // Bản cũ còn nguyên.
    expect(await getOrgExamNetwork(s.adminId, s.orgId)).toEqual(["203.0.113.0/24"]);
  });

  it("người ngoài trường bị chặn", async () => {
    const s = await setup("forbid");
    await expect(
      updateOrgExamNetwork(s.outsiderId, s.orgId, ["203.0.113.0/24"]),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(await getOrgExamNetwork(s.adminId, s.orgId)).toEqual([]);
  });
});

describe("examNetworkRulesForExam — chỉ đề của trường có cấu hình mới bị giới hạn", () => {
  it("đề thuộc khoá của trường có quy tắc thì trả quy tắc; trường khác thì rỗng", async () => {
    const a = await setup("rulesA");
    const b = await setup("rulesB");
    await updateOrgExamNetwork(a.adminId, a.orgId, ["203.0.113.0/24"]);

    const mk = async (ownerId: string, orgId: string, slug: string) => {
      const course = await createCourse(ownerId, {
        title: `C ${slug}`,
        description: "x",
        slug: `ipp-course-${slug}-${Date.now()}`,
      });
      await prisma.course.update({
        where: { id: course.courseId },
        data: { organizationId: orgId },
      });
      const { examId } = await createExam(ownerId, course.courseId, {
        title: `Đề ${slug}`,
        durationMin: 10,
      });
      return examId;
    };

    const examA = await mk(a.adminId, a.orgId, "a");
    const examB = await mk(b.adminId, b.orgId, "b");
    expect(await examNetworkRulesForExam(examA)).toEqual(["203.0.113.0/24"]);
    expect(await examNetworkRulesForExam(examB)).toEqual([]);

    // Đề luyện thi (mockMode) không bị giới hạn mạng dù trường có cấu hình.
    await prisma.exam.update({ where: { id: examA }, data: { mockMode: true } });
    expect(await examNetworkRulesForExam(examA)).toEqual([]);
  });
});
