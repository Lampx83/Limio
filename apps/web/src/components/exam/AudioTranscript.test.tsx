import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AudioTranscript, { AudioTranscriptContext } from "./AudioTranscript";
import PassageImage, { PASSAGE_IMAGE_CLASS } from "./PassageImage";
import { examAssetFilenameFromUrl } from "@/lib/examAssetUrl";
import { fitWithin, IMAGE_MAX_EDGE } from "@/lib/downscaleImage";

// docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md — AC2 (ảnh vừa khung, cỡ), AC4 (transcript chỉ khi được cấp).

const SRC = "/api/exam-assets/e1-123-abc.mp3";
const render = (map: Record<string, string> | null, src = SRC) =>
  renderToStaticMarkup(
    <AudioTranscriptContext.Provider value={map}>
      <AudioTranscript src={src} />
    </AudioTranscriptContext.Provider>,
  );

describe("AudioTranscript", () => {
  it("không có bối cảnh (thi thử đang làm): không vẽ gì và không có chữ nào của transcript", () => {
    expect(render(null)).toBe("");
  });
  it("có bối cảnh nhưng audio này không có transcript: không vẽ gì", () => {
    expect(render({ "khac.mp3": "chữ" })).toBe("");
    expect(render({ "e1-123-abc.mp3": "   " })).toBe("");
  });
  it("có transcript: dòng 'Xem transcript' đóng sẵn (details, không open)", () => {
    const html = render({ "e1-123-abc.mp3": "Xin chào" });
    expect(html).toContain("Xem transcript");
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    expect(html).toContain("Xin chào");
  });
  it("nhiều đoạn (cách nhau dòng trống) thì đánh số ①②", () => {
    const html = render({ "e1-123-abc.mp3": "Đoạn một\n\nĐoạn hai" });
    expect(html).toContain('data-testid="numbered-transcript"');
    expect(html).toContain("①");
    expect(html).toContain("②");
  });
  it("video: tra theo khoá video (tệp tải lên hoặc link)", () => {
    const html = renderToStaticMarkup(
      <AudioTranscriptContext.Provider value={{ "u1.mp4": "Lời tệp", "link:https://youtu.be/abcdefghijk": "Lời link" }}>
        <AudioTranscript src="/api/lesson-media/videos/u1.mp4" kind="video" />
        <AudioTranscript src="https://youtu.be/abcdefghijk" kind="video" />
      </AudioTranscriptContext.Provider>,
    );
    expect(html).toContain("Lời tệp");
    expect(html).toContain("Lời link");
    expect(renderToStaticMarkup(<AudioTranscript src="https://youtu.be/abcdefghijk" kind="video" />)).toBe("");
  });
  it("src không phải của kho đề: không vẽ gì", () => {
    expect(render({ "e1-123-abc.mp3": "x" }, "https://cdn.example.com/a.mp3")).toBe("");
  });
});

describe("tên tệp từ đường dẫn", () => {
  it("nhận đường dẫn kho đề, có hoặc không tiền tố/tham số", () => {
    expect(examAssetFilenameFromUrl("/api/exam-assets/a.png")).toBe("a.png");
    expect(examAssetFilenameFromUrl("/lms/api/exam-assets/a.png?x=1")).toBe("a.png");
    expect(examAssetFilenameFromUrl("/api/other/a.png")).toBeNull();
  });
});

describe("PassageImage", () => {
  it("ảnh nằm gọn trong khung: giới hạn rộng và cao (28rem), căn giữa, giữ tỉ lệ; bấm để xem toàn cỡ", () => {
    const html = renderToStaticMarkup(<PassageImage src="/api/exam-assets/a.png" alt="Sơ đồ" />);
    for (const c of ["max-w-full", "max-h-[28rem]", "object-contain", "mx-auto"]) expect(PASSAGE_IMAGE_CLASS).toContain(c);
    expect(html).toContain("<button");
    expect(html).toContain("Xem ảnh toàn cỡ: Sơ đồ");
    expect(html).not.toContain('data-testid="passage-image-lightbox"'); // đóng sẵn
  });
});

describe("fitWithin — thu ảnh khi tải lên", () => {
  it("ảnh lớn thu về cạnh dài 2000 px, giữ tỉ lệ", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1000, 5000)).toEqual({ width: 400, height: 2000 });
  });
  it("ảnh nhỏ hơn hoặc bằng mức này giữ nguyên, không phóng to", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(IMAGE_MAX_EDGE, 10)).toEqual({ width: IMAGE_MAX_EDGE, height: 10 });
  });
});
