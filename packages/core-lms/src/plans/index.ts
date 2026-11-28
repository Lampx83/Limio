/** Gói tài khoản (docs/tieu-chi/goi-tai-khoan.md). `FeatureValue` xuất qua auth/permissions. */
export * from "./config";
export {
  mergeValues,
  mergeEntitlements,
  validateEntitlements,
  PlanError,
  type PlanErrorCode,
} from "./entitlements";
export {
  getPlanSubjectKind,
  getActiveSubscriptions,
  getPlanEntitlementsForUser,
  getEffectivePlan,
  type PlanSubjectKind,
  type ActiveSubscription,
} from "./subscriptions";
export {
  updatePlan,
  upsertPlanPrice,
  assignSubscription,
  extendSubscription,
  cancelSubscription,
  listPlansForAdmin,
  listSubscriptions,
  type PlanPatch,
  type AssignSubscriptionInput,
} from "./admin";
export { grantTrialSubscriptions, type TrialGrantResult } from "./trial";
// `vnDayKey` của quota.ts là bản của courses/classScheduleCalc, đã xuất ở gốc package.
export {
  vnMonthRange,
  getPlanLimit,
  checkUsageQuota,
  assertUsageQuota,
  PlanLimitError,
  type UsageMetric,
  type SnapshotMetric,
  type QuotaSource,
  type QuotaResult,
  type QuotaSubject,
  type QuotaOptions,
  type PlanLimitDetails,
} from "./quota";
