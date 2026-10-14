import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SpeakingFeedbackPanel from "./SpeakingFeedbackPanel";

const text = (h: string) => h.replace(/<[^>]+>/g, "");

describe("SpeakingFeedbackPanel", () => {
  it("chưa có góp ý: nút 'Nhận góp ý bài nói', câu đồng ý gửi bản ghi tới OpenAI (G7e.2) và ghi chú giới hạn phát âm", () => {
    const t = text(renderToStaticMarkup(<SpeakingFeedbackPanel submissionId="s1" initial={null} />));
    expect(t).toContain("Nhận góp ý bài nói");
    expect(t).toMatch(/gửi tới OpenAI/);
    expect(t).toMatch(/trừ lượt AI/);
    expect(t).toMatch(/không chấm được phát âm/i);
  });
  it("đã có góp ý: hiện góp ý + bản chữ, nút đổi thành 'Chấm lại'", () => {
    const t = text(
      renderToStaticMarkup(
        <SpeakingFeedbackPanel
          submissionId="s1"
          initial={{
            review: "unreviewed",
            reviewerNote: null,
            transcript: { text: "Hello Anna" },
            body: { summary: "Ổn.", criteria: [], errors: [], nextSteps: [] },
          }}
        />,
      ),
    );
    expect(t).toContain("Chấm lại");
    expect(t).toContain("Hello Anna");
    expect(t).toContain("Chưa được giảng viên duyệt");
  });
});
