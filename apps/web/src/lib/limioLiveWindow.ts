import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

// Mở cửa sổ màn chiếu (popup độc lập) — PHẢI gọi đồng bộ trong 1 cú click để
// không bị chặn popup. Tên cửa sổ cố định nên bấm lại chỉ đưa cửa sổ cũ lên.
// Nếu trình duyệt có Window Management API (Chrome/Edge) thì hỏi quyền 1 lần và
// dời popup sang màn hình khác màn hình hiện tại; lệnh fullscreen thì không
// làm hộ được (phải có click ngay trong cửa sổ đó — cửa sổ màn chiếu tự gợi ý).
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

  const getScreenDetails = (window as any).getScreenDetails as undefined | (() => Promise<any>);
  if (getScreenDetails) {
    getScreenDetails
      .call(window)
      .then((details: any) => {
        const other = (details.screens as any[]).find((sc) => sc !== details.currentScreen);
        if (!other) return;
        win.moveTo(other.availLeft, other.availTop);
        win.resizeTo(other.availWidth, other.availHeight);
        win.focus?.();
        toast.info("Đã đưa màn chiếu sang màn hình thứ hai — bấm vào cửa sổ đó để fullscreen");
      })
      .catch(() => {
        /* từ chối quyền / không hỗ trợ — popup ở lại vị trí mặc định */
      });
  }
  return win;
}
