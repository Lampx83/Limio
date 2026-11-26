/**
 * Gộp và kiểm quyền (entitlements) của gói tài khoản.
 * Quy tắc gộp dùng chung với resolver quyền theo vai trò: boolean OR,
 * int MAX, string_array UNION — "nguồn nào cho nhiều hơn thì thắng".
 */
export type FeatureValue = boolean | number | string[] | null;

type ValueType = "boolean" | "int" | "string_array";

export function mergeValues(valueType: ValueType, values: FeatureValue[]): FeatureValue {
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

/** Gộp nhiều bộ quyền; chỉ trả khoá có mặt ở ít nhất một bộ. */
export function mergeEntitlements(
  flags: { key: string; valueType: string }[],
  list: Record<string, FeatureValue>[],
): Record<string, FeatureValue> {
  const out: Record<string, FeatureValue> = {};
  for (const f of flags) {
    const present = list.filter((e) => Object.prototype.hasOwnProperty.call(e, f.key));
    if (present.length === 0) continue;
    out[f.key] = mergeValues(
      f.valueType as ValueType,
      present.map((e) => e[f.key] as FeatureValue),
    );
  }
  return out;
}

export type PlanErrorCode =
  | "unknown_key"
  | "non_sellable_key"
  | "invalid_value_type"
  | "plan_not_found"
  | "plan_inactive"
  | "invalid_subject"
  | "invalid_dates"
  | "subscription_not_found";

export class PlanError extends Error {
  constructor(
    public readonly code: PlanErrorCode,
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/** Kiểm quyền do admin nhập: khoá phải có, bán được, đúng kiểu; không cho null. */
export function validateEntitlements(
  entitlements: unknown,
  flags: { key: string; valueType: string; sellable: boolean }[],
): Record<string, FeatureValue> {
  if (typeof entitlements !== "object" || entitlements === null || Array.isArray(entitlements)) {
    throw new PlanError("invalid_value_type", { value: entitlements });
  }
  const byKey = new Map(flags.map((f) => [f.key, f]));
  const out: Record<string, FeatureValue> = {};
  for (const [key, value] of Object.entries(entitlements)) {
    const flag = byKey.get(key);
    if (!flag) throw new PlanError("unknown_key", { key });
    if (!flag.sellable) throw new PlanError("non_sellable_key", { key });
    const ok =
      (flag.valueType === "boolean" && typeof value === "boolean") ||
      (flag.valueType === "int" && typeof value === "number" && Number.isInteger(value) && value >= 0) ||
      (flag.valueType === "string_array" &&
        Array.isArray(value) &&
        value.every((s) => typeof s === "string"));
    if (!ok) throw new PlanError("invalid_value_type", { key, valueType: flag.valueType, value });
    out[key] = value as FeatureValue;
  }
  return out;
}
