import { masteryLabel, type MasteryLabel } from "@feedbackme/shared-types";

/**
 * Mini-test cuối bài ("tự kiểm tra", xem docs/tieu-chi/mini-test-cuoi-bai.md) là một Quiz gắn vào bài, tên theo quy ước "Tự kiểm tra · …".
 * Nhãn kết quả của nó lấy theo ĐIỂM của lượt vừa làm (ngưỡng chung 60/85 của nhãn mức nắm vững), không theo xác suất BKT:
 * BKT bão hoà rất nhanh nên làm đúng 11/16 vẫn ra "Vững", sai với mục đích "tự kiểm tra xem mình đã nắm bài chưa".
 */
const SELF_TEST_PREFIX = "Tự kiểm tra ·";

export function isSelfTestTitle(title: string | null | undefined): boolean {
  return typeof title === "string" && title.trim().startsWith(SELF_TEST_PREFIX);
}

export function selfTestLabel(scorePct: number | null | undefined): MasteryLabel {
  if (scorePct === null || scorePct === undefined || Number.isNaN(scorePct)) return "no_data";
  return masteryLabel(scorePct / 100);
}
