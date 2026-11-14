// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeEmbed } from "@feedbackme/core-lms";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: () => undefined }) }));

import LessonPractice from "./LessonPractice";

const mcqConfig = { options: [{ id: "a", label: "Đáp án A" }, { id: "b", label: "Đáp án B" }] };
const checkConfig = { explanation: "Vì A đúng.", options: [{ id: "a", label: "Đáp án A", isCorrect: true }, { id: "b", label: "Đáp án B", isCorrect: false }] };

const embed = (o: Partial<PracticeEmbed> = {}): PracticeEmbed => ({
  examId: "ex1",
  title: "Đề đọc hiểu",
  sessionId: null,
  checkEnabled: true,
  timed: false,
  questions: [
    { id: "q1", type: "mcq", prompt: "Câu hỏi một?", points: 1, passageId: "p1", sectionTitle: "Đọc", languageSkill: "reading", config: mcqConfig },
    { id: "q2", type: "mcq", prompt: "Câu hỏi hai?", points: 1, passageId: "p1", sectionTitle: "Đọc", languageSkill: "reading", config: mcqConfig },
  ],
  passages: [{ id: "p1", title: "Endangered Species", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Đoạn văn mẫu." }] }] } }],
  answers: [],
  ...o,
});

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let handlers: Record<string, (c: Call) => { status?: number; json?: unknown; wait?: Promise<unknown> }>;
let host: HTMLDivElement;
let root: Root;

function mockFetch() {
  calls = [];
  handlers = {
    "POST /api/exams/ex1/practice": () => ({ status: 201, json: { sessionId: "s1", resumed: false, questionCount: 2 } }),
    "PUT /api/practice-sessions/s1/answers/q1": () => ({ json: { ok: true } }),
    "PUT /api/practice-sessions/s1/answers/q2": () => ({ json: { ok: true } }),
    "POST /api/practice-sessions/s1/check/q1": () => ({ json: { isCorrect: true, score: 1, maxScore: 1, manual: false, config: checkConfig } }),
    "POST /api/practice-sessions/s1/check/q2": () => ({ json: { isCorrect: false, score: 0, maxScore: 1, manual: false, config: checkConfig } }),
    "POST /api/practice-preview/ex1/check/q1": () => ({ json: { isCorrect: true, score: 1, maxScore: 1, manual: false, config: checkConfig } }),
    "POST /api/practice-sessions/s1/complete": () => ({
      json: { sessionId: "s1", examId: "ex1", bySkill: [{ skill: "reading", correct: 1, total: 2, answered: 2, manual: 0 }], wrong: [{ questionId: "q2" }] },
    }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace(/^.*?(\/api\/)/, "/api/");
      const method = init?.method ?? "GET";
      // Tải lên giọng nói gửi FormData (không phải JSON): ghi lại tên và loại của tệp.
      const raw = init?.body;
      const body = raw instanceof FormData ? { file: { name: (raw.get("file") as File).name, type: (raw.get("file") as File).type } } : raw ? JSON.parse(String(raw)) : undefined;
      const c: Call = { url: path, method, body };
      calls.push(c);
      const h = handlers[`${method} ${path}`];
      if (!h) return new Response(JSON.stringify({ error: "not_mocked" }), { status: 500 });
      const r = h(c);
      if (r.wait) await r.wait;
      return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 });
    }),
  );
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function render(e: PracticeEmbed = embed(), preview = false) {
  await act(async () => {
    root.render(<LessonPractice slug="ielts" embed={e} preview={preview} />);
  });
  await flush();
}

