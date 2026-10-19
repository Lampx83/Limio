// Bộ biểu tượng của slide (Ba thẻ, Nhóm) và cách tự chọn biểu tượng theo từ khoá (tiêu chí P60–P61). Hàm thuần, không phụ thuộc giao diện.

/** 16 biểu tượng cùng nét vẽ. 8 biểu tượng cũ giữ nguyên thứ tự ở đầu (slide Ba thẻ cũ dùng 6 biểu tượng đầu theo vòng). */
export const SLIDE_ICONS = [
  "target",
  "compass",
  "route",
  "chat",
  "book",
  "sparkle",
  "users",
  "chart",
  "bulb",
  "shield",
  "search",
  "gear",
  "cap",
  "heart",
  "rocket",
  "clock",
] as const;
export type SlideIconId = (typeof SLIDE_ICONS)[number];

export const ICON_LABELS: Record<SlideIconId, string> = {
  target: "Mục tiêu",
  compass: "La bàn",
  route: "Lộ trình",
  chat: "Trao đổi",
  book: "Sách",
  sparkle: "Ý tưởng",
  users: "Nhóm",
  chart: "Biểu đồ",
  bulb: "Bóng đèn",
  shield: "An toàn",
  search: "Nghiên cứu",
  gear: "Công cụ",
  cap: "Giáo dục",
  heart: "Tích cực",
  rocket: "Triển khai",
  clock: "Thời gian",
};

export const isSlideIcon = (v: unknown): v is SlideIconId => typeof v === "string" && (SLIDE_ICONS as readonly string[]).includes(v);

const w = (words: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${words})`, "iu");
/** Thứ tự là thứ tự ưu tiên: từ chuyên biệt (đạo đức, kiểm chứng) đứng trước từ chung (giáo dục). Tiền tố từ tiếng Anh khớp cả dạng biến đổi. */
const LEXICON: Array<[SlideIconId, RegExp]> = [
  ["shield", w("đạo đức|an toàn|an ninh|bảo mật|quyền riêng tư|bản quyền|trách nhiệm|ethic|privacy|safe|secur|responsib|trust|risk")],
  ["search", w("nghiên cứu|kiểm chứng|khảo sát|tìm kiếm|research|verif|inquir|investigat|survey")],
  ["chart", w("phân tích|dữ liệu|đánh giá|thống kê|số liệu|analy|data|assess|evaluat|statistic|metric|measur")],
  ["book", w("kiến thức|học liệu|tài liệu|literacy|knowledge|curricul|reading|content")],
  ["sparkle", w("ai(?![\\p{L}\\p{N}])|trí tuệ nhân tạo|sáng tạo|thiết kế|generative|creativ|design|innovat")],
  ["bulb", w("ý tưởng|giải pháp|sáng kiến|idea|solution|insight")],
  ["target", w("mục tiêu|chuẩn đầu ra|kết quả học tập|goal|objective|outcome|plo")],
  ["users", w("nhóm|hợp tác|cộng đồng|giáo viên|người học|học viên|sinh viên|team|collaborat|communit|teacher|learner|student|people")],
  ["compass", w("định hướng|nguyên lý|nguyên tắc|tầm nhìn|chiến lược|principle|vision|direction|strateg")],
  ["route", w("quy trình|lộ trình|tiến trình|process|roadmap|workflow|pathway|journey")],
  ["chat", w("giao tiếp|trao đổi|phản hồi|thảo luận|communicat|feedback|discuss|dialog")],
  ["gear", w("công cụ|kỹ thuật|công nghệ|hệ thống|tool|technic|technolog|system|engineer")],
  ["rocket", w("triển khai|khởi động|khởi nghiệp|phát triển|launch|deploy|growth|implement|startup")],
  ["heart", w("tích cực|hạnh phúc|cảm xúc|sức khoẻ|well-?being|positiv|happi|emotion|care|health")],
  ["clock", w("thời gian|thời hạn|lịch|time|schedul|deadline|duration")],
  ["cap", w("giáo dục|đào tạo|học tập|chương trình|education|training|learning|school|academ")],
];

/** Các biểu tượng khớp với một đoạn chữ, theo thứ tự ưu tiên; không có từ khoá thì mảng rỗng. */
export function iconForText(text: string): SlideIconId[] {
  const t = text.trim();
  if (!t) return [];
  return LEXICON.filter(([, re]) => re.test(t)).map(([id]) => id);
}

/** Biểu tượng trung tính cho nhóm không khớp từ khoá nào (theo thứ tự, để cả hàng đồng đều). */
const NEUTRAL: SlideIconId[] = ["compass", "sparkle", "target", "chart", "book", "users"];

export interface IconGroup {
  heading: string;
  points: string[];
  icon?: SlideIconId;
}

/**
 * Biểu tượng của từng nhóm trong một slide (P61): giảng viên đã chọn thì giữ; còn lại theo từ khoá của tên nhóm, rồi của các ý
 * con; hai nhóm không dùng chung một biểu tượng. Nhóm không khớp lấy biểu tượng trung tính chưa dùng.
 */
export function autoGroupIcons(groups: IconGroup[]): SlideIconId[] {
  const used = new Set<SlideIconId>(groups.flatMap((g) => (g.icon ? [g.icon] : [])));
  const out: SlideIconId[] = [];
  for (const g of groups) {
    if (g.icon) {
      out.push(g.icon);
      continue;
    }
    const candidates = [...iconForText(g.heading), ...iconForText(g.points.join(" "))];
    const pick = candidates.find((id) => !used.has(id)) ?? [...NEUTRAL, ...SLIDE_ICONS].find((id) => !used.has(id)) ?? NEUTRAL[0]!;
    used.add(pick);
    out.push(pick);
  }
  return out;
}
