import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { CourseError, createCourse, updateCourse, isAllowedCoverUrl } from "../courses";
import { registerUser } from "../../auth/register";

// docs/tieu-chi/trang-khoa-hoc-banner-sach.md — AC3: thông tin sách (nhà xuất bản, tác giả, lần xuất bản) và ảnh bìa
// được sửa cùng đường lưu của form khoá (updateCourse), cùng quyền với việc sửa khoá.

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}
async function makeCourse(email: string, slug: string) {
  const ownerId = await makeUser(email);
  const { courseId } = await createCourse(ownerId, { title: "Active Skills for Reading 3", description: "Sách đọc hiểu", slug });
  return { ownerId, courseId };
}
const read = (courseId: string) =>
  prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { publisher: true, authors: true, edition: true, coverUrl: true } });

describe("isAllowedCoverUrl", () => {
  it("nhận đường dẫn nội bộ của ảnh đã tải lên và URL http(s) tuyệt đối", () => {
    expect(isAllowedCoverUrl("/api/course-covers/abc-1a2b3c4d5e6f.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://cdn.example.com/cover.png")).toBe(true);
    expect(isAllowedCoverUrl("http://localhost:3000/x.webp")).toBe(true);
  });
  it("từ chối mọi thứ khác: đường dẫn lạ, thoát thư mục, scheme nguy hiểm, chuỗi rỗng", () => {
    for (const bad of ["", "/api/course-covers/", "/api/course-covers/../secret", "/api/course-covers/a/b.png", "/api/other/x.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://x/y.png", "cover.png"]) {
      expect(isAllowedCoverUrl(bad), bad).toBe(false);
    }
  });
});

describe("updateCourse — thông tin sách và ảnh bìa", () => {
  it("lưu ba trường sách, cắt khoảng trắng; ghi lại ra đúng giá trị", async () => {
    const { ownerId, courseId } = await makeCourse("cbi-o1@e.com", "cbi-1");
    await updateCourse(ownerId, courseId, { publisher: "  National Geographic Learning ", authors: "Neil J Anderson", edition: " Third Edition " });
    expect(await read(courseId)).toMatchObject({ publisher: "National Geographic Learning", authors: "Neil J Anderson", edition: "Third Edition" });
  });

  it("để trống hoặc null thì xoá; trường vắng mặt giữ nguyên", async () => {
    const { ownerId, courseId } = await makeCourse("cbi-o2@e.com", "cbi-2");
    await updateCourse(ownerId, courseId, { publisher: "NGL", authors: "A", edition: "3rd" });
    await updateCourse(ownerId, courseId, { publisher: "   ", authors: null }); // edition vắng mặt
    expect(await read(courseId)).toMatchObject({ publisher: null, authors: null, edition: "3rd" });
  });

  it("quá 120 ký tự bị từ chối và không đổi gì", async () => {
    const { ownerId, courseId } = await makeCourse("cbi-o3@e.com", "cbi-3");
    await updateCourse(ownerId, courseId, { publisher: "NGL" });
    await expect(updateCourse(ownerId, courseId, { publisher: "x".repeat(121) })).rejects.toMatchObject({ code: "validation_failed" });
    expect((await read(courseId)).publisher).toBe("NGL");
  });

  it("ảnh bìa: nhận đường dẫn nội bộ, đặt null để xoá, từ chối scheme nguy hiểm", async () => {
    const { ownerId, courseId } = await makeCourse("cbi-o4@e.com", "cbi-4");
    await updateCourse(ownerId, courseId, { coverUrl: "/api/course-covers/c1-aabbccddeeff.jpg" });
    expect((await read(courseId)).coverUrl).toBe("/api/course-covers/c1-aabbccddeeff.jpg");
    await expect(updateCourse(ownerId, courseId, { coverUrl: "javascript:alert(1)" })).rejects.toBeInstanceOf(CourseError);
    expect((await read(courseId)).coverUrl).toBe("/api/course-covers/c1-aabbccddeeff.jpg");
    await updateCourse(ownerId, courseId, { coverUrl: null });
    expect((await read(courseId)).coverUrl).toBeNull();
  });

  it("người không sửa được khoá bị từ chối ở cả hai nhóm trường", async () => {
    const { courseId } = await makeCourse("cbi-o5@e.com", "cbi-5");
    const stranger = await makeUser("cbi-x5@e.com");
    await expect(updateCourse(stranger, courseId, { publisher: "Lậu" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateCourse(stranger, courseId, { coverUrl: "/api/course-covers/x.jpg" })).rejects.toMatchObject({ code: "forbidden" });
    expect(await read(courseId)).toMatchObject({ publisher: null, coverUrl: null });
  });
});
