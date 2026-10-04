import { neighborSubmissions, type SubmissionNeighbors } from "./submissionNav";

type TeamNavRow = {
  team: { id: string };
  latest: { status: "submitted" | "graded" } | null;
};

/**
 * "Chấm & bài tiếp" cho bài tập nộp theo nhóm (AC D4): đi lần lượt theo NHÓM,
 * theo đúng thứ tự GV đang thấy, bỏ qua nhóm chưa nộp. Khoá điều hướng là id
 * nhóm (ổn định qua các lần nộp lại), không phải id dòng bài nộp đại diện.
 */
export function neighborTeams(
  orderedRows: TeamNavRow[],
  currentTeamId: string,
  pendingOnly: boolean,
): SubmissionNeighbors {
  return neighborSubmissions(
    orderedRows.map((r) => ({
      submission: r.latest ? { id: r.team.id, status: r.latest.status } : null,
    })),
    currentTeamId,
    pendingOnly,
  );
}
