// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TabBlurWarning from "./TabBlurWarning";

/**
 * Cảnh báo hiện ngay khi sinh viên quay lại trang thi. Điện thoại có thể tạm dừng bộ đếm giờ
 * khi trang chạy nền, nên thời gian rời trang phải tính theo đồng hồ thật.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
let state: DocumentVisibilityState;
const onBlur = vi.fn();

function setVisibility(next: DocumentVisibilityState) {
  state = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  state = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  onBlur.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<TabBlurWarning onBlur={onBlur} />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("TabBlurWarning", () => {
  it("rời trang rất ngắn không ghi và không cảnh báo", () => {
    setVisibility("hidden");
    act(() => vi.advanceTimersByTime(300));
    setVisibility("visible");
    expect(onBlur).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Cảnh báo");
  });

  it("rời 2 giây là ghi nhận và cảnh báo ngay khi quay lại", () => {
    setVisibility("hidden");
    act(() => vi.advanceTimersByTime(2_000));
    expect(onBlur).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Cảnh báo: Bạn đã rời tab");
    expect(host.textContent).toContain("1 lần");
  });

  it("điện thoại dừng bộ đếm khi chạy nền: vẫn ghi và cảnh báo theo đồng hồ thật", () => {
    setVisibility("hidden");
    // Đồng hồ thật đi tiếp 60 giây nhưng bộ đếm không được chạy.
    vi.setSystemTime(Date.now() + 60_000);
    setVisibility("visible");
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Cảnh báo: Bạn đã rời tab");
  });

  it("không quay lại thì vẫn ghi nhận khi bộ đếm chạy được", () => {
    setVisibility("hidden");
    act(() => vi.advanceTimersByTime(1_000));
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("Cảnh báo");
  });

  it("mỗi lần rời được đếm riêng", () => {
    for (let i = 0; i < 2; i++) {
      setVisibility("hidden");
      act(() => vi.advanceTimersByTime(2_000));
      setVisibility("visible");
    }
    expect(onBlur).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("2 lần");
  });

  it("sự kiện ẩn lặp lại không làm mất mốc rời trang", () => {
    setVisibility("hidden");
    vi.setSystemTime(Date.now() + 3_000);
    setVisibility("hidden");
    setVisibility("visible");
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
