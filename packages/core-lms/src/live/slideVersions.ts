import { Prisma, type LiveSlide, type LiveSlideType, type PrismaClient } from "@feedbackme/db";
import { hasDeckAccess } from "./deckAccess";

/**
 * Phiên bản slide để hoàn tác (tiêu chí H11).
 *
 * Mỗi lần slide sắp bị ghi đè, chụp lại TRẠNG THÁI CŨ:
 * - before_edit: trước khi giảng viên sửa tay — các lần sửa liên tiếp trong 5 phút gộp thành
 *   một phiên bản (bản chụp là trạng thái trước cả đợt sửa), nên gõ chữ không sinh hàng trăm bản;
 * - before_ai: trước khi nhận đề xuất của AI; before_sync: trước khi cập nhật theo dàn ý;
 *   before_restore: trước khi khôi phục một phiên bản (để khôi phục cũng hoàn tác được);
 * - generated: trạng thái lúc AI sinh slide. Luôn được giữ, không bị dọn.
 * Chỉ giữ MAX_OTHER_VERSIONS bản gần nhất ngoài các bản "generated".
 */

export type SlideVersionSource = "generated" | "before_edit" | "before_ai" | "before_sync" | "before_restore";

export const VERSION_COALESCE_MS = 5 * 60 * 1000;
export const MAX_OTHER_VERSIONS = 30;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export interface SlideSnapshot {
  id: string;
  type: LiveSlideType;
  config: unknown;
}

/**
 * Chụp một phiên bản. Trả true nếu có ghi mới. Bỏ qua khi nội dung giống hệt phiên bản mới nhất
 * (autosave không đổi gì) hoặc, với before_edit, khi phiên bản mới nhất cũng là before_edit vừa
 * tạo trong cửa sổ gộp.
 */
/** Chỉ cần bảng phiên bản — để dùng được cả trong giao dịch (tx) lẫn client thường. */
export type VersionDb = Pick<PrismaClient, "liveSlideVersion">;

export async function recordSlideVersion(
  db: VersionDb,
  slide: SlideSnapshot,
  source: SlideVersionSource,
  now: Date = new Date(),
): Promise<boolean> {
  const latest = await db.liveSlideVersion.findFirst({
    where: { slideId: slide.id },
    orderBy: { createdAt: "desc" },
    select: { source: true, type: true, config: true, createdAt: true },
  });
  if (latest && source !== "generated" && latest.type === slide.type && stable(latest.config) === stable(slide.config)) return false;
  if (source === "before_edit" && latest?.source === "before_edit" && now.getTime() - latest.createdAt.getTime() < VERSION_COALESCE_MS) {
    return false;
  }
  await db.liveSlideVersion.create({
    data: { slideId: slide.id, source, type: slide.type, config: (slide.config ?? {}) as Prisma.InputJsonValue, createdAt: now },
  });
  await pruneSlideVersions(db, slide.id);
  return true;
}

async function pruneSlideVersions(db: VersionDb, slideId: string): Promise<void> {
  const others = await db.liveSlideVersion.findMany({
    where: { slideId, source: { not: "generated" } },
    orderBy: { createdAt: "desc" },
    skip: MAX_OTHER_VERSIONS,
    select: { id: true },
  });
  if (others.length) await db.liveSlideVersion.deleteMany({ where: { id: { in: others.map((o) => o.id) } } });
}

export interface SlideVersionView {
  id: string;
  source: SlideVersionSource;
  type: LiveSlideType;
  config: unknown;
  createdAt: Date;
}

async function assertOwnsSlide(db: PrismaClient, slideId: string, userId: string): Promise<LiveSlide> {
  const slide = await db.liveSlide.findUnique({ where: { id: slideId }, include: { deck: { select: { id: true, userId: true } } } });
  if (!slide || !(await hasDeckAccess(slide.deck, userId, db))) throw new Error("Not authorized to edit this slide");
  return slide;
}

/** Các phiên bản của slide, mới nhất trước (chỉ chủ bài giảng). */
export async function listSlideVersions(db: PrismaClient, slideId: string, userId: string): Promise<SlideVersionView[]> {
  await assertOwnsSlide(db, slideId, userId);
  const rows = await db.liveSlideVersion.findMany({ where: { slideId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, source: r.source as SlideVersionSource, type: r.type, config: r.config, createdAt: r.createdAt }));
}

/**
 * Khôi phục slide về một phiên bản. Trạng thái hiện tại được chụp trước (before_restore) nên khôi phục
 * cũng hoàn tác được. Khôi phục nguyên văn cả config lẫn loại slide (kể cả cờ ẩn, ghi chú, dấu vết AI).
 */
export async function restoreSlideVersion(
  db: PrismaClient,
  slideId: string,
  versionId: string,
  userId: string,
): Promise<LiveSlide> {
  const slide = await assertOwnsSlide(db, slideId, userId);
  const version = await db.liveSlideVersion.findFirst({ where: { id: versionId, slideId } });
  if (!version) throw new Error("Version not found");
  await recordSlideVersion(db, { id: slide.id, type: slide.type, config: slide.config }, "before_restore");
  return db.liveSlide.update({
    where: { id: slideId },
    data: { type: version.type, config: version.config as Prisma.InputJsonValue },
  });
}
