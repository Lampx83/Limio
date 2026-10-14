/**
 * LANG G5a — đồng hồ theo phần của đề thi thử.
 *
 * Hàm THUẦN: "phần nào đang chạy" luôn được suy ra từ giờ bắt đầu + giờ các
 * phần + (nộp sớm, gia hạn), không đọc/ghi gì. Nhờ vậy hết giờ phần thì phần
 * kế mở ngay mà không cần ai mở trang hay cron nào kịp chạy, và tải lại trang
 * không đặt lại được đồng hồ (xem G5a.3, G5a.6).
 */

export interface TimelineSectionInput {
  id: string;
  /** Giây của phần (đã đổi từ durationMin). */
  durationSec: number;
}

export interface SectionOverride {
  /** Học viên nộp sớm lúc nào; null = chưa. Giờ sau hạn tự nhiên bị bỏ qua. */
  endedAt: Date | null;
  /** Giây giảng viên gia hạn riêng cho phần này. */
  extraSec: number;
}

export type SectionState = "done" | "active" | "upcoming";

export interface ResolvedSection {
  id: string;
  state: SectionState;
  startsAt: Date;
  endsAt: Date;
}

export interface SectionTimeline {
  finished: boolean;
  activeIndex: number | null;
  activeSectionId: string | null;
  /** Giây còn lại của phần đang chạy (đã bị cắt bởi hạn cứng cả bài). 0 khi finished. */
  remainingSec: number;
  sections: ResolvedSection[];
}

export function resolveSectionTimeline(args: {
  sections: TimelineSectionInput[];
  overrides: Record<string, SectionOverride | undefined>;
  startedAt: Date;
  /** durationSec của lượt thi: hạn cứng = startedAt + durationSec. */
  durationSec: number;
  now: Date;
}): SectionTimeline {
  const { sections, overrides, startedAt, durationSec, now } = args;
  const hardEnd = startedAt.getTime() + durationSec * 1000;
  const nowMs = now.getTime();

  const resolved: ResolvedSection[] = [];
  let cursor = startedAt.getTime();
  let activeIndex: number | null = null;
  let remainingSec = 0;

  sections.forEach((s, i) => {
    const o = overrides[s.id];
    const natural = cursor + (s.durationSec + (o?.extraSec ?? 0)) * 1000;
    let end = natural;
    if (o?.endedAt) {
      const e = o.endedAt.getTime();
      if (e >= cursor && e < natural) end = e;
    }
    end = Math.min(end, hardEnd);
    const start = Math.min(cursor, hardEnd);

    let state: SectionState;
    if (nowMs >= hardEnd || nowMs >= end) state = "done";
    else if (activeIndex === null && nowMs >= start) {
      state = "active";
      activeIndex = i;
      remainingSec = Math.ceil((end - nowMs) / 1000);
    } else state = "upcoming";

    resolved.push({ id: s.id, state, startsAt: new Date(start), endsAt: new Date(end) });
    cursor = end;
  });

  return {
    finished: activeIndex === null,
    activeIndex,
    activeSectionId: activeIndex === null ? null : sections[activeIndex]!.id,
    remainingSec,
    sections: resolved,
  };
}
