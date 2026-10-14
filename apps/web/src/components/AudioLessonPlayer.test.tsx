import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AudioLessonPlayer from "./AudioLessonPlayer";
import LessonContent from "./LessonContent";

// LessonContent nạp các trình phát nặng bằng next/dynamic (ssr:false). Ngoài
// trình duyệt thì chúng không có gì để vẽ, nên thay bằng null; riêng trình phát
// audio PHẢI import tĩnh để vẽ được ở server (và để test này thấy nó).
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const URL_ = "/api/lesson-media/audio/11111111-2222-4333-8444-555555555555-1790000000000-ab12cd34ef567890.mp3";
const text = (out: string) => out.replace(/<[^>]+>/g, "");
const render = (props: Partial<React.ComponentProps<typeof AudioLessonPlayer>> = {}) =>
  renderToStaticMarkup(<AudioLessonPlayer url={URL_} {...props} />);

describe("AudioLessonPlayer", () => {
  it("AUD.2.3: <audio> với src đúng, chỉ tải metadata (không tải cả file khi mới mở bài)", () => {
    const out = render();
    expect(out).toMatch(/<audio\b/);
    expect(out).toContain(`src="${URL_}"`);
    expect(out).toContain('preload="metadata"');
  });

  it("thanh phát tự vẽ (để thanh tiến độ rõ, không phụ thuộc giao diện mặc định của trình duyệt): nút phát, thanh tua có nhãn, giờ, tắt tiếng", () => {
    const out = render();
    expect(out).not.toMatch(/<audio[^>]*\bcontrols\b/); // không dùng bộ điều khiển gốc nữa
    expect(out).toContain('aria-label="Phát"');
    expect(out).toMatch(/<input[^>]*type="range"[^>]*aria-label="Tiến độ phát"|<input[^>]*aria-label="Tiến độ phát"[^>]*type="range"/);
    expect(text(out)).toContain("0:00");
    expect(out).toContain('aria-label="Tắt tiếng"');
  });

  it("AUD.2.3: có nút tốc độ 0.75×, 1×, 1.25× (1× đang chọn) và nút lặp lại", () => {
    const out = render();
    const t = text(out);
    for (const label of ["0.75×", "1×", "1.25×"]) expect(t).toContain(label);
    // Mỗi nút tốc độ là một <button>; tìm theo nhãn rồi đọc aria-pressed của đúng nút đó.
    const button = (label: string) => out.split("<button").find((chunk) => chunk.includes(`>${label}<`)) ?? "";
    expect(button("1×")).toContain('aria-pressed="true"');
    expect(button("0.75×")).toContain('aria-pressed="false"');
    expect(button("1.25×")).toContain('aria-pressed="false"');
    expect(t).toContain("Lặp lại");
  });

  it("hiện tiêu đề và chú thích khi có", () => {
    const t = text(render({ title: "Hội thoại bài 5", caption: "Nghe hai lần rồi mới xem lời thoại." }));
    expect(t).toContain("Hội thoại bài 5");
    expect(t).toContain("Nghe hai lần rồi mới xem lời thoại.");
  });

  it("AUD.2.4: lời thoại nằm trong <details> thu gọn mặc định (không có thuộc tính open)", () => {
    const out = render({ transcript: "A：你好！\nB：你好，好久不见。" });
    expect(out).toContain("<details");
    expect(out).not.toMatch(/<details[^>]*\bopen\b/);
    expect(text(out)).toContain("Lời thoại");
    expect(text(out)).toContain("好久不见");
  });

  it("AUD.2.4 / AUD.4.6: showTranscript=false → lời thoại KHÔNG có trong markup (không chỉ ẩn bằng CSS)", () => {
    const out = render({ transcript: "BÍ MẬT_ĐÁP_ÁN 你好", showTranscript: false });
    expect(out).not.toContain("BÍ MẬT_ĐÁP_ÁN");
    expect(out).not.toContain("<details");
    expect(text(out)).not.toContain("Lời thoại");
  });

  it("không có lời thoại thì không dựng khối lời thoại rỗng", () => {
    const out = render();
    expect(out).not.toContain("<details");
  });

  it("lời thoại là văn bản thuần: thẻ HTML trong đó bị thoát, không thành phần tử", () => {
    const out = render({ transcript: '<img src=x onerror="alert(1)">你好' });
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });
});

describe("LessonContent — nối loại `audio` vào trang bài", () => {
  it("AUD.2.3: mục nội dung type=audio được vẽ bằng trình phát audio, không rơi vào nhánh mặc định", () => {
    const out = renderToStaticMarkup(
      <LessonContent
        items={[{ id: "ci-1", type: "audio", orderIndex: 0, payload: { url: URL_, title: "Bài nghe 5" } }]}
      />,
    );
    expect(out).toContain("<audio");
    expect(out).toContain(`src="${URL_}"`);
    expect(text(out)).toContain("Bài nghe 5");
  });

  it("showTranscript=false đi xuyên qua LessonContent: học viên không nhận lời thoại", () => {
    const out = renderToStaticMarkup(
      <LessonContent
        items={[
          {
            id: "ci-2",
            type: "audio",
            orderIndex: 0,
            payload: { url: URL_, transcript: "ĐÁP_ÁN_NGHE_HIỂU", showTranscript: false },
          },
        ]}
      />,
    );
    expect(out).not.toContain("ĐÁP_ÁN_NGHE_HIỂU");
  });
});

// AUD.5 — chưa viết test thật: chờ chốt cách đo (đề xuất: dùng lại `videoRanges`
// của LessonEngagementTracker, đổi tên thành mediaRanges hay giữ nguyên). Viết
// ngay sau khi chủ dự án xác nhận, trước khi code phần ghi nhận nghe.
describe("AUD.5 — ghi nhận thời gian nghe", () => {
  it.todo("nghe liên tục được gộp thành các đoạn [từ, đến] giống cách video làm");
  it.todo("tua qua đoạn không nghe thì không tính là đã nghe đoạn đó");
  it.todo("ghi nhận không chặn hay làm chậm nút phát/dừng (lỗi mạng khi ghi không dừng âm thanh)");
});
