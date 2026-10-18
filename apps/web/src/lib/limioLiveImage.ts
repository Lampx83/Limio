// Ảnh riêng ở ô hình (phía trình duyệt, không đụng sharp): dựng srcset từ URL ảnh đã xử lý ở máy chủ.
// Ảnh qua slideImage.ts có kích thước nhúng trong tên file (`-1600x1067-`) và có sẵn bản ?w=480|960.

const OWN = /^\/api\/limio-live-resource\/[^/?#]+-(\d+)x(\d+)-\d{10,}-[A-Za-z0-9]+\.(?:jpg|png)$/;

export interface SlideImageSources {
  src: string;
  srcSet?: string;
  /** Kích thước bản hiển thị, để dựng khung trước khi ảnh về. */
  width?: number;
  height?: number;
}

/** Nguồn ảnh cho thẻ <img>: ảnh tự lưu thì có srcset 480/960/bản hiển thị; ảnh cũ (URL ngoài, GIF) thì giữ nguyên. */
export function slideImageSources(url: string): SlideImageSources {
  const m = OWN.exec(url);
  if (!m) return { src: url };
  const w = Number(m[1]);
  const h = Number(m[2]);
  const set = [`${url}?w=480 480w`];
  if (w > 960) set.push(`${url}?w=960 960w`);
  set.push(`${url} ${w}w`);
  return { src: url, srcSet: set.join(", "), width: w, height: h };
}

/**
 * Bản nhỏ nhất đủ dùng cho trình sửa và dải slide thu nhỏ (nạp trước, xem trước).
 * Ảnh không phải của ta thì trả nguyên URL.
 */
export const slideImageThumb = (url: string): string => (OWN.test(url) ? `${url}?w=480` : url);
