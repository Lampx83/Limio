/**
 * D1 — Feature permission resolver.
 *
 * Bổ sung cho RBAC (Role/UserRole) sẵn có, không thay thế: Role trả lời
 * "user này LÀ ai" (ranh giới chức năng), FeatureFlag trả lời "user này ĐƯỢC
 * BẬT tính năng gì" (ranh giới governance/thương mại tương lai) — 2 trục độc
 * lập cùng tồn tại song song.
 *
 * Resolution: UserFeatureOverride (còn hạn) > RoleFeatureOverride > default.
 * Multi-role xung đột trên cùng key: OR cho boolean, MAX cho int, UNION cho
 * string_array — "role nào cho phép nhiều hơn thì thắng", nhất quán với
 * isInstructor()-style check hiện có (có bất kỳ scope nào của role đó là đủ).
 */
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { logAudit } from "./audit";

export type FeatureValue = boolean | number | string[] | null;

export class FeatureFlagError extends Error {
  constructor(
    public readonly code: "unknown_key" | "invalid_value_type",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

type ValueType = "boolean" | "int" | "string_array";

function jsonToFeatureValue(json: Prisma.JsonValue): FeatureValue {
  return json as FeatureValue;
}

function mergeValues(valueType: ValueType, values: FeatureValue[]): FeatureValue {
  if (values.length === 0) return null;
  if (valueType === "boolean") {
    return values.some((v) => v === true);
  }
  if (valueType === "int") {
    const nums = values.filter((v): v is number => typeof v === "number");
    return nums.length > 0 ? Math.max(...nums) : null;
  }
  // string_array
  const union = new Set<string>();
  for (const v of values) {
    if (Array.isArray(v)) for (const s of v) union.add(s);
  }
  return Array.from(union);
}

function validateValueType(valueType: ValueType, value: FeatureValue): void {
  const ok =
    (valueType === "boolean" && typeof value === "boolean") ||
    (valueType === "int" && (value === null || typeof value === "number")) ||
    (valueType === "string_array" && Array.isArray(value));
  if (!ok) {
    throw new FeatureFlagError("invalid_value_type", { valueType, value });
  }
}

async function getUserRoleIds(userId: string, db: PrismaClient): Promise<string[]> {
  const rows = await db.userRole.findMany({ where: { userId }, select: { roleId: true } });
  return Array.from(new Set(rows.map((r) => r.roleId)));
}

/**
 * Resolve nhiều feature key cùng lúc cho 1 user — dùng khi cần check nhiều
 * key (vd trang tổng hợp quyền của 1 user). Tối đa 4 query cố định, không
 * N+1 theo số key.
 */
export async function resolveFeatures(
  userId: string,
  keys: string[],
  db: PrismaClient = prisma,
): Promise<Record<string, FeatureValue>> {
  if (keys.length === 0) return {};
  const now = new Date();

  const [flags, userOverrides, roleIds] = await Promise.all([
    db.featureFlag.findMany({ where: { key: { in: keys } } }),
    db.userFeatureOverride.findMany({ where: { userId, featureKey: { in: keys } } }),
    getUserRoleIds(userId, db),
  ]);

  const missing = keys.filter((k) => !flags.some((f) => f.key === k));
  if (missing.length > 0) {
    throw new FeatureFlagError("unknown_key", { keys: missing });
  }

  const roleOverrides =
    roleIds.length > 0
      ? await db.roleFeatureOverride.findMany({
          where: { roleId: { in: roleIds }, featureKey: { in: keys } },
        })
      : [];

  const userOverrideByKey = new Map(userOverrides.map((o) => [o.featureKey, o]));
  const roleOverridesByKey = new Map<string, typeof roleOverrides>();
  for (const o of roleOverrides) {
    const arr = roleOverridesByKey.get(o.featureKey) ?? [];
    arr.push(o);
    roleOverridesByKey.set(o.featureKey, arr);
  }

  const result: Record<string, FeatureValue> = {};
  for (const flag of flags) {
    const userOverride = userOverrideByKey.get(flag.key);
    if (userOverride && (userOverride.expiresAt === null || userOverride.expiresAt > now)) {
      result[flag.key] = jsonToFeatureValue(userOverride.value);
      continue;
    }

    const roleValues = roleOverridesByKey.get(flag.key);
    if (roleValues && roleValues.length > 0) {
      result[flag.key] = mergeValues(
        flag.valueType as ValueType,
        roleValues.map((o) => jsonToFeatureValue(o.value)),
      );
      continue;
    }

    result[flag.key] = jsonToFeatureValue(flag.defaultValue);
  }
  return result;
}

/** Resolve 1 feature key. Xem resolveFeatures() cho batch — tránh N+1. */
export async function resolveFeature(
  userId: string,
  key: string,
  db: PrismaClient = prisma,
): Promise<FeatureValue> {
  const result = await resolveFeatures(userId, [key], db);
  // resolveFeatures throws unknown_key for any key it can't find a FeatureFlag
  // for, so result[key] is always populated here.
  return result[key] as FeatureValue;
}

/**
 * Helper cho key boolean — throw nếu key không phải boolean (fail fast, tránh
 * dùng sai kiểu ở call site như if (await isFeatureEnabled(...)) đang mong
 * đợi boolean nhưng key thực ra là int).
 */
export async function isFeatureEnabled(
  userId: string,
  key: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { key }, select: { valueType: true } });
  if (!flag) throw new FeatureFlagError("unknown_key", { key });
  if (flag.valueType !== "boolean") {
    throw new FeatureFlagError("invalid_value_type", { key, expected: "boolean", actual: flag.valueType });
  }
  return (await resolveFeature(userId, key, db)) === true;
}

