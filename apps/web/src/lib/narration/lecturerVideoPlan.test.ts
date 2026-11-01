import { describe, expect, it } from "vitest";
import { LECTURER_VIDEO_FPS, clipCacheKey, pickRendition, planClips, totalFrames, videoSeekTarget } from "./lecturerVideoPlan";

const SEGS = [
  { anchor: "s0b0", startSec: 0, endSec: 14.71 },
  { anchor: "s0b1", startSec: 15.21, endSec: 19.21 },
  { anchor: "s1b0", startSec: 19.71, endSec: 30.45 },
];

describe("kế hoạch clip theo số hình", () => {
  it("đoạn đầu bắt đầu ở hình 0 và các đoạn nối liền nhau tới hết video", () => {
    const plan = planClips(SEGS, 31, LECTURER_VIDEO_FPS);
    expect(plan[0]!.startFrame).toBe(0);
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.startFrame).toBe(plan[i - 1]!.startFrame + plan[i - 1]!.frames);
    const last = plan[plan.length - 1]!;
    expect(last.startFrame + last.frames).toBe(totalFrames(31));
  });

  it("hình đầu của mỗi đoạn rơi đúng mốc giây của đoạn (không trôi)", () => {
    const plan = planClips(SEGS, 31);
    expect(plan[1]!.startFrame).toBe(Math.round(15.21 * 25));
    expect(plan[2]!.startFrame).toBe(Math.round(19.71 * 25));
  });

  it("phần trước mốc đầu giữ hình đầu: đoạn đầu bắt đầu ở 0 dù mốc là 1,2 giây", () => {
    const plan = planClips([{ anchor: "a", startSec: 1.2, endSec: 5 }], 6);
    expect(plan[0]!.startFrame).toBe(0);
    expect(plan[0]!.frames).toBe(150);
  });

  it("sắp theo thời gian dù đầu vào lộn xộn", () => {
    const plan = planClips([SEGS[2]!, SEGS[0]!, SEGS[1]!], 31);
    expect(plan.map((c) => c.anchor)).toEqual(["s0b0", "s0b1", "s1b0"]);
  });

  it("từ chối đoạn chồng nhau, đoạn ngược và độ dài không hợp lệ", () => {
    expect(() => planClips([{ anchor: "a", startSec: 0, endSec: 5 }, { anchor: "b", startSec: 4, endSec: 8 }], 10)).toThrow(/chồng/);
    expect(() => planClips([{ anchor: "a", startSec: 5, endSec: 5 }], 10)).toThrow(/endSec/);
    expect(() => planClips(SEGS, 0)).toThrow();
  });

  it("mốc đoạn vượt quá độ dài giọng thì bị chặn ở hình cuối, mỗi clip còn ít nhất 1 hình", () => {
    const plan = planClips([{ anchor: "a", startSec: 0, endSec: 5 }, { anchor: "b", startSec: 9.99, endSec: 12 }], 10);
    expect(plan[1]!.startFrame).toBeLessThanOrEqual(totalFrames(10));
    expect(plan.every((c) => c.frames >= 1)).toBe(true);
  });
});

describe("khoá cache clip", () => {
  it("đổi ảnh, âm thanh hay cỡ thì khoá đổi; cùng đầu vào thì giống nhau", () => {
    const a = clipCacheKey("a".repeat(40), "b".repeat(40), 512);
    expect(clipCacheKey("a".repeat(40), "b".repeat(40), 512)).toBe(a);
    expect(clipCacheKey("c".repeat(40), "b".repeat(40), 512)).not.toBe(a);
    expect(clipCacheKey("a".repeat(40), "d".repeat(40), 512)).not.toBe(a);
    expect(clipCacheKey("a".repeat(40), "b".repeat(40), 256)).not.toBe(a);
  });
});

describe("chọn bản video", () => {
  it("dưới 640px hoặc tiết kiệm dữ liệu dùng bản nhỏ", () => {
    expect(pickRendition(375)).toBe("sm");
    expect(pickRendition(639)).toBe("sm");
    expect(pickRendition(640)).toBe("lg");
    expect(pickRendition(1440)).toBe("lg");
    expect(pickRendition(1440, true)).toBe("sm");
  });
});

describe("đồng bộ video theo giọng", () => {
  it("chỉ tua khi lệch quá ngưỡng", () => {
    expect(videoSeekTarget(10, 10.1)).toBeNull();
    expect(videoSeekTarget(10, 9.76)).toBeNull();
    expect(videoSeekTarget(10, 9.7)).toBe(10);
    expect(videoSeekTarget(10, 12)).toBe(10);
  });
  it("giá trị hỏng thì không tua", () => {
    expect(videoSeekTarget(NaN, 1)).toBeNull();
    expect(videoSeekTarget(1, Infinity)).toBeNull();
  });
});