const text = () => host.textContent?.replace(/\s+/g, " ") ?? "";
const radios = () => [...host.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')];
const button = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? ""))!;
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch();
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LessonPractice — bài luyện nhúng trong bài", () => {
  it("lúc mở: tên, tiến độ, đoạn văn, bố cục chia đôi mặc định, nút Kiểm tra khoá, CHƯA gọi máy chủ", async () => {
    await render();
    expect(text()).toContain("Đề đọc hiểu");
    expect(text()).toContain("0 đã kiểm tra · 0 đã chọn · 2 chưa trả lời");
    expect(text()).toContain("Đoạn văn mẫu.");
    expect(host.querySelector('[data-testid="lp-passage"]')).not.toBeNull();
    expect(host.querySelector(".lg\\:grid-cols-\\[1\\.1fr_1fr\\]")).not.toBeNull();
    expect((button(/Kiểm tra câu 1/) as HTMLButtonElement).disabled).toBe(true);
    expect(calls).toHaveLength(0);
    expect(text()).toContain("bài luyện bắt đầu khi bạn chọn đáp án đầu tiên");
  });

  it("chọn đáp án đầu tiên: tạo buổi luyện đúng một lần rồi lưu đáp án; chọn tiếp câu khác không tạo thêm buổi", async () => {
    await render();
    await click(radios()[0]!);
    await flush(600);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/exams/ex1/practice", "PUT /api/practice-sessions/s1/answers/q1"]);
    expect(calls[0]!.body).toEqual({ all: true });
    expect(calls[1]!.body).toEqual({ answerJson: { optionIds: ["a"] } });
    expect(text()).toContain("0 đã kiểm tra · 1 đã chọn · 1 chưa trả lời");
    await click(radios()[2]!);
    await flush(600);
    expect(calls.filter((c) => c.method === "POST" && c.url === "/api/exams/ex1/practice")).toHaveLength(1);
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: "/api/practice-sessions/s1/answers/q2" });
  });

  it("Kiểm tra câu n: hiện Chính xác kèm giải thích; câu sai hiện Chưa chính xác và mở sẵn đáp án", async () => {
    await render();
    await click(radios()[0]!);
    await flush(600);
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(text()).toContain("Chính xác");
    expect(text()).toContain("Vì A đúng.");
    expect(text()).toContain("1 đã kiểm tra · 0 đã chọn · 1 chưa trả lời");
    await click(radios()[3]!); // câu 2 chọn B
    await flush(600);
    await click(button(/Kiểm tra câu 2/));
    await flush();
    expect(text()).toContain("Chưa chính xác");
    const answers = host.querySelectorAll('[data-testid="lp-answer"]');
    expect(answers).toHaveLength(2);
    expect(answers[0]!.hasAttribute("open")).toBe(false);
    expect(answers[1]!.hasAttribute("open")).toBe(true);
  });

  it("kiểm tra một câu xong thì làm mới dữ liệu máy chủ (để 'Bài luyện n / m' đầu trang và việc tự hoàn thành bài cập nhật); xem thử thì không", async () => {
    refresh.mockClear();
    await render();
    await click(radios()[0]!);
    await flush(600);
    expect(refresh).not.toHaveBeenCalled(); // chọn đáp án chưa tính là kiểm tra
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    root = createRoot(host);
    refresh.mockClear();
    await render(embed(), true);
    await click(radios()[0]!);
    await flush(600);
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sửa đáp án sau khi kiểm tra thì kết quả cũ biến mất và phải kiểm tra lại", async () => {
    await render();
    await click(radios()[0]!);
    await flush(600);
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(text()).toContain("Chính xác");
    await click(radios()[1]!);
    await flush(600);
    expect(text()).not.toContain("Chính xác");
    expect(text()).toContain("Bạn có thể đổi đáp án trước khi kiểm tra.");
  });

  it("mất mạng khi lưu: báo lỗi, giữ đáp án đang chọn", async () => {
    await render();
    handlers["POST /api/exams/ex1/practice"] = () => ({ status: 500, json: { error: "x" } });
    await click(radios()[0]!);
    await flush(600);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Chưa lưu được");
    expect(radios()[0]!.checked).toBe(true);
  });

  it("kết thúc: hỏi khi còn câu bỏ trống, rồi hiện tóm tắt theo kỹ năng và nút Luyện lại", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await render();
    await click(radios()[0]!);
    await flush(600);
    await click(button(/Kết thúc bài luyện/));
    await flush();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Còn 1 câu chưa trả lời"));
    expect(text()).toContain("Kết quả bài luyện");
    expect(text()).toContain("Đọc");
    expect(text()).toContain("1 / 2 câu đúng");
    expect(host.querySelector('a[href="/learn/ielts/exams/ex1/practice/s1/result"]')).not.toBeNull();
    // Luyện lại: quay về câu hỏi, lần chọn kế tiếp tạo buổi MỚI
    await click(button(/Luyện lại/));
    await flush();
    expect(text()).toContain("0 đã kiểm tra · 0 đã chọn · 2 chưa trả lời");
    handlers["POST /api/exams/ex1/practice"] = () => ({ status: 201, json: { sessionId: "s1", resumed: false, questionCount: 2 } });
    const before = calls.filter((c) => c.url === "/api/exams/ex1/practice").length;
    await click(radios()[0]!);
    await flush(600);
    expect(calls.filter((c) => c.url === "/api/exams/ex1/practice").length).toBe(before + 1);
    confirm.mockRestore();
  });

  it("đổi bố cục sang Một cột và nhớ lựa chọn; lưu trữ bị chặn cũng không vỡ", async () => {
    await render();
    await click(button(/Một cột/));
    expect(host.querySelector(".lg\\:grid-cols-\\[1\\.1fr_1fr\\]")).toBeNull();
    expect(window.localStorage.getItem("limio:practice-layout")).toBe("single");
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    expect(host.querySelector(".lg\\:grid-cols-\\[1\\.1fr_1fr\\]")).toBeNull();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await click(button(/Chia đôi/));
    expect(host.querySelector(".lg\\:grid-cols-\\[1\\.1fr_1fr\\]")).not.toBeNull();
    spy.mockRestore();
  });

  it("không có đoạn văn: không có nút bố cục và các câu xếp một cột", async () => {
    await render(embed({ passages: [], questions: embed().questions.map((q) => ({ ...q, passageId: null })) }));
    expect(text()).not.toContain("Chia đôi");
    expect(host.querySelector('[data-testid="lp-passage"]')).toBeNull();
  });

  it("không có thanh chuyển bước: đổi bước bằng bản đồ câu hỏi (bấm số câu ở bước khác thì sang bước đó)", async () => {
    const two = embed({
      questions: [
        ...embed().questions,
        { id: "q3", type: "mcq", prompt: "Câu hỏi ba?", points: 1, passageId: "p2", sectionTitle: "Đọc", languageSkill: "reading", config: mcqConfig },
      ],
      passages: [...embed().passages, { id: "p2", title: "Đoạn hai", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Đoạn hai." }] }] } }],
    });
    await render(two);
    for (const t of ["Bước trước", "Bước sau", "Quay lại", "Tiếp →", "Bước 1 /"]) expect(text()).not.toContain(t);
    expect(text()).toContain("Câu hỏi một?");
    expect(text()).not.toContain("Câu hỏi ba?");
    const q3 = host.querySelector('button[aria-label^="Câu 3"]') as HTMLButtonElement;
    await act(async () => q3.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(text()).toContain("Câu hỏi ba?");
  });

  it("mở lại bài có câu đã kiểm tra: nạp lại kết quả từ máy chủ, không tạo buổi mới", async () => {
    const e = embed({ sessionId: "s1", answers: [{ questionId: "q1", answerJson: { optionIds: ["a"] }, checked: true, isCorrect: true, hasAudio: false, aiFeedback: null }] });
    await render(e);
    await flush();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/practice-sessions/s1/check/q1"]);
    expect(text()).toContain("Chính xác");
    expect(text()).toContain("1 đã kiểm tra");
  });

  it("đợt 4: khi có lessonId, mỗi lần kiểm tra (kể cả nạp lại kết quả) gửi kèm { lessonId }; không có thì không gửi thân", async () => {
    await act(async () => {
      root.render(<LessonPractice slug="ielts" embed={embed()} lessonId="les1" />);
    });
    await flush();
    await click(radios()[0]!);
    await flush(600);
    await click(button(/Kiểm tra câu 1/));
    await flush();
    const checkCall = calls.find((c) => c.url.includes("/check/q1"))!;
    expect(checkCall.body).toEqual({ lessonId: "les1" });
    act(() => root.unmount());
    root = createRoot(host);
    calls.length = 0;
    await render();
    await click(radios()[0]!);
    await flush(600);
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(calls.find((c) => c.url.includes("/check/q1"))!.body).toBeUndefined();
  });

  it("đề tắt kiểm tra từng câu thì không có nút Kiểm tra", async () => {
    await render(embed({ checkEnabled: false }));
    expect(host.textContent).not.toContain("Kiểm tra câu 1");
  });

  it("không lộ đáp án đúng trước khi kiểm tra (HTML ban đầu không có isCorrect hay giải thích)", async () => {
    await render();
    expect(host.innerHTML).not.toContain("Vì A đúng");
    expect(host.innerHTML).not.toContain("isCorrect");
  });
  it("xem trước của giảng viên: không tạo buổi, không lưu đáp án, chấm qua API xem trước, không có nút kết thúc", async () => {
    await render(embed(), true);
    await click(radios()[0]!);
    await flush(600);
    expect(calls).toHaveLength(0); // chọn đáp án không gọi máy chủ
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/practice-preview/ex1/check/q1"]);
    expect(calls[0]!.body).toEqual({ answerJson: { optionIds: ["a"] } });
    expect(text()).toContain("Chính xác");
    expect(text()).toContain("Vì A đúng.");
    expect(text()).toContain("Xem trước: không lưu đáp án");
    expect(button(/Kết thúc bài luyện/)).toBeUndefined();
  });
});

// ─── Câu mở: giọng nói, góp ý AI, bài mẫu ────────────────────────────────────

const essayQuestion = (config: Record<string, unknown> = {}) => ({
  id: "e1",
  type: "essay",
  prompt: "What 'firsts' and 'seconds' did you learn about?",
  points: 5,
  passageId: null,
  sectionTitle: "Speaking",
  languageSkill: "speaking",
  config: { minWords: 10, voiceAnswer: true, aiFeedback: true, ...config },
});
const essayEmbed = (o: Partial<PracticeEmbed> = {}, config: Record<string, unknown> = {}) =>
  embed({ passages: [], questions: [essayQuestion(config)], ...o });

const SAMPLE = { explanation: "The first man on the moon was Neil Armstrong.\nThe second was Buzz Aldrin.", explanationAudio: "/api/exam-assets/s-1.m4a" };
const FEEDBACK = {
  summary: "A clear answer with good ideas.",
  criteria: [
    { key: "task", level: "good", comment: "You answered the question." },
    { key: "content", level: "fair", comment: "Mention the second person too." },
    { key: "language", level: "needs_work", comment: "Watch the past tense." },
  ],
  errors: [{ category: "grammar", quote: "I go to Hanoi", correction: "I went to Hanoi", explanation: "Use the past simple." }],
  nextSteps: ["Retell it with two dates."],
  viaVoice: false,
  generatedAt: "2026-11-11T00:00:00.000Z",
};
const manualCheck = (extra: Record<string, unknown> = {}, config: Record<string, unknown> = SAMPLE) => ({
  json: { isCorrect: null, score: null, maxScore: 5, manual: true, config: { minWords: 10, ...config }, ...extra },
});

const textarea = () => host.querySelector("textarea") as HTMLTextAreaElement;
async function typeInto(el: HTMLTextAreaElement, v: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function answerEssay(v = "I go to Hanoi and I saw many things.") {
  await typeInto(textarea(), v);
  await flush(600);
}

describe("LessonPractice — câu mở (essay)", () => {
  beforeEach(() => {
    handlers["PUT /api/practice-sessions/s1/answers/e1"] = () => ({ json: { ok: true } });
  });

  it("câu mở có nút giọng nói dưới ô gõ; chưa có bản ghi thì không có trình phát; chưa gọi máy chủ", async () => {
    await render(essayEmbed());
    expect(button(/Trả lời bằng giọng nói/)).toBeDefined();
    // Nằm DƯỚI ô gõ
    expect(textarea().compareDocumentPosition(button(/Trả lời bằng giọng nói/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.querySelector('[data-testid="lp-voice-player"]')).toBeNull();
    expect(text()).toContain("Khi bấm Kiểm tra, câu trả lời của bạn được gửi tới AI để nhận xét.");
    expect(calls).toHaveLength(0);
  });

  it("voiceAnswer = false: không có nút giọng nói; aiFeedback = false: không nói gửi tới AI", async () => {
    await render(essayEmbed({}, { voiceAnswer: false, aiFeedback: false }));
    expect(button(/Trả lời bằng giọng nói/)).toBeUndefined();
    expect(text()).not.toContain("gửi tới AI");
    expect(text()).toContain("Bạn có thể đổi đáp án trước khi kiểm tra.");
  });

  it("xem thử của giảng viên: nút dùng được và ghi rõ không lưu bản ghi; chưa ghi thì chưa gọi máy chủ", async () => {
    await render(essayEmbed(), true);
    const b = button(/Trả lời bằng giọng nói/) as HTMLButtonElement;
    expect(b.disabled).toBe(false);
    expect(text()).toContain("Xem thử: ghi âm và chuyển thành chữ được, nhưng không lưu bản ghi.");
    expect(calls).toHaveLength(0);
  });

  it("sau Kiểm tra: khối Góp ý (nhãn AI, tiêu chí + mức, lỗi, bước tiếp) rồi khối Bài mẫu có audio, đều DƯỚI ô trả lời; không còn dòng cảnh báo vàng", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({ feedback: FEEDBACK, feedbackReused: false });
    await render(essayEmbed());
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    await flush();
    const fb = host.querySelector('[data-testid="lp-feedback"]')!;
    expect(fb).not.toBeNull();
    expect(fb.textContent).toContain("Góp ý do AI tạo, có thể sai. Hãy đối chiếu với bài mẫu.");
    expect(fb.textContent).toContain("A clear answer with good ideas.");
    expect(host.querySelector('[data-testid="lp-criterion-task"]')!.textContent).toMatch(/Task\s*Good/);
    expect(host.querySelector('[data-testid="lp-criterion-content"]')!.textContent).toMatch(/Content\s*Fair/);
    expect(host.querySelector('[data-testid="lp-criterion-language"]')!.textContent).toMatch(/Language\s*Needs work/);
    expect(host.querySelector('[data-testid="lp-criterion-fluency"]')).toBeNull(); // không có tiêu chí Lưu loát khi trả lời bằng chữ
    expect(fb.textContent).toContain("I go to Hanoi");
    expect(fb.textContent).toContain("I went to Hanoi");
    expect(fb.textContent).toContain("Use the past simple.");
    expect(fb.textContent).toContain("Retell it with two dates.");
    expect(fb.textContent).not.toMatch(/\d+\s*\/\s*\d+|điểm/i); // không có số điểm
    const sample = host.querySelector('[data-testid="lp-sample"]')!;
    expect(sample.textContent).toContain("Sample answer");
    expect(sample.textContent).toContain("The first man on the moon was Neil Armstrong.");
    expect(sample.textContent).toContain("Hãy tự đối chiếu");
    expect(sample.querySelector("p.whitespace-pre-wrap")!.textContent).toContain("\nThe second was Buzz Aldrin."); // giữ xuống dòng
    expect(sample.querySelector("audio")!.getAttribute("src")).toBe("/api/exam-assets/s-1.m4a");
    // Thứ tự: ô trả lời → góp ý → bài mẫu
    expect(textarea().compareDocumentPosition(fb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fb.compareDocumentPosition(sample) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text()).not.toContain("không kiểm tra tự động được");
    expect(host.innerHTML).not.toContain("border-amber-300 bg-amber-50 p-3"); // dòng cảnh báo vàng cũ
    // Câu trả lời của học viên không bị mất
    expect(textarea().value).toContain("I go to Hanoi");
  });

  it("trong lúc chờ AI: nút hiện 'Đang nhận xét…' và khoá; xong thì trở lại", async () => {
    let release!: () => void;
    const wait = new Promise<void>((r) => (release = r));
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => ({ ...manualCheck({ feedback: FEEDBACK }), wait });
    await render(essayEmbed());
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    const busy = button(/Đang nhận xét/) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    await act(async () => release());
    await flush();
    expect(button(/Đang nhận xét/)).toBeUndefined();
    expect(host.querySelector('[data-testid="lp-feedback"]')).not.toBeNull();
  });

  it("AI không nhận xét được (hết hạn mức, chưa cấu hình, lỗi): lời nhắn nhẹ, KHÔNG có khối Góp ý dở, vẫn hiện bài mẫu", async () => {
    for (const [code, snippet] of [
      ["quota", "Hạn mức AI đã hết"],
      ["not_configured", "chưa bật nhận xét tự động"],
      ["failed", "Chưa nhận xét được lúc này"],
    ] as const) {
      handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({ feedbackError: code });
      act(() => root.unmount());
      root = createRoot(host);
      calls.length = 0;
      await render(essayEmbed());
      await answerEssay();
      await click(button(/Kiểm tra câu 1/));
      await flush();
      expect(host.querySelector('[data-testid="lp-feedback"]')).toBeNull();
      expect(host.querySelector('[data-testid="lp-feedback-note"]')!.textContent).toContain(snippet);
      expect(host.querySelector('[data-testid="lp-feedback-note"]')!.textContent).toContain("bài mẫu");
      expect(host.querySelector('[data-testid="lp-sample"]')!.textContent).toContain("Neil Armstrong");
    }
  });

  it("nhóm đối chứng (control_group): không nói gì về góp ý, chỉ có bài mẫu", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({ feedbackError: "control_group" });
    await render(essayEmbed());
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(host.querySelector('[data-testid="lp-feedback-note"]')).toBeNull();
    expect(host.querySelector('[data-testid="lp-sample"]')).not.toBeNull();
  });

  it("không có bài mẫu và không có góp ý: chỉ dòng nhắc như cũ, không khối Bài mẫu trống", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({}, {});
    await render(essayEmbed({}, { aiFeedback: false }));
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(host.querySelector('[data-testid="lp-sample"]')).toBeNull();
    expect(host.querySelector('[data-testid="lp-feedback"]')).toBeNull();
    expect(text()).toContain("Câu tự luận không kiểm tra tự động được. Hãy nhờ giảng viên góp ý.");
  });

  it("có bài mẫu nhưng không có audio: không vẽ trình phát", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({}, { explanation: "Just text." });
    await render(essayEmbed({}, { aiFeedback: false }));
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(host.querySelector('[data-testid="lp-sample"]')!.textContent).toContain("Just text.");
    expect(host.querySelector('[data-testid="lp-sample"] audio')).toBeNull();
  });

  it("audio mẫu trỏ ra ngoài kho đề không bao giờ được phát", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({}, { explanation: "Text.", explanationAudio: "https://evil.example/x.mp3" });
    await render(essayEmbed({}, { aiFeedback: false }));
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(host.querySelector("audio")).toBeNull();
  });

  it("xem thử: Kiểm tra vẫn hiện bài mẫu và ghi 'không nhận xét bằng AI', đi qua API xem thử", async () => {
    handlers["POST /api/practice-preview/ex1/check/e1"] = () => manualCheck();
    await render(essayEmbed(), true);
    await typeInto(textarea(), "I go to Hanoi.");
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/practice-preview/ex1/check/e1"]);
    expect(host.querySelector('[data-testid="lp-feedback"]')).toBeNull();
    expect(text()).toContain("Xem thử: không nhận xét bằng AI.");
    expect(host.querySelector('[data-testid="lp-sample"]')!.textContent).toContain("Neil Armstrong");
  });

  it("sửa câu trả lời sau khi kiểm tra: góp ý và bài mẫu cũ biến mất", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({ feedback: FEEDBACK });
    await render(essayEmbed());
    await answerEssay();
    await click(button(/Kiểm tra câu 1/));
    await flush();
    expect(host.querySelector('[data-testid="lp-feedback"]')).not.toBeNull();
    await typeInto(textarea(), "I went to Hanoi last year.");
    await flush(600);
    expect(host.querySelector('[data-testid="lp-feedback"]')).toBeNull();
    expect(host.querySelector('[data-testid="lp-sample"]')).toBeNull();
  });

  it("mở lại bài: có bản ghi thì hiện trình phát 'Bản ghi của bạn' và nhãn bản chữ; góp ý đã lưu hiện lại mà KHÔNG gọi AI (restore)", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck();
    const e = essayEmbed({
      sessionId: "s1",
      answers: [{ questionId: "e1", answerJson: { text: "I went to Hanoi.", viaVoice: true }, checked: true, isCorrect: null, hasAudio: true, aiFeedback: { ...FEEDBACK, criteria: [...FEEDBACK.criteria, { key: "fluency", level: "good", comment: "Steady pace." }], viaVoice: true } }],
    });
    await render(e);
    await flush();
    const audio = host.querySelector('[data-testid="lp-voice-player"] audio')!;
    expect(audio.getAttribute("src")).toBe("/api/practice-sessions/s1/audio/e1?v=1");
    expect(text()).toContain("Bản ghi của bạn");
    expect(text()).toContain("Bản chữ từ giọng nói, máy có thể nghe sai: hãy đọc lại và sửa.");
    // nạp lại kết quả chỉ để lấy bài mẫu; báo máy chủ không tự sinh góp ý
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ restore: true });
    expect(host.querySelector('[data-testid="lp-feedback"]')!.textContent).toContain("A clear answer with good ideas.");
    expect(host.querySelector('[data-testid="lp-criterion-fluency"]')!.textContent).toMatch(/Fluency\s*Good/);
    expect(host.querySelector('[data-testid="lp-sample"]')!.textContent).toContain("Neil Armstrong");
  });

  it("khôi phục góp ý hỏng (sai dạng) không làm vỡ giao diện", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck();
    await render(essayEmbed({ sessionId: "s1", answers: [{ questionId: "e1", answerJson: { text: "abc def" }, checked: true, isCorrect: null, hasAudio: false, aiFeedback: { criteria: "x", errors: [1, null] } }] }));
    await flush();
    expect(host.querySelector('[data-testid="lp-feedback"]')).toBeNull();
    expect(host.querySelector('[data-testid="lp-sample"]')).not.toBeNull();
  });
});

