import { HSK_COPY, HSK_LEVELS } from "../hsk";
import { builtinMicro4Asia, HSK_SLUG } from "./builtin";
import type { SpaceStored } from "./settings";
import type { SpaceConfig, SpaceLang } from "./types";

/** Các khoá chữ người quản trị chỉnh trong form (phần còn lại dùng mặc định). */
export const SPACE_EDITABLE_COPY = ["heroLead", "heroAccent", "intro", "coursesSub", "footnote", "metaDescription"] as const;

/** Chuyển một SpaceConfig đầy đủ thành phần lưu được (dùng làm mẫu để nạp vào form). */
export function storedFromConfig(cfg: SpaceConfig): SpaceStored {
  const copy: NonNullable<SpaceStored["copy"]> = {};
  for (const l of cfg.langs) {
    const c = cfg.copy[l];
    copy[l] = Object.fromEntries(SPACE_EDITABLE_COPY.map((k) => [k, c[k]]).filter(([, v]) => v)) as Partial<typeof c>;
  }
  return {
    name: cfg.name,
    titleSuffix: cfg.titleSuffix,
    primary: cfg.palette.primary,
    accent: cfg.palette.accent,
    dark: cfg.palette.dark,
    soft: cfg.palette.soft,
    accent2: cfg.palette.accent2,
    logoUrl: cfg.logoUrl ?? undefined,
    logoAlt: cfg.logoAlt,
    partnerLogoUrl: cfg.partnerLogoUrl ?? undefined,
    partnerLogoAlt: cfg.partnerLogoAlt || undefined,
    heroVisualUrl: cfg.heroVisualUrl ?? undefined,
    siteUrl: cfg.siteUrl ?? undefined,
    siteLabel: cfg.siteLabel ?? undefined,
    langs: cfg.langs,
    defaultLang: cfg.defaultLang,
    courses: cfg.courses.map((c) => ({
      slug: c.slug,
      title: c.title,
      iconUrl: c.iconUrl ?? undefined,
      topic: c.topic as Partial<Record<SpaceLang, string>>,
      outcome: c.outcome as Partial<Record<SpaceLang, string>>,
    })),
    copy,
  };
}

/**
 * Mẫu space HSK (/hsk). Khác MICRO4ASIA, space này không dựng sẵn trong mã mà sống hoàn toàn trong DB
 * (Organization.space): quản trị nạp mẫu này vào form rồi Lưu, sau đó chỉnh trong DB/form như mọi space khác.
 * Mang theo đủ chữ hai ngôn ngữ (kể cả các mục form không sửa) và dải số liệu để trang giống bản thiết kế.
 */
export function hskTemplate(): SpaceStored {
  return {
    name: "HSK 3.0",
    titleSuffix: "Limio",
    // lime-800 làm nền, lime-400 làm màu nhấn, hồng của chữ "io" trong logo Limio làm nhấn thứ hai.
    primary: "#3F6212",
    accent: "#A3E635",
    dark: "#365314",
    soft: "#ECFCCB",
    accent2: "#DB2777",
    logoUrl: "/favicon.svg",
    logoAlt: "Limio",
    heroVisualUrl: "/brand/hsk/hero.svg",
    limioBrand: true,
    langs: ["vi", "en"],
    defaultLang: "vi",
    stats: {
      vi: [
        { n: "9", label: "cấp độ" },
        { n: "3.0", label: "chuẩn HSK" },
      ],
      en: [
        { n: "9", label: "levels" },
        { n: "3.0", label: "HSK standard" },
      ],
    },
    courses: HSK_LEVELS.map((l) => ({ slug: l.slug, title: l.title, topic: l.topic, outcome: l.outcome })),
    copy: { vi: HSK_COPY.vi, en: HSK_COPY.en },
  };
}

export { HSK_SLUG };

export const SPACE_TEMPLATES: Array<{ id: string; label: string; build: () => SpaceStored }> = [
  { id: "micro4asia", label: "MICRO4ASIA (NEU) — 6 vi tín chỉ", build: () => storedFromConfig(builtinMicro4Asia()) },
  { id: "hsk", label: "HSK 3.0 (Limio) — 9 cấp tiếng Trung", build: hskTemplate },
];
