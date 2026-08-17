import type { PrismaClient } from "@feedbackme/db";

// Preset tên/màu đội — sinh tuần tự theo teamCount lúc tạo phiên, không cho
// đổi tên (giữ MVP đơn giản). Emoji khác bộ AVATARS (avatars.ts) để tránh
// nhầm avatar cá nhân với biểu tượng đội.
export interface TeamPreset {
  colorKey: string;
  emoji: string;
  name: string;
}

export const TEAM_PRESETS: TeamPreset[] = [
  { colorKey: "red", emoji: "🦊", name: "Đội Cáo" },
  { colorKey: "blue", emoji: "🐳", name: "Đội Cá Voi" },
  { colorKey: "green", emoji: "🐸", name: "Đội Ếch" },
  { colorKey: "amber", emoji: "🦁", name: "Đội Sư Tử" },
  { colorKey: "purple", emoji: "🦄", name: "Đội Kỳ Lân" },
  { colorKey: "pink", emoji: "🐧", name: "Đội Cánh Cụt" },
  { colorKey: "teal", emoji: "🐢", name: "Đội Rùa" },
  { colorKey: "orange", emoji: "🐯", name: "Đội Hổ" },
];

export const TEAM_COUNT_MIN = 2;
export const TEAM_COUNT_MAX = TEAM_PRESETS.length;

export function presetForIndex(i: number): TeamPreset {
  return TEAM_PRESETS[i % TEAM_PRESETS.length]!;
}

// Tailwind class theo colorKey — dùng chung cho badge đội ở cả host & participant UI.
export const TEAM_COLOR_CLASSES: Record<string, { bg: string; ring: string; text: string }> = {
  red: { bg: "bg-red-500", ring: "ring-red-400", text: "text-red-50" },
  blue: { bg: "bg-blue-500", ring: "ring-blue-400", text: "text-blue-50" },
  green: { bg: "bg-emerald-500", ring: "ring-emerald-400", text: "text-emerald-50" },
  amber: { bg: "bg-amber-500", ring: "ring-amber-400", text: "text-amber-50" },
  purple: { bg: "bg-purple-500", ring: "ring-purple-400", text: "text-purple-50" },
  pink: { bg: "bg-pink-500", ring: "ring-pink-400", text: "text-pink-50" },
  teal: { bg: "bg-teal-500", ring: "ring-teal-400", text: "text-teal-50" },
  orange: { bg: "bg-orange-500", ring: "ring-orange-400", text: "text-orange-50" },
};

export function teamColorClasses(colorKey: string) {
  return TEAM_COLOR_CLASSES[colorKey] ?? TEAM_COLOR_CLASSES.red!;
}

export function emojiForColorKey(colorKey: string): string {
  return TEAM_PRESETS.find((p) => p.colorKey === colorKey)?.emoji ?? "🎯";
}

export interface TeamMember {
  participantId: string;
  displayName: string;
  avatarKey: string;
  teamId: string | null;
  totalScore: number;
}

export interface TeamMeta {
  id: string;
  name: string;
  colorKey: string;
}

// Gom participant theo đội, tính điểm trung bình — chạy client-side để phản
// ánh real-time ngay khi participant.joined tới (SSE không đẩy lại
// teamStandings cho event này, chỉ score-driven event mới có).
export function computeTeamStandings<M extends TeamMember>(
  participants: M[],
  teamsMeta: TeamMeta[],
) {
  const grouped = new Map<string, M[]>();
  for (const p of participants) {
    if (!p.teamId) continue;
    const list = grouped.get(p.teamId) ?? [];
    list.push(p);
    grouped.set(p.teamId, list);
  }
  return teamsMeta
    .filter((t) => grouped.has(t.id))
    .map((t) => {
      const members = (grouped.get(t.id) ?? [])
        .slice()
        .sort((a, b) => b.totalScore - a.totalScore);
      const totalScore = members.reduce((sum, m) => sum + m.totalScore, 0);
      return {
        teamId: t.id,
        name: t.name,
        colorKey: t.colorKey,
        avgScore: members.length > 0 ? Math.round(totalScore / members.length) : 0,
        memberCount: members.length,
        members,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

export async function createTeamsForSession(
  db: PrismaClient,
  sessionId: string,
  teamCount: number,
): Promise<void> {
  await db.gameTeam.createMany({
    data: Array.from({ length: teamCount }, (_, i) => {
      const preset = presetForIndex(i);
      return { sessionId, name: preset.name, colorKey: preset.colorKey };
    }),
  });
}
