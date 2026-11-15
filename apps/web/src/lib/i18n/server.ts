import { cache } from "react";
import { cookies, headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { prisma } from "@feedbackme/db";
import { LANG_COOKIE, resolveUiLang, translate, type TParams, type UiLang } from "./core";
import { EN, VI, type MessageKey } from "./dict";

/** Middleware gắn slug khoá khi URL là /catalog/<slug> hoặc /learn/<slug>/… (không tin giá trị client gửi). */
export const COURSE_SLUG_HEADER = "x-course-slug";

const courseLanguageBySlug = unstable_cache(
  async (slug: string) => {
    const c = await prisma.course.findUnique({ where: { slug }, select: { language: true } });
    return c?.language ?? null;
  },
  ["ui-course-language"],
  { revalidate: 300 },
);

/** Ngôn ngữ giao diện của request hiện tại (cache theo request). Không bao giờ ném lỗi: lỗi DB ⇒ rơi về cookie/vi. */
export const getUiLang = cache(async (): Promise<UiLang> => {
  const cookie = cookies().get(LANG_COOKIE)?.value;
  const slug = headers().get(COURSE_SLUG_HEADER);
  let courseLanguage: string | null = null;
  if (slug && !parseCookieWins(cookie)) {
    courseLanguage = await courseLanguageBySlug(slug).catch(() => null);
  }
  return resolveUiLang({ cookie, courseLanguage });
});

function parseCookieWins(cookie: string | undefined): boolean {
  return cookie === "en" || cookie === "vi";
}

/** Hàm dịch cho server component: `const t = await getT(); t("header.signIn")`. */
export async function getT(): Promise<(key: MessageKey, params?: TParams) => string> {
  const lang = await getUiLang();
  return (key, params) => translate(VI, EN, lang, key, params);
}
