import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

// ── Window Management API (Chrome/Edge 100+) — chưa có trong lib.dom của TS.
// Safari/Firefox/webview nhúng không có → mọi hàm dưới đây lùi về cách cũ.
export interface ScreenLike {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isInternal?: boolean;
  isPrimary?: boolean;
}
interface ScreenDetailsLike {
  screens: ScreenLike[];
  currentScreen: ScreenLike;
  addEventListener?: (type: "screenschange" | "currentscreenchange", fn: () => void) => void;
}

const getScreenDetailsFn = (): undefined | (() => Promise<ScreenDetailsLike>) =>
  typeof window !== "undefined" ? ((window as any).getScreenDetails as any) : undefined;

// screen.isExtended: true khi máy đang nối thêm màn hình ở chế độ mở rộng (không phải
// mirror). Đọc được ngay, không cần xin quyền.
const isExtended = () => typeof window !== "undefined" && (window.screen as any).isExtended === true;

// ScreenDetails là object "sống" (tự cập nhật khi cắm/rút màn hình) nên chỉ cần lấy 1 lần.
// Chỉ lấy khi quyền ĐÃ được cấp: lúc bấm Presenter view phải dùng ngay, đồng bộ, vì
// fullscreen + mở cửa sổ cần còn nguyên cử chỉ click — không chờ hộp hỏi quyền được.
let cachedDetails: ScreenDetailsLike | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const remember = (details: ScreenDetailsLike) => {
  if (cachedDetails === details) return;
  cachedDetails = details;
  details.addEventListener?.("screenschange", notify);
  details.addEventListener?.("currentscreenchange", notify);
  notify();
};

// Trạng thái quyền "Quản lý cửa sổ" (null = chưa đọc được). Theo dõi sự kiện đổi quyền để giảng viên bật
// lại trong cài đặt trang web thì trang tự nhận, không cần tải lại.
let permState: PermissionState | null = null;
let permWatched = false;

async function readPermission(): Promise<PermissionState | null> {
  // Tên quyền cũ là "window-placement" (Chrome < 111).
  for (const name of ["window-management", "window-placement"]) {
    try {
      const st = await navigator.permissions.query({ name: name as PermissionName });
      if (!permWatched) {
        permWatched = true;
        st.addEventListener?.("change", () => {
          permState = st.state;
          notify();
          primeScreenDetails();
        });
      }
      return st.state;
    } catch {
      /* trình duyệt không biết tên này — thử tên kế */
    }
  }
  return null;
}

async function primeScreenDetails(): Promise<void> {
  const getDetails = getScreenDetailsFn();
  if (!getDetails || !isExtended()) return;
  permState = await readPermission();
  notify();
  if (cachedDetails || permState !== "granted") return;
  try {
    remember(await getDetails.call(window));
  } catch {
    /* API lỗi — giữ cách cũ */
  }
}

// Máy chiếu = màn hình khác màn hình đang mở Limio; nếu có nhiều, ưu tiên màn hình
// gắn ngoài (không phải màn hình liền của laptop) — giống PowerPoint.
export function pickProjector(screens: ScreenLike[], current: ScreenLike): ScreenLike | null {
  const others = screens.filter((sc) => sc !== current);
  return others.find((sc) => sc.isInternal === false) ?? others[0] ?? null;
}

const projectorPair = () => {
  if (!cachedDetails || !isExtended()) return null;
  const here = cachedDetails.currentScreen;
  const projector = pickProjector(cachedDetails.screens, here);
  return projector ? { here, projector } : null;
};

/**
 * Presenter view sẽ chạy thế nào:
 *   "ready"       = có màn hình mở rộng và đã có quyền → màn chiếu tự lên màn hình thứ hai, toàn màn hình;
 *   "prompt"      = có màn hình mở rộng nhưng chưa xin quyền → cần nút "Cho phép" (xin riêng, không chen lúc mở cửa sổ:
 *                   cửa sổ màn chiếu bật lên sẽ che mất hộp hỏi quyền của trình duyệt);
 *   "denied"      = quyền bị chặn → chỉ cách bật lại trong cài đặt trang web;
 *   "unavailable" = một màn hình, chế độ nhân bản, hoặc trình duyệt không hỗ trợ (Safari, Firefox) → cách cũ.
 */
export type ProjectorStatus = "ready" | "prompt" | "denied" | "unavailable";

export function projectorStatus(): ProjectorStatus {
  if (!getScreenDetailsFn() || !isExtended()) return "unavailable";
  if (projectorPair()) return "ready";
  if (permState === "denied") return "denied";
  // Đã có quyền nhưng đang đọc danh sách màn hình: chưa hiện gì để khỏi nháy nút "Cho phép".
  if (permState === "granted") return "unavailable";
  return "prompt";
}

/** Gọi trong cú click của nút "Cho phép": trình duyệt hiện hộp hỏi quyền (lần đầu), rồi đọc danh sách màn hình. */
export async function requestProjectorPermission(): Promise<ProjectorStatus> {
  const getDetails = getScreenDetailsFn();
  if (!getDetails) return "unavailable";
  try {
    const details = await getDetails.call(window);
    permState = "granted";
    remember(details);
  } catch {
    // Bị từ chối hoặc đóng hộp hỏi: đọc lại để phân biệt "chặn" với "chưa trả lời".
    permState = (await readPermission()) ?? "prompt";
  }
  notify();
  return projectorStatus();
}

