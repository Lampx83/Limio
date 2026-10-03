import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FlashcardStats } from "@feedbackme/core-feedback";
import type { LanguageProfile } from "@feedbackme/core-feedback";
import FlashcardStage from "./FlashcardStage";
import FlashcardSummary from "./FlashcardSummary";
import FlashcardStatsBlock from "./FlashcardStatsBlock";
import LanguageProfileView from "./LanguageProfileView";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

/**
 * LANG G4 / G4.5 — màn ôn thẻ, màn tổng kết, khối thống kê trên hồ sơ. Chỉ có
 * số đếm và nhãn; không phần trăm, không mastery.
 */

const text = (out: string) => out.replace(/<[^>]+>/g, "");
const noop = () => {};

const card = {
  itemId: "11111111-2222-4333-8444-555555555555",
  contentItemId: "ci",
  term: "朋友",
  reading: "péngyou",
  meaning: "bạn bè",
  example: "他是我的朋友。",
  exampleMeaning: "Anh ấy là bạn tôi.",
  audioUrl: "/api/lesson-media/audio/a-1790000000000-ab.mp3",
  isNew: true,
  intervals: { again: 1, hard: 1, good: 2, easy: 4 },
};

const stage = (over: Partial<React.ComponentProps<typeof FlashcardStage>> = {}) =>
  renderToStaticMarkup(
    <FlashcardStage card={card} mode="term_to_meaning" flipped={false} index={0} total={12} onFlip={noop} onRate={noop} {...over} />,
  );

