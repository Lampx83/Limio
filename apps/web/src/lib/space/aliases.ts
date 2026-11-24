/**
 * Space dựng sẵn có URL ngắn riêng (không qua /s/<slug>). Tệp này không import gì nặng để dùng được cả ở
 * server, client và middleware (edge).
 */
export const SPACE_HOME_ALIAS: Readonly<Record<string, string>> = {
  micro4asia: "/micro4asia",
  hsk: "/hsk",
};

/** Đường dẫn trang chủ của space theo slug: URL ngắn nếu có, ngược lại /s/<slug>. */
export function spaceBasePath(slug: string): string {
  return SPACE_HOME_ALIAS[slug] ?? `/s/${slug}`;
}