// Editor dùng để chọn cách chạy Presenter view và hiện dòng xin quyền khi cần.
export function useProjectorStatus(): ProjectorStatus {
  const [status, setStatus] = useState<ProjectorStatus>("unavailable");
  useEffect(() => {
    const update = () => setStatus(projectorStatus());
    listeners.add(update);
    update();
    primeScreenDetails();
    // Cắm/rút máy chiếu hoặc đổi mirror ↔ extended khi đang mở trang.
    const onScreenChange = () => {
      primeScreenDetails();
      update();
    };
    (window.screen as any).addEventListener?.("change", onScreenChange);
    return () => {
      listeners.delete(update);
      (window.screen as any).removeEventListener?.("change", onScreenChange);
    };
  }, []);
  return status;
}

const popupFeatures = (sc: ScreenLike) =>
  `popup=yes,left=${sc.availLeft},top=${sc.availTop},width=${sc.availWidth},height=${sc.availHeight}`;

export const PRESENTER_WINDOW = "limio-live-presenter";
export const presenterUrl = (deckId: string, from?: string) =>
  apiUrl(`/instructor/limio-live/${deckId}/present?swap=1${from ? `&from=${encodeURIComponent(from)}` : ""}`);
export const audienceUrl = (deckId: string) => `/instructor/limio-live/${deckId}/present?view=audience&swap=1`;

// Presenter view kiểu PowerPoint (đổi vai 2 cửa sổ). PHẢI gọi đồng bộ trong cú click:
// Chrome cho 1 cử chỉ vừa đưa tab hiện tại lên fullscreen ở màn hình KHÁC vừa mở 1
// popup — đúng thứ tự fullscreen trước, mở cửa sổ sau. Tab đang soạn thành màn chiếu
// (caller tự điều hướng sang audienceUrl), presenter view mở cửa sổ mới phủ màn hình
// laptop. Cửa sổ mở trống trước; caller gán URL sau khi lưu xong để presenter không
// đọc bản cũ.
//   null      = không đủ điều kiện (không extended / chưa có quyền / không hỗ trợ) → dùng cách cũ
//   "blocked" = bị chặn popup (đã trả lại fullscreen)
export function startPresenterOnProjector(): Window | "blocked" | null {
  const pair = projectorPair();
  if (!pair) return null;
  document.documentElement
    .requestFullscreen({ screen: pair.projector } as FullscreenOptions)
    .catch(() => {
      /* bị từ chối — màn chiếu tự gợi ý bấm để fullscreen */
    });
  const win = window.open("", PRESENTER_WINDOW, popupFeatures(pair.here));
  if (!win) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    toast.error("Trình duyệt chặn cửa sổ bật lên — cho phép popup cho trang này rồi bấm lại");
    return "blocked";
  }
  return win;
}

// Mở lại presenter view từ màn chiếu (lỡ đóng cửa sổ điều khiển): đặt ở màn hình
// khác màn hình đang chiếu. Không có quyền/không hỗ trợ thì để trình duyệt tự đặt.
export function reopenPresenterWindow(deckId: string): Window | null {
  const pair = projectorPair();
  const w = Math.min(1280, window.screen.availWidth);
  const h = Math.min(800, window.screen.availHeight);
  const win = window.open(
    presenterUrl(deckId),
    PRESENTER_WINDOW,
    pair ? popupFeatures(pair.projector) : `popup=yes,width=${w},height=${h}`
  );
  if (!win) toast.error("Trình duyệt chặn cửa sổ bật lên — cho phép popup cho trang này rồi bấm lại");
  else win.focus?.();
  return win;
}

// Mở cửa sổ màn chiếu (popup độc lập) — PHẢI gọi đồng bộ trong 1 cú click để
// không bị chặn popup. Tên cửa sổ cố định nên bấm lại chỉ đưa cửa sổ cũ lên.
// Nếu trình duyệt có Window Management API (Chrome/Edge) thì hỏi quyền 1 lần và
// dời popup sang màn hình khác màn hình hiện tại; lệnh fullscreen thì không
// làm hộ được (phải có click ngay trong cửa sổ đó — cửa sổ màn chiếu tự gợi ý).
// Có quyền rồi thì lần sau editor dùng startPresenterOnProjector (không phải kéo, không phải bấm).
export function openAudienceWindow(deckId: string): Window | null {
  const w = Math.min(1280, window.screen.availWidth);
  const h = Math.min(720, window.screen.availHeight);
  const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
  const win = window.open(
    apiUrl(`/instructor/limio-live/${deckId}/present?view=audience`),
    "limio-live-audience",
    `popup=yes,width=${w},height=${h},left=${left},top=${top}`
  );
  if (!win) {
    toast.error("Trình duyệt chặn cửa sổ bật lên — cho phép popup cho trang này rồi bấm lại");
    return null;
  }
  win.focus?.();

  const getDetails = getScreenDetailsFn();
  if (getDetails) {
    getDetails
      .call(window)
      .then((details) => {
        remember(details);
        const other = details.screens.find((sc) => sc !== details.currentScreen);
        if (!other) return;
        win.moveTo(other.availLeft, other.availTop);
        win.resizeTo(other.availWidth, other.availHeight);
        win.focus?.();
        toast.info(
          "Đã đưa màn chiếu sang màn hình thứ hai — bấm vào cửa sổ đó để fullscreen. Lần sau Limio sẽ tự làm việc này."
        );
      })
      .catch(() => {
        /* từ chối quyền / không hỗ trợ — popup ở lại vị trí mặc định */
      });
  }
  return win;
}
