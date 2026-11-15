import type { SpaceConfig, SpaceLang } from "./types";

export function resolveSpaceLang(raw: string | string[] | undefined, cfg: Pick<SpaceConfig, "langs" | "defaultLang">): SpaceLang {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "en" || v === "vi" ? (cfg.langs.includes(v) ? v : cfg.defaultLang) : cfg.defaultLang;
}
