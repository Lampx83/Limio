import { randomUUID } from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { AiTutorError } from "./errors";

/**
 * Ví token AI — hạn mức tháng theo vai trò, cộng phần mua thêm.
 *
 * AiUsageLog trả lời "đã tiêu bao nhiêu" (dữ liệu quan sát, gộp theo ngày để
 * làm báo cáo). Module này trả lời "được tiêu bao nhiêu nữa" (dữ liệu kế toán,
 * cộng trừ từng đơn vị và truy được nguồn gốc). Hai việc khác nhau nên hai
 * bảng khác nhau.
 *
 * Thứ tự tiêu: **hạn mức tháng trước, ví đã mua sau**. Nếu trừ ngược lại,
 * người vừa trả tiền sẽ mất luôn phần miễn phí của tháng đó — hoá ra bị phạt
 * vì đã mua.
 */

// Mốc tháng theo giờ VN. VN không có DST và cố định +07:00 nên chỉ cần dịch
// UTC đi 7 tiếng rồi đọc lịch.
//
// Hàm này trùng với periodKeyOf() bên core-gamification, và trùng có chủ ý:
// hai module business không được import nhau (CLAUDE.md §4.3). Bảy dòng lặp
// lại rẻ hơn một đường phụ thuộc chéo.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function vnMonthKey(date: Date = new Date()): string {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  const m = vn.getUTCMonth() + 1;
  return `${vn.getUTCFullYear()}-${m < 10 ? `0${m}` : m}`;
}

// Hạn mức tháng mặc định. Học viên: ~145 lượt hỏi (đo thực tế 688 token/lượt).
// Giảng viên cao hơn hẳn vì họ còn chạy generator — mỗi lần tới 2.000 token
// đầu ra, có endpoint chạy theo lô cả khoá.
export const MONTHLY_TOKENS_LEARNER_KEY = "ai.monthly_tokens.learner";
export const MONTHLY_TOKENS_INSTRUCTOR_KEY = "ai.monthly_tokens.instructor";
export const DEFAULT_MONTHLY_TOKENS_LEARNER = Number(
  process.env.AI_MONTHLY_TOKENS_LEARNER ?? "100000",
);
export const DEFAULT_MONTHLY_TOKENS_INSTRUCTOR = Number(
  process.env.AI_MONTHLY_TOKENS_INSTRUCTOR ?? "1000000",
);

// Số dư tối thiểu để được bắt đầu một lượt. Streaming nên chỉ biết chi phí
// thật SAU khi sinh xong; giữ lại đúng phần đắt nhất một lượt có thể tốn
// (~1.500 ngữ cảnh bài + lịch sử + 800 đầu ra) thì số dư không bao giờ âm quá
// một lượt.
export const RESERVE_TOKENS_PER_TURN = Number(
  process.env.AI_RESERVE_TOKENS_PER_TURN ?? "5000",
);

