import { prisma, type PrismaClient } from "@feedbackme/db";

export interface StorageUsageReport {
  totalBytes: number;
  totalFiles: number;
  byKind: Array<{ kind: string; files: number; bytes: number }>;
  /** File chưa gán được cho ai (không suy được người upload, chưa ai tham chiếu). */
  unattributed: { files: number; bytes: number };
  topUsers: Array<{
    userId: string;
    email: string | null;
    displayName: string | null;
    files: number;
    bytes: number;
  }>;
}

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0);

export async function getStorageUsageReport(
  opts: { topN?: number } = {},
  db: PrismaClient = prisma,
): Promise<StorageUsageReport> {
  const live = { deletedAt: null } as const;

  const [byKind, unattributed, perUser] = await Promise.all([
    db.storedFile.groupBy({
      by: ["kind"],
      where: live,
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
    db.storedFile.aggregate({
      where: { ...live, billedUserId: null },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
    db.storedFile.groupBy({
      by: ["billedUserId"],
      where: { ...live, billedUserId: { not: null } },
      _sum: { sizeBytes: true },
      _count: { _all: true },
      orderBy: { _sum: { sizeBytes: "desc" } },
      take: opts.topN ?? 20,
    }),
  ]);

  const userIds = perUser.map((r) => r.billedUserId!).filter(Boolean);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, displayName: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const kinds = byKind
    .map((r) => ({ kind: r.kind, files: r._count._all, bytes: num(r._sum.sizeBytes) }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    totalBytes: kinds.reduce((s, k) => s + k.bytes, 0),
    totalFiles: kinds.reduce((s, k) => s + k.files, 0),
    byKind: kinds,
    unattributed: { files: unattributed._count._all, bytes: num(unattributed._sum.sizeBytes) },
    topUsers: perUser.map((r) => {
      const u = byId.get(r.billedUserId!);
      return {
        userId: r.billedUserId!,
        email: u?.email ?? null,
        displayName: u?.displayName ?? null,
        files: r._count._all,
        bytes: num(r._sum.sizeBytes),
      };
    }),
  };
}
