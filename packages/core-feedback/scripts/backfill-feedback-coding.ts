/**
 * B9.1 AC-3.x — code feedback deliveries that predate the instrumentation.
 *
 * The coding is derived from what was actually stored at the time (the template
 * that supplied the body, the lessons offered, and the `feedback.delivered`
 * event that recorded which misconception matched), so it is a reconstruction,
 * not a guess. Every row it touches is marked `codedRetroactively: true`, and
 * `masteryAtGeneration` is left absent rather than reconstructed — that value
 * only existed at delivery time and cannot be recovered honestly.
 *
 *   pnpm --filter @feedbackme/core-feedback backfill:feedback-coding
 *   pnpm --filter @feedbackme/core-feedback backfill:feedback-coding -- --dry-run
 */

import { Prisma, prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { CODER_VERSION, codeFeedback, type GenerationContext } from "../src/coding";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  // AC-3.3 — only rows never coded, so a second run is a no-op.
  const pending = await prisma.feedbackDelivery.findMany({
    where: { level: null },
    select: {
      id: true,
      templateId: true,
      remediationLessonIds: true,
      template: { select: { scope: true, level: true, elaboration: true } },
    },
    orderBy: { deliveredAt: "asc" },
  });

  if (pending.length === 0) {
    console.log("Không có delivery nào chưa mã hoá.");
    return;
  }

  // The misconception that matched was never stored on the delivery, but the
  // append-only event log recorded it. This is exactly what that log is for.
  const events = await prisma.learningEvent.findMany({
    where: { eventType: LearningEventType.FeedbackDelivered },
    select: { payload: true },
  });
  const misconceptionByDelivery = new Map<string, string>();
  for (const e of events) {
    const p = e.payload as
      | { deliveryId?: string; misconceptionCode?: string | null }
      | null;
    if (p?.deliveryId && typeof p.misconceptionCode === "string") {
      misconceptionByDelivery.set(p.deliveryId, p.misconceptionCode);
    }
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Mã hoá ${pending.length} delivery chưa có toạ độ\n`,
  );

  const tally: Record<string, number> = {};
  let coded = 0;

  for (const d of pending) {
    const lessonIds = Array.isArray(d.remediationLessonIds)
      ? (d.remediationLessonIds as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];
    const misconceptionCode = misconceptionByDelivery.get(d.id) ?? null;

    const coding = codeFeedback({
      templateScope: d.template?.scope ?? null,
      declaredLevel: d.template?.level ?? null,
      declaredElaboration: d.template?.elaboration ?? null,
      misconceptionCode,
      remediationCount: lessonIds.length,
    });

    const context: GenerationContext = {
      coderVersion: CODER_VERSION,
      templateScope: d.template?.scope ?? null,
      templateId: d.templateId,
      misconceptionCode,
      // Skills the question carried at delivery time are not recoverable — the
      // tags may have changed since. Left empty rather than back-filled wrong.
      skillIds: [],
      remediationLessonIds: lessonIds,
      remediationExcludedCompleted: 0,
      // AC-3.2 / AC-3.4 — flagged, and no invented mastery.
      codedRetroactively: true,
    };

    tally[coding.level] = (tally[coding.level] ?? 0) + 1;

    if (!dryRun) {
      await prisma.feedbackDelivery.update({
        where: { id: d.id },
        data: {
          level: coding.level,
          levels: coding.levels as Prisma.InputJsonValue,
          elaboration: coding.elaboration,
          sourceKind: coding.sourceKind,
          generationContext: context as unknown as Prisma.InputJsonValue,
        },
      });
    }
    coded += 1;
  }

  console.log(`${dryRun ? "Sẽ mã hoá" : "Đã mã hoá"}: ${coded} delivery`);
  for (const [level, n] of Object.entries(tally).sort()) {
    console.log(`   ${level}: ${n}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
