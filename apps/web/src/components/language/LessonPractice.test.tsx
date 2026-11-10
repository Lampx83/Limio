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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

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
let handlers: Record<string, (c: Call) => { status?: number; json?: unknown }>;
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
      const c: Call = { url: path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(c);
      const h = handlers[`${method} ${path}`];
      if (!h) return new Response(JSON.stringify({ error: "not_mocked" }), { status: 500 });
      const r = h(c);
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
    const e = embed({ sessionId: "s1", answers: [{ questionId: "q1", answerJson: { optionIds: ["a"] }, checked: true, isCorrect: true }] });
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
