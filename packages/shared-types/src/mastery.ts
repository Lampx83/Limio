/**
 * B4 — nhãn mức nắm vững mà học viên nhìn thấy.
 *
 * Học viên không bao giờ thấy số % mastery: BKT là ước lượng xác suất, con số
 * "47%" đọc như điểm thi và dễ gây nản hơn là giúp. Trang giáo viên vẫn hiện số.
 *
 * Đặt ở đây vì core-feedback (xếp lộ trình) lẫn apps/web (hiển thị) cùng cần
 * một định nghĩa — hai bản lệch nhau là thứ đã từng xảy ra ("Cần ôn — dưới 50%").
 */

/** Dưới mức này: "Cần ôn". */
export const MASTERY_REVIEW_BELOW = 0.6;
/** Từ mức này trở lên: "Vững" — cũng là ngưỡng gợi ý lướt qua bài chưa học. */
export const MASTERY_SOLID_AT = 0.85;

export type MasteryLabel = "no_data" | "needs_review" | "practice_more" | "solid";

export const MASTERY_LABEL_TEXT: Record<MasteryLabel, string> = {
  no_data: "Chưa có dữ liệu",
  needs_review: "Cần ôn",
  practice_more: "Nên luyện thêm",
  solid: "Vững",
};

/** `null`/`undefined` = chưa trả lời câu nào của chủ đề đó. */
export function masteryLabel(mastery: number | null | undefined): MasteryLabel {
  if (mastery === null || mastery === undefined) return "no_data";
  if (mastery < MASTERY_REVIEW_BELOW) return "needs_review";
  if (mastery < MASTERY_SOLID_AT) return "practice_more";
  return "solid";
}
