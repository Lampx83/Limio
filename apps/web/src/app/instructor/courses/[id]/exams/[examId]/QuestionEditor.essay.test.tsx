import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

import QuestionEditor from "./QuestionEditor";

// docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md — AC5a: câu Tự luận soạn được ngay trong trình soạn Bài luyện.

const essay = {
  type: "essay",
  prompt: "What did you learn?",
  points: 1,
  config: { explanation: "Bài mẫu ở đây", explanationAudio: "/api/exam-assets/mau-1.mp3", minWords: 30, voiceAnswer: false },
  skills: [],
};

describe("QuestionEditor: Bài luyện (practiceMode)", () => {
  it("bộ chọn dạng câu có 'Tự luận' khi tạo câu mới trong Bài luyện, và vẫn có ở đề thi thường", () => {
    const practice = renderToStaticMarkup(<QuestionEditor mode="create" examId="e1" passageId={null} onClose={() => undefined} practiceMode />);
    expect(practice).toContain("Tự luận");
    const normal = renderToStaticMarkup(<QuestionEditor mode="create" examId="e1" passageId={null} onClose={() => undefined} />);
    expect(normal).toContain("Tự luận");
  });

  it("form câu tự luận có đủ các mục, nhãn đúng như thiết kế", () => {
    const html = renderToStaticMarkup(
      <QuestionEditor mode="edit" examId="e1" passageId={null} questionId="q1" initial={essay} onClose={() => undefined} practiceMode />,
    );
    for (const label of [
      "Bài mẫu (Sample answer)",
      "Audio bài mẫu",
      "Tiêu chí đánh giá cho AI",
      "Số từ tối thiểu",
      "Cho trả lời bằng giọng nói",
      "AI nhận xét câu trả lời",
      "Điều AI cần xét khi góp ý; để trống thì AI chỉ dựa vào đề và bài mẫu.",
      "Học viên thấy sau khi kiểm tra",
    ]) {
      expect(html, label).toContain(label);
    }
    // Audio đã lưu hiện trình nghe thử và nút Xoá; định dạng và dung lượng nêu sẵn.
    expect(html).toContain("/api/exam-assets/mau-1.mp3");
    expect(html).toContain(">Xoá<");
    expect(html).toContain("MP3, OGG, WAV, M4A, WebM, tối đa 25 MB");
    // Công tắc đã tắt lúc lưu thì hiện bỏ tích; công tắc còn lại bật.
    const voice = /<input[^>]*type="checkbox"[^>]*>(?=<span><span[^>]*>Cho trả lời bằng giọng nói)/.exec(html)?.[0] ?? "";
    expect(voice).toContain('type="checkbox"');
    expect(voice).not.toContain("checked");
    const ai = /<input[^>]*type="checkbox"[^>]*>(?=<span><span[^>]*>AI nhận xét câu trả lời)/.exec(html)?.[0] ?? "";
    expect(ai).toContain('type="checkbox"');
    expect(ai).toContain("checked");
  });

  it("đề thi thường: câu tự luận giữ giao diện cũ, không có audio mẫu hay hai công tắc", () => {
    const html = renderToStaticMarkup(
      <QuestionEditor mode="edit" examId="e1" passageId={null} questionId="q1" initial={essay} onClose={() => undefined} />,
    );
    expect(html).toContain("Rubric (tuỳ chọn)");
    expect(html).toContain("Giải thích đáp án");
    expect(html).not.toContain("Audio bài mẫu");
    expect(html).not.toContain("Cho trả lời bằng giọng nói");
  });
});
