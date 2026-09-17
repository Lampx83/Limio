import { describe, expect, it } from "vitest";
import { prisma, Prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  resolveFeature,
  resolveFeatures,
  isFeatureEnabled,
  setUserFeatureOverride,
  setRoleFeatureOverride,
  FeatureFlagError,
} from "../permissions";
import { registerUser } from "../register";
import { grantRole } from "../roles";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser({ email, password: "password1234", displayName: email }, BASE);
  return r.userId;
}

async function makeAdmin(email: string) {
  const id = await makeUser(email);
  await grantRole(id, { targetUserId: id, roleName: RoleName.Admin });
  return id;
}

async function makeBooleanFlag(key: string, defaultValue: boolean) {
  return prisma.featureFlag.create({
    data: {
      key,
      group: "teaching_tools",
      name: key,
      description: "test flag",
      valueType: "boolean",
      defaultValue,
      sellable: false,
    },
  });
}

async function makeIntFlag(key: string) {
  return prisma.featureFlag.create({
    data: {
      key,
      group: "ai_tutor",
      name: key,
      description: "test int flag",
      valueType: "int",
      defaultValue: Prisma.JsonNull,
      sellable: true,
    },
  });
}

async function roleIdFor(name: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name } });
  return role.id;
}

describe("resolveFeature — resolution order", () => {
  it("AC3: falls back to FeatureFlag.defaultValue when no override exists", async () => {
    await makeBooleanFlag("test.default_true", true);
    const userId = await makeUser("u1@e.com");
    expect(await resolveFeature(userId, "test.default_true")).toBe(true);
  });

  it("AC4: role override wins over default", async () => {
    await makeBooleanFlag("test.role_wins", false);
    const userId = await makeUser("u2@e.com");
    await grantRole(userId, { targetUserId: userId, roleName: RoleName.Instructor });
    const roleId = await roleIdFor(RoleName.Instructor);
    await setRoleFeatureOverride(userId, roleId, "test.role_wins", true);

    expect(await resolveFeature(userId, "test.role_wins")).toBe(true);
  });

  it("AC5: user override wins over role override", async () => {
    await makeBooleanFlag("test.user_wins", false);
    const userId = await makeUser("u3@e.com");
    await grantRole(userId, { targetUserId: userId, roleName: RoleName.Instructor });
    const roleId = await roleIdFor(RoleName.Instructor);
    await setRoleFeatureOverride(userId, roleId, "test.user_wins", true);
    await setUserFeatureOverride(userId, userId, "test.user_wins", false, "test override");

    expect(await resolveFeature(userId, "test.user_wins")).toBe(false);
  });

  it("AC6: multi-role conflict — OR for boolean, MAX for int", async () => {
    await makeBooleanFlag("test.multirole_bool", false);
    await makeIntFlag("test.multirole_int");
    const userId = await makeUser("u4@e.com");
    await grantRole(userId, { targetUserId: userId, roleName: RoleName.Learner });
    await grantRole(userId, { targetUserId: userId, roleName: RoleName.Instructor });
    const learnerRoleId = await roleIdFor(RoleName.Learner);
    const instructorRoleId = await roleIdFor(RoleName.Instructor);

    await setRoleFeatureOverride(userId, learnerRoleId, "test.multirole_bool", false);
    await setRoleFeatureOverride(userId, instructorRoleId, "test.multirole_bool", true);
    expect(await resolveFeature(userId, "test.multirole_bool")).toBe(true);

    await setRoleFeatureOverride(userId, learnerRoleId, "test.multirole_int", 5);
    await setRoleFeatureOverride(userId, instructorRoleId, "test.multirole_int", 20);
    expect(await resolveFeature(userId, "test.multirole_int")).toBe(20);
  });

  it("AC7: expired user override is ignored, falls back to role/default", async () => {
    await makeBooleanFlag("test.expired_override", false);
    const userId = await makeUser("u5@e.com");
    await setUserFeatureOverride(
      userId,
      userId,
      "test.expired_override",
      true,
      "trial",
      { expiresAt: new Date(Date.now() - 1000) },
    );
    expect(await resolveFeature(userId, "test.expired_override")).toBe(false);
  });

  it("AC7b: a still-valid expiresAt is honored", async () => {
    await makeBooleanFlag("test.valid_expiry", false);
    const userId = await makeUser("u5b@e.com");
    await setUserFeatureOverride(
      userId,
      userId,
      "test.valid_expiry",
      true,
      "trial",
      { expiresAt: new Date(Date.now() + 60_000) },
    );
    expect(await resolveFeature(userId, "test.valid_expiry")).toBe(true);
  });

  it("throws FeatureFlagError(unknown_key) for an unregistered key", async () => {
    const userId = await makeUser("u6@e.com");
    await expect(resolveFeature(userId, "no.such.key")).rejects.toBeInstanceOf(FeatureFlagError);
  });
});

