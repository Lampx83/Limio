// Luật hiển thị thẻ bài nộp ở trang showcase (nhãn trạng thái, điểm, tên đội, nhãn nhiều phiếu, phân trang).

export type ShowcaseTone = "ok" | "bad" | "wait";

/** kind: "mission" = MissionSubmission (chấm chéo/GV chấm nhóm); "assignment" = AssignmentSubmission (GV chấm bài tập). */
export function showcaseStatus(
  kind: "mission" | "assignment",
  status: string,
): { label: string; tone: ShowcaseTone } {
  if (kind === "assignment") {
    return status === "graded" ? { label: "Đã chấm", tone: "ok" } : { label: "Chờ chấm", tone: "wait" };
  }
  switch (status) {
    case "passed":
      return { label: "Đạt", tone: "ok" };
    case "failed":
      return { label: "Chưa đạt", tone: "bad" };
    case "disqualified":
      return { label: "Bị loại", tone: "bad" };
    default:
      return { label: "Chờ chấm", tone: "wait" };
  }
}

export function showcaseScoreLabel(input: {
  kind: "mission" | "assignment";
  finalScore: number | null;
  score: number | null;
  maxScore: number | null;
}): string | null {
  if (input.kind === "mission") {
    return input.finalScore == null ? null : `${Math.round(input.finalScore * 100)}%`;
  }
  if (input.score == null || input.maxScore == null) return null;
  return `${input.score}/${input.maxScore}`;
}

/** Tên hiển thị của nhóm nộp bài. Không bao giờ ghi "Solo" cho giải theo đội. */
export function showcaseTeamLabel(input: { teamName: string | null; captainName: string; teamSize: number }): string {
  if (input.teamName) return input.teamName;
  return input.teamSize > 1 ? `Nhóm của ${input.captainName}` : input.captainName;
}

/** Bài được gắn nhãn "nhiều phiếu nhất": dẫn đầu duy nhất trong nhiệm vụ và có ít nhất 2 phiếu. */
export function topVotedSubmissionIds(
  rows: { missionId: string; submissionId: string; votes: number }[],
): Set<string> {
  const byMission = new Map<string, { missionId: string; submissionId: string; votes: number }[]>();
  for (const r of rows) byMission.set(r.missionId, [...(byMission.get(r.missionId) ?? []), r]);
  const out = new Set<string>();
  for (const list of byMission.values()) {
    const max = Math.max(...list.map((r) => r.votes));
    const leaders = list.filter((r) => r.votes === max);
    if (max >= 2 && leaders.length === 1) out.add(leaders[0]!.submissionId);
  }
  return out;
}

export function paginate<T>(items: T[], page: number, size: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Number.isFinite(page) ? Math.min(Math.max(1, Math.floor(page)), pages) : 1;
  return { items: items.slice((p - 1) * size, p * size), page: p, pages, total };
}
