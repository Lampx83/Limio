// Tự co nội dung slide bố cục cho vừa khung 1280×720: slide có chữ quá dài thì thu cả khối nội dung lại,
// thay vì để chữ tràn ra ngoài khung rồi bị cắt. Phần tính toán thuần (dễ test); phần đo DOM ở measureContentBox.

export const FIT_W = 1280;
export const FIT_H = 720;
/** Vùng an toàn: nội dung bình thường nằm trong đệm 72/96px nên không chạm tới các mép này. */
export const FIT_SAFE = { top: 40, bottom: 680, left: 48, right: 1232 } as const;
/** Co tối đa; nhỏ hơn nữa thì chữ khó đọc, để phần cảnh báo "slide dài" lo. */
export const FIT_MIN_SCALE = 0.55;

export interface ContentBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Hệ số co (1 = giữ nguyên) để khối nội dung nằm trọn vùng an toàn khi co quanh tâm khung. Slide đã nằm gọn thì luôn là 1,
 * nên slide ngắn không bị đổi gì. Hộp rỗng hoặc không hợp lệ cho 1.
 */
export function fitScaleForBox(box: ContentBox | null): number {
  if (!box || ![box.top, box.bottom, box.left, box.right].every(Number.isFinite)) return 1;
  const cx = FIT_W / 2, cy = FIT_H / 2;
  let k = 1;
  const shrink = (extent: number, limit: number) => {
    // extent: khoảng cách từ tâm tới mép nội dung; limit: khoảng cách tối đa cho phép
    if (extent > limit && extent > 0) k = Math.min(k, limit / extent);
  };
  shrink(box.bottom - cy, FIT_SAFE.bottom - cy);
  shrink(cy - box.top, cy - FIT_SAFE.top);
  shrink(box.right - cx, FIT_SAFE.right - cx);
  shrink(cx - box.left, cx - FIT_SAFE.left);
  return Math.max(FIT_MIN_SCALE, Math.min(1, k));
}

/**
 * Chiều cao khung cần để nội dung nằm trọn khi người xem phóng to (không co chữ, chấp nhận cuộn): chiều cao thật của khối nội dung
 * cộng đệm 72px mỗi phía như bố cục thường. Không bao giờ thấp hơn khung chuẩn 720 nên slide ngắn không đổi.
 */
export function frameHeightForContent(box: ContentBox | null): number {
  if (!box || ![box.top, box.bottom].every(Number.isFinite)) return FIT_H;
  return Math.max(FIT_H, Math.ceil(box.bottom - box.top + 2 * 72));
}

/**
 * Đo hộp bao của nội dung trong `root` (khung 1280×720) theo toạ độ thiết kế bằng offsetLeft/offsetTop: các số này không
 * bị ảnh hưởng bởi transform (co theo khung, hiệu ứng xuất hiện), nên đo đúng ở mọi mức thu phóng. Bỏ qua khung gốc của bố cục, vầng sáng trang trí và
 * khung đệm phủ kín. null nếu không có phần tử nào đo được.
 */
export function measureContentBox(root: HTMLElement): ContentBox | null {
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    // Bỏ qua khung gốc của bố cục (con trực tiếp của root, luôn cao đủ cả khung), khung đệm phủ kín và vầng sáng trang trí.
    if (el.parentElement === root || el.classList.contains("glow") || el.classList.contains("pad") || el.closest(".glow")) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w && !h) return; // phần tử SVG hoặc ẩn
    let x = 0, y = 0, n: HTMLElement | null = el, reached = false;
    while (n) {
      if (n === root) { reached = true; break; }
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent as HTMLElement | null;
    }
    if (!reached) return;
    top = Math.min(top, y);
    left = Math.min(left, x);
    bottom = Math.max(bottom, y + h);
    right = Math.max(right, x + w);
  });
  return Number.isFinite(top) ? { top, bottom, left, right } : null;
}
