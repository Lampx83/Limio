import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createContentItem, updateContentItem } from "../contents";
import {
  MAX_OTHER_CONTENT_VERSIONS,
  listContentVersions,
  recordContentVersion,
  restoreContentVersion,
} from "../contentVersions";
import { registerUser } from "../../auth/register";

/** Mốc 4 — lịch sử phiên bản khối Văn bản (S3, S7). */

async function setup() {
  const r = await registerUser(
    { email: `cv${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "GV" },
    "http://localhost:3000",
  );
  const c = await createCourse(r.userId, { title: "Khoá phiên bản", description: "x" });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(r.userId, m.moduleId, { title: "Bài", orderIndex: 0 });
  const { contentItemId } = await createContentItem(r.userId, l.lessonId, {
    type: "richtext",
    payload: { html: "<p>Bản 1</p>", look: { palette: "limio", font: "modern" } },
    orderIndex: 0,
  });
  return { userId: r.userId, courseId: c.courseId, id: contentItemId };
}

const save = (userId: string, id: string, html: string, versionSource?: string) =>
  updateContentItem(userId, id, { payload: { html }, ...(versionSource ? { versionSource } : {}) });

describe("phiên bản khối Văn bản", () => {
  it("lưu là chụp nội dung cũ; nhiều lần lưu trong 5 phút gộp làm một; lưu có Nhờ AI thì tách riêng", async () => {
    const { userId, id } = await setup();
    await save(userId, id, "<p>Bản 2</p>");
    await save(userId, id, "<p>Bản 3</p>");
    let v = await listContentVersions(userId, id);
    expect(v.map((x) => x.source)).toEqual(["before_edit"]);
    expect((v[0]!.payload as { html: string }).html).toBe("<p>Bản 1</p>");

    await save(userId, id, "<p>Bản 4 (AI)</p>", "before_ai");
    v = await listContentVersions(userId, id);
    expect(v.map((x) => x.source)).toEqual(["before_ai", "before_edit"]);
    expect((v[0]!.payload as { html: string }).html).toBe("<p>Bản 3</p>");
  });

  it("đổi trạng thái ẩn/hiện không sinh phiên bản; khối không phải Văn bản không có lịch sử", async () => {
    const { userId, id } = await setup();
    await updateContentItem(userId, id, { isHidden: true });
    expect(await listContentVersions(userId, id)).toEqual([]);
  });

  it("khôi phục: chụp bản hiện tại trước (khôi phục cũng hoàn tác được) và ghi sự kiện", async () => {
    const { userId, courseId, id } = await setup();
    await save(userId, id, "<p>Bản 2</p>");
    const [first] = await listContentVersions(userId, id);
    const r = await restoreContentVersion(userId, id, first!.id);
    expect((r.payload as { html: string }).html).toBe("<p>Bản 1</p>");
    const item = await prisma.contentItem.findUnique({ where: { id } });
    expect((item?.payload as { html: string }).html).toBe("<p>Bản 1</p>");
    const v = await listContentVersions(userId, id);
    expect(v[0]!.source).toBe("before_restore");
    expect((v[0]!.payload as { html: string }).html).toBe("<p>Bản 2</p>");
    const ev = await prisma.learningEvent.findFirst({ where: { userId, eventType: "lesson.content.restored", courseId } });
    expect(ev?.payload).toMatchObject({ contentItemId: id, versionSource: "before_edit" });
  });

  it("người không sửa được khoá không xem, không khôi phục được", async () => {
    const { id } = await setup();
    const other = await registerUser(
      { email: `cvx${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "X" },
      "http://localhost:3000",
    );
    await expect(listContentVersions(other.userId, id)).rejects.toBeTruthy();
  });

  it("giữ tối đa 30 bản ngoài bản AI tạo; bản AI tạo luôn còn", async () => {
    const { userId, id } = await setup();
    await recordContentVersion(prisma, { id, payload: { html: "<p>AI</p>" } }, "generated", userId, new Date(Date.now() - 10 ** 8));
    for (let i = 0; i < MAX_OTHER_CONTENT_VERSIONS + 5; i++) {
      await recordContentVersion(prisma, { id, payload: { html: `<p>${i}</p>` } }, "before_ai", userId, new Date(Date.now() - 10 ** 7 + i * 1000));
    }
    const v = await listContentVersions(userId, id);
    expect(v.filter((x) => x.source !== "generated")).toHaveLength(MAX_OTHER_CONTENT_VERSIONS);
    expect(v.filter((x) => x.source === "generated")).toHaveLength(1);
  });
});
