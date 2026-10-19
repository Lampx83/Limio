/**
 * Lưu "lần chạm đầu tiên" của một user vào `AcquisitionTouch`.
 *
 * BEST-EFFORT tuyệt đối: không bao giờ throw, không làm chậm đăng ký đáng kể
 * (một upsert đơn), và không làm gì cả khi cờ tắt / không có cookie / cookie hỏng.
 * First touch wins: dòng đã có thì không bị ghi đè.
 */
import { prisma } from "@feedbackme/db";
import { ATTRIBUTION_COOKIE, decodeAttributionCookie } from "./attribution";
import { isGrowthAttributionEnabled } from "./config";

export type TouchOutcome = "stored" | "disabled" | "no_cookie" | "invalid_cookie" | "not_new_user" | "error";

/** Phần của Prisma client mà module này cần — để test tiêm bản giả. */
export interface TouchDb {
  acquisitionTouch: {
    upsert(args: {
      where: { userId: string };
      create: Record<string, unknown>;
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  user?: {
    findUnique(args: {
      where: { id: string };
      select: { createdAt: true };
    }): Promise<{ createdAt: Date } | null>;
  };
}

/** Lấy giá trị một cookie từ header `Cookie` thô. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export const readAttributionCookie = (cookieHeader: string | null | undefined) =>
  readCookie(cookieHeader, ATTRIBUTION_COOKIE);

/** Tài khoản coi là "vừa tạo" nếu createdAt trong vòng chừng này giây (đường SSO). */
const FRESH_USER_WINDOW_SEC = 120;

export interface RecordOptions {
  db?: TouchDb;
  env?: Record<string, string | undefined>;
  nowSec?: number;
  /** Đường SSO không biết user mới hay cũ: chỉ lưu khi tài khoản vừa tạo. */
  onlyIfFreshUser?: boolean;
}

export async function recordAcquisitionTouch(
  userId: string,
  rawCookie: string | undefined,
  opts: RecordOptions = {},
): Promise<TouchOutcome> {
  try {
    if (!isGrowthAttributionEnabled(opts.env ?? process.env)) return "disabled";
    if (!rawCookie) return "no_cookie";
    const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
    const touch = decodeAttributionCookie(rawCookie, nowSec);
    if (!touch) return "invalid_cookie";

    const db = opts.db ?? (prisma as unknown as TouchDb);

    if (opts.onlyIfFreshUser) {
      const u = await db.user?.findUnique({ where: { id: userId }, select: { createdAt: true } });
      if (!u || nowSec - Math.floor(u.createdAt.getTime() / 1000) > FRESH_USER_WINDOW_SEC) {
        return "not_new_user";
      }
    }

    const firstSeenAt = new Date(Math.min(touch.firstSeenAtSec, nowSec) * 1000);
    await db.acquisitionTouch.upsert({
      where: { userId },
      create: {
        userId,
        utmSource: touch.utmSource,
        utmMedium: touch.utmMedium,
        utmCampaign: touch.utmCampaign,
        utmContent: touch.utmContent,
        utmTerm: touch.utmTerm,
        clickIdKind: touch.clickIdKind,
        landingPath: touch.landingPath,
        referrerHost: touch.referrerHost,
        firstSeenAt,
      },
      update: {},
    });
    return "stored";
  } catch {
    // Không log nội dung cookie / userId: đây là đường đo lường, im lặng là đúng.
    return "error";
  }
}
