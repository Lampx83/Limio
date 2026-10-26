/**
 * Kênh nói chuyện giữa `PdfViewer` (đang ở trang mấy, có đang nằm trong màn hình
 * không) và `LessonEngagementTracker` (đo thời gian). Dùng sự kiện DOM thay vì
 * context/prop vì hai thành phần không có cha chung gần nhau, và `PdfViewer` còn
 * được dùng ở nơi không có bộ đo (form giảng viên, Limio-Live) — ở đó sự kiện
 * bắn ra không ai nghe, không tốn gì. Cùng cách bộ đo bắt `timeupdate` của video.
 *
 * Xem docs/tieu-chi/doc-pdf-theo-trang.md.
 */

/** PdfViewer báo trạng thái hiện tại của nó (mỗi lần đổi trang / ra-vào màn hình / gỡ). */
export const PDF_VIEW_EVENT = "limio:pdf-view";

/**
 * Bộ đo vừa gắn xong và hỏi "ai đang có PDF?". PdfViewer là component nạp trễ nên
 * có thể đã bắn trạng thái đầu tiên trước khi bộ đo kịp nghe.
 */
export const PDF_VIEW_REQUEST_EVENT = "limio:pdf-view-request";

export interface PdfViewDetail {
  contentItemId: string;
  /** Trang đang mở, tính từ 1. */
  page: number;
  /** 0 = chưa tải xong / lỗi — bộ đo bỏ qua. */
  totalPages: number;
  /** Khung PDF đủ lớn trong màn hình để coi là đang đọc. */
  inView: boolean;
}

/** Trần số trang mà bộ đo chịu theo dõi — khớp trần ở máy chủ (`MAX_PDF_TOTAL_PAGES`). */
export const MAX_TRACKED_PDF_PAGES = 2000;
