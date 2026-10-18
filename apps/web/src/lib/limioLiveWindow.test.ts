import { describe, expect, it } from "vitest";
import { pickProjector, type ScreenLike } from "./limioLiveWindow";

const screen = (over: Partial<ScreenLike> = {}): ScreenLike => ({
  availLeft: 0,
  availTop: 0,
  availWidth: 1440,
  availHeight: 900,
  ...over,
});

describe("pickProjector", () => {
  it("chọn màn hình khác màn hình đang mở Limio", () => {
    const laptop = screen({ isInternal: true });
    const projector = screen({ availLeft: 1440, isInternal: false });
    expect(pickProjector([laptop, projector], laptop)).toBe(projector);
  });

  it("có nhiều màn hình khác thì ưu tiên màn hình gắn ngoài", () => {
    const monitor = screen({ isInternal: false });
    const laptop = screen({ availLeft: 1920, isInternal: true });
    const projector = screen({ availLeft: 3360, isInternal: false });
    expect(pickProjector([monitor, laptop, projector], monitor)).toBe(projector);
  });

  it("đang ở màn hình ngoài thì máy chiếu là màn hình còn lại, kể cả màn hình liền laptop", () => {
    const laptop = screen({ isInternal: true });
    const external = screen({ availLeft: 1440, isInternal: false });
    expect(pickProjector([laptop, external], external)).toBe(laptop);
  });

  it("chỉ một màn hình thì không có máy chiếu", () => {
    const only = screen();
    expect(pickProjector([only], only)).toBeNull();
  });
});
