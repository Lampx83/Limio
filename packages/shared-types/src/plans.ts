/**
 * Danh mục gói tài khoản ban đầu (xem docs/tieu-chi/goi-tai-khoan.md §6).
 * Chỉ hằng số và kiểu: dùng chung cho seed (packages/db) và core-lms.
 */

/** Khoá hạn mức dạng số của gói. */
export const PLAN_LIMIT_KEYS = [
  "activity.max_responses",
  "gameshow.max_participants",
  "exam.session.max_candidates",
  "ai_oral.monthly_attempts",
  "ai.tokens.monthly_override",
  "storage.mb",
  "org.max_instructors",
  "org.active_learners",
] as const;

/** Khoá bật/tắt mà gói bán có. */
export const PLAN_BOOLEAN_KEYS = ["limio_live.access", "ai_oral.access", "center.access"] as const;

/** Trần kỹ thuật cho mọi hạn mức (gói dùng thử lấy đúng các số này). */
export const TECH_CEILINGS: Record<string, number> = {
  "activity.max_responses": 500,
  "gameshow.max_participants": 300,
  "exam.session.max_candidates": 5000,
  "ai_oral.monthly_attempts": 100000,
  "ai.tokens.monthly_override": 10000000,
  "storage.mb": 10485760,
  "org.max_instructors": 10000,
  "org.active_learners": 1000000,
};

/** 01/03/2027 00:00 giờ Việt Nam. */
export const TRIAL_ENDS_AT_ISO = "2027-02-28T17:00:00.000Z";

export interface PlanSeed {
  key: string;
  name: string;
  scope: "individual" | "organization";
  entitlements: Record<string, boolean | number>;
  referencePlanKey?: string;
  isPublic: boolean;
  sortOrder: number;
  prices?: { period: "month" | "year"; amountVnd: number }[];
}

type Num = {
  act: number; game: number; exam: number; oral: number; tok: number; mb: number;
  inst?: number; learners?: number; center: boolean;
};

function ent(n: Num): Record<string, boolean | number> {
  const e: Record<string, boolean | number> = {
    "activity.max_responses": n.act,
    "gameshow.max_participants": n.game,
    "exam.session.max_candidates": n.exam,
    "ai_oral.monthly_attempts": n.oral,
    "ai.tokens.monthly_override": n.tok,
    "storage.mb": n.mb,
    "limio_live.access": true,
    "ai_oral.access": true,
    "center.access": n.center,
  };
  if (n.inst !== undefined) e["org.max_instructors"] = n.inst;
  if (n.learners !== undefined) e["org.active_learners"] = n.learners;
  return e;
}

/** Gói dùng thử: mọi boolean của gói bán bật, mọi hạn mức lấy trần kỹ thuật. */
function trialEntitlements(withOrg: boolean): Record<string, boolean | number> {
  const e: Record<string, boolean | number> = {};
  for (const k of PLAN_BOOLEAN_KEYS) e[k] = true;
  for (const k of PLAN_LIMIT_KEYS) {
    if (k.startsWith("org.") && !withOrg) continue;
    e[k] = TECH_CEILINGS[k]!;
  }
  return e;
}

export const PLAN_CATALOG: PlanSeed[] = [
  {
    key: "free", name: "Miễn phí", scope: "individual", isPublic: true, sortOrder: 10,
    entitlements: ent({ act: 100, game: 40, exam: 50, oral: 2, tok: 300000, mb: 2048, center: false }),
  },
  {
    key: "pro", name: "Pro", scope: "individual", isPublic: true, sortOrder: 20,
    entitlements: ent({ act: 300, game: 150, exam: 300, oral: 30, tok: 1000000, mb: 20480, center: false }),
    prices: [{ period: "month", amountVnd: 99000 }, { period: "year", amountVnd: 990000 }],
  },
  {
    key: "pro_plus", name: "Pro+", scope: "individual", isPublic: true, sortOrder: 30,
    entitlements: ent({ act: 500, game: 300, exam: 1000, oral: 100, tok: 3000000, mb: 51200, center: false }),
    prices: [{ period: "year", amountVnd: 2900000 }],
  },
  {
    key: "org_khoa", name: "Tổ chức - Khoa", scope: "organization", isPublic: false, sortOrder: 40,
    entitlements: ent({ act: 500, game: 300, exam: 1000, oral: 125, tok: 1000000, mb: 204800, inst: 30, center: false }),
  },
  {
    key: "org_truong", name: "Tổ chức - Trường", scope: "organization", isPublic: false, sortOrder: 50,
    entitlements: ent({ act: 500, game: 300, exam: 1000, oral: 833, tok: 1000000, mb: 1048576, inst: 200, center: false }),
  },
  {
    key: "center_start", name: "Trung tâm - Khởi đầu", scope: "organization", isPublic: false, sortOrder: 60,
    entitlements: ent({ act: 300, game: 150, exam: 300, oral: 100, tok: 1000000, mb: 51200, inst: 5, learners: 100, center: true }),
  },
  {
    key: "center_growth", name: "Trung tâm - Phát triển", scope: "organization", isPublic: false, sortOrder: 70,
    entitlements: ent({ act: 500, game: 300, exam: 1000, oral: 400, tok: 1000000, mb: 204800, inst: 20, learners: 500, center: true }),
  },
  {
    key: "trial_individual", name: "Dùng thử (cá nhân)", scope: "individual", isPublic: false, sortOrder: 80,
    referencePlanKey: "pro", entitlements: trialEntitlements(false),
  },
  {
    key: "org_trial", name: "Dùng thử (tổ chức)", scope: "organization", isPublic: false, sortOrder: 90,
    referencePlanKey: "org_khoa", entitlements: trialEntitlements(true),
  },
];
