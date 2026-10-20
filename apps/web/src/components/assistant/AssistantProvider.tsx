"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { HISTORY_SENT, loadHistory, saveHistory, type StoredMessage } from "@/lib/assistantHistory";
// Chỉ import kiểu: teacherAssistant.ts kéo theo cả chuỗi limioLiveChat (phía server), không để vào bundle trình duyệt.
import type { AssistantReply } from "@/lib/teacherAssistant";

/** Tin trong cuộc trò chuyện. `fresh`: câu trả lời vừa về, đang hiện dần; liên kết và gợi ý chỉ hiện khi gõ xong. */
export type AssistantMsg = StoredMessage;

/** Nguồn của một lượt hỏi, để nhật ký phân biệt câu tự gõ với câu bấm từ gợi ý. */
export type SendSource = "typed" | "suggestion" | "followup";

const newConversationId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const conversationKey = (userId: string) => `limio.assistant.cid.${userId}`;

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
  send: (text: string, source?: SendSource) => Promise<void>;
  /** Ghi nhật ký giảng viên bấm liên kết Lily đưa. Gửi rồi quên: không chặn việc chuyển trang. */
  logLinkClick: (destinationId: string, href: string) => void;
  /** Bắt đầu cuộc trò chuyện mới: xoá lịch sử (cả trong sessionStorage). */
  reset: () => void;
  setOpen: (open: boolean) => void;
  /** Câu trả lời ở vị trí `index` đã hiện dần xong. */
  markDone: (index: number) => void;
  /** Tên khoá giảng viên vừa chỉnh gần nhất, để gợi ý "Mở khoá học …"; null nếu chưa có khoá. */
  recentCourseTitle: string | null;
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
export function AssistantProvider({ userId, recentCourseTitle = null, children }: { userId: string; recentCourseTitle?: string | null; children: ReactNode }) {
  const [messages, setMessages] = useState<AssistantMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpenState] = useState(false);
  const [unread, setUnread] = useState(false);
  const hydrated = useRef(false);
  const openRef = useRef(false);
  const messagesRef = useRef<AssistantMsg[]>([]);
  messagesRef.current = messages;
  const pathname = usePathname();
  const pathRef = useRef<string | null>(null);
  pathRef.current = pathname;
  // Mã cuộc trò chuyện chỉ để nhóm các sự kiện trong nhật ký; sống cùng lịch sử (sessionStorage), đổi khi bấm "Cuộc trò chuyện mới".
  const conversationIdRef = useRef<string | null>(null);
  const conversationId = useCallback(() => {
    if (conversationIdRef.current) return conversationIdRef.current;
    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem(conversationKey(userId));
    } catch {
      // không đọc được thì sinh mã mới trong bộ nhớ
    }
    if (!id) {
      id = newConversationId();
      try {
        window.sessionStorage.setItem(conversationKey(userId), id);
      } catch {
        // không ghi được: mã chỉ sống trong lần tải trang này
      }
    }
    conversationIdRef.current = id;
    return id;
  }, [userId]);

  /** Nhật ký thao tác với Lily không đi qua lượt hỏi. Lỗi thì bỏ qua: không bao giờ làm chậm hay hỏng thao tác của giảng viên. */
  const logEvent = useCallback(
    (body: Record<string, unknown>) => {
      try {
        void fetch(apiUrl("/api/instructor/assistant/events"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId: conversationId(), page: pathRef.current, ...body }),
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        // bỏ qua
      }
    },
    [conversationId],
  );

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

  const setOpen = useCallback(
    (v: boolean) => {
      if (v && !openRef.current) logEvent({ type: "opened", hasHistory: messagesRef.current.length > 0 });
      openRef.current = v;
      setOpenState(v);
      if (v) setUnread(false);
    },
    [logEvent],
  );

  const send = useCallback(
    async (raw: string, source: SendSource = "typed") => {
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
          body: JSON.stringify({ message: text, history, source, conversationId: conversationId(), page: pathRef.current }),
        });
        const data = (await res.json().catch(() => null)) as { result?: AssistantReply; error?: string } | null;
        if (!res.ok || !data?.result) {
          setError(errorText(data?.error ?? "unknown"));
          return;
        }
        const r = data.result;
        setMessages((prev) => [...prev, { role: "assistant", text: r.reply, actions: r.actions, followUps: r.followUps, fresh: true }]);
        if (!openRef.current) setUnread(true);
      } catch {
        setError(errorText("unknown"));
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId],
  );

  const reset = useCallback(() => {
    logEvent({ type: "reset", messageCount: messagesRef.current.length });
    conversationIdRef.current = null;
    try {
      window.sessionStorage.removeItem(conversationKey(userId));
    } catch {
      // bỏ qua
    }
    setMessages([]);
    setError(null);
    setUnread(false);
  }, [logEvent, userId]);

  const logLinkClick = useCallback((destinationId: string, href: string) => logEvent({ type: "link_clicked", destinationId, href }), [logEvent]);

  const markDone = useCallback((index: number) => {
    setMessages((prev) => prev.map((x, j) => (j === index && x.role === "assistant" && x.fresh ? { ...x, fresh: false } : x)));
  }, []);

  const value = useMemo<AssistantContextValue>(
    () => ({ messages, busy, error, open, unread, send, logLinkClick, reset, setOpen, markDone, recentCourseTitle }),
    [messages, busy, error, open, unread, send, logLinkClick, reset, setOpen, markDone, recentCourseTitle],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
