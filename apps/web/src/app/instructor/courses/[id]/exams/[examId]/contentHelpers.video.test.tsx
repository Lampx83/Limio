import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { plainTextToTiptap, tiptapToPlainText } from "./contentHelpers";
import { renderDoc, type TiptapDoc } from "@/components/exam/PassageView";

/**
 * Đoạn văn của Bài luyện nhận video: tệp tải lên (đường dẫn trong kho video của bài học) và link (YouTube, Vimeo…).
 * Thẻ `[[video:url|mô tả]]` đi vòng nhà soạn ↔ nội dung ↔ trang học viên.
 */
const UPLOADED = "/api/lesson-media/videos/2026/11/abc123.mp4";

describe("video trong đoạn văn", () => {
  it("tệp tải lên: thẻ → nút video → quay lại đúng thẻ; học viên thấy trình phát <video> trỏ đúng tệp", () => {
    const text = `Xem video rồi trả lời.\n\n[[video:${UPLOADED}|Hội thoại ở chợ]]`;
    const doc = plainTextToTiptap(text) as TiptapDoc;
    const video = (doc.content as Array<{ type: string; attrs?: Record<string, unknown> }>).find((n) => n.type === "video");
    expect(video?.attrs).toEqual({ src: UPLOADED, alt: "Hội thoại ở chợ" });
    expect(tiptapToPlainText(doc)).toContain(`[[video:${UPLOADED}|Hội thoại ở chợ]]`);
    const html = renderToStaticMarkup(<div>{renderDoc(doc)}</div>);
    expect(html).toContain("<video");
    expect(html).toContain(`src="${UPLOADED}"`);
    expect(html).toContain("Hội thoại ở chợ");
  });

  it("link YouTube/Vimeo: học viên thấy khung nhúng, không phải đường dẫn trơ", () => {
    const yt = renderToStaticMarkup(<div>{renderDoc(plainTextToTiptap("[[video:https://youtu.be/dQw4w9WgXcQ|Bài nghe]]") as TiptapDoc)}</div>);
    expect(yt).toContain("https://www.youtube.com/embed/dQw4w9WgXcQ");
    const vm = renderToStaticMarkup(<div>{renderDoc(plainTextToTiptap("[[video:https://vimeo.com/123456789|Clip]]") as TiptapDoc)}</div>);
    expect(vm).toContain("https://player.vimeo.com/video/123456789");
  });
});
