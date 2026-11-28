/**
 * Các bản audio hội thoại của một bài (mỗi khối "dialogue" có audio cả đoạn là một bản), để khối Bài luyện kỹ năng Nghe
 * ("Hiểu hội thoại · …") đặt thanh nghe ngay trong khối, học viên khỏi cuộn lên phần Hội thoại.
 */
export interface DialogueTrack {
  id: string;
  /** Tên khối hội thoại ("课文2A · 考场门口"), có thể rỗng. */
  title: string;
  url: string;
}

interface ItemLike {
  id: string;
  type: string;
  payload?: unknown;
}

export function dialogueTracksOf(items: readonly ItemLike[]): DialogueTrack[] {
  const out: DialogueTrack[] = [];
  for (const it of items) {
    if (it.type !== "dialogue") continue;
    const p = (it.payload ?? {}) as { title?: unknown; audioUrl?: unknown };
    if (typeof p.audioUrl !== "string" || !p.audioUrl.trim()) continue;
    out.push({ id: it.id, title: typeof p.title === "string" ? p.title.trim() : "", url: p.audioUrl });
  }
  return out;
}
