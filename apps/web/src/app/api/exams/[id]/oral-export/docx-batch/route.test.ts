import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const examFindUnique = vi.fn();
const attemptFindMany = vi.fn();
const courseFindUnique = vi.fn();
vi.mock("@feedbackme/db", () => ({
  prisma: {
    exam: { findUnique: examFindUnique },
    examAttempt: { findMany: attemptFindMany },
    course: { findUnique: courseFindUnique },
  },
}));
const assertCanEditExam = vi.fn();
class CourseAuthzError extends Error {}
vi.mock("@feedbackme/core-lms", () => ({ assertCanEditExam, CourseAuthzError }));
const requireUserId = vi.fn();
vi.mock("@/lib/session", () => ({ requireUserId }));

const { POST } = await import("./route");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EXAM_ID = "11111111-1111-4111-8111-111111111111";
const ID_A = "22222222-2222-4222-8222-222222222222";
const ID_B = "33333333-3333-4333-8333-333333333333";

function attempt(id: string, displayName: string) {
  return {
    id,
    startedAt: new Date("2026-11-02T02:00:00Z"),
    submittedAt: new Date("2026-11-02T02:30:00Z"),
    user: { displayName, email: "hv@example.com" },
    oralEvaluation: null,
    oralTurns: [{ role: "examiner", content: "Câu hỏi thứ nhất" }],
  };
}

function call(body: unknown) {
  return POST(
    new Request("http://test/api", { method: "POST", body: JSON.stringify(body) }),
    { params: { id: EXAM_ID } },
  );
}

function downloadName(res: Response): string {
  const header = res.headers.get("content-disposition") ?? "";
  return decodeURIComponent(/filename\*=UTF-8''(.+)$/.exec(header)![1]!);
}

describe("POST /api/exams/[id]/oral-export/docx-batch", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue("gv-1");
    assertCanEditExam.mockReset().mockResolvedValue(undefined);
    courseFindUnique.mockReset().mockResolvedValue({ title: "Kinh tế vi mô" });
    examFindUnique.mockReset().mockResolvedValue({
      id: EXAM_ID,
      title: "Giữa kỳ",
      courseId: "c-1",
      createdById: "gv-1",
      kind: "oral",
    });
    attemptFindMany.mockReset();
  });

  it("một người thì tải thẳng file Word, tên gồm học viên, ngày thi, tên đề", async () => {
    attemptFindMany.mockResolvedValue([attempt(ID_A, "Nguyễn Văn An")]);
    const res = await call({ attemptIds: [ID_A] });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(DOCX_MIME);
    expect(downloadName(res)).toBe("Nguyễn Văn An - 02-11-2026 - Giữa kỳ.docx");
    const docx = await JSZip.loadAsync(await res.arrayBuffer());
    expect(await docx.file("word/document.xml")!.async("string")).toContain("Câu hỏi thứ nhất");
  });

  it("nhiều người thì gói một file nén, có một thư mục chứa file từng người", async () => {
    attemptFindMany.mockResolvedValue([
      attempt(ID_A, "Nguyễn Văn An"),
      attempt(ID_B, "Trần Thị Bình"),
    ]);
    const res = await call({ attemptIds: [ID_A, ID_B] });
    expect(res.headers.get("content-type")).toBe("application/zip");
    const zipName = downloadName(res);
    expect(zipName).toMatch(/^Vấn đáp - Giữa kỳ - \d{2}-\d{2}-\d{4}\.zip$/);

    const folder = zipName.replace(/\.zip$/, "");
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const files = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir).sort();
    expect(files).toEqual([
      `${folder}/Nguyễn Văn An - 02-11-2026 - Giữa kỳ.docx`,
      `${folder}/Trần Thị Bình - 02-11-2026 - Giữa kỳ.docx`,
    ]);
    const inner = await JSZip.loadAsync(await zip.file(files[0]!)!.async("nodebuffer"));
    expect(inner.file("word/document.xml")).not.toBeNull();
  });

  it("trùng họ tên thì file sau thêm số, không ghi đè", async () => {
    attemptFindMany.mockResolvedValue([attempt(ID_A, "Lê An"), attempt(ID_B, "Lê An")]);
    const res = await call({});
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const files = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
    expect(files).toHaveLength(2);
    expect(files.some((n) => n.endsWith("Lê An - 02-11-2026 - Giữa kỳ (2).docx"))).toBe(true);
  });

  it("không gửi danh sách thì lấy mọi lượt đã kết thúc; có danh sách thì chỉ lấy trong đề này", async () => {
    attemptFindMany.mockResolvedValue([attempt(ID_A, "An")]);
    await call({});
    expect(attemptFindMany.mock.calls[0]![0].where).toEqual({
      examId: EXAM_ID,
      status: { in: ["submitted", "auto_submitted", "graded"] },
    });
    await call({ attemptIds: [ID_A] });
    expect(attemptFindMany.mock.calls[1]![0].where).toEqual({
      examId: EXAM_ID,
      status: { in: ["submitted", "auto_submitted", "graded"] },
      id: { in: [ID_A] },
    });
  });

  it("không có lượt nào khớp thì trả 404", async () => {
    attemptFindMany.mockResolvedValue([]);
    const res = await call({ attemptIds: [ID_A] });
    expect(res.status).toBe(404);
  });

  it("từ chối khi chưa đăng nhập, không có quyền sửa đề, đề không phải vấn đáp hoặc dữ liệu sai", async () => {
    requireUserId.mockResolvedValueOnce(null);
    expect((await call({})).status).toBe(401);

    assertCanEditExam.mockRejectedValueOnce(new CourseAuthzError("no"));
    expect((await call({})).status).toBe(403);

    examFindUnique.mockResolvedValueOnce({ id: EXAM_ID, kind: "written" });
    expect((await call({})).status).toBe(400);

    expect((await call({ attemptIds: ["khong-phai-uuid"] })).status).toBe(400);
    expect((await call({ attemptIds: [] })).status).toBe(400);
    expect(attemptFindMany).not.toHaveBeenCalled();
  });
});
