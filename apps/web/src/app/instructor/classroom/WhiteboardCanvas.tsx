"use client";

import "@excalidraw/excalidraw/index.css";
import { useEffect, useRef, useState, useCallback } from "react";
import dynamicImport from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { reconcileWhiteboardElements, type WhiteboardElement } from "@/lib/whiteboardReconcile";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

const Excalidraw = dynamicImport(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false },
);

// = CaptureUpdateAction.NEVER (giá trị literal string ổn định của package —
// xem store.d.ts) — dùng thẳng literal để khỏi phải import runtime của
// @excalidraw/excalidraw ở module scope (phá mất lazy-load ssr:false ở trên).
// Theo khuyến nghị chính thức: remote update không nên vào undo stack của mình.
const CAPTURE_UPDATE_NEVER = "NEVER" as const;

// Throttle gửi batch lên server — đủ nhanh để cảm giác "gần real-time",
// đủ thưa để không spam request khi đang kéo nét dài.
const FLUSH_INTERVAL_MS = 350;

// C — Kiosk/triển lãm: im lặng (không ai vẽ, kể cả từ thiết bị khác cùng
// board) quá lâu → tự xoá để sẵn sàng cho khách tiếp theo. Chạy hoàn toàn
// phía client (kiosk là 1 tab luôn mở tại chỗ) — không cần cron/BullMQ.
const KIOSK_IDLE_RESET_MS = 3 * 60 * 1000;

// C — Offline resilience: nét vẽ chưa gửi được lưu tạm vào localStorage để
// sống sót qua 1 lần reload/crash tab khi đang mất mạng (kiosk có thể chạy
// cả ngày). Dọn ngay khi gửi thành công.
function pendingStorageKey(code: string) {
  return `wb-pending-${code}`;
}
function loadPendingFromStorage(
  code: string,
): { page: number; elements: WhiteboardElement[] } | null {
  try {
    const raw = localStorage.getItem(pendingStorageKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.elements)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function savePendingToStorage(code: string, page: number, elements: WhiteboardElement[]) {
  try {
    if (elements.length === 0) {
      localStorage.removeItem(pendingStorageKey(code));
      return;
    }
    localStorage.setItem(pendingStorageKey(code), JSON.stringify({ page, elements }));
  } catch {
    // localStorage có thể bị chặn (private mode/quota) — bỏ qua, không chặn vẽ.
  }
}

// id cố định cho element ảnh nền — luôn bị thay hoàn toàn mỗi lần load/đổi
// trang, không bao giờ đi qua handleChange/server (xem loadPage + handleChange).
const BG_ELEMENT_ID = "whiteboard-bg";

interface WhiteboardCanvasProps {
  code: string;
  // Tên người đang vẽ — ghi vào customData.authorName của mọi nét mới (server giữ nguyên, các thiết bị khác
  // nhận qua SSE). Không truyền = không gắn tên (hành vi cũ).
  authorName?: string;
  // Hiện nhãn tên người vẽ trên từng nét — bật ở màn hình giáo viên/chiếu, tắt ở máy học viên.
  showAuthors?: boolean;
  onReady?: (api: ExcalidrawImperativeAPI) => void;
  onStatusLoaded?: (status: string, title: string) => void;
  onPageInfo?: (currentPage: number, totalPages: number) => void;
}

async function loadBackgroundImage(
  url: string,
  cache: Map<string, { dataURL: string; mimeType: string; width: number; height: number }>,
): Promise<{ dataURL: string; mimeType: string; width: number; height: number } | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataURL = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("decode_failed"));
        img.src = dataURL;
      },
    );
    const result = { dataURL, mimeType: blob.type || "image/png", width, height };
    cache.set(url, result);
    return result;
  } catch {
    return null;
  }
}

function buildBackgroundElement(fileId: string, width: number, height: number): WhiteboardElement {
  return {
    id: BG_ELEMENT_ID,
    type: "image",
    fileId,
    x: 0,
    y: 0,
    width,
    height,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 0,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    // Khoá — GV/học viên không kéo/xoá/chọn nhầm ảnh nền khi vẽ đè lên.
    locked: true,
    status: "saved",
    scale: [1, 1],
    crop: null,
  };
}

