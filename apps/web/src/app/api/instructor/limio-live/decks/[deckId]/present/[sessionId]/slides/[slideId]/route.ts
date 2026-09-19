import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma, LiveSession } from "@feedbackme/db";
import { goToSlide, ensureClassroomSession, recordSlideRuntimeRef } from "@feedbackme/core-lms";
import { generateUniqueBoardCode, normalizeBoardColumns } from "@/lib/board";
import { describeRuntime, type Runtime } from "@/lib/limioLiveRuntime";

/**
 * POST /api/instructor/limio-live/decks/[deckId]/present/[sessionId]/slides/[slideId]
 * Navigate the present run to this slide, lazily creating the backing
 * ClassroomPoll/WordCloud/InteractiveBoard the first time it's visited, and
 * reusing it on every revisit within the same run.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string; sessionId: string; slideId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    let session: LiveSession = await goToSlide(params.sessionId, userId, params.slideId, prisma);
    if (session.deckId !== params.deckId) {
      return NextResponse.json({ error: "session_deck_mismatch" }, { status: 400 });
    }

    const slide = await prisma.liveSlide.findUnique({ where: { id: params.slideId } });
    if (!slide) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (slide.type === "content") {
      return NextResponse.json({ session, runtime: { kind: "content" } satisfies Runtime });
    }

    const existingRefId = (session.slideRuntimeRefs as Record<string, string>)[slide.id];
    if (existingRefId) {
      const runtime = await describeRuntime(slide.type, existingRefId);
      return NextResponse.json({ session, runtime });
    }

    const config = slide.config as Record<string, any>;
    let refId: string;
    let runtime: Runtime;

    if (slide.type === "poll" || slide.type === "quiz") {
      const classroomSessionId = await ensureClassroomSession(params.sessionId, userId, prisma);
      const poll = await prisma.classroomPoll.create({
        data: {
          sessionId: classroomSessionId,
          question: config.question ?? "",
          options: (config.options ?? []).map((o: { text: string }) => o.text),
          isAnonymous: true,
          createdById: userId,
        },
      });
      refId = poll.id;
      runtime = { kind: slide.type, refId, joinPath: `/learn/poll/${refId}` };
    } else if (slide.type === "word_cloud") {
      const classroomSessionId = await ensureClassroomSession(params.sessionId, userId, prisma);
      const wordCloud = await prisma.wordCloud.create({
        data: {
          sessionId: classroomSessionId,
          prompt: config.prompt ?? "",
          createdById: userId,
        },
      });
      refId = wordCloud.id;
      runtime = { kind: "word_cloud", refId, joinPath: `/learn/word-cloud/${refId}` };
    } else {
      // collaborate_board
      const columns =
        config.mode === "grouped" ? normalizeBoardColumns(config.columns ?? []) ?? [] : [];
      const code = await generateUniqueBoardCode();
      const board = await prisma.interactiveBoard.create({
        data: {
          code,
          ownerId: userId,
          title: (config.prompt || "Bảng cộng tác").slice(0, 120),
          prompt: config.prompt || null,
          columns,
          blockPaste: !!config.blockPaste,
        },
      });
      refId = board.id;
      runtime = { kind: "collaborate_board", refId, code: board.code, joinPath: `/join/${board.code}` };
    }

    session = await recordSlideRuntimeRef(params.sessionId, userId, slide.id, refId, prisma);
    return NextResponse.json({ session, runtime });
  } catch (error) {
    console.error("[Limio-Live Present Slide API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