async function readNumericSetting(
  key: string,
  fallback: number,
  db: PrismaClient,
): Promise<number> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  if (row) {
    const n = Number(row.value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

/** Hạn mức tháng của một người, theo vai trò cao nhất họ có. */
export async function resolveMonthlyAllowance(
  userId: string,
  db: PrismaClient = prisma,
): Promise<number> {
  // Đọc role thẳng qua Prisma chứ không gọi core-lms — hai module business
  // không được import nhau (CLAUDE.md §4.3), bảng chung là đường hợp lệ.
  const privileged = await db.userRole.findFirst({
    where: {
      userId,
      role: {
        name: { in: [RoleName.Instructor, RoleName.Admin, RoleName.OrgAdmin] },
      },
    },
    select: { id: true },
  });
  return privileged
    ? readNumericSetting(
        MONTHLY_TOKENS_INSTRUCTOR_KEY,
        DEFAULT_MONTHLY_TOKENS_INSTRUCTOR,
        db,
      )
    : readNumericSetting(
        MONTHLY_TOKENS_LEARNER_KEY,
        DEFAULT_MONTHLY_TOKENS_LEARNER,
        db,
      );
}

export interface TokenBudget {
  monthlyRemaining: number;
  purchased: number;
  total: number;
  periodKey: string;
  /** Ước lượng số lượt hỏi còn lại — để hiện cho người học thay vì con số token. */
  estimatedTurns: number;
}

// Trung bình đo được trên prod: 24.092 token / 35 lượt.
const AVG_TOKENS_PER_TURN = 700;

function toBudget(row: {
  monthlyRemaining: number;
  purchased: number;
  periodKey: string;
}): TokenBudget {
  const total = row.monthlyRemaining + row.purchased;
  return {
    monthlyRemaining: row.monthlyRemaining,
    purchased: row.purchased,
    total,
    periodKey: row.periodKey,
    estimatedTurns: Math.floor(total / AVG_TOKENS_PER_TURN),
  };
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

/**
 * Cấp hạn mức tháng nếu chưa cấp, rồi trả về ví.
 *
 * Cấp kiểu "lười" — ngay trong lượt gọi đầu tiên của tháng — thay vì một cron
 * quét toàn bộ người dùng lúc nửa đêm: không phải đụng tới người không dùng
 * AI, và không có việc gì hỏng khi cron chết. Hạn mức tháng **reset**, không
 * cộng dồn: để dành cả năm rồi tiêu một lúc là đúng cái đỉnh tải mà trần này
 * sinh ra để chặn.
 */
export async function ensureMonthlyGrant(
  userId: string,
  db: PrismaClient = prisma,
) {
  const periodKey = vnMonthKey();
  const existing = await db.aiTokenBalance.findUnique({ where: { userId } });
  if (existing && existing.periodKey === periodKey) return existing;

  const allowance = await resolveMonthlyAllowance(userId, db);
  try {
    return await db.$transaction(async (tx) => {
      await tx.aiTokenLedger.create({
        data: {
          userId,
          kind: "monthly_grant",
          amount: allowance,
          refType: "month",
          refId: periodKey,
        },
      });
      return tx.aiTokenBalance.upsert({
        where: { userId },
        create: {
          userId,
          purchased: 0,
          monthlyRemaining: allowance,
          periodKey,
        },
        update: { monthlyRemaining: allowance, periodKey },
      });
    });
  } catch (e) {
    // Hai request song song cùng vào tháng mới: unique (userId, kind, refType,
    // refId) để đúng một cái thắng, cái thua đọc lại kết quả của cái thắng.
    if (isUniqueViolation(e)) {
      const row = await db.aiTokenBalance.findUnique({ where: { userId } });
      if (row?.periodKey === periodKey) return row;
      // Sổ cái đã có dòng cấp cho tháng này nhưng ví thì chưa phản ánh — ví bị
      // dựng lại từ bản sao lưu cũ, hoặc lần ghi trước hỏng giữa hai lệnh.
      // Sổ cái là nguồn sự thật, nên đồng bộ ví theo nó thay vì trả về một số
      // dư cũ mà người dùng sẽ nhìn thấy là "hết hạn mức" giữa tháng.
      return db.aiTokenBalance.upsert({
        where: { userId },
        create: { userId, purchased: 0, monthlyRemaining: allowance, periodKey },
        update: { monthlyRemaining: allowance, periodKey },
      });
    }
    throw e;
  }
}

export async function getTokenBudget(
  userId: string,
  db: PrismaClient = prisma,
): Promise<TokenBudget> {
  return toBudget(await ensureMonthlyGrant(userId, db));
}

/** Ném no_token_budget nếu không đủ số dư để bắt đầu một lượt. */
export async function assertHasTokenBudget(
  userId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const budget = await getTokenBudget(userId, db);
  if (budget.total < RESERVE_TOKENS_PER_TURN) {
    throw new AiTutorError("no_token_budget", {
      remaining: budget.total,
      needed: RESERVE_TOKENS_PER_TURN,
      periodKey: budget.periodKey,
    });
  }
}

/**
 * Trừ token đã tiêu. Gọi SAU khi biết chi phí thật.
 *
 * Trừ bằng một câu UPDATE duy nhất chứ không đọc-rồi-ghi: hai lượt chạy song
 * song của cùng một người sẽ cộng đúng, thay vì cái sau ghi đè cái trước.
 * GREATEST(0, ...) giữ số dư không âm — phần vượt của lượt cuối cùng coi như
 * bỏ qua, đó là cái giá đã biết trước của việc chỉ đo được chi phí sau khi
 * sinh xong.
 */
export async function chargeTokens(
  userId: string,
  tokens: number,
  usageLogId: string | null,
  db: PrismaClient = prisma,
): Promise<void> {
  if (tokens <= 0) return;
  await ensureMonthlyGrant(userId, db);
  await db.$transaction([
    db.$executeRaw`
      UPDATE "AiTokenBalance"
      SET "monthlyRemaining" = GREATEST(0, "monthlyRemaining" - ${tokens}),
          "purchased" = GREATEST(
            0,
            "purchased" - GREATEST(0, ${tokens} - "monthlyRemaining")
          ),
          "updatedAt" = NOW()
      WHERE "userId" = ${userId}
    `,
    // refId để trống có chủ ý: unique (userId, kind, refType, refId) chỉ nhằm
    // chặn cộng trùng cho grant và purchase — hai thứ luôn có refId. Postgres
    // coi NULL là khác nhau, nên dòng tiêu vẫn ghi được nhiều lần trong ngày.
    db.aiTokenLedger.create({
      data: {
        userId,
        kind: "consumption",
        amount: -tokens,
        refType: "usage",
        note: usageLogId ?? undefined,
      },
    }),
  ]);
}

/**
 * Cộng token đã mua vào ví, sau khi admin xác nhận nhận được tiền.
 *
 * Trả về false nếu đơn này đã được cộng rồi — unique (userId, kind, refType,
 * refId) là thứ chặn, chứ không phải một lần đọc trước đó: hai admin bấm xác
 * nhận cùng lúc thì chỉ một dòng vào được sổ, cái còn lại nhận unique violation
 * và trả về false. Kiểm bằng cách đọc trước rồi ghi sau sẽ để lọt cả hai.
 */
export async function creditPurchasedTokens(
  userId: string,
  tokens: number,
  orderId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (tokens <= 0) return false;
  // Đảm bảo có hàng ví để increment — người chưa từng gọi AI thì chưa có.
  await ensureMonthlyGrant(userId, db);
  try {
    await db.$transaction([
      db.aiTokenLedger.create({
        data: {
          userId,
          kind: "purchase",
          amount: tokens,
          refType: "order",
          refId: orderId,
        },
      }),
      db.aiTokenBalance.update({
        where: { userId },
        data: { purchased: { increment: tokens } },
      }),
    ]);
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/**
 * Admin cộng/trừ token thủ công. Dùng cho hai việc: van xả khi một người học
 * cạn hạn mức đúng lúc cần (giảng viên báo lên), và sửa sai sót đối soát.
 *
 * amount âm thì trừ vào phần đã mua, có chặn sàn 0 — số dư ví không bao giờ âm.
 */
export async function adminAdjustTokens(
  userId: string,
  amount: number,
  adminUserId: string,
  note: string | null,
  db: PrismaClient = prisma,
): Promise<void> {
  if (amount === 0) return;
  await ensureMonthlyGrant(userId, db);
  await db.$transaction([
    db.aiTokenLedger.create({
      data: {
        userId,
        kind: "admin_adjustment",
        amount,
        refType: "admin",
        // refId riêng cho từng lần chỉnh: cùng một admin chỉnh hai lần vẫn phải
        // thành hai dòng, nên không dùng adminUserId làm khoá.
        refId: randomUUID(),
        note: note ? `${adminUserId}: ${note}` : adminUserId,
      },
    }),
    db.$executeRaw`
      UPDATE "AiTokenBalance"
      SET "purchased" = GREATEST(0, "purchased" + ${amount}),
          "updatedAt" = NOW()
      WHERE "userId" = ${userId}
    `,
  ]);
}
