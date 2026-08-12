import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { seedParticipant } from "@/lib/gameshow/bus";
import { isValidAvatarKey, randomAvatarKey } from "@/lib/gameshow/avatars";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/gameshow/constants";

export const runtime = "nodejs";

const BodySchema = z.object({
  displayName: z.string().trim().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX),
  avatarKey: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { code: string } }) {
  // Public — không cần đăng nhập (join bằng code, giống InteractiveBoard).
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`gameshow:join:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed" }, { status: 400 });
  }

  const gameSession = await prisma.gameSession.findUnique({
    where: { code: params.code.toUpperCase() },
    select: { id: true, status: true },
  });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });
  if (gameSession.status !== "lobby") {
    return Response.json({ error: "session_already_started" }, { status: 409 });
  }

  const avatarKey =
    parsed.data.avatarKey && isValidAvatarKey(parsed.data.avatarKey)
      ? parsed.data.avatarKey
      : randomAvatarKey();
  const participantToken = crypto.randomUUID();

  let participant;
  try {
    participant = await prisma.gameParticipant.create({
      data: {
        sessionId: gameSession.id,
        userId,
        displayName: parsed.data.displayName,
        avatarKey,
        participantToken,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return Response.json({ error: "name_taken" }, { status: 409 });
    }
    throw e;
  }

  await seedParticipant(gameSession.id, {
    participantId: participant.id,
    displayName: participant.displayName,
    avatarKey: participant.avatarKey,
    totalScore: 0,
    streak: 0,
  });

  return Response.json({
    sessionId: gameSession.id,
    participantId: participant.id,
    participantToken: participant.participantToken,
    avatarKey: participant.avatarKey,
  });
}
