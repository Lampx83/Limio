"use client";

import { createContext, useCallback, useContext } from "react";
import { translate, type TParams, type UiLang } from "./core";
import { EN, VI, type MessageKey } from "./dict";

const Ctx = createContext<UiLang>("vi");

export function I18nProvider({ lang, children }: { lang: UiLang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useUiLang(): UiLang {
  return useContext(Ctx);
}

/** Hàm dịch cho client component: `const t = useT(); t("learn.back")`. */
export function useT(): (key: MessageKey, params?: TParams) => string {
  const lang = useContext(Ctx);
  return useCallback((key, params) => translate(VI, EN, lang, key, params), [lang]);
}
