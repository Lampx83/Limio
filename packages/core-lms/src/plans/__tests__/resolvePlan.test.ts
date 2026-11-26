import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma, Prisma } from "@feedbackme/db";
import { FLAGS } from "@feedbackme/db/feature-flag-catalog";
import { RoleName } from "@feedbackme/shared-types";
import { PLAN_CATALOG } from "../config";
import {
  getActiveSubscriptions,
  getEffectivePlan,
  getPlanEntitlementsForUser,
  getPlanSubjectKind,
} from "../subscriptions";
import { resolveFeature, resolveFeatures, setRoleFeatureOverride, setUserFeatureOverride } from "../../auth/permissions";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";
const HOUR = 3600_000;
const FAR = new Date("2099-01-01T00:00:00.000Z");

let seq = 0;
async function makeUser(tag: string) {
  seq += 1;
  const r = await registerUser(
    { email: `${tag}-${seq}-${Date.now()}@e.com`, password: "password1234", displayName: tag },
    BASE,
  );
  return r.userId;
}
async function makeTeacher(tag = "gv") {
  const id = await makeUser(tag);
  await grantRole(id, { targetUserId: id, roleName: RoleName.Instructor });
  return id;
}
/** grantRole không nhận center_teacher / org_admin nên gắn thẳng. */
async function giveRole(userId: string, name: string) {
  const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}
async function makeOrg(tag: string) {
  seq += 1;
  return prisma.organization.create({ data: { code: `P${tag}-${seq}-${Date.now()}`, name: tag } });
}
async function planId(key: string) {
  return (await prisma.plan.findUniqueOrThrow({ where: { key } })).id;
}
async function subscribe(
  key: string,
  who: { userId?: string; organizationId?: string },
  opts: { startsAt?: Date; endsAt?: Date; cancelledAt?: Date } = {},
) {
  return prisma.subscription.create({
    data: {
      planId: await planId(key),
      ...who,
      source: "admin",
      startsAt: opts.startsAt ?? new Date(Date.now() - HOUR),
      endsAt: opts.endsAt ?? FAR,
      cancelledAt: opts.cancelledAt ?? null,
    },
  });
}

const oldEnv = process.env.PLANS_ENABLED;

beforeEach(async () => {
  process.env.PLANS_ENABLED = "1";
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, update: {}, create: f });
  }
  for (const p of PLAN_CATALOG) {
    await prisma.plan.create({
      data: {
        key: p.key,
        name: p.name,
        scope: p.scope,
        entitlements: p.entitlements as Prisma.InputJsonValue,
        referencePlanKey: p.referencePlanKey ?? null,
        isPublic: p.isPublic,
        sortOrder: p.sortOrder,
      },
    });
  }
});

afterEach(() => {
  if (oldEnv === undefined) delete process.env.PLANS_ENABLED;
  else process.env.PLANS_ENABLED = oldEnv;
});