/**
 * Ghi/xoá override cho 1 user cụ thể. `value: null` = thu hồi override (xoá
 * hẳn, không phải "set false") — quay lại role/default. Luôn ghi AuditLog
 * cùng transaction; `reason` bắt buộc khi cấp (không bắt buộc khi thu hồi).
 */
export async function setUserFeatureOverride(
  actorUserId: string,
  targetUserId: string,
  featureKey: string,
  value: FeatureValue,
  reason: string,
  opts: { expiresAt?: Date | null } = {},
  db: PrismaClient = prisma,
): Promise<void> {
  const flag = await db.featureFlag.findUnique({ where: { key: featureKey } });
  if (!flag) throw new FeatureFlagError("unknown_key", { key: featureKey });
  if (value !== null) validateValueType(flag.valueType as ValueType, value);

  await db.$transaction(async (tx) => {
    const existing = await tx.userFeatureOverride.findUnique({
      where: { userId_featureKey: { userId: targetUserId, featureKey } },
    });

    if (value === null) {
      if (existing) {
        await tx.userFeatureOverride.delete({ where: { id: existing.id } });
      }
    } else {
      await tx.userFeatureOverride.upsert({
        where: { userId_featureKey: { userId: targetUserId, featureKey } },
        create: {
          userId: targetUserId,
          featureKey,
          value: value as Prisma.InputJsonValue,
          reason,
          grantedBy: actorUserId,
          expiresAt: opts.expiresAt ?? null,
        },
        update: {
          value: value as Prisma.InputJsonValue,
          reason,
          grantedBy: actorUserId,
          expiresAt: opts.expiresAt ?? null,
        },
      });
    }

    await logAudit(
      {
        action: value === null ? "feature.override.revoked" : "feature.override.granted",
        actorUserId,
        targetUserId,
        payload: {
          featureKey,
          oldValue: existing ? jsonToFeatureValue(existing.value) : null,
          newValue: value,
          reason,
        },
      },
      tx,
    );
  });
}

/**
 * Ghi/xoá default theo role (áp dụng cho mọi user giữ role đó). Khác
 * setUserFeatureOverride: không cần `reason` (đây là thay đổi cấu hình sản
 * phẩm, không phải case-by-case), nhưng vẫn audit.
 */
export async function setRoleFeatureOverride(
  actorUserId: string,
  roleId: string,
  featureKey: string,
  value: FeatureValue,
  db: PrismaClient = prisma,
): Promise<void> {
  const flag = await db.featureFlag.findUnique({ where: { key: featureKey } });
  if (!flag) throw new FeatureFlagError("unknown_key", { key: featureKey });
  if (value !== null) validateValueType(flag.valueType as ValueType, value);

  await db.$transaction(async (tx) => {
    const existing = await tx.roleFeatureOverride.findUnique({
      where: { roleId_featureKey: { roleId, featureKey } },
    });

    if (value === null) {
      if (existing) {
        await tx.roleFeatureOverride.delete({ where: { id: existing.id } });
      }
    } else {
      await tx.roleFeatureOverride.upsert({
        where: { roleId_featureKey: { roleId, featureKey } },
        create: { roleId, featureKey, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      });
    }

    await logAudit(
      {
        action: value === null ? "feature.role_default.revoked" : "feature.role_default.set",
        actorUserId,
        payload: {
          roleId,
          featureKey,
          oldValue: existing ? jsonToFeatureValue(existing.value) : null,
          newValue: value,
        },
      },
      tx,
    );
  });
}
