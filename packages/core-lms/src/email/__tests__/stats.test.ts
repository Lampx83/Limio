import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getEmailUsageStats, utcDayStart } from "../stats";

// Dùng DB test thật (như các test khác trong package). Đo chênh lệch trước/sau thay vì
// xoá dữ liệu, để không phụ thuộc trạng thái bảng.
const KEY = `test.stats.${Date.now()}`;

describe("getEmailUsageStats", () => {
  it("đếm đúng sent/failed hôm nay, theo template; bỏ qua dòng của ngày hôm qua", async () => {
    const now = new Date();
    const before = await getEmailUsageStats(now);
    const yesterday = new Date(utcDayStart(now).getTime() - 3_600_000); // 23:00 UTC hôm qua

    await prisma.emailSendLog.createMany({
      data: [
        { templateKey: KEY, toDomain: "a.vn", status: "sent" },
        { templateKey: KEY, toDomain: "b.vn", status: "sent" },
        { templateKey: KEY, toDomain: "c.vn", status: "failed", error: "429" },
        { templateKey: KEY, toDomain: "old.vn", status: "sent", createdAt: yesterday },
      ],
    });

    const after = await getEmailUsageStats(now);
    expect(after.sentToday - before.sentToday).toBe(2);
    expect(after.failedToday - before.failedToday).toBe(1);
    expect(after.sentThisMonth).toBeGreaterThanOrEqual(before.sentThisMonth + 2);
    expect(after.byTemplateToday.find((t) => t.key === KEY)?.count).toBe(2);
  });

  it("hạn mức mặc định 100/ngày, 3000/tháng; đọc được từ biến môi trường", async () => {
    const s = await getEmailUsageStats();
    expect(s.dailyLimit).toBe(100);
    expect(s.monthlyLimit).toBe(3000);
    process.env.EMAIL_DAILY_LIMIT = "5000";
    expect((await getEmailUsageStats()).dailyLimit).toBe(5000);
    delete process.env.EMAIL_DAILY_LIMIT;
  });

  it("mốc reset = 00:00 UTC hôm sau", async () => {
    const now = new Date("2026-09-26T13:30:00Z");
    const s = await getEmailUsageStats(now);
    expect(s.windowStart).toBe("2026-09-26T00:00:00.000Z");
    expect(s.resetsAt).toBe("2026-09-27T00:00:00.000Z");
  });
});
