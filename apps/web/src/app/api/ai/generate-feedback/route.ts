import { NextResponse } from "next/server";
import {
  AiGenerationError,
  AiTutorError,
  generateFeedbackBody,
} from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * Generate a draft feedback template body for a given misconception.
 * Body: { misconceptionId, context? }
 * Authz: any course instructor or admin.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [admin, anyCourse] = await Promise.all([
    isAdmin(userId),
    prisma.courseInstructor.findFirst({ where: { userId } }),
  ]);
  if (!admin && !anyCourse) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await readJson(req)) as
    | { misconceptionId?: string; context?: string }
    | null;
  if (!body?.misconceptionId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const mc = await prisma.misconception.findUnique({
    where: { id: body.misconceptionId },
  });
  if (!mc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Pull skill names linked to this misconception via QuestionOptions.
  const options = await prisma.questionOption.findMany({
    where: { misconceptionId: mc.id },
    select: {
      question: {
        select: {
          skillTags: { select: { skill: { select: { name: true } } } },
        },
      },
    },
    take: 5,
  });
  const skillNames = Array.from(
    new Set(
      options.flatMap((o) =>
        o.question.skillTags.map((t) => t.skill.name),
      ),
    ),
  );

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  try {
    const draft = await generateFeedbackBody(
      userId,
      {
        misconceptionName: mc.name,
        misconceptionDescription: mc.description,
        context: body.context,
        skillNames,
      },
      openai,
    );
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof AiTutorError) {
      // Vượt trần token — 429 chứ không phải 400: người gọi không sai gì,
      // chỉ là hết hạn mức, và thử lại sau thì được.
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 429 },
      );
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 400 },
      );
    }
    throw e;
  }
}
