"use client";

import { createContext, useContext } from "react";

// Trang Token AI của người dùng (/me/ai-tokens) có thể bị admin khoá ở /admin/ai-tokens.
// Root layout đọc site setting rồi phát xuống đây để menu và AI tutor ẩn link theo.
const AiTokensPageContext = createContext(false);

export function AiTokensPageProvider({
  unlocked,
  children,
}: {
  unlocked: boolean;
  children: React.ReactNode;
}) {
  return <AiTokensPageContext.Provider value={unlocked}>{children}</AiTokensPageContext.Provider>;
}

export function useAiTokensPageUnlocked(): boolean {
  return useContext(AiTokensPageContext);
}

export const AI_TOKENS_HREF = "/me/ai-tokens";
