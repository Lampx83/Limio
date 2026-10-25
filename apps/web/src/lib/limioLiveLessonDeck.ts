// Bài giảng slide sinh từ BÀI VIẾT của bài học (docs/tieu-chi/nghe-giang-slide.md, AC2–AC4). Hàm thuần.
import { estimateGenerationTokens } from "./limioLiveGenerate";

/** Thời lượng dàn ý theo thời lượng bài học: các mức Limio-Live hỗ trợ là 15, 30, 45 phút (isValidMinutes). */
export function minutesForLesson(wordCount: number): 15 | 30 | 45 {
  // Khoảng 130 từ/phút khi giảng; bài viết dài hơn thì chọn mức lớn hơn nhưng không quá 45.
  const minutes = wordCount / 130;
  return minutes <= 20 ? 15 : minutes <= 38 ? 30 : 45;
}

export const countWords = (text: string): number => (text.match(/\S+/g) ?? []).length;

/**
 * Yêu cầu đi kèm tài liệu: AI làm theo khi soạn dàn ý, tạo slide và bổ sung tương tác (`sourceIntent`).
 * - Ghi chú giảng của mỗi slide là LỜI ĐỌC cho tai nghe (AC4): chính trường này được đọc thành giọng.
 * - Slide tương tác chỉ là trắc nghiệm tự kiểm tra có đáp án (AC3).
 */
export function lessonDeckIntent(lessonTitle: string): string {
  return [
    `Đây là bài giảng slide cho bài học "${lessonTitle}", để học viên TỰ nghe giảng kèm slide; không có giảng viên đứng lớp.`,
    "1. Ghi chú giảng của MỖI slide là lời đọc cho tai nghe, sẽ được chuyển thành giọng nói: viết câu đầy đủ, văn nói mạch lạc, xưng \"mình – bạn\"; không gạch đầu dòng, không markdown, không ký hiệu, không dùng chữ viết tắt khó đọc thành tiếng (viết đầy đủ, vd \"ví dụ\" thay cho \"vd\"); mỗi slide khoảng 60 đến 120 từ.",
    "2. Lời đọc chỉ nói về những gì đang hiện trên slide và ý có trong bài viết; không nhắc hình, bảng hay khung mà slide không có.",
    "3. Slide tương tác chỉ là câu trắc nghiệm tự kiểm tra, có đúng một đáp án đúng, kiểm tra kiến thức có trong bài viết. Không dùng bình chọn lấy ý kiến, đám mây từ, bảng cộng tác hay bảng trắng. Ghi chú của slide trắc nghiệm chỉ đọc đề bài và các lựa chọn, tuyệt đối không nói đáp án hay lời giải thích.",
    "4. Chỉ dùng kiến thức, số liệu, tên người, trích dẫn có trong bài viết. Không bịa thêm.",
    "5. Slide đầu là bìa, slide cuối là tổng kết; lời đọc của hai slide này là lời chào và lời tóm ý ngắn.",
  ].join("\n");
}

/**
 * Ước lượng token cho cả việc tạo bài giảng từ bài viết, để hộp xác nhận nói trước chi phí: bước dàn ý (nguồn vào, dàn ý ra) cộng
 * bước viết slide. `slideCount` mặc định là mức giữa của bài 15 phút (12–16).
 */
export function estimateLessonDeckTokens(sourceChars: number, slideCount = 14): number {
  const outline = 1800 + Math.round(Math.min(sourceChars, 24_000) / 2.4) + slideCount * 60;
  return outline + estimateGenerationTokens({ sourceChars, slideCount }).total;
}

/** 15300 → "15,3 nghìn"; dưới 1000 giữ nguyên số. */
export function formatTokenCount(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10} nghìn`.replace(".", ",") : String(n);
}