describe("LessonPractice — trả lời câu mở bằng giọng nói", () => {
  let recorderMime: string;
  beforeEach(() => {
    recorderMime = "audio/webm";
    class FakeRecorder {
      static isTypeSupported = () => true;
      state: "inactive" | "recording" = "inactive";
      mimeType = recorderMime;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["abc"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: () => undefined }] })) } });
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => undefined;
    handlers["PUT /api/practice-sessions/s1/answers/e1"] = () => ({ json: { ok: true } });
    handlers["POST /api/practice-sessions/s1/voice/e1"] = () => ({ json: { text: "I went to Hanoi last year.", durationSec: 8.2 } });
  });

  async function record() {
    await click(button(/Trả lời bằng giọng nói/)); // bấm là ghi luôn
    await flush();
    await click(button(/Dừng/));
    await flush();
  }

  it("ghi âm → Chỉ lấy bản chữ: tạo buổi, gửi tệp, điền ô trả lời, hiện nhãn bản chữ và trình phát; lần sau không nhắc OpenAI nữa", async () => {
    await render(essayEmbed());
    await click(button(/Trả lời bằng giọng nói/));
    await flush();
    expect(text()).toContain("Bản ghi âm sẽ được gửi tới OpenAI để chuyển thành chữ.");
    expect(button(/Trả lời bằng giọng nói/)).toBeUndefined(); // không còn nút thứ hai nối tiếp
    expect(button(/^\s*Ghi âm/)).toBeUndefined(); // đã ghi rồi, chỉ còn Dừng
    expect(button(/Dừng/)).toBeDefined();
    expect(button(/Chỉ lấy bản chữ/)).toBeUndefined(); // chưa ghi xong thì chưa có nút
    expect(calls).toHaveLength(0); // không tự gửi gì khi chưa bấm
    await click(button(/Dừng/));
    await flush();
    expect(button(/Ghi lại/)).toBeDefined();
    await click(button(/Chỉ lấy bản chữ/));
    await flush();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/exams/ex1/practice", "POST /api/practice-sessions/s1/voice/e1"]);
    expect(calls[1]!.body).toEqual({ file: { name: "ghi-am.webm", type: "audio/webm" } });
    expect(textarea().value).toBe("I went to Hanoi last year.");
    expect(text()).toContain("Bản chữ từ giọng nói, máy có thể nghe sai: hãy đọc lại và sửa.");
    expect(host.querySelector('[data-testid="lp-voice-player"] audio')!.getAttribute("src")).toBe("/api/practice-sessions/s1/audio/e1?v=1");
    expect(host.querySelector('[data-testid="lp-voice-panel"]')).toBeNull(); // ngăn ghi âm đóng lại
    // Lần dùng sau: không nhắc nữa
    await click(button(/Trả lời bằng giọng nói/));
    expect(text()).not.toContain("gửi tới OpenAI");
  });

  it("sửa chữ sau khi nói vẫn GIỮ viaVoice (còn bản ghi) khi lưu; gõ trước khi nói thì không có viaVoice", async () => {
    await render(essayEmbed());
    await typeInto(textarea(), "typed first");
    await flush(600);
    expect(calls.at(-1)!.body).toEqual({ answerJson: { text: "typed first" } });
    expect(text()).not.toContain("Bản chữ từ giọng nói");
    await record();
    expect(text()).toContain("Bản chữ từ giọng nói sẽ thay phần bạn đã gõ.");
    await click(button(/Chỉ lấy bản chữ/));
    await flush();
    await typeInto(textarea(), "I went to Hanoi last year and it was great.");
    await flush(600);
    expect(calls.at(-1)).toMatchObject({ method: "PUT", url: "/api/practice-sessions/s1/answers/e1", body: { answerJson: { text: "I went to Hanoi last year and it was great.", viaVoice: true } } });
  });

  it("chữ gõ dở chưa kịp lưu không ghi đè bản chữ vừa nhận từ giọng nói", async () => {
    await render(essayEmbed());
    await record();
    await typeInto(textarea(), "half typed"); // hẹn lưu sau 500 ms
    await click(button(/Chỉ lấy bản chữ/));
    await flush(1000);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
    expect(textarea().value).toBe("I went to Hanoi last year.");
  });

  it("Safari ghi mp4: gửi đúng loại tệp", async () => {
    recorderMime = "audio/mp4";
    await render(essayEmbed());
    await record();
    await click(button(/Chỉ lấy bản chữ/));
    await flush();
    expect(calls.find((c) => c.url.endsWith("/voice/e1"))!.body).toEqual({ file: { name: "ghi-am.m4a", type: "audio/mp4" } });
  });

  it("lỗi từ máy chủ: lời nhắn tiếng Việt rõ, ô gõ không đổi và vẫn gõ được", async () => {
    await render(essayEmbed());
    await typeInto(textarea(), "my own words");
    await flush(600);
    const cases: Array<[number, string, string]> = [
      [429, "daily_token_cap", "Hạn mức AI đã hết"],
      [503, "openai_not_configured", "chưa bật chuyển giọng nói thành chữ"],
      [422, "no_speech", "Không nghe thấy tiếng nói"],
      [422, "audio_too_long", "quá dài"],
      [413, "file_too_large", "quá dài"],
    ];
    await record();
    for (const [status, error, snippet] of cases) {
      handlers["POST /api/practice-sessions/s1/voice/e1"] = () => ({ status, json: { error } });
      await click(button(/Chỉ lấy bản chữ/));
      await flush();
      expect(host.querySelector('[data-testid="lp-voice-error"]')!.textContent).toContain(snippet);
      expect(textarea().value).toBe("my own words");
      expect(host.querySelector('[data-testid="lp-voice-player"]')).toBeNull();
    }
    await typeInto(textarea(), "my own words, edited");
    await flush(600);
    expect(calls.at(-1)).toMatchObject({ method: "PUT", body: { answerJson: { text: "my own words, edited" } } });
  });

  it("từ chối micro: lời nhắn rõ, ô gõ vẫn dùng được, chưa gọi máy chủ", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }))) },
    });
    await render(essayEmbed());
    await click(button(/Trả lời bằng giọng nói/));
    await flush();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("Chưa có quyền micro");
    await typeInto(textarea(), "typed answer");
    expect(textarea().value).toBe("typed answer");
    expect(calls.filter((c) => c.url.includes("/voice/"))).toHaveLength(0);
  });

  it("mất mạng khi gửi bản ghi: báo lỗi chung, không mất bản ghi để thử lại", async () => {
    await render(essayEmbed());
    await record();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await click(button(/Chỉ lấy bản chữ/));
    await flush();
    expect(host.querySelector('[data-testid="lp-voice-error"]')!.textContent).toContain("Chưa dùng được bản ghi này");
    expect(button(/Chỉ lấy bản chữ/)).toBeDefined();
  });
  it("câu có góp ý AI: nút chính là \"Nhận xét bằng AI\", lấy bản chữ rồi kiểm tra luôn và hiện góp ý, không cần bấm Kiểm tra", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => manualCheck({ feedback: FEEDBACK });
    await render(essayEmbed());
    await record();
    expect(button(/^\s*Chuyển thành chữ/)).toBeUndefined();
    await click(button(/Nhận xét bằng AI/));
    await flush();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/exams/ex1/practice",
      "POST /api/practice-sessions/s1/voice/e1",
      "PUT /api/practice-sessions/s1/answers/e1",
      "POST /api/practice-sessions/s1/check/e1",
    ]);
    expect(calls[2]!.body).toEqual({ answerJson: { text: "I went to Hanoi last year.", viaVoice: true } });
    expect(textarea().value).toBe("I went to Hanoi last year.");
    expect(host.querySelector('[data-testid="lp-feedback"]')!.textContent).toContain("A clear answer with good ideas.");
    expect(host.querySelector('[data-testid="lp-voice-panel"]')).toBeNull();
  });

  it("câu tắt góp ý AI: nút chính vẫn là \"Chuyển thành chữ\", không tự kiểm tra, không có lối \"Chỉ lấy bản chữ\"", async () => {
    await render(essayEmbed({}, { aiFeedback: false }));
    await record();
    expect(button(/Nhận xét bằng AI/)).toBeUndefined();
    expect(button(/Chỉ lấy bản chữ/)).toBeUndefined();
    await click(button(/^\s*Chuyển thành chữ/));
    await flush();
    expect(calls.some((c) => c.url.includes("/check/"))).toBe(false);
    expect(textarea().value).toBe("I went to Hanoi last year.");
  });

  it("nhận xét lỗi sau khi đã có bản chữ: bản chữ vẫn nằm trong ô, học viên bấm Kiểm tra lại được", async () => {
    handlers["POST /api/practice-sessions/s1/check/e1"] = () => ({ status: 500, json: { error: "boom" } });
    await render(essayEmbed());
    await record();
    await click(button(/Nhận xét bằng AI/));
    await flush();
    expect(textarea().value).toBe("I went to Hanoi last year.");
    expect(button(/Kiểm tra câu 1/)).toBeDefined();
    expect(host.querySelector('[data-testid="lp-feedback"]')).toBeNull();
  });
  it("xem thử của giảng viên: ghi âm → chuyển chữ qua lối xem thử, điền ô trả lời, KHÔNG tạo buổi, KHÔNG lưu, KHÔNG có trình phát hay nút nhận xét AI", async () => {
    handlers["POST /api/practice-preview/ex1/voice/e1"] = () => ({ json: { text: "I went to Hanoi last year.", durationSec: 8.2 } });
    await render(essayEmbed(), true);
    await click(button(/Trả lời bằng giọng nói/));
    await flush();
    await click(button(/Dừng/));
    await flush();
    expect(button(/Nhận xét bằng AI/)).toBeUndefined(); // xem thử không có nhận xét AI
    await click(button(/^\s*Chuyển thành chữ/));
    await flush(600);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/practice-preview/ex1/voice/e1"]);
    expect(textarea().value).toBe("I went to Hanoi last year.");
    expect(host.querySelector('[data-testid="lp-voice-player"]')).toBeNull();
    expect(host.querySelector('[data-testid="lp-voice-panel"]')).toBeNull();
  });

  it("xem thử: lỗi từ máy chủ (chưa bật chuyển giọng) hiện lời nhắn, ô gõ không đổi", async () => {
    handlers["POST /api/practice-preview/ex1/voice/e1"] = () => ({ status: 503, json: { error: "openai_not_configured" } });
    await render(essayEmbed(), true);
    await click(button(/Trả lời bằng giọng nói/));
    await flush();
    await click(button(/Dừng/));
    await flush();
    await click(button(/^\s*Chuyển thành chữ/));
    await flush();
    expect(host.querySelector('[data-testid="lp-voice-error"]')!.textContent).toContain("chưa bật chuyển giọng nói thành chữ");
    expect(textarea().value).toBe("");
  });
});
