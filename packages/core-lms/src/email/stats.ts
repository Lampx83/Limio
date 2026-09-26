/**
 * Thống kê gửi email cho trang admin: số email đã gửi hôm nay / tháng này, lỗi, và
 * hạn mức của gói Resend.
 *
 * Ngày/tháng tính theo UTC vì hạn mức Resend reset theo UTC (00:00 UTC = 07:00 giờ VN).
 * Đếm từ EmailSendLog (chỉ những lần app này gọi provider). Hạn mức Resend tính CHUNG
 * cho cả tài khoản — nếu domain khác cùng tài khoản (vd. codelab.ai.vn) cũng gửi thì
 * số thực tế còn lại thấp hơn số hiển thị ở đây.
 */
import { prisma } from "@feedbackme/db";

export interface EmailUsageStats {
  sentToday: number;
  failedToday: number;
  sentThisMonth: number;
  /** 0 = không giới hạn / không rõ. Cấu hình bằng EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT. */
  dailyLimit: number;
  monthlyLimit: number;
  byTemplateToday: Array<{ key: string; count: number }>;
  /** Thời điểm hạn mức ngày reset (ISO, 00:00 UTC hôm sau). */
  resetsAt: string;
  windowStart: string;
}

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
};

export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getEmailUsageStats(now: Date = new Date()): Promise<EmailUsageStats> {
  const dayStart = utcDayStart(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [sentToday, failedToday, sentThisMonth, grouped] = await Promise.all([
    prisma.emailSendLog.count({ where: { createdAt: { gte: dayStart }, status: "sent" } }),
    prisma.emailSendLog.count({ where: { createdAt: { gte: dayStart }, status: "failed" } }),
    prisma.emailSendLog.count({ where: { createdAt: { gte: monthStart }, status: "sent" } }),
    prisma.emailSendLog.groupBy({
      by: ["templateKey"],
      where: { createdAt: { gte: dayStart }, status: "sent" },
      _count: { _all: true },
      orderBy: { _count: { templateKey: "desc" } },
      take: 8,
    }),
  ]);

  return {
    sentToday,
    failedToday,
    sentThisMonth,
    dailyLimit: num(process.env.EMAIL_DAILY_LIMIT, 100),
    monthlyLimit: num(process.env.EMAIL_MONTHLY_LIMIT, 3000),
    byTemplateToday: grouped.map((g) => ({ key: g.templateKey ?? "(gửi tay)", count: g._count._all })),
    resetsAt: new Date(dayStart.getTime() + 86_400_000).toISOString(),
    windowStart: dayStart.toISOString(),
  };
}
