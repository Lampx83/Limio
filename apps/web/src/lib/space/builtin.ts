import { M4A_COPY, M4A_COURSES, M4A_SITE_URL, type M4aIcon, type M4aLang } from "../micro4asia";
import { derivePalette } from "./theme";
import type { SpaceConfig, SpaceCopy, SpaceLang } from "./types";

/**
 * Cấu hình dựng sẵn cho space MICRO4ASIA (NEU). Dùng khi chưa có hàng `Organization` nào bật space "micro4asia"
 * trong DB; khi có, cấu hình trong DB thắng. Nhận diện theo sổ tay thương hiệu NEU 2026 (Design/Thương hiệu NEU).
 */
const TILE: Record<M4aIcon, string> = {
  math: "/brand/neu/kv-light/11-cham-tam-giac.svg",
  code: "/brand/neu/kv-light/02-banh-rang.svg",
  clean: "/brand/neu/kv-light/07-hoa-tiet-zigzag.svg",
  chart: "/brand/neu/kv-light/04-bieu-do-tang-truong.svg",
  ml: "/brand/neu/kv-light/03-chip-ai.svg",
  prompt: "/brand/neu/kv-light/08-hai-nguoi.svg",
};

function copyFor(l: M4aLang): SpaceCopy {
  const c = M4A_COPY[l];
  return {
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    eyebrow: c.eyebrow,
    heroLead: c.heroLead,
    heroAccent: c.heroAccent,
    intro: c.intro,
    browse: c.browse,
    aboutProject: c.aboutProject,
    statsOpen: c.statsOpen(0).replace("0", "{n}"),
    coursesTitle: c.coursesTitle,
    coursesSub: c.coursesSub,
    openNow: c.openNow,
    comingSoon: c.comingSoon,
    viewCourse: c.viewCourse,
    youWillBeAbleTo: c.youWillBeAbleTo,
    principlesTitle: c.principlesTitle,
    principles: c.principles,
    stepsTitle: c.stepsTitle,
    steps: c.steps,
    register: c.register,
    registerIntro:
      l === "vi"
        ? "Một tài khoản cho mọi khoá học MICRO4ASIA trên Limio."
        : "One account for all MICRO4ASIA courses on Limio.",
    footnote: c.footnote,
    poweredBy: c.poweredBy,
    switchTo: c.switchTo,
    switchLabel: c.switchLabel,
    breadcrumbHome: c.breadcrumbHome,
  };
}

export const MICRO4ASIA_SLUG = "micro4asia";

export function builtinMicro4Asia(): SpaceConfig {
  const langs: SpaceLang[] = ["en", "vi"];
  const copy = { en: copyFor("en"), vi: copyFor("vi") };
  return {
    slug: MICRO4ASIA_SLUG,
    source: "builtin",
    name: "MICRO4ASIA",
    titleSuffix: "NEU",
    palette: derivePalette("#00528C", "#FFC101", { dark: "#0E4877", soft: "#D6EEFB", accent2: "#C41212" }),
    logoUrl: "/brand/neu/neu-logo-ngang.svg",
    logoAlt: "Đại học Kinh tế Quốc dân – National Economics University",
    partnerLogoUrl: "/brand/micro4asia/logo.png",
    partnerLogoAlt: "MICRO4ASIA",
    heroVisualUrl: "/brand/neu/kv-dark/00-nguyen-khung.svg",
    siteUrl: M4A_SITE_URL,
    siteLabel: "micro4asia.eu",
    langs,
    defaultLang: "en",
    stats: {
      en: [
        { n: "6", label: M4A_COPY.en.statsCredentials },
        { n: "15", label: M4A_COPY.en.statsSessions },
        { n: "EN", label: M4A_COPY.en.statsLanguage },
      ],
      vi: [
        { n: "6", label: M4A_COPY.vi.statsCredentials },
        { n: "15", label: M4A_COPY.vi.statsSessions },
        { n: "EN", label: M4A_COPY.vi.statsLanguage },
      ],
    },
    copy,
    courses: M4A_COURSES.map((c) => ({
      slug: c.slug,
      title: c.title,
      iconUrl: TILE[c.icon],
      topic: c.topic,
      outcome: c.outcome,
    })),
  };
}

/**
 * Space dựng sẵn (MICRO4ASIA) chỉ phục vụ khi môi trường bật `SPACE_BUILTIN_MICRO4ASIA=1`.
 * Mỗi máy chủ Limio có dữ liệu riêng (limio.vn, server trường…): nội dung của máy này không được tự xuất hiện trên
 * máy khác chỉ vì chung mã nguồn. Máy không bật thì /micro4asia là 404, trừ khi một tổ chức bật space "micro4asia" trong DB.
 */
export function builtinMicro4AsiaEnabled(): boolean {
  const v = (process.env.SPACE_BUILTIN_MICRO4ASIA ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}
