import { afterEach, describe, expect, it, vi } from "vitest";
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

// Trạng thái quyền giữ trong module, nên mỗi ca nạp lại module với window/navigator giả.
async function load(opts: {
  extended?: boolean;
  api?: boolean;
  details?: () => Promise<unknown>;
  perm?: PermissionState | "unknown";
}) {
  vi.resetModules();
  const laptop = { availLeft: 0, availTop: 0, availWidth: 1440, availHeight: 900, isInternal: true };
  const projector = { availLeft: 1440, availTop: 0, availWidth: 1920, availHeight: 1080, isInternal: false };
  vi.stubGlobal("window", {
    screen: { isExtended: opts.extended ?? true },
    ...(opts.api === false
      ? {}
      : { getScreenDetails: opts.details ?? (async () => ({ screens: [laptop, projector], currentScreen: laptop })) }),
  });
  vi.stubGlobal("navigator", {
    permissions: {
      query: async () => {
        if (opts.perm === "unknown") throw new TypeError("không biết tên quyền");
        return { state: opts.perm ?? "prompt", addEventListener() {} };
      },
    },
  });
  return import("./limioLiveWindow");
}

describe("projectorStatus — dòng xin quyền cạnh Presenter view", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("trình duyệt không có API (Safari, Firefox): không hiện gì, giữ cách cũ", async () => {
    const m = await load({ api: false });
    expect(m.projectorStatus()).toBe("unavailable");
  });

  it("một màn hình hoặc chế độ nhân bản: không hiện gì", async () => {
    const m = await load({ extended: false });
    expect(m.projectorStatus()).toBe("unavailable");
  });

  it("màn hình mở rộng, chưa cấp quyền: hiện nút Cho phép", async () => {
    const m = await load({});
    expect(m.projectorStatus()).toBe("prompt");
  });

  it("bấm Cho phép và được cấp quyền: sẵn sàng tự đưa màn chiếu sang màn hình thứ hai", async () => {
    const m = await load({});
    expect(await m.requestProjectorPermission()).toBe("ready");
    expect(m.projectorStatus()).toBe("ready");
  });

  it("bị chặn: chuyển sang dòng hướng dẫn bật lại", async () => {
    const m = await load({ perm: "denied", details: async () => Promise.reject(new Error("NotAllowedError")) });
    expect(await m.requestProjectorPermission()).toBe("denied");
  });

  it("đóng hộp hỏi mà chưa trả lời: vẫn giữ nút Cho phép", async () => {
    const m = await load({ perm: "prompt", details: async () => Promise.reject(new Error("dismissed")) });
    expect(await m.requestProjectorPermission()).toBe("prompt");
  });

  it("trình duyệt không đọc được trạng thái quyền mà bị từ chối: vẫn cho bấm lại", async () => {
    const m = await load({ perm: "unknown", details: async () => Promise.reject(new Error("NotAllowedError")) });
    expect(await m.requestProjectorPermission()).toBe("prompt");
  });
});
