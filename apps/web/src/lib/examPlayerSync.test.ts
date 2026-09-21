import { describe, expect, it } from "vitest";
import {
  diffDraftAgainstServer,
  estimateClockSkewMs,
  humanizeSubmitError,
  remainingSec,
  retryDelayMs,
} from "./examPlayerSync";

describe("diffDraftAgainstServer — bản nháp trên máy chưa lên server", () => {
  it("câu khác server hoặc chưa có trên server thì cần đồng bộ", () => {
    const server = [
      { questionId: "q1", answerJson: { optionIds: ["a"] } },
      { questionId: "q2", answerJson: { text: "x" } },
    ];
    const draft = {
      q1: { optionIds: ["a"] }, // trùng server → bỏ
      q2: { text: "sửa khi mất mạng" }, // khác → cần
      q3: { optionIds: ["b"] }, // server chưa có → cần
    };
    expect(diffDraftAgainstServer(draft, server).sort()).toEqual(["q2", "q3"]);
  });

  it("không có nháp: không có gì cần đồng bộ", () => {
    expect(diffDraftAgainstServer(null, [])).toEqual([]);
    expect(diffDraftAgainstServer({}, [{ questionId: "q1", answerJson: null }])).toEqual([]);
  });

  it("nháp null trùng server chưa có: coi là không đổi", () => {
    expect(diffDraftAgainstServer({ q1: null }, [])).toEqual([]);
  });
});

describe("retryDelayMs — lùi dần khi lưu lỗi", () => {
  it("tăng gấp đôi rồi chặn ở 30s", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("estimateClockSkewMs — lệch đồng hồ so với server", () => {
  it("lấy điểm giữa của yêu cầu để bù độ trễ mạng", () => {
    // Server báo 10:00:00.000; yêu cầu đi lúc t0=1000ms, về t1=1400ms (RTT 400).
    // Điểm giữa client = 1200 → skew = serverNow - 1200.
    const serverNow = new Date(10_000).toISOString();
    expect(estimateClockSkewMs(serverNow, 1000, 1400)).toBe(10_000 - 1200);
  });
  it("RTT quá lớn hoặc dữ liệu hỏng: không tin (null)", () => {
    expect(estimateClockSkewMs(new Date(0).toISOString(), 0, 5000)).toBeNull();
    expect(estimateClockSkewMs("không phải ngày", 0, 100)).toBeNull();
    expect(estimateClockSkewMs(undefined, 0, 100)).toBeNull();
  });
});

describe("remainingSec", () => {
  it("tính theo giờ server, không âm", () => {
    expect(remainingSec(100_000, 40_000, 0)).toBe(60);
    expect(remainingSec(100_000, 40_000, 10_000)).toBe(50); // đồng hồ máy chậm 10s → server đi trước
    expect(remainingSec(100_000, 200_000, 0)).toBe(0);
  });
});

describe("humanizeSubmitError — không hiện mã thô cho thí sinh", () => {
  it("map mã đã biết sang câu tiếng Việt có hướng xử lý", () => {
    expect(humanizeSubmitError("network_error")).toMatch(/mạng/);
    expect(humanizeSubmitError("session_stale")).toMatch(/thiết bị|tab/);
    expect(humanizeSubmitError("unauthorized")).toMatch(/đăng nhập|phiên/);
  });
  it("mã lạ vẫn có câu hướng dẫn, kèm mã để báo giám thị", () => {
    const m = humanizeSubmitError("weird_code");
    expect(m).toMatch(/giám thị/);
    expect(m).toContain("weird_code");
  });
});
