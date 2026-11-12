/**
 * SPACE: trang riêng + nhận diện thương hiệu của một trường/dự án trên Limio.
 * Dữ liệu nguồn: cột `Organization.space` (JSON, chuẩn hoá ở settings.ts) hoặc cấu hình dựng sẵn (builtin.ts).
 * File này chỉ chứa kiểu — dùng được ở cả server lẫn client.
 */

export type SpaceLang = "en" | "vi";
export const SPACE_LANGS: readonly SpaceLang[] = ["en", "vi"];

export interface SpacePalette {
  /** Màu chủ đạo (nút, tiêu đề, nền hero). */
  primary: string;
  /** Biến thể đậm của primary (hover, nền sâu). */
  dark: string;
  /** Tông rất nhạt của primary (nền chip, dải số liệu). */
  soft: string;
  /** Màu nhấn (vạch tiêu đề, nút chính trên nền primary). */
  accent: string;
  /** Màu nhấn thứ hai (nhãn "Thật", tiêu đề nhỏ). */
  accent2: string;
}

export interface SpaceCourseEntry {
  /** Slug khoá học trên Limio. Khoá published với slug này thì mở, chưa có thì "sắp ra mắt". */
  slug: string;
  /** Tên dùng khi khoá chưa có trên Limio. */
  title: string;
  /** Ảnh/biểu tượng ô khoá (tuỳ chọn). */
  iconUrl: string | null;
  topic: Record<SpaceLang, string>;
  outcome: Record<SpaceLang, string>;
}

export interface SpaceCopy {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroLead: string;
  heroAccent: string;
  intro: string;
  browse: string;
  aboutProject: string;
  /** Mẫu có "{n}", vd "{n} open now". */
  statsOpen: string;
  coursesTitle: string;
  coursesSub: string;
  openNow: string;
  comingSoon: string;
  viewCourse: string;
  youWillBeAbleTo: string;
  principlesTitle: string;
  principles: Array<{ word: string; t: string; d: string }>;
  stepsTitle: string;
  steps: Array<{ t: string; d: string }>;
  register: string;
  registerIntro: string;
  footnote: string;
  poweredBy: string;
  switchTo: string;
  switchLabel: string;
  breadcrumbHome: string;
}

export interface SpaceStat {
  n: string;
  label: string;
}

export interface SpaceConfig {
  slug: string;
  source: "builtin" | "db";
  /** Tên hiển thị của space (vd "MICRO4ASIA"). */
  name: string;
  /** Hậu tố tên trang/title khi chia sẻ (vd "NEU"). */
  titleSuffix: string;
  palette: SpacePalette;
  logoUrl: string | null;
  logoAlt: string;
  partnerLogoUrl: string | null;
  partnerLogoAlt: string;
  /** Ảnh hero (nền tối, vuông) — tuỳ chọn; thiếu thì hero chạy hết chiều ngang. */
  heroVisualUrl: string | null;
  siteUrl: string | null;
  siteLabel: string | null;
  langs: SpaceLang[];
  defaultLang: SpaceLang;
  stats: Record<SpaceLang, SpaceStat[]>;
  copy: Record<SpaceLang, SpaceCopy>;
  courses: SpaceCourseEntry[];
}

/** Phần thương hiệu tối thiểu cần ở header/footer — truyền được qua ranh giới server→client. */
export interface SpaceBrand {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string;
  partnerLogoUrl: string | null;
  partnerLogoAlt: string;
  homeHref: string;
  poweredByLabel: string;
  coursesLabel: string;
}
