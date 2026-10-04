import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import CourseTeamPanel, { type CourseTeamState } from "./CourseTeamPanel";
import LessonTasksTab, { type AssignmentItem } from "@/components/lesson/LessonTasksTab";

const text = (h: string) => h.replace(/<[^>]+>/g, "");

const team = (over: Partial<NonNullable<CourseTeamState["team"]>> = {}): NonNullable<CourseTeamState["team"]> => ({
  id: "t1",
  name: "Nhóm Mây",
  joinCode: "K7M2NP",
  captainId: "u1",
  members: [
    { userId: "u1", displayName: "An", joinedAt: "2026-10-01T00:00:00.000Z" },
    { userId: "u2", displayName: "Bình", joinedAt: "2026-10-02T00:00:00.000Z" },
  ],
  ...over,
});

function panel(state: CourseTeamState, me = "u1") {
  return renderToStaticMarkup(<CourseTeamPanel courseId="c1" currentUserId={me} initial={state} />);
}

describe("CourseTeamPanel", () => {
  it("chưa có nhóm, chưa khoá: có Tạo nhóm / Vào nhóm bằng mã và neo #nhom-cua-toi", () => {
    const h = panel({ settings: { teamMaxSize: 5, locked: false }, team: null });
    expect(h).toContain('id="nhom-cua-toi"');
    const t = text(h);
    expect(t).toContain("Tạo nhóm");
    expect(t).toContain("Vào nhóm bằng mã");
    expect(t).toContain("tối đa 5 người");
  });

  it("chưa có nhóm, đã khoá: chỉ có lời nhắc liên hệ giảng viên", () => {
    const t = text(panel({ settings: { teamMaxSize: null, locked: true }, team: null }));
    expect(t).toContain("Bạn chưa có nhóm. Danh sách nhóm đã khoá — liên hệ giảng viên.");
    expect(t).not.toContain("Tạo nhóm");
  });

  it("trưởng nhóm: thấy mã, x/N người, Đổi mã, mời ra, Rời nhóm", () => {
    const h = panel({ settings: { teamMaxSize: 4, locked: false }, team: team() });
    const t = text(h);
    expect(t).toContain("Nhóm Mây");
    expect(t).toContain("2/4 người");
    expect(t).toContain("K7M2NP");
    expect(t).toContain("Sao chép mã");
    expect(t).toContain("Đổi mã");
    expect(t).toContain("Trưởng nhóm");
    expect(t).toContain("Rời nhóm");
    expect(h).toContain("Mời Bình ra khỏi nhóm");
  });

  it("thành viên thường: không có Đổi mã hay nút mời ra", () => {
    const h = panel({ settings: { teamMaxSize: null, locked: false }, team: team() }, "u2");
    const t = text(h);
    expect(t).toContain("2 người");
    expect(t).not.toContain("Đổi mã");
    expect(h).not.toContain("ra khỏi nhóm\"");
    expect(t).toContain("Rời nhóm");
  });

  it("đã khoá: ẩn mọi nút thay đổi, hiện banner khoá", () => {
    const t = text(panel({ settings: { teamMaxSize: null, locked: true }, team: team() }));
    expect(t).toContain("Danh sách nhóm đã khoá — liên hệ giảng viên nếu cần đổi nhóm.");
    expect(t).not.toContain("Đổi mã");
    expect(t).not.toContain("Rời nhóm");
    expect(t).toContain("Sao chép mã");
  });
});

const assignment = (over: Partial<AssignmentItem> = {}): AssignmentItem => ({
  kind: "assignment",
  id: "a1",
  title: "Bài giữa kỳ",
  description: "",
  dueAt: null,
  maxScore: 10,
  pedagogicalIntent: null,
  responseFormat: "text",
  requireSelfRating: false,
  requireReflection: false,
  submissionMode: "team",
  submission: null,
  ...over,
});

describe("LessonTasksTab — bài tập nhóm", () => {
  it("chưa có nhóm: không có form nộp, có lời nhắc dẫn tới khối nhóm", () => {
    const h = renderToStaticMarkup(
      <LessonTasksTab items={[assignment()]} courseSlug="ui-ux" teamContext={{ team: null, locked: false }} />,
    );
    const t = text(h);
    expect(t).toContain("Bài tập nhóm");
    expect(t).toContain("Bạn cần vào một nhóm trước khi nộp.");
    expect(h).toContain('href="/learn/ui-ux#nhom-cua-toi"');
    expect(t).not.toContain("Nộp bài / sửa bài đã nộp");
  });

  it("chưa có nhóm, đã khoá: bảo liên hệ giảng viên, không có link", () => {
    const h = renderToStaticMarkup(
      <LessonTasksTab items={[assignment()]} courseSlug="ui-ux" teamContext={{ team: null, locked: true }} />,
    );
    expect(text(h)).toContain("liên hệ giảng viên");
    expect(h).not.toContain("#nhom-cua-toi");
  });

  it("đã nộp: dòng 'Nộp lần cuối bởi', ô Phần việc của tôi, vẫn nộp lại được", () => {
    const t = text(
      renderToStaticMarkup(
        <LessonTasksTab
          items={[
            assignment({
              submission: {
                id: "s1",
                status: "submitted",
                submittedAt: new Date("2026-10-03T03:00:00Z"),
                score: null,
                feedback: null,
                teamId: "t1",
                teamSubmittedAt: new Date("2026-10-03T03:00:00Z"),
                submittedByName: "Bình",
                contributionNote: "Vẽ luồng",
              },
            }),
          ]}
          courseSlug="ui-ux"
          teamContext={{ team: { id: "t1", name: "Nhóm Mây" }, locked: false }}
        />,
      ),
    );
    expect(t).toContain("Nộp lần cuối bởi Bình lúc 03/10/2026 10:00");
    expect(t).toContain("Phần việc của tôi");
    expect(t).toContain("Vẽ luồng");
    expect(t).toContain("Nộp bài / sửa bài đã nộp");
  });

  it("bài cá nhân: không có nhãn nhóm, không có ô Phần việc", () => {
    const t = text(
      renderToStaticMarkup(
        <LessonTasksTab items={[assignment({ submissionMode: "individual" })]} courseSlug="ui-ux" />,
      ),
    );
    expect(t).not.toContain("Bài tập nhóm");
    expect(t).not.toContain("Phần việc của tôi");
    expect(t).toContain("Nộp bài / sửa bài đã nộp");
  });
});
