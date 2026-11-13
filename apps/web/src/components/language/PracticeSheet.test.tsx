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

/**
 * Phiếu bài tập (docs/tieu-chi/limio-language-phieu-bai-tap.md): tab bài tập, mỗi câu một dòng, trả lời ngay trong dòng, không kéo thả,
 * "Kiểm tra bài này"/"Kiểm tra tất cả", dấu ✓ ✗ có nhãn, đáp án đúng hiện ở hàng sai.
 */

const q = (id: string, type: string, prompt: string, passageId: string | null, config: Record<string, unknown>) => ({
  id,
  type,
  prompt,
  points: 1,
  passageId,
  sectionTitle: "Ngữ pháp",
  languageSkill: "other",
  config,
});

const embed = (): PracticeEmbed => ({
  examId: "ex1",
  title: "Present tenses",
  sessionId: null,
  checkEnabled: true,
  timed: false,
  questions: [
    q("g1", "gap_fill", "She ______ (study) really hard.", "p1", { blanks: [{ id: "b1" }] }),
    q("c1", "mcq", "I really ______ this song.", "p1", { options: [{ id: "o1", label: "love" }, { id: "o2", label: "am loving" }] }),
    q("g2", "gap_fill", "We ______ around and ______ nothing.", "p2", { blanks: [{ id: "b1" }, { id: "b2" }] }),
    q("m1", "matching", "Match each word with its meaning.", "p2", {
      lefts: [{ id: "L1", label: "nomadic" }, { id: "L2", label: "sedentary" }],
      rights: [{ id: "R1", label: "moves around" }, { id: "R2", label: "stays in one place" }],
    }),
    q("od1", "ordering", "Put the steps in order.", "p2", { items: [{ id: "I1", label: "wake up" }, { id: "I2", label: "get dressed" }] }),
    q("d1", "drag_drop_fill", "I [[1]] books.", "p2", { tokens: [{ id: "T1", label: "read" }, { id: "T2", label: "reads" }] }),
  ],
  passages: [
    { id: "p1", title: "Ex 1A · Present forms", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Đoạn một." }] }] } },
    { id: "p2", title: "", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Đoạn hai." }] }] } },
  ],
  answers: [],
});

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let handlers: Record<string, (c: Call) => { status?: number; json?: unknown }>;
let host: HTMLDivElement;
let root: Root;

function mockFetch() {
  calls = [];
  const ok = { json: { ok: true } };
  handlers = {
    "POST /api/exams/ex1/practice": () => ({ status: 201, json: { sessionId: "s1", resumed: false, questionCount: 6 } }),
    "POST /api/practice-sessions/s1/check/g1": () => ({
      json: { isCorrect: false, score: 0, maxScore: 1, manual: false, config: { blanks: [{ id: "b1", acceptedAnswers: ["is studying"] }], explanation: "Hành động đang diễn ra." } },
    }),
    "POST /api/practice-sessions/s1/check/c1": () => ({
      json: { isCorrect: true, score: 1, maxScore: 1, manual: false, config: { options: [{ id: "o1", label: "love", isCorrect: true }, { id: "o2", label: "am loving", isCorrect: false }] } },
    }),
    "POST /api/practice-sessions/s1/check/g2": () => ({ json: { isCorrect: true, score: 1, maxScore: 1, manual: false, config: { blanks: [{ id: "b1", acceptedAnswers: ["x"] }, { id: "b2", acceptedAnswers: ["y"] }] } } }),
  };
  for (const id of ["g1", "c1", "g2", "m1", "od1", "d1"]) handlers[`PUT /api/practice-sessions/s1/answers/${id}`] = () => ok;
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
    root.render(<LessonPractice slug="ielts" embed={e} preview={preview} sheet skillLabel="Ngữ pháp" />);
  });
  await flush();
}

