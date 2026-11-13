import { translate, type TParams, type UiLang } from "./core";
import { EN, VI, type MessageKey } from "./dict";

/**
 * Hàm dịch không dùng hook/async: cho component thuần (server) cần chạy đồng bộ — vd. test render trực tiếp — nhận `lang`
 * qua prop. Trang cha lấy `lang` bằng `await getUiLang()`; không truyền thì mặc định "vi".
 */
export function tFor(lang: UiLang = "vi") {
  return (key: MessageKey, params?: TParams): string => translate(VI, EN, lang, key, params);
}
