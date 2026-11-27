/**
 * Bố cục của Bảng điều phối (CENTER M, docs/CENTER-dashboard-dieu-phoi-AC.md): quy đổi giờ → vị trí và xếp khối vào làn. Thuần, chỉ dùng ở trình
 * duyệt (nên nằm ở web, không kéo core-lms/Prisma vào bundle). Các định nghĩa nghiệp vụ (trạng thái, cờ, trùng) nằm ở core-lms/centerBoardCalc.
 */

/**
 * Xếp các khối của một hàng vào làn (M1.5): khối giao giờ không chồng lên nhau mà xuống làn dưới. Trả về chỉ số làn theo thứ tự
 * đầu vào và tổng số làn (≥ 1). Khối chạm đầu mút (kết thúc đúng lúc khối kia bắt đầu) vẫn cùng một làn.
 */
export function assignLanes(blocks: ReadonlyArray<{ startsAt: Date; endsAt: Date }>): { lanes: number[]; laneCount: number } {
  const order = blocks.map((_, i) => i).sort((a, b) => blocks[a]!.startsAt.getTime() - blocks[b]!.startsAt.getTime() || blocks[a]!.endsAt.getTime() - blocks[b]!.endsAt.getTime());
  const laneEnds: number[] = [];
  const lanes = new Array<number>(blocks.length).fill(0);
  for (const idx of order) {
    const b = blocks[idx]!;
    let lane = laneEnds.findIndex((end) => end <= b.startsAt.getTime());
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = b.endsAt.getTime();
    lanes[idx] = lane;
  }
  return { lanes, laneCount: Math.max(1, laneEnds.length) };
}

/** Vị trí theo phần trăm của một thời điểm trên trục [from, to]; kẹp vào 0–100 để khối kéo dài ra ngoài khoảng xem vẫn vẽ được. */
export function timeToPct(t: Date | number, from: Date | number, to: Date | number): number {
  const a = +from;
  const b = +to;
  if (b <= a) return 0;
  return Math.min(100, Math.max(0, ((+t - a) / (b - a)) * 100));
}

/** Một khối [startsAt, endsAt] có giao với khoảng đang xem [from, to) không. */
export function overlapsRange(startsAt: Date, endsAt: Date, from: Date, to: Date): boolean {
  return startsAt.getTime() < to.getTime() && endsAt.getTime() > from.getTime();
}