describe("resolveFeatures — tầng gói", () => {
  it("giảng viên không có gói → giá trị gói free", async () => {
    const teacher = await makeTeacher();
    expect(await resolveFeature(teacher, "storage.mb")).toBe(2048);
  });

  it("Pro cá nhân + org_khoa của tổ chức → lấy số lớn hơn", async () => {
    const org = await makeOrg("khoa");
    const teacher = await makeTeacher();
    await prisma.user.update({ where: { id: teacher }, data: { organizationId: org.id } });
    await subscribe("pro", { userId: teacher });
    await subscribe("org_khoa", { organizationId: org.id });
    // pro storage 20480, org_khoa 204800; pro oral 30, org_khoa 125
    expect(await resolveFeature(teacher, "storage.mb")).toBe(204800);
    expect(await resolveFeature(teacher, "ai_oral.monthly_attempts")).toBe(125);
  });

  it("học viên thuộc tổ chức có gói → như khi chưa có gói", async () => {
    const org = await makeOrg("hv");
    const learner = await makeUser("hv");
    await prisma.user.update({ where: { id: learner }, data: { organizationId: org.id } });
    await subscribe("org_khoa", { organizationId: org.id });
    expect(await resolveFeature(learner, "storage.mb")).toBeNull();
    expect(await getPlanEntitlementsForUser(learner)).toBeNull();
  });

  it("platform admin không đi qua tầng gói", async () => {
    const admin = await makeTeacher("admin");
    await grantRole(admin, { targetUserId: admin, roleName: RoleName.Admin });
    expect(await getPlanSubjectKind(admin)).toBe("admin");
    expect(await resolveFeature(admin, "storage.mb")).toBeNull();
  });

  it("UserFeatureOverride còn hạn thắng gói", async () => {
    const teacher = await makeTeacher();
    await subscribe("pro", { userId: teacher });
    await setUserFeatureOverride(teacher, teacher, "storage.mb", 7, "tặng");
    expect(await resolveFeature(teacher, "storage.mb")).toBe(7);
  });

  it("UserFeatureOverride hết hạn thì gói lại quyết định", async () => {
    const teacher = await makeTeacher();
    await subscribe("pro", { userId: teacher });
    await setUserFeatureOverride(teacher, teacher, "storage.mb", 7, "tặng", {
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await resolveFeature(teacher, "storage.mb")).toBe(20480);
  });

  it("gói thắng RoleFeatureOverride trên khoá sellable", async () => {
    const teacher = await makeTeacher();
    const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });
    await setRoleFeatureOverride(teacher, role.id, "storage.mb", 999999);
    expect(await resolveFeature(teacher, "storage.mb")).toBe(2048);
  });

  it("endsAt đúng bằng now là đã hết; startsAt tương lai chưa hiệu lực", async () => {
    const t1 = await makeTeacher("t1");
    const now = new Date();
    await subscribe("pro", { userId: t1 }, { startsAt: new Date(now.getTime() - HOUR), endsAt: now });
    expect(await getActiveSubscriptions(t1, now)).toEqual([]);
    expect((await getPlanEntitlementsForUser(t1, now))?.["storage.mb"]).toBe(2048);

    const t2 = await makeTeacher("t2");
    await subscribe("pro", { userId: t2 }, { startsAt: new Date(Date.now() + HOUR) });
    expect(await resolveFeature(t2, "storage.mb")).toBe(2048);

    const t3 = await makeTeacher("t3");
    await subscribe("pro", { userId: t3 }, { cancelledAt: new Date() });
    expect(await resolveFeature(t3, "storage.mb")).toBe(2048);
  });

  it("đổi organizationId thì gói tổ chức theo ngay", async () => {
    const orgA = await makeOrg("a");
    const orgB = await makeOrg("b");
    const teacher = await makeTeacher();
    await prisma.user.update({ where: { id: teacher }, data: { organizationId: orgA.id } });
    await subscribe("pro", { userId: teacher });
    await subscribe("org_khoa", { organizationId: orgA.id });
    expect(await resolveFeature(teacher, "storage.mb")).toBe(204800);
    await prisma.user.update({ where: { id: teacher }, data: { organizationId: orgB.id } });
    expect(await resolveFeature(teacher, "storage.mb")).toBe(20480);
  });

  it("khoá vắng mặt trong mọi gói rơi về vai trò/mặc định", async () => {
    const teacher = await makeTeacher();
    await subscribe("pro", { userId: teacher });
    // tournament.create.global sellable nhưng không gói nào có
    expect(await resolveFeature(teacher, "tournament.create.global")).toBe(false);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });
    await setRoleFeatureOverride(teacher, role.id, "tournament.create.global", true);
    expect(await resolveFeature(teacher, "tournament.create.global")).toBe(true);
  });

  it("PLANS_ENABLED tắt → không tầng gói", async () => {
    delete process.env.PLANS_ENABLED;
    const teacher = await makeTeacher();
    await subscribe("pro", { userId: teacher });
    expect(await resolveFeature(teacher, "storage.mb")).toBeNull();
    expect(await getPlanEntitlementsForUser(teacher)).toBeNull();
  });

  it("không có dòng gói free → tầng gói không góp gì", async () => {
    await prisma.plan.delete({ where: { key: "free" } });
    const teacher = await makeTeacher();
    expect(await getPlanEntitlementsForUser(teacher)).toBeNull();
    expect(await resolveFeature(teacher, "storage.mb")).toBeNull();
  });

  it("gói đã ngừng bán (active=false) vẫn tính cho thuê bao đang có", async () => {
    const teacher = await makeTeacher();
    await subscribe("pro", { userId: teacher });
    await prisma.plan.update({ where: { key: "pro" }, data: { active: false } });
    expect(await resolveFeature(teacher, "storage.mb")).toBe(20480);
  });

  it("chỉ khoá không sellable thì không thêm truy vấn nào của tầng gói", async () => {
    const teacher = await makeTeacher();
    // Đếm bảng được chạm qua một Proxy bọc client (spyOn trên delegate của Prisma làm hỏng client).
    const touched: string[] = [];
    const db = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && !prop.startsWith("$")) touched.push(prop);
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof prisma;

    await resolveFeatures(teacher, ["teaching_tools.access"], db);
    expect(new Set(touched)).toEqual(
      new Set(["featureFlag", "userFeatureOverride", "userRole", "roleFeatureOverride"]),
    );

    touched.length = 0;
    await resolveFeatures(teacher, ["teaching_tools.access", "storage.mb"], db);
    expect(touched.filter((t) => t === "subscription")).toHaveLength(1);
    expect(touched).not.toContain("courseInstructor"); // đã có vai trò instructor
  });
});

