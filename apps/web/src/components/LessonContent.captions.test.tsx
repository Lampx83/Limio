import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonContent from "./LessonContent";

const NATIVE = "/api/lesson-media/videos/u-1790000000000-abcdef0123456789.mp4";
const VTT = "/api/lesson-media/transcripts/u-1790000000000-abcdef0123456789.vtt";

const video = (payload: Record<string, unknown>) => ({
  id: "v1",
  type: "video",
  payload,
  orderIndex: 0,
});

describe("LessonContent — phụ đề cho video tải lên", () => {
  it("có transcript .vtt → <track kind=subtitles> trong <video controls>, mặc định tắt, không có link transcript", () => {
    const html = renderToStaticMarkup(
      <LessonContent items={[video({ url: NATIVE, transcriptUrl: VTT })]} />,
    );
    expect(html).toContain("<video");
    expect(html).toMatch(/<track [^>]*kind="subtitles"/);
    expect(html).toContain(`src="${VTT}"`);
    expect(html).toContain('srcLang="en"');
    expect(html).toContain('label="English"');
    // "optional": không bật sẵn
    expect(html).not.toMatch(/<track [^>]*\bdefault\b/);
    expect(html).not.toContain("Xem transcript");
  });

  it("captionLang / captionLabel tuỳ chỉnh được", () => {
    const html = renderToStaticMarkup(
      <LessonContent
        items={[video({ url: NATIVE, transcriptUrl: VTT, captionLang: "vi", captionLabel: "Tiếng Việt" })]}
      />,
    );
    expect(html).toContain('srcLang="vi"');
    expect(html).toContain('label="Tiếng Việt"');
  });

  it("video tải lên không có transcript → không có <track>", () => {
    const html = renderToStaticMarkup(<LessonContent items={[video({ url: NATIVE })]} />);
    expect(html).toContain("<video");
    expect(html).not.toContain("<track");
  });

  it("transcript .srt trên video tải lên giữ nguyên link 'Xem transcript', không có <track>", () => {
    const srt = VTT.replace(".vtt", ".srt");
    const html = renderToStaticMarkup(<LessonContent items={[video({ url: NATIVE, transcriptUrl: srt })]} />);
    expect(html).not.toContain("<track");
    expect(html).toContain("Xem transcript");
    expect(html).toContain(`href="${srt}"`);
  });

  it("video YouTube với .vtt không đi qua <track> (iframe, hành vi cũ)", () => {
    const html = renderToStaticMarkup(
      <LessonContent items={[video({ url: "https://www.youtube.com/watch?v=abc12345678", transcriptUrl: VTT })]} />,
    );
    expect(html).not.toContain("<track");
  });
});
