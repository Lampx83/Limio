"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { HISTORY_SENT, loadHistory, saveHistory, type StoredMessage } from "@/lib/assistantHistory";
// Chỉ import kiểu: teacherAssistant.ts kéo theo cả chuỗi limioLiveChat (phía server), không để vào bundle trình duyệt.
import type { AssistantReply } from "@/lib/teacherAssistant";

/** Tin trong cuộc trò chuyện. `fresh`: câu trả lời vừa về, đang hiện dần; liên kết và gợi ý chỉ hiện khi gõ xong. */
export type AssistantMsg = StoredMessage;

export function errorText(code: string): string {
  switch (code) {
    case "openai_not_configured":
      return "Trợ lý AI chưa được cấu hình. Báo quản trị viên kiểm tra ở mục tích hợp.";
    case "openai_busy":
      return "Hệ thống AI đang quá tải, thầy/cô đợi vài giây rồi hỏi lại nhé.";
    case "rate_limited":
      return "Thầy/cô đã hỏi quá nhiều trong một giờ, đợi chút rồi thử lại nhé.";
    case "no_token_budget":
    case "daily_token_cap":
      return "Thầy/cô đã dùng hết lượt hỏi AI. Hạn mức được cấp lại vào đầu tháng sau, hoặc mua thêm ở mục Token AI.";
    case "global_token_cap":
      return "Cả hệ thống đã chạm trần AI hôm nay. Đây là hạn mức chung, không phải lỗi của thầy/cô; thử lại vào ngày mai.";
    default:
      return "Chưa gửi được câu hỏi. Thầy/cô thử lại sau ít phút.";
  }
}

interface AssistantContextValue {
  messages: AssistantMsg[];
  busy: boolean;
  error: string | null;
  /** Ngăn kéo trợ lý (nút nổi) đang mở. */
  open: boolean;
  /** Có câu trả lời mới về khi ngăn kéo đóng. */
  unread: boolean;
  send: (text: string) => Promise<void>;
  /** Bắt đầu cuộc trò chuyện mới: xoá lịch sử (cả trong sessionStorage). */
  reset: () => void;
  setOpen: (open: boolean) => void;
  /** Câu trả lời ở vị trí `index` đã hiện dần xong. */
  markDone: (index: number) => void;
  /** Một khung chat đang hiển thị trên trang (vd khung lớn ở trang chủ): câu trả lời về lúc này không tính là "chưa đọc". Trả về hàm huỷ. */
  registerSurface: () => () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant phải nằm trong <AssistantProvider>");
  return ctx;
}

/**
 * Một cuộc trò chuyện duy nhất với trợ lý Lily cho cả khu vực giảng viên: khung lớn ở trang chủ và ngăn kéo ở mọi
 * trang khác cùng đọc một trạng thái. Provider nằm ở layout nên không bị huỷ khi chuyển trang trong khu vực; lịch sử
 * còn được lưu trong sessionStorage (theo tài khoản) để sống sót qua tải lại trang. Đóng tab thì mất, cố ý.
 */
export function AssistantProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [messages, setMessages] = useState<AssistantMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpenState] = useState(false);
  const [unread, setUnread] = useState(false);
  const hydrated = useRef(false);
  const openRef = useRef(false);
  const surfaces = useRef(0);
  const messagesRef = useRef<AssistantMsg[]>([]);
  messagesRef.current = messages;

  // Nạp lịch sử sau khi gắn vào trình duyệt (không đọc lúc render để khỏi lệch với HTML từ máy chủ).
  useEffect(() => {
    const restored = loadHistory(typeof window === "undefined" ? null : window.sessionStorage, userId);
    if (restored.length > 0) setMessages((cur) => (cur.length > 0 ? cur : restored));
    hydrated.current = true;
  }, [userId]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveHistory(typeof window === "undefined" ? null : window.sessionStorage, userId, messages);
  }, [messages, userId]);

  const setOpen = useCallback((v: boolean) => {
    openRef.current = v;
    setOpenState(v);
    if (v) setUnread(false);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setError(null);
      const history = messagesRef.current.slice(-HISTORY_SENT).map((m) => ({ role: m.role, text: m.text }));
      setMessages((prev) => [...prev.map((m) => (m.role === "assistant" && m.fresh ? { ...m, fresh: false } : m)), { role: "user", text }]);
      setBusy(true);
      try {
        const res = await fetch(apiUrl("/api/instructor/assistant"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });
        const data = (await res.json().catch(() => null)) as { result?: AssistantReply; error?: string } | null;
        if (!res.ok || !data?.result) {
          setError(errorText(data?.error ?? "unknown"));
          return;
        }
        const r = data.result;
        setMessages((prev) => [...prev, { role: "assistant", text: r.reply, actions: r.actions, followUps: r.followUps, fresh: true }]);
        if (!openRef.current && surfaces.current === 0) setUnread(true);
      } catch {
        setError(errorText("unknown"));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setUnread(false);
  }, []);

  const markDone = useCallback((index: number) => {
    setMessages((prev) => prev.map((x, j) => (j === index && x.role === "assistant" && x.fresh ? { ...x, fresh: false } : x)));
  }, []);

  const registerSurface = useCallback(() => {
    surfaces.current += 1;
    return () => {
      surfaces.current -= 1;
    };
  }, []);

  const value = useMemo<AssistantContextValue>(
    () => ({ messages, busy, error, open, unread, send, reset, setOpen, markDone, registerSurface }),
    [messages, busy, error, open, unread, send, reset, setOpen, markDone, registerSurface],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