describe("getPlanSubjectKind", () => {
  it("phân loại admin / teaching / other", async () => {
    const learner = await makeUser("hv");
    expect(await getPlanSubjectKind(learner)).toBe("other");

    const center = await makeUser("ct");
    await giveRole(center, RoleName.CenterTeacher);
    expect(await getPlanSubjectKind(center)).toBe("teaching");

    const orgAdmin = await makeUser("oa");
    await giveRole(orgAdmin, RoleName.OrgAdmin);
    expect(await getPlanSubjectKind(orgAdmin)).toBe("teaching");
  });

  it("CourseInstructor của một khoá (vai trò khoá bất kỳ) là người giảng dạy", async () => {
    const ta = await makeUser("ta");
    const course = await prisma.course.create({
      data: { slug: `plan-ci-${Date.now()}-${seq}`, title: "C", description: "x" },
    });
    await prisma.courseInstructor.create({
      data: { courseId: course.id, userId: ta, role: "teaching-assistant" },
    });
    expect(await getPlanSubjectKind(ta)).toBe("teaching");
    expect(await resolveFeature(ta, "storage.mb")).toBe(2048);
  });
});

describe("getEffectivePlan", () => {
  it("không gói hiệu lực → null", async () => {
    const teacher = await makeTeacher();
    expect(await getEffectivePlan(teacher)).toBeNull();
  });

  it("sortOrder cao nhất thắng, kèm nguồn tổ chức", async () => {
    const org = await makeOrg("e");
    const teacher = await makeTeacher();
    await prisma.user.update({ where: { id: teacher }, data: { organizationId: org.id } });
    await subscribe("pro", { userId: teacher });
    await subscribe("org_khoa", { organizationId: org.id });
    const eff = await getEffectivePlan(teacher);
    expect(eff?.planKey).toBe("org_khoa");
    expect(eff?.scope).toBe("organization");
    expect(eff?.entitlements["storage.mb"]).toBe(204800);
  });

  it("cùng gói → ưu tiên endsAt xa hơn", async () => {
    const teacher = await makeTeacher();
    const near = new Date(Date.now() + 10 * HOUR);
    await subscribe("pro", { userId: teacher }, { endsAt: near });
    const far = await subscribe("pro", { userId: teacher }, { endsAt: FAR });
    const eff = await getEffectivePlan(teacher);
    expect(eff?.id).toBe(far.id);
    expect(eff?.scope).toBe("individual");
    expect(eff?.source).toBe("admin");
  });

  it("gói dùng thử mang referencePlanKey", async () => {
    const teacher = await makeTeacher();
    await subscribe("trial_individual", { userId: teacher });
    const eff = await getEffectivePlan(teacher);
    expect(eff?.referencePlanKey).toBe("pro");
    expect(eff?.planName).toBe("Dùng thử (cá nhân)");
  });
});
