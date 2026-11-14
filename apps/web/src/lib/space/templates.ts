import { builtinMicro4Asia } from "./builtin";
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

export const SPACE_TEMPLATES: Array<{ id: string; label: string; build: () => SpaceStored }> = [
  { id: "micro4asia", label: "MICRO4ASIA (NEU) — 6 vi tín chỉ", build: () => storedFromConfig(builtinMicro4Asia()) },
];
