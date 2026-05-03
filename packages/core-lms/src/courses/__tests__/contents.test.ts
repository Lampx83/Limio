import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createContentItem, updateContentItem } from "../contents";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup() {
  const r = await registerUser(
    { email: `c${Date.now()}@example.com`, password: "password1234", displayName: "C" },
    BASE,
  );
  const c = await createCourse(r.userId, { title: "Content tests", description: "x" });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(r.userId, m.moduleId, { title: "L", orderIndex: 0 });
  return { userId: r.userId, lessonId: l.lessonId };
}

describe("createContentItem — per-type payload validation", () => {
  it("AC-A2.4: video accepts {url, transcriptUrl?, durationSec?}", async () => {
    const { userId, lessonId } = await setup();
    const item = await createContentItem(userId, lessonId, {
      type: "video",
      orderIndex: 0,
      payload: { url: "https://cdn.example.com/v.mp4", durationSec: 600 },
    });
    const row = await prisma.contentItem.findUniqueOrThrow({ where: { id: item.contentItemId } });
    expect(row.type).toBe("video");
  });

  it("video rejects missing url", async () => {
    const { userId, lessonId } = await setup();
    await expect(
      createContentItem(userId, lessonId, {
        type: "video",
        orderIndex: 0,
        payload: { durationSec: 600 },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("markdown requires non-empty body", async () => {
    const { userId, lessonId } = await setup();
    await expect(
      createContentItem(userId, lessonId, {
        type: "markdown",
        orderIndex: 0,
        payload: { body: "" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("file accepts {url, filename}", async () => {
    const { userId, lessonId } = await setup();
    await createContentItem(userId, lessonId, {
      type: "file",
      orderIndex: 0,
      payload: { url: "https://x.com/a.pdf", filename: "a.pdf" },
    });
  });

  it("external_link minimal payload", async () => {
    const { userId, lessonId } = await setup();
    await createContentItem(userId, lessonId, {
      type: "external_link",
      orderIndex: 0,
      payload: { url: "https://docs.example.com" },
    });
  });

  it("pdf accepts {url} and optional title", async () => {
    const { userId, lessonId } = await setup();
    await createContentItem(userId, lessonId, {
      type: "pdf",
      orderIndex: 0,
      payload: {
        url: "https://example.com/handbook.pdf",
        title: "Course handbook",
      },
    });
    await createContentItem(userId, lessonId, {
      type: "pdf",
      orderIndex: 1,
      payload: { url: "https://example.com/cheatsheet.pdf" },
    });
  });

  it("pdf rejects missing url", async () => {
    const { userId, lessonId } = await setup();
    await expect(
      createContentItem(userId, lessonId, {
        type: "pdf",
        orderIndex: 0,
        payload: { title: "Just a title" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("pdf rejects non-URL string in url field", async () => {
    const { userId, lessonId } = await setup();
    await expect(
      createContentItem(userId, lessonId, {
        type: "pdf",
        orderIndex: 0,
        payload: { url: "not-a-url" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("update with new type re-validates payload against new type", async () => {
    const { userId, lessonId } = await setup();
    const item = await createContentItem(userId, lessonId, {
      type: "markdown",
      orderIndex: 0,
      payload: { body: "Hello" },
    });
    // Switch to video — payload must match video schema or fail.
    await expect(
      updateContentItem(userId, item.contentItemId, {
        type: "video",
        payload: { body: "still markdown" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await updateContentItem(userId, item.contentItemId, {
      type: "video",
      payload: { url: "https://x.com/v.mp4" },
    });
  });
});
