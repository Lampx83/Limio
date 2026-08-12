import { z } from "zod";
import { verifyParticipant } from "@/lib/gameshow/participant";
import { updateAvatar } from "@/lib/gameshow/bus";
import { isValidAvatarKey } from "@/lib/gameshow/avatars";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  participantId: z.string().min(1),
  participantToken: z.string().min(1),
  avatarKey: z.string().min(1),
});

// Đổi avatar khi còn ở phòng chờ (lobby) — trước khi phiên bắt đầu.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation_failed" }, { status: 400 });
  if (!isValidAvatarKey(parsed.data.avatarKey)) {
    return Response.json({ error: "invalid_avatar" }, { status: 400 });
  }

  const participant = await verifyParticipant(
    params.id,
    parsed.data.participantId,
    parsed.data.participantToken,
  );
  if (!participant) return Response.json({ error: "unauthorized" }, { status: 401 });

  await prisma.gameParticipant.update({
    where: { id: participant.id },
    data: { avatarKey: parsed.data.avatarKey },
  });
  await updateAvatar(params.id, participant.id, parsed.data.avatarKey);

  return Response.json({ ok: true });
}
