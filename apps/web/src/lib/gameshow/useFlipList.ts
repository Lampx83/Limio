import { useLayoutEffect, useRef } from "react";

/**
 * FLIP (First-Last-Invert-Play) thuần CSS/JS, không cần Framer Motion —
 * dùng cho danh sách xếp hạng đổi thứ tự (điểm cập nhật -> hạng đổi chỗ).
 * Đo vị trí CŨ trước khi React re-render vào đúng thứ tự MỚI, rồi "tua
 * ngược" bằng translateY tức thời + bật transition ở frame kế tiếp để
 * trình duyệt tự animate về vị trí thật — thẻ trượt lên/xuống mượt thay vì
 * nhảy khựng.
 *
 * `containerRef` phải bọc các hàng có `data-flip-id={id}` khớp với 1 phần
 * tử trong `orderedIds` (thứ tự hiện tại). Key trong `orderedIds` phải ổn
 * định qua các lần render (participantId/teamId).
 */
export function useFlipList(containerRef: React.RefObject<HTMLElement>, orderedIds: string[]) {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const key = orderedIds.join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const nodes = container.querySelectorAll<HTMLElement>("[data-flip-id]");

    nodes.forEach((node) => {
      const id = node.getAttribute("data-flip-id");
      if (!id) return;
      const newRect = node.getBoundingClientRect();
      const oldRect = prevRects.current.get(id);
      if (oldRect) {
        const deltaY = oldRect.top - newRect.top;
        if (Math.abs(deltaY) > 0.5) {
          node.style.transition = "none";
          node.style.transform = `translateY(${deltaY}px)`;
          // Buộc reflow rồi mới bật transition — nếu không trình duyệt gộp
          // 2 lần set style làm mất animation.
          void node.offsetHeight;
          requestAnimationFrame(() => {
            node.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
            node.style.transform = "";
          });
        }
      }
      prevRects.current.set(id, newRect);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