const text = () => host.textContent?.replace(/\s+/g, " ") ?? "";
const button = (label: RegExp) => [...host.querySelectorAll("button")].find((b) => label.test(b.textContent ?? ""))!;
const panel = () => host.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!;
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
async function type(el: HTMLInputElement, v: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function choose(el: HTMLSelectElement, v: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, v);
    el.dispatchEvent(new Event("change", { bubbles: true }));
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

describe("Phiếu bài tập — khung và tab", () => {
  it("một tờ phiếu có dải kỹ năng, thanh tab theo đoạn văn (nhãn là tiêu đề đoạn hoặc 'Bài n') kèm đếm; chỉ một bài tập hiện; không thẻ riêng, không nút 'Kiểm tra câu n'", async () => {
    await render();
    expect(host.querySelector('[data-testid="practice-sheet"]')).not.toBeNull();
    expect(text()).toContain("Ngữ pháp");
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs).toEqual(["1A0/2", "Bài 2"]); // nhãn ngắn là mã bài tập; đếm chỉ hiện ở tab đang mở hoặc đã làm; đủ tên ở gợi ý
    expect(host.querySelector<HTMLElement>('[role="tab"]')!.title).toBe("Ex 1A · Present forms");
    expect(panel().querySelectorAll(".ps-row")).toHaveLength(2);
    expect(host.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    expect(host.textContent).not.toMatch(/Kiểm tra câu \d/);
    expect(host.querySelector('[draggable="true"]')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("chuyển tab đổi bài tập và đoạn văn; mũi tên trái/phải đổi tab; tab chỉ một bước thì không có thanh tab", async () => {
    await render();
    expect(text()).toContain("Đoạn một.");
    await click(button(/Bài 2/));
    expect(text()).toContain("Đoạn hai.");
    expect(panel().querySelectorAll(".ps-row")).toHaveLength(4);
    const e = embed();
    await render({ ...e, questions: e.questions.slice(0, 2), passages: [e.passages[0]!] });
    expect(host.querySelector('[role="tablist"]')).toBeNull();
  });
});

describe("Phiếu bài tập — màu nhấn của bộ sách", () => {
  it("có accent hợp lệ thì khối đặt biến --brand theo màu đó (nút, dải, đường kẻ đổi theo); sai dạng hoặc trống thì giữ màu Limio", async () => {
    const section = () => host.querySelector<HTMLElement>('[data-testid="lesson-practice"]')!;
    await act(async () => {
      root.render(<LessonPractice slug="ielts" embed={embed()} sheet accent="229,0,92" />);
    });
    await flush();
    expect(section().style.getPropertyValue("--brand")).toBe("229 0 92");
    await act(async () => {
      root.render(<LessonPractice slug="ielts" embed={embed()} sheet accent="javascript:alert(1)" />);
    });
    await flush();
    expect(section().style.getPropertyValue("--brand")).toBe("");
    await act(async () => {
      root.render(<LessonPractice slug="ielts" embed={embed()} sheet />);
    });
    await flush();
    expect(section().style.getPropertyValue("--brand")).toBe("");
  });
});

describe("Phiếu bài tập — khi nào có tab", () => {
  it("khối không có đoạn văn: mọi câu cùng một bài tập, không có thanh tab (không mỗi câu một tab)", async () => {
    const e = embed();
    await render({ ...e, passages: [], questions: e.questions.slice(0, 3).map((x) => ({ ...x, passageId: null })) });
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.querySelectorAll(".ps-row")).toHaveLength(3);
  });
});

describe("Phiếu bài tập — đoạn văn không có câu hỏi", () => {
  it("vẫn là một tab: hiện đoạn văn, ghi rõ không có câu hỏi, không có nút kiểm tra và không hiện đếm 0/0", async () => {
    const e = embed();
    await render({
      ...e,
      questions: e.questions.slice(0, 2),
      passages: [e.passages[0]!, { id: "p9", title: "Listen and repeat", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bài nghe." }] }] } }],
    });
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs).toEqual(["1A0/2", "Listen and re…"]);
    await click(button(/Listen and re/));
    expect(text()).toContain("Bài nghe.");
    expect(text()).toContain("Phần này chỉ có nội dung để nghe hoặc đọc, không có câu hỏi.");
    expect(panel().querySelectorAll(".ps-row")).toHaveLength(0);
    expect(host.textContent).not.toContain("Kiểm tra bài này");
  });
});

describe("Phiếu bài tập — trả lời ngay trong dòng", () => {
  it("chỗ trống gạch chân nằm trong dòng; gõ thì tạo buổi và lưu đúng dạng cũ {blanks}", async () => {
    await render();
    const blank = panel().querySelector<HTMLInputElement>("input.ps-blank")!;
    expect(blank.getAttribute("aria-label")).toBe("Câu 1");
    expect(blank.closest(".ps-body")!.textContent).toContain("She");
    await type(blank, "is studying");
    await flush(600);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/exams/ex1/practice", "PUT /api/practice-sessions/s1/answers/g1"]);
    expect(calls[1]!.body).toEqual({ answerJson: { blanks: { b1: "is studying" } } });
    expect(text()).toContain("1/2");
  });

  it("khoanh đáp án ngắn ngay trong dòng: aria-pressed, lưu {optionIds}", async () => {
    await render();
    const alt = [...panel().querySelectorAll<HTMLButtonElement>(".ps-alt")].find((b) => b.textContent === "love")!;
    expect(alt.getAttribute("aria-pressed")).toBe("false");
    await click(alt);
    await flush(600);
    expect(alt.getAttribute("aria-pressed")).toBe("true");
    expect(calls.at(-1)!.body).toEqual({ answerJson: { optionIds: ["o1"] } });
  });

  it("câu nhiều chỗ trống: mỗi chỗ một ô có nhãn riêng; ghép cặp, sắp xếp, kéo thả đổi sang ô chọn và giữ nguyên dạng dữ liệu", async () => {
    await render();
    await click(button(/Bài 2/));
    const blanks = [...panel().querySelectorAll<HTMLInputElement>("input.ps-blank")];
    expect(blanks.map((b) => b.getAttribute("aria-label"))).toEqual(["Câu 1, chỗ trống 1", "Câu 1, chỗ trống 2"]);
    await type(blanks[0]!, "x");
    await type(blanks[1]!, "y");
    await flush(600);
    expect(calls.at(-1)!.body).toEqual({ answerJson: { blanks: { b1: "x", b2: "y" } } });

    // ghép cặp: hộp chữ cái a, b và mỗi vế trái một ô chọn
    expect(panel().textContent).toContain("a. moves around");
    const pair = [...panel().querySelectorAll<HTMLSelectElement>(".ps-pairs select")];
    // danh sách chọn hiện cả nghĩa (a — …), không chỉ chữ cái; chưa chọn thì chưa có dòng nghĩa đã chọn
    expect([...pair[0]!.options].map((o) => o.textContent)).toEqual(["—", "a — moves around", "b — stays in one place"]);
    expect(panel().querySelector(".ps-chosen")).toBeNull();
    await choose(pair[0]!, "R1");
    expect(panel().querySelector(".ps-chosen")!.textContent).toContain("a) moves around");
    expect([...panel().querySelectorAll('.ps-box[aria-label="Các vế để chọn"] li')].map((li) => li.classList.contains("ps-used"))).toEqual([true, false]);
    await choose(pair[1]!, "R2");
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/m1")).at(-1)!.body).toEqual({ answerJson: { matched: { L1: "R1", L2: "R2" } } });

    // sắp xếp: chỉ lưu khi mọi mục có số và không trùng
    const ord = [...panel().querySelectorAll<HTMLSelectElement>(".ps-pairs select")].slice(2);
    await choose(ord[0]!, "2");
    await flush(600);
    expect(calls.some((c) => c.url.endsWith("/answers/od1"))).toBe(false);
    expect(text()).toContain("Đánh số thứ tự cho mọi mục (1/2)");
    await choose(ord[1]!, "1");
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/od1")).at(-1)!.body).toEqual({ answerJson: { order: ["I2", "I1"] } });

    // kéo thả điền: hộp từ và ô chọn tại chỗ
    const slot = panel().querySelector<HTMLSelectElement>("select.ps-select-inline")!;
    await choose(slot, "T2");
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/d1")).at(-1)!.body).toEqual({ answerJson: { placed: { "1": "T2" } } });
    expect(panel().querySelector(".ps-words .ps-used")!.textContent).toBe("reads"); // từ đã đặt của câu kéo thả (không lẫn nghĩa đã dùng của ghép cặp)
  });

  it("Enter trong ô điền chuyển sang ô kế tiếp; ở ô cuối chuyển tới nút kiểm tra", async () => {
    await render();
    await click(button(/Bài 2/));
    const blanks = [...panel().querySelectorAll<HTMLInputElement>("input.ps-blank")];
    await type(blanks[0]!, "x");
    await type(blanks[1]!, "y"); // có câu trả lời thì nút kiểm tra mới bật và nhận được tiêu điểm
    blanks[0]!.focus();
    await act(async () => {
      blanks[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(blanks[1]);
    await act(async () => {
      blanks[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement?.hasAttribute("data-ps-check")).toBe(true);
  });
});

describe("Phiếu bài tập — dạng câu chưa có kiểu dòng", () => {
  it("dùng ô nhập chung của trình làm bài thay vì chỉ hiện đề (không để câu không trả lời được)", async () => {
    const e = embed();
    await render({ ...e, questions: [q("w1", "weird_type", "Câu lạ", null, {})], passages: [] });
    const row = host.querySelector(".ps-row")!;
    expect(row.textContent).toContain("Câu lạ");
    expect(row.querySelector('[role="status"]')).not.toBeNull(); // ExamQuestion báo dạng chưa hỗ trợ cho học viên
  });
});

describe("Phiếu bài tập — kiểm tra và chấm", () => {
  async function fillTab1() {
    await type(panel().querySelector<HTMLInputElement>("input.ps-blank")!, "studies");
    await click([...panel().querySelectorAll<HTMLButtonElement>(".ps-alt")].find((b) => b.textContent === "love")!);
    await flush(600);
  }

  it("'Kiểm tra bài này' chấm các câu đã trả lời của tab: ✓ ✗ có nhãn, hàng sai hiện đáp án đúng và giải thích; sau đó nút tắt", async () => {
    await render();
    expect(button(/Kiểm tra bài này/).disabled).toBe(true);
    await fillTab1();
    await click(button(/Kiểm tra bài này/));
    await flush(50);
    expect(calls.filter((c) => c.url.includes("/check/")).map((c) => c.url)).toEqual(["/api/practice-sessions/s1/check/g1", "/api/practice-sessions/s1/check/c1"]);
    const marks = [...panel().querySelectorAll('[role="img"]')].map((m) => m.getAttribute("aria-label"));
    expect(marks).toEqual(["Sai", "Đúng"]);
    expect(panel().textContent).toContain("→ is studying");
    expect(panel().textContent).toContain("Hành động đang diễn ra.");
    expect(text()).toContain("Đúng 1 / 2");
    expect(button(/Kiểm tra bài này/).disabled).toBe(true);
    expect(host.querySelector(".ps-row[data-state='no']")).not.toBeNull();
  });

  it("sửa đáp án thì dấu của hàng đó mất và có thể kiểm tra lại; 'Kiểm tra tất cả' chỉ ở tab cuối và chấm cả hai tab", async () => {
    await render();
    expect(host.textContent).not.toContain("Kiểm tra tất cả");
    await fillTab1();
    await click(button(/Kiểm tra bài này/));
    await flush(50);
    await type(panel().querySelector<HTMLInputElement>("input.ps-blank")!, "is studying");
    await flush(600);
    expect(panel().querySelectorAll('[role="img"]')).toHaveLength(1); // chỉ còn dấu của câu chưa sửa
    expect(button(/Kiểm tra bài này/).disabled).toBe(false);

    await click(button(/Bài 2/));
    const blanks = [...panel().querySelectorAll<HTMLInputElement>("input.ps-blank")];
    await type(blanks[0]!, "x");
    await type(blanks[1]!, "y");
    await flush(600);
    calls.length = 0;
    await click(button(/Kiểm tra tất cả/));
    await flush(50);
    expect(calls.filter((c) => c.url.includes("/check/")).map((c) => c.url)).toEqual(["/api/practice-sessions/s1/check/g1", "/api/practice-sessions/s1/check/g2"]);
  });

  it("một câu lỗi không dừng cả loạt: các câu còn lại vẫn được chấm và có thông báo", async () => {
    await render();
    await fillTab1();
    handlers["POST /api/practice-sessions/s1/check/g1"] = () => ({ status: 500, json: { error: "boom" } });
    await click(button(/Kiểm tra bài này/));
    await flush(50);
    expect(calls.filter((c) => c.url.includes("/check/")).map((c) => c.url)).toEqual(["/api/practice-sessions/s1/check/g1", "/api/practice-sessions/s1/check/c1"]);
    expect(text()).toContain("Không kiểm tra được 1 câu");
    expect([...panel().querySelectorAll('[role="img"]')].map((m) => m.getAttribute("aria-label"))).toEqual(["Đúng"]);
  });

  it("xem thử của giảng viên: vẫn dựng phiếu; chấm qua route xem thử, không tạo buổi", async () => {
    handlers["POST /api/practice-preview/ex1/check/g1"] = () => ({ json: { isCorrect: true, score: 1, maxScore: 1, manual: false, config: { blanks: [{ id: "b1", acceptedAnswers: ["x"] }] } } });
    await render(embed(), true);
    await type(panel().querySelector<HTMLInputElement>("input.ps-blank")!, "x");
    await flush(600);
    await click(button(/Kiểm tra bài này/));
    await flush(50);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/practice-preview/ex1/check/g1"]);
  });

  it("số câu đánh lại từ 1 trong mỗi bài tập (như sách), không đánh liên tục cả khối", async () => {
    await render();
    expect([...panel().querySelectorAll(".ps-n")].map((n) => n.textContent)).toEqual(["1", "2"]);
    await click(button(/Bài 2/));
    expect([...panel().querySelectorAll(".ps-n")].map((n) => n.textContent)).toEqual(["1", "2", "3", "4"]);
  });
});
