import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { getLessonSource, lessonHtmlToText, lessonMarkdownToText } from "../lessonSource";
import { LessonDeckError } from "../lessonDeck";

const BASE = "http://localhost:3000";

describe("lessonHtmlToText", () => {
  it("giữ cấu trúc: tiêu đề, danh sách, bảng, chú thích hình; bỏ thẻ và hình", () => {
    const html = `
      <style>.x{color:red}</style>
      <h2>AI tạo câu trả lời thế nào</h2>
      <p>Mô hình <strong>đoán chữ</strong> kế tiếp &amp; tiếp nữa.</p>
      <ul><li>Bước một</li><li>Bước hai</li></ul>
      <table><tr><th>Loại</th><th>Cách kiểm</th></tr><tr><td>Số liệu</td><td>Tìm nguồn</td></tr></table>
      <figure><img src="x.jpg" alt="Sơ đồ mạng nơ-ron"><figcaption>Hình: Sơ đồ đơn giản</figcaption></figure>
      <h3>Lưu ý</h3><p>Đừng tin ngay.</p>`;
    const t = lessonHtmlToText(html);
    expect(t).toContain("## AI tạo câu trả lời thế nào");
    expect(t).toContain("Mô hình đoán chữ kế tiếp & tiếp nữa.");
    expect(t).toContain("- Bước một\n- Bước hai");
    expect(t).toContain("Loại | Cách kiểm\nSố liệu | Tìm nguồn");
    expect(t).toContain("[Hình: Sơ đồ mạng nơ-ron]");
    expect(t).toContain("Chú thích hình: Hình: Sơ đồ đơn giản");
    expect(t).toContain("### Lưu ý");
    expect(t).not.toMatch(/<|color:red/);
  });

  it("giải mã ký tự đặc biệt và không để lại dòng trống thừa", () => {
    const t = lessonHtmlToText("<p>a&nbsp;b &#7843; &#x1EA3; &lt;ok&gt;</p><p></p><p></p><p></p><p>c</p>");
    expect(t).toBe("a b ả ả <ok>\n\nc");
  });
});

describe("lessonMarkdownToText", () => {
  it("giữ tiêu đề và gạch đầu dòng, bỏ ảnh, liên kết và dấu nhấn", () => {
    const t = lessonMarkdownToText("# Tiêu đề\n\n**Đậm** và [liên kết](http://x.y)\n\n* ý một\n![ảnh](a.png)");
    expect(t).toContain("## Tiêu đề");
    expect(t).toContain("Đậm và liên kết");
    expect(t).toContain("- ý một");
    expect(t).not.toContain("http");
  });
});

describe("getLessonSource", () => {
  it("lấy chữ của các khối hiển thị, theo thứ tự; bỏ khối bị ẩn; chỉ người sửa được khoá", async () => {
    const owner = await registerUser({ email: "o-ls@e.com", password: "password1234", displayName: "Chủ" }, BASE);
    const other = await registerUser({ email: "x-ls@e.com", password: "password1234", displayName: "Khác" }, BASE);
    const c = await createCourse(owner.userId, { title: "ls", description: "x", slug: "ls-course" });
    const m = await createModule(owner.userId, c.courseId, { title: "Module A", orderIndex: 0 });
    const l = await createLesson(owner.userId, m.moduleId, { title: "Bài một", orderIndex: 0 });
    await prisma.contentItem.createMany({
      data: [
        { lessonId: l.lessonId, type: "richtext", orderIndex: 0, payload: { html: "<h2>Mở đầu</h2><p>Đoạn một.</p>" } },
        { lessonId: l.lessonId, type: "markdown", orderIndex: 1, payload: { body: "## Phần hai\n\nĐoạn hai." } },
        { lessonId: l.lessonId, type: "richtext", orderIndex: 2, isHidden: true, payload: { html: "<p>BÍ MẬT</p>" } },
      ],
    });
    const src = await getLessonSource(owner.userId, l.lessonId);
    expect(src.title).toBe("Bài một");
    expect(src.moduleTitle).toBe("Module A");
    expect(src.ownerId).toBe(owner.userId);
    expect(src.hasDeck).toBe(false);
    expect(src.text).toBe("## Mở đầu\nĐoạn một.\n\n## Phần hai\n\nĐoạn hai.");
    expect(src.text).not.toContain("BÍ MẬT");

    await expect(getLessonSource(other.userId, l.lessonId)).rejects.toMatchObject({ code: "forbidden" });
    await expect(getLessonSource(owner.userId, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(LessonDeckError);
  });
});
