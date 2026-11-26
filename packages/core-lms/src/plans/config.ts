/** Cấu hình gói tài khoản: cờ bật tầng gói, mốc dùng thử, danh mục ban đầu. */
import { TRIAL_ENDS_AT_ISO } from "@feedbackme/shared-types";

export {
  PLAN_LIMIT_KEYS,
  PLAN_BOOLEAN_KEYS,
  TECH_CEILINGS,
  TRIAL_ENDS_AT_ISO,
  PLAN_CATALOG,
  type PlanSeed,
} from "@feedbackme/shared-types";

/** Đọc môi trường mỗi lần gọi (không cache lúc nạp module). */
export function plansEnabled(): boolean {
  const v = process.env.PLANS_ENABLED;
  return v === "1" || v === "true";
}

export const TRIAL_ENDS_AT: Date = new Date(TRIAL_ENDS_AT_ISO);
