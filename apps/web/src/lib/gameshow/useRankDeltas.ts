import { useEffect, useRef } from "react";

/**
 * So sánh thứ hạng hiện tại với lần render trước đó — trả về Map id -> số
 * bậc đã tăng (dương = lên hạng, âm = tụt hạng). Dùng cho mũi tên 🔼/🔻 cạnh
 * tên trên bảng xếp hạng. Thuần client-side, không đụng gì tới điểm số
 * thật lưu ở server — chỉ diff thứ tự hiển thị giữa 2 lần cập nhật.
 */
export function useRankDeltas(orderedIds: string[]): Map<string, number> {
  const prevRef = useRef<Map<string, number>>(new Map());
  const deltas = new Map<string, number>();
  const key = orderedIds.join("|");

  orderedIds.forEach((id, i) => {
    const prevRank = prevRef.current.get(id);
    if (prevRank !== undefined && prevRank !== i) deltas.set(id, prevRank - i);
  });

  useEffect(() => {
    const m = new Map<string, number>();
    orderedIds.forEach((id, i) => m.set(id, i));
    prevRef.current = m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return deltas;
}
