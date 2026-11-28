import { describe, expect, it } from "vitest";
import { dialogueTracksOf } from "./dialogueTracks";

describe("dialogueTracksOf — audio hội thoại của bài", () => {
  it("lấy mỗi khối hội thoại có audio cả đoạn, theo thứ tự trong bài", () => {
    const items = [
      { id: "a", type: "richtext", payload: { html: "<p>x</p>" } },
      { id: "b", type: "dialogue", payload: { title: " 课文2A · 考场门口 ", audioUrl: "/api/lesson-media/audio/1.mp3", turns: [] } },
      { id: "c", type: "dialogue", payload: { title: "课文2B", audioUrl: "/api/lesson-media/audio/2.mp3" } },
    ];
    expect(dialogueTracksOf(items)).toEqual([
      { id: "b", title: "课文2A · 考场门口", url: "/api/lesson-media/audio/1.mp3" },
      { id: "c", title: "课文2B", url: "/api/lesson-media/audio/2.mp3" },
    ]);
  });

  it("bỏ khối hội thoại chưa có audio cả đoạn và khối không phải hội thoại", () => {
    const items = [
      { id: "a", type: "dialogue", payload: { title: "A", turns: [{ audioUrl: "/x.mp3" }] } },
      { id: "b", type: "dialogue", payload: { title: "B", audioUrl: "  " } },
      { id: "c", type: "vocab_list", payload: { audioUrl: "/y.mp3" } },
      { id: "d", type: "dialogue" },
    ];
    expect(dialogueTracksOf(items)).toEqual([]);
  });
});
