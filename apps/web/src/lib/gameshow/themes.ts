// Theme giao diện Gameshow — chọn lúc tạo phiên, lưu ở GameSession.theme.
// Màu thật nằm ở globals.css (`[data-gs-theme="<key>"]`); file này chỉ giữ
// danh sách key + nhãn + màu xem trước, dùng chung cho form tạo phiên, API
// validate và client (host/người chơi).

export const GAME_THEMES = [
  { key: "aurora", label: "Aurora", preview: "linear-gradient(120deg,#4f46e5,#9333ea,#db2777,#f97316)" },
  { key: "ocean", label: "Đại dương", preview: "linear-gradient(120deg,#0369a1,#0891b2,#0d9488)" },
  { key: "sunset", label: "Hoàng hôn", preview: "linear-gradient(120deg,#be123c,#ea580c,#f59e0b)" },
  { key: "forest", label: "Rừng xanh", preview: "linear-gradient(120deg,#166534,#15803d,#65a30d)" },
  { key: "midnight", label: "Đêm sao", preview: "linear-gradient(120deg,#0f172a,#312e81,#581c87)" },
] as const;

export type GameThemeKey = (typeof GAME_THEMES)[number]["key"];
export const DEFAULT_GAME_THEME: GameThemeKey = "aurora";
export const GAME_THEME_KEYS = GAME_THEMES.map((t) => t.key) as [GameThemeKey, ...GameThemeKey[]];

export function normalizeGameTheme(v: string | null | undefined): GameThemeKey {
  return GAME_THEMES.some((t) => t.key === v) ? (v as GameThemeKey) : DEFAULT_GAME_THEME;
}