describe("FlashcardStage — mặt trước và mặt sau theo chế độ", () => {
  it("Hán→nghĩa: mặt trước chỉ có từ; có nút Lật thẻ; chưa có nút đánh giá", () => {
    const out = stage();
    const t = text(out);
    expect(t).toContain("朋友");
    expect(t).not.toContain("bạn bè");
    expect(t).toContain("Lật thẻ");
    for (const label of ["Quên", "Khó", "Được", "Dễ"]) expect(t).not.toContain(label);
  });

  it("Hán→nghĩa: mặt sau có từ, phiên âm, nghĩa, ví dụ", () => {
    const t = text(stage({ flipped: true }));
    for (const s of ["朋友", "péngyou", "bạn bè", "他是我的朋友。", "Anh ấy là bạn tôi."]) expect(t).toContain(s);
  });

  it("Nghĩa→Hán: mặt trước là nghĩa (không lộ từ); mặt sau mới có từ", () => {
    const front = text(stage({ mode: "meaning_to_term" }));
    expect(front).toContain("bạn bè");
    expect(front).not.toContain("朋友");
    expect(text(stage({ mode: "meaning_to_term", flipped: true }))).toContain("朋友");
  });

  it("Nghe→Hán: mặt trước chỉ có nút nghe (không lộ từ lẫn nghĩa); mặt sau có đủ", () => {
    const front = stage({ mode: "audio_to_term" });
    expect(front).toContain('aria-label="Nghe từ"');
    expect(text(front)).not.toContain("朋友");
    expect(text(front)).not.toContain("bạn bè");
    const back = text(stage({ mode: "audio_to_term", flipped: true }));
    expect(back).toContain("朋友");
    expect(back).toContain("bạn bè");
  });

  it("mặt sau của chế độ khác có nút nghe khi thẻ có audio; thẻ không audio thì không có", () => {
    expect(stage({ flipped: true })).toMatch(/aria-label="Nghe [^"]*"/);
    const { audioUrl: _a, ...noAudio } = card;
    expect(stage({ flipped: true, card: noAudio })).not.toMatch(/aria-label="Nghe/);
  });

  it("tiến độ 'Thẻ 1/12'", () => {
    expect(text(stage())).toContain("Thẻ 1/12");
    expect(text(stage({ index: 4 }))).toContain("Thẻ 5/12");
  });
});

describe("FlashcardStage — bốn nút đánh giá (G4.5.1, G4.5.2)", () => {
  it("sau khi lật: Quên/Khó/Được/Dễ kèm khoảng ôn tới và phím tắt 1–4", () => {
    const out = stage({ flipped: true });
    const t = text(out);
    for (const label of ["Quên", "Khó", "Được", "Dễ"]) expect(t).toContain(label);
    expect(t).toContain("2 ngày");
    expect(t).toContain("4 ngày");
    expect([...out.matchAll(/aria-keyshortcuts="([1-4])"/g)].map((m) => m[1])).toEqual(["1", "2", "3", "4"]);
    // Nút lật thẻ biến mất sau khi lật.
    expect(t).not.toContain("Lật thẻ");
  });

  it("khoảng hiển thị lấy từ chính thẻ (nút không nói dối)", () => {
    const t = text(stage({ flipped: true, card: { ...card, intervals: { again: 1, hard: 7, good: 30, easy: 365 } } }));
    expect(t).toContain("1 tuần");
    expect(t).toContain("1 tháng");
    expect(t).toContain("1 năm");
  });

  it("G4.5.4: thanh nút dính đáy trên mobile, về vị trí thường từ lg", () => {
    const out = stage({ flipped: true });
    expect(out).toMatch(/fixed[^"]*bottom-0/);
    expect(out).toContain("lg:static");
  });

  it("phím Space lật thẻ được khai báo cho nút Lật thẻ", () => {
    expect(stage()).toContain('aria-keyshortcuts="Space"');
  });

  it("chữ trong thẻ là text: HTML hiện nguyên chữ", () => {
    const out = stage({ flipped: true, card: { ...card, term: "<img src=x onerror=alert(1)>", meaning: "<b>đậm</b>" } });
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<b>");
  });
});

describe("FlashcardSummary", () => {
  it("tổng số thẻ đã ôn và số theo từng mức; có lối quay về", () => {
    const out = renderToStaticMarkup(
      <FlashcardSummary slug="tieng-trung" summary={{ total: 12, again: 2, hard: 1, good: 7, easy: 2 }} />,
    );
    const t = text(out);
    expect(t).toContain("12");
    for (const s of ["Quên", "Khó", "Được", "Dễ"]) expect(t).toContain(s);
    expect(out).toContain('href="/learn/tieng-trung"');
    expect(t).not.toContain("%");
  });
});

const stats = (over: Partial<FlashcardStats> = {}): FlashcardStats => ({
  enrolled: true,
  total: 86,
  learned: 66,
  dueToday: 12,
  struggling: 7,
  newAvailable: 10,
  distribution: { new: 20, learning: 38, mature: 28 },
  ...over,
});

describe("FlashcardStatsBlock — G4.4 / G4.5.3", () => {
  const render = (s: FlashcardStats) => renderToStaticMarkup(<FlashcardStatsBlock slug="tieng-trung" stats={s} />);

  it("ba số: Đã học · Đến hạn hôm nay · Hay quên, và phân bố Mới/Đang học/Nhớ lâu bằng số đếm", () => {
    const t = text(render(stats()));
    for (const s of ["Đã học", "66", "Đến hạn hôm nay", "12", "Hay quên", "7"]) expect(t).toContain(s);
    for (const s of ["Mới · 20", "Đang học · 38", "Nhớ lâu · 28"]) expect(t).toContain(s);
    expect(t).not.toContain("%");
  });

  it("thanh phân bố có mô tả cho trình đọc màn hình", () => {
    expect(render(stats())).toContain('aria-label="Mới 20, Đang học 38, Nhớ lâu 28"');
  });

  it("nút ôn: số thẻ = đến hạn + thẻ mới còn được ôn hôm nay, tối đa 20 mỗi phiên", () => {
    const out = render(stats({ dueToday: 5, newAvailable: 3 }));
    expect(text(out)).toContain("Ôn 8 thẻ");
    expect(out).toContain('href="/learn/tieng-trung/flashcards"');
    expect(text(render(stats({ dueToday: 30, newAvailable: 10 })))).toContain("Ôn 20 thẻ");
  });

  it("hết việc hôm nay: không có nút ôn, có lời nhắn", () => {
    const out = render(stats({ dueToday: 0, newAvailable: 0 }));
    expect(out).not.toContain("/flashcards");
    expect(text(out)).toContain("hôm nay");
  });

  it("khoá không có từ vựng: không dựng khối nào", () => {
    expect(render(stats({ total: 0, learned: 0, dueToday: 0, newAvailable: 0, struggling: 0, distribution: { new: 0, learning: 0, mature: 0 } }))).toBe("");
  });
});

describe("LanguageProfileView — nối thống kê flashcard vào hồ sơ", () => {
  const profile: LanguageProfile = {
    enabled: true,
    skills: [
      { skill: "listening", label: "needs_review", lessonsTotal: 4, lessonsPracticed: 2 },
      { skill: "speaking", label: "no_data", lessonsTotal: 0, lessonsPracticed: 0 },
      { skill: "reading", label: "solid", lessonsTotal: 5, lessonsPracticed: 5 },
      { skill: "writing", label: "practice_more", lessonsTotal: 3, lessonsPracticed: 1 },
    ],
    suggestion: { skill: "listening", lessonId: "l1", lessonTitle: "Hội thoại bài 5", reason: "review" },
  };
  const render = (p: LanguageProfile, flashcards?: FlashcardStats) =>
    renderToStaticMarkup(<LanguageProfileView slug="tieng-trung" profile={p} flashcards={flashcards} />);

  it("có khối Từ vựng khi khoá có thẻ", () => {
    const t = text(render(profile, stats()));
    expect(t).toContain("Từ vựng");
    expect(t).toContain("Đã học");
  });

  it("'Luyện hôm nay' gom cả bài gợi ý và thẻ đến hạn", () => {
    const out = render(profile, stats({ dueToday: 5, newAvailable: 3 }));
    expect(text(out)).toContain("Hội thoại bài 5");
    expect(text(out)).toContain("Ôn 8 thẻ");
    expect(out).toContain('href="/learn/tieng-trung/flashcards"');
  });

  it("không có bài gợi ý nhưng có thẻ cần ôn: vẫn có 'Luyện hôm nay'", () => {
    const out = render({ ...profile, suggestion: null }, stats({ dueToday: 5, newAvailable: 0 }));
    expect(text(out)).toContain("Luyện hôm nay");
    expect(text(out)).toContain("Ôn 5 thẻ");
  });

  it("không có thống kê flashcard (hoặc khoá không có từ vựng) thì hồ sơ y như trước, không có khối Từ vựng", () => {
    expect(text(render(profile))).not.toContain("Từ vựng");
    const empty = stats({ total: 0, learned: 0, dueToday: 0, newAvailable: 0, struggling: 0, distribution: { new: 0, learning: 0, mature: 0 } });
    expect(text(render(profile, empty))).not.toContain("Từ vựng");
  });
});