// Nhãn tên: 1 nhãn/nét, nhưng bỏ nhãn nào nằm sát nhãn đã có của CÙNG người (nét dài/nhiều nét liền nhau
// chỉ hiện 1 tên) — đủ để biết ai vẽ đâu mà không phủ kín canvas.
const AUTHOR_TAG_MERGE_PX = 70;
interface AuthorTag {
  key: string;
  name: string;
  left: number;
  top: number;
}
function authorColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 38%)`;
}
function computeAuthorTags(
  elements: readonly unknown[],
  appState: { scrollX: number; scrollY: number; zoom: { value: number } },
): AuthorTag[] {
  const z = appState.zoom.value;
  const tags: AuthorTag[] = [];
  for (const raw of elements) {
    const el = raw as WhiteboardElement & { x?: number; y?: number; customData?: { authorName?: string } };
    const name = el.customData?.authorName;
    if (!name || el.isDeleted || el.id === BG_ELEMENT_ID || typeof el.x !== "number" || typeof el.y !== "number") continue;
    const left = (el.x + appState.scrollX) * z;
    const top = (el.y + appState.scrollY) * z - 18;
    if (tags.some((t) => t.name === name && Math.hypot(t.left - left, t.top - top) < AUTHOR_TAG_MERGE_PX)) continue;
    tags.push({ key: el.id, name, left, top });
  }
  return tags;
}

export default function WhiteboardCanvas({
  code,
  authorName,
  showAuthors,
  onReady,
  onStatusLoaded,
  onPageInfo,
}: WhiteboardCanvasProps) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [authorTags, setAuthorTags] = useState<AuthorTag[]>([]);
  const authorNameRef = useRef(authorName);
  const showAuthorsRef = useRef(showAuthors);
  const tagFrameRef = useRef<number | null>(null);
  useEffect(() => {
    authorNameRef.current = authorName;
    showAuthorsRef.current = showAuthors;
  });
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // C — kiosk mode + timer tự xoá khi im lặng quá lâu.
  const kioskModeRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // B — trang hiện tại (chế độ annotate tài liệu) + danh sách ảnh nền, sống
  // trong ref chứ không phải React state: cần đọc giá trị mới nhất bên trong
  // callback SSE (đóng closure 1 lần lúc effect chạy) mà không phải re-subscribe
  // EventSource mỗi lần đổi trang.
  const pageRef = useRef(0);
  const pagesRef = useRef<{ url: string }[]>([]);
  const bgCacheRef = useRef<Map<string, { dataURL: string; mimeType: string; width: number; height: number }>>(
    new Map(),
  );
  const currentBgElementRef = useRef<WhiteboardElement | null>(null);

  // Giữ callback prop mới nhất trong ref thay vì đưa vào dependency array —
  // đổi identity mỗi render (arrow function inline ở cha) sẽ gây loop nếu đưa
  // vào deps của effect load-snapshot. Bug thực tế đã gặp: 380+ request GET
  // lặp lại khi test whiteboard này (xem lịch sử sửa lỗi Phase A).
  const onReadyRef = useRef(onReady);
  const onStatusLoadedRef = useRef(onStatusLoaded);
  const onPageInfoRef = useRef(onPageInfo);
  useEffect(() => {
    onReadyRef.current = onReady;
    onStatusLoadedRef.current = onStatusLoaded;
    onPageInfoRef.current = onPageInfo;
  });

  // Theo dõi version đã gửi lên server thành công + hàng đợi chờ gửi —
  // xem lib/whiteboardReconcile.ts cho lý do append-only đủ an toàn khi mất mạng.
  const lastSentRef = useRef<Map<string, number>>(new Map());
  const pendingRef = useRef<Map<string, WhiteboardElement>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef(false);

  // Trang mà lô đang chờ gửi (pendingRef) thuộc về — chốt lúc nét ĐẦU TIÊN
  // của lô được thêm vào (xem handleChange), không phải lúc timer bắn hay
  // lúc thử gửi lại. Đọc pageRef.current ở những thời điểm đó thì 1 lần đổi
  // trang xảy ra đúng trong khoảng debounce/lúc mạng chập chờn sẽ khiến nét
  // vẽ ở trang cũ bị gắn nhầm sang trang mới (bug thực tế đã gặp khi test).
  const pendingPageRef = useRef(0);

  // Gọi mỗi khi có "hoạt động" (vẽ tại chỗ hoặc thấy nét từ thiết bị khác
  // cùng board) — dời timer tự xoá ra xa thêm. Không làm gì nếu board không
  // bật kioskMode.
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!kioskModeRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      fetch(apiUrl(`/api/public/whiteboards/${code}/kiosk-reset`), { method: "POST" }).catch(() => {
        /* best-effort — không có thì thôi, thử lại ở lần idle kế tiếp */
      });
    }, KIOSK_IDLE_RESET_MS);
  }, [code]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    const page = pendingPageRef.current;
    flushTimerRef.current = setTimeout(async () => {
      flushTimerRef.current = null;
      const batch = Array.from(pendingRef.current.values());
      pendingRef.current.clear();
      if (batch.length === 0) return;
      try {
        const res = await fetch(apiUrl(`/api/public/whiteboards/${code}/elements`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elements: batch, page }),
        });
        if (res.ok) {
          for (const el of batch) lastSentRef.current.set(el.id, el.version);
          savePendingToStorage(code, page, Array.from(pendingRef.current.values()));
        } else if (res.status !== 403 && res.status !== 404) {
          // Lỗi tạm thời (rate limit, 5xx) — đưa lại hàng đợi để thử lại, giữ
          // nguyên `page` đã chốt (không đọc lại pageRef.current ở đây).
          for (const el of batch) {
            const existing = pendingRef.current.get(el.id);
            if (!existing || el.version >= existing.version) pendingRef.current.set(el.id, el);
          }
          pendingPageRef.current = page;
          savePendingToStorage(code, page, Array.from(pendingRef.current.values()));
          scheduleFlush();
        }
      } catch {
        // Mất mạng — giữ lại hàng đợi, thử lại ở lần flush kế tiếp khi có mạng
        // (xem effect online/offline bên dưới — flush lại ngay khi mạng về).
        for (const el of batch) {
          const existing = pendingRef.current.get(el.id);
          if (!existing || el.version >= existing.version) pendingRef.current.set(el.id, el);
        }
        pendingPageRef.current = page;
        savePendingToStorage(code, page, Array.from(pendingRef.current.values()));
        scheduleFlush();
      }
    }, FLUSH_INTERVAL_MS);
  }, [code]);

  // Tải elements + ảnh nền của 1 trang rồi áp vào canvas hiện có (dùng cả lúc
  // mount lần đầu lẫn khi đổi trang — updateScene thay hẳn scene, không phải
  // patch). KHÔNG gọi trước khi apiRef sẵn sàng.
  const loadPage = useCallback(
    async (page: number) => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const res = await fetch(apiUrl(`/api/public/whiteboards/${code}?page=${page}`));
        if (!res.ok) return;
        const data = await res.json();
        const elements: WhiteboardElement[] = data.snapshot ?? [];
        pageRef.current = page;
        lastSentRef.current = new Map(elements.map((el) => [el.id, el.version]));
        pendingRef.current.clear();

        let sceneElements: WhiteboardElement[] = elements;
        const bg = pagesRef.current[page];
        if (bg?.url) {
          const bgData = await loadBackgroundImage(bg.url, bgCacheRef.current);
          if (bgData) {
            const fileId = `wb-bg-${page}`;
            api.addFiles([
              { id: fileId, dataURL: bgData.dataURL, mimeType: bgData.mimeType, created: Date.now() },
            ] as unknown as Parameters<typeof api.addFiles>[0]);
            const bgElement = buildBackgroundElement(fileId, bgData.width, bgData.height);
            currentBgElementRef.current = bgElement;
            sceneElements = [bgElement, ...elements];
          }
        } else {
          currentBgElementRef.current = null;
        }

        applyingRemoteRef.current = true;
        api.updateScene({
          elements: sceneElements as unknown as ExcalidrawInitialDataState["elements"],
          captureUpdate: CAPTURE_UPDATE_NEVER as never,
        });
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      } catch {
        /* best-effort — SSE/lần load sau sẽ tự sửa nếu 1 lần bị lỗi mạng */
      }
    },
    [code],
  );
  const loadPageRef = useRef(loadPage);
  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  // Ref-callback ổn định (deps rỗng) — nếu để inline trong JSX, function mới
  // mỗi render khiến Excalidraw coi đây là ref-callback MỚI và gọi lại trên
  // mọi re-render của cha (vd. Whiteboard.tsx đổi isFullscreen), tức loadPage
  // chạy lại không cần thiết mỗi lần. Cùng loại bug đã gặp với onReady/
  // onStatusLoaded ở Phase A — sửa bằng cùng kỹ thuật: chỉ đọc qua ref.
  const handleExcalidrawApi = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    onReadyRef.current?.(api);
    loadPageRef.current(pageRef.current);
  }, []);

  // Kiểm tra whiteboard tồn tại + đọc meta (title/status/pages/currentPage).
  // Excalidraw mount ngay sau bước này (elements của trang hiện tại hydrate
  // sau, qua loadPage, khi apiRef đã sẵn sàng — xem excalidrawAPI callback).
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/public/whiteboards/${code}`));
        if (res.status === 404) {
          if (!cancelled) setLoadError("Không tìm thấy whiteboard với code này.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Lỗi tải whiteboard");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        pagesRef.current = data.pages ?? [];
        pageRef.current = data.currentPage ?? 0;
        kioskModeRef.current = data.kioskMode ?? false;
        setReadOnly(data.status !== "open");
        onStatusLoadedRef.current?.(data.status, data.title);
        onPageInfoRef.current?.(pageRef.current, pagesRef.current.length);
        setReady(true);
        resetIdleTimer();

        // Nét vẽ chưa gửi được từ lần trước (mất mạng/crash tab) — thử gửi
        // lại ngay. Không cần render lại canvas ở đây: nếu gửi thành công,
        // SSE của chính board sẽ tự phát elements.updated về và áp vào scene
        // như bình thường.
        const pendingFromStorage = loadPendingFromStorage(code);
        if (pendingFromStorage && pendingFromStorage.elements.length > 0) {
          for (const el of pendingFromStorage.elements) pendingRef.current.set(el.id, el);
          pendingPageRef.current = pendingFromStorage.page;
          scheduleFlush();
        }
      } catch {
        if (!cancelled) setLoadError("Lỗi mạng");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, resetIdleTimer, scheduleFlush]);

  // Offline resilience: banner báo mất mạng + thử flush lại ngay khi mạng về
  // (thay vì đợi request tiếp theo tự trigger retry).
  useEffect(() => {
    setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);
    const handleOnline = () => {
      setIsOffline(false);
      if (pendingRef.current.size > 0) scheduleFlush();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [scheduleFlush]);

  // Dọn timer idle khi unmount (đổi board/rời trang) — tránh gọi kiosk-reset
  // "ma" cho 1 component đã không còn hiển thị.
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // SSE live update
  useEffect(() => {
    if (!ready) return;
    const es = new EventSource(apiUrl(`/api/public/whiteboards/${code}/stream`));
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as {
          type?: string;
          elements?: WhiteboardElement[];
          status?: string;
          page?: number;
        };
        if (ev.type === "status.changed" && ev.status) {
          setReadOnly(ev.status !== "open");
          return;
        }
        if (ev.type === "doc.page.changed" && typeof ev.page === "number") {
          resetIdleTimer();
          onPageInfoRef.current?.(ev.page, pagesRef.current.length);
          loadPageRef.current(ev.page);
          return;
        }
        const api = apiRef.current;
        if (!api) return;
        // elements.updated/board.cleared của trang khác trang đang xem — server
        // đã lưu đúng chỗ rồi, chỉ cần bỏ qua ở đây; loadPage sẽ lấy bản mới
        // nhất khi người dùng chuyển tới trang đó.
        if (typeof ev.page === "number" && ev.page !== pageRef.current) return;
        if (ev.type === "elements.updated" && ev.elements) {
          resetIdleTimer();
          applyingRemoteRef.current = true;
          const local = api.getSceneElementsIncludingDeleted();
          const merged = reconcileWhiteboardElements(
            local as unknown as WhiteboardElement[],
            ev.elements,
          );
          api.updateScene({
            elements: merged as unknown as ExcalidrawInitialDataState["elements"],
            captureUpdate: CAPTURE_UPDATE_NEVER as never,
          });
          // Không phải nét của mình — không cần gửi lại lên server.
          for (const el of ev.elements) lastSentRef.current.set(el.id, el.version);
          setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 0);
        }
        if (ev.type === "board.cleared") {
          resetIdleTimer(); // re-arm cho phiên kế tiếp (kể cả sau khi tự kiosk-reset)
          applyingRemoteRef.current = true;
          // Giữ lại ảnh nền (nếu có) — reset chỉ xoá nét vẽ, không xoá trang.
          const bg = currentBgElementRef.current;
          api.updateScene({
            elements: (bg ? [bg] : []) as unknown as ExcalidrawInitialDataState["elements"],
            captureUpdate: CAPTURE_UPDATE_NEVER as never,
          });
          lastSentRef.current.clear();
          pendingRef.current.clear();
          setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 0);
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnect */
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [code, ready, resetIdleTimer]);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: { scrollX: number; scrollY: number; zoom: { value: number } }) => {
      if (showAuthorsRef.current) {
        // rAF: onChange bắn liên tục khi kéo nét — gộp về 1 lần tính/khung hình.
        if (tagFrameRef.current === null) {
          tagFrameRef.current = requestAnimationFrame(() => {
            tagFrameRef.current = null;
            setAuthorTags(computeAuthorTags(elements, appState));
          });
        }
      }
      if (applyingRemoteRef.current || readOnly) return;
      // Hàng đợi đang rỗng → lô mới bắt đầu từ đây, chốt luôn trang hiện tại
      // cho cả lô (xem scheduleFlush).
      if (pendingRef.current.size === 0) pendingPageRef.current = pageRef.current;
      let changed = false;
      for (const raw of elements) {
        const el = raw as WhiteboardElement;
        if (el.id === BG_ELEMENT_ID) continue; // ảnh nền — không đồng bộ lên server
        const pending = pendingRef.current.get(el.id);
        const lastSent = lastSentRef.current.get(el.id);
        const known = pending ? Math.max(pending.version, lastSent ?? -1) : lastSent;
        if (known === undefined || el.version > known) {
          // Gắn tên người vẽ vào bản gửi đi (nét của người khác đã có sẵn tên nên không bị ghi đè).
          const name = authorNameRef.current;
          const cd = el.customData as { authorName?: string } | undefined;
          pendingRef.current.set(
            el.id,
            name && !cd?.authorName ? { ...el, customData: { ...(cd ?? {}), authorName: name } } : el,
          );
          changed = true;
        }
      }
      if (changed) {
        resetIdleTimer();
        savePendingToStorage(code, pendingPageRef.current, Array.from(pendingRef.current.values()));
        scheduleFlush();
      }
    },
    [readOnly, scheduleFlush, resetIdleTimer, code],
  );

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-muted">{loadError}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted text-sm">Đang tải bảng vẽ...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Excalidraw
        initialData={{ elements: [], appState: { viewBackgroundColor: "#ffffff" } }}
        viewModeEnabled={readOnly}
        excalidrawAPI={handleExcalidrawApi}
        onChange={handleChange}
      />
      {showAuthors && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
          {authorTags.map((t) => (
            <span
              key={t.key}
              className="absolute whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow"
              style={{ left: t.left, top: t.top, backgroundColor: authorColor(t.name) }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      {isOffline && (
        // Góc phải dưới — tránh toolbar Excalidraw (giữa trên + giữa dưới) và
        // khung QR (trái dưới).
        <div className="pointer-events-none absolute bottom-16 right-3 z-30 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
          ⚠ Mất mạng — vẫn vẽ được, sẽ tự đồng bộ khi có mạng lại
        </div>
      )}
    </div>
  );
}