describe("isFeatureEnabled", () => {
  it("AC8: returns a plain boolean", async () => {
    await makeBooleanFlag("test.enabled_check", true);
    const userId = await makeUser("u7@e.com");
    expect(await isFeatureEnabled(userId, "test.enabled_check")).toBe(true);
  });

  it("AC8b: throws for a non-boolean key instead of silently coercing", async () => {
    await makeIntFlag("test.not_boolean");
    const userId = await makeUser("u8@e.com");
    await expect(isFeatureEnabled(userId, "test.not_boolean")).rejects.toBeInstanceOf(
      FeatureFlagError,
    );
  });
});

describe("resolveFeatures — batch", () => {
  it("AC9: resolves multiple keys in one call with the same semantics as resolveFeature", async () => {
    await makeBooleanFlag("test.batch_a", true);
    await makeBooleanFlag("test.batch_b", false);
    const userId = await makeUser("u9@e.com");
    await setUserFeatureOverride(userId, userId, "test.batch_b", true, "override b");

    const result = await resolveFeatures(userId, ["test.batch_a", "test.batch_b"]);
    expect(result).toEqual({ "test.batch_a": true, "test.batch_b": true });
  });
});

describe("setUserFeatureOverride — writes + audit", () => {
  it("AC10: grants write an AuditLog row with old/new value", async () => {
    await makeBooleanFlag("test.audit_grant", false);
    const adminId = await makeAdmin("admin1@e.com");
    const targetId = await makeUser("target1@e.com");

    await setUserFeatureOverride(adminId, targetId, "test.audit_grant", true, "vip customer");

    const logs = await prisma.auditLog.findMany({
      where: { action: "feature.override.granted", actorUserId: adminId, targetUserId: targetId },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.payload).toMatchObject({
      featureKey: "test.audit_grant",
      oldValue: null,
      newValue: true,
      reason: "vip customer",
    });
  });

  it("AC10b: revoking (value=null) deletes the override and audits feature.override.revoked", async () => {
    await makeBooleanFlag("test.audit_revoke", false);
    const adminId = await makeAdmin("admin2@e.com");
    const targetId = await makeUser("target2@e.com");
    await setUserFeatureOverride(adminId, targetId, "test.audit_revoke", true, "temp grant");

    await setUserFeatureOverride(adminId, targetId, "test.audit_revoke", null, "no longer needed");

    const override = await prisma.userFeatureOverride.findUnique({
      where: { userId_featureKey: { userId: targetId, featureKey: "test.audit_revoke" } },
    });
    expect(override).toBeNull();
    expect(await resolveFeature(targetId, "test.audit_revoke")).toBe(false);

    const revokeLogs = await prisma.auditLog.findMany({
      where: { action: "feature.override.revoked", targetUserId: targetId },
    });
    expect(revokeLogs).toHaveLength(1);
  });

  it("AC11: rejects a value that doesn't match the flag's valueType", async () => {
    await makeBooleanFlag("test.wrong_type", false);
    const adminId = await makeAdmin("admin3@e.com");
    const targetId = await makeUser("target3@e.com");

    await expect(
      setUserFeatureOverride(
        adminId,
        targetId,
        "test.wrong_type",
        // @ts-expect-error deliberately wrong type for the test
        "not-a-boolean",
        "bad input",
      ),
    ).rejects.toBeInstanceOf(FeatureFlagError);

    // Nothing should have been written.
    const override = await prisma.userFeatureOverride.findUnique({
      where: { userId_featureKey: { userId: targetId, featureKey: "test.wrong_type" } },
    });
    expect(override).toBeNull();
  });

  it("throws unknown_key for a key with no FeatureFlag row", async () => {
    const adminId = await makeAdmin("admin4@e.com");
    const targetId = await makeUser("target4@e.com");
    await expect(
      setUserFeatureOverride(adminId, targetId, "no.such.key", true, "x"),
    ).rejects.toBeInstanceOf(FeatureFlagError);
  });
});

describe("setRoleFeatureOverride — writes + audit", () => {
  it("sets and revokes a role default, each audited", async () => {
    await makeBooleanFlag("test.role_default", false);
    const adminId = await makeAdmin("admin5@e.com");
    const roleId = await roleIdFor(RoleName.Instructor);

    await setRoleFeatureOverride(adminId, roleId, "test.role_default", true);
    const setLogs = await prisma.auditLog.findMany({
      where: { action: "feature.role_default.set", actorUserId: adminId },
    });
    expect(setLogs).toHaveLength(1);

    await setRoleFeatureOverride(adminId, roleId, "test.role_default", null);
    const row = await prisma.roleFeatureOverride.findUnique({
      where: { roleId_featureKey: { roleId, featureKey: "test.role_default" } },
    });
    expect(row).toBeNull();
    const revokeLogs = await prisma.auditLog.findMany({
      where: { action: "feature.role_default.revoked", actorUserId: adminId },
    });
    expect(revokeLogs).toHaveLength(1);
  });
});
