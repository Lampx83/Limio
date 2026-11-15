import type { PartialDict } from "../core";
import { viCommon } from "./vi/common";
import { viHeader } from "./vi/header";
import { viCatalog } from "./vi/catalog";
import { viLearn } from "./vi/learn";
import { viAi } from "./vi/ai";
import { viPractice } from "./vi/practice";
import { viAuth } from "./vi/auth";
import { viReader } from "./vi/reader";
import { enCommon } from "./en/common";
import { enHeader } from "./en/header";
import { enCatalog } from "./en/catalog";
import { enLearn } from "./en/learn";
import { enAi } from "./en/ai";
import { enPractice } from "./en/practice";
import { enAuth } from "./en/auth";
import { enReader } from "./en/reader";

/**
 * Mỗi vùng giao diện một cặp file `vi/<vùng>.ts` + `en/<vùng>.ts`, khoá tiền tố theo vùng ("header.signIn").
 * Chuỗi vi là NGUỒN: phải giống hệt chữ đang hiển thị (đổi giao diện tiếng Việt = đổi cả ở đây). Chuỗi en có thể thiếu —
 * thiếu thì rơi về vi. Thêm vùng mới: tạo hai file rồi trải vào VI/EN dưới đây.
 */
export const VI = {
  ...viCommon,
  ...viHeader,
  ...viCatalog,
  ...viLearn,
  ...viAi,
  ...viPractice,
  ...viAuth,
  ...viReader,
} as const;

export type MessageKey = keyof typeof VI;

export const EN: PartialDict<typeof VI> = {
  ...enCommon,
  ...enHeader,
  ...enCatalog,
  ...enLearn,
  ...enAi,
  ...enPractice,
  ...enAuth,
  ...enReader,
};
