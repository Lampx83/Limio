import { Editor, type Extensions } from "@tiptap/react";

/**
 * TipTap không lưu lại HTML mà bạn đưa vào — nó phân tích HTML thành schema
 * nội bộ rồi sinh lại. Thứ gì schema không biểu diễn được thì biến mất, lặng
 * lẽ, ngay lần chỉnh sửa đầu tiên. Với nội dung gõ trong chính editor thì
 * không sao; với HTML nhập từ ngoài (script import học liệu) thì đó là mất dữ
 * liệu: cỡ chữ, thẻ bọc bố cục, figure, bảng, và có khi cả ảnh.
 *
 * Cách duy nhất trả lời đúng câu "mở bài này ra sửa có mất gì không" là chạy
 * thử vòng phân tích–sinh lại bằng đúng bộ extension mà editor dùng, rồi so
 * cái vào với cái ra. Đoán theo tên thẻ sẽ vừa báo nhầm vừa bỏ sót.
 */

/** Dưới ngưỡng này, lệch chữ là do chuẩn hoá khoảng trắng chứ không phải mất chữ. */
const TEXT_NOISE_TOLERANCE = 20;

export interface LossReport {
  /** Chữ hoặc ảnh biến mất — nghiêm trọng, không chỉ là xấu đi. */
  contentLoss: boolean;
  /** Số ảnh bị mất. */
  lostImages: number;
  /** Số ký tự chữ bị mất. */
  lostChars: number;
  /** Số thuộc tính style bị gỡ (cỡ chữ, nền, khung...). */
  lostStyles: number;
}

interface Inventory {
  text: string;
  images: string[];
  styles: number;
}

function inventory(html: string): Inventory {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return {
    text: (doc.body.textContent ?? "").replace(/\s+/g, " ").trim(),
    images: Array.from(doc.querySelectorAll("img"))
      .map((el) => el.getAttribute("src") ?? "")
      .sort(),
    styles: doc.body.querySelectorAll("[style]").length,
  };
}

/**
 * Trả về báo cáo mất mát, hoặc null nếu HTML đi qua editor mà không suy suyển.
 * Chỉ chạy được trên trình duyệt (cần DOMParser).
 */
export function probeEditorLoss(
  html: string,
  extensions: Extensions,
): LossReport | null {
  if (!html.trim()) return null;

  let after: string;
  try {
    // Editor không gắn vào DOM — dựng lên chỉ để hỏi "anh sẽ sinh lại thành gì".
    const probe = new Editor({ extensions, content: html });
    after = probe.getHTML();
    probe.destroy();
  } catch {
    // Không phân tích nổi thì coi như sửa được — thà cho vào chế độ HTML nhầm
    // một lần còn hơn chặn người dùng vì một lỗi của chính hàm dò này.
    return null;
  }

  const before = inventory(html);
  const post = inventory(after);

  const lostImages = before.images.filter((src) => !post.images.includes(src)).length;
  const rawLostChars = Math.max(0, before.text.length - post.text.length);
  const lostStyles = Math.max(0, before.styles - post.styles);

  // Chênh vài ký tự là chuyện chuẩn hoá khoảng trắng và thực thể HTML, không
  // phải mất chữ. Đếm nó vào rồi tô băng đỏ thì lần nào cũng đỏ, và một cảnh
  // báo lúc nào cũng đỏ thì không ai đọc nữa.
  const lostChars = rawLostChars > TEXT_NOISE_TOLERANCE ? rawLostChars : 0;

  if (lostImages === 0 && lostChars === 0 && lostStyles === 0) return null;

  return {
    contentLoss: lostImages > 0 || lostChars > 0,
    lostImages,
    lostChars,
    lostStyles,
  };
}
