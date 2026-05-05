import { NextResponse } from "next/server";
import {
  getConversationWithMessages,
  getOrCreateConversation,
} from "@feedbackme/core-feedback";
import { isUserEnrolled } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Get-or-create the latest 24h conversation for this user+lesson, with all
 * its messages. Used by AiTutorPanel on mount.
 */
export async function GET(
  _req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await isUserEnrolled(userId, lesson.module.courseId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const conv = await getOrCreateConversation(userId, params.lessonId);
  const full = await getConversationWithMessages(conv.id, userId);
  return NextResponse.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      model: conv.model,
      messages: full?.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })) ?? [],
    },
  });
}
