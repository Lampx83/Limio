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
import { COMPACT_OPTION_CHARS, splitTransform } from "./PracticeSheet";

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
    // Đoạn chỉ có câu yêu cầu: tên đoạn + câu yêu cầu ở khối đề bài riêng phía trên (AC2), không nằm trong thẻ phiếu.
    expect(host.querySelector('[data-testid="lp-instruction"]')!.textContent).toContain("Đoạn một.");
    await click(button(/Bài 2/));
    expect(host.querySelector('[data-testid="lp-instruction"]')!.textContent).toContain("Đoạn hai.");
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

    // sắp xếp (kéo-thả; ô chọn dự phòng cho đọc màn hình): chỉ lưu khi mọi ô đã có mảnh và không trùng
    const ord = [...panel().querySelectorAll<HTMLSelectElement>('select[aria-label*="vị trí"]')];
    expect(ord).toHaveLength(2);
    await choose(ord[0]!, "I2");
    await flush(600);
    expect(calls.some((c) => c.url.endsWith("/answers/od1"))).toBe(false);
    expect(text()).toContain("Đặt đủ các mảnh vào ô (1/2)");
    await choose(ord[1]!, "I1");
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/od1")).at(-1)!.body).toEqual({ answerJson: { order: ["I2", "I1"] } });

    // kéo thả điền: hộp từ và ô chỗ trống tại chỗ (ô chọn gốc nằm trong ô)
    const slot = panel().querySelector<HTMLSelectElement>(".ps-slot select.ps-slot-select")!;
    await choose(slot, "T2");
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/d1")).at(-1)!.body).toEqual({ answerJson: { placed: { "1": "T2" } } });
    expect(panel().querySelector(".ps-slot")!.getAttribute("data-filled")).toBe("true");
    expect(panel().querySelector(".ps-slot-face")!.textContent).toBe("reads");
    expect(panel().querySelector('.ps-words .ps-card[data-used="true"]')!.textContent).toBe("reads"); // từ đã đặt của câu kéo thả (không lẫn nghĩa đã dùng của ghép cặp)
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

describe("Phiếu bài tập — đoạn văn chỉ là câu yêu cầu thì một cột", () => {
  const para = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
  const withP2 = (...content: unknown[]) => ({ id: "p2", title: "Ex 2 · Bài hai", contentJson: { type: "doc", content } });

  it("đoạn chỉ có vài câu chữ hiện thành câu yêu cầu ở đầu bài tập (không thẻ đoạn văn bên trái, không nút chia đôi)", async () => {
    await render();
    expect(host.querySelector('[data-testid="lp-passage"]')).toBeNull();
    // Câu yêu cầu nằm ở khối đề bài riêng rộng bằng bài, không lặp trong thẻ phiếu.
    expect(host.querySelector('[data-testid="lp-instruction"]')!.textContent).toContain("Đoạn một.");
    expect(panel().querySelector(".ps-intro")).toBeNull();
    expect(host.querySelector('[aria-label="Bố cục"]')).toBeNull();
  });

  it("bài nghe chỉ có câu yêu cầu ngắn và audio: trình phát hiện ngay trên các câu hỏi (một cột)", async () => {
    const e = embed();
    await render({ ...e, passages: [e.passages[0]!, withP2(para("Nghe."), { type: "audio", attrs: { src: "/api/exam-assets/a.m4a" } })] });
    await click(host.querySelectorAll('[role="tab"]')[1]!);
    expect(host.querySelector('[data-testid="lp-passage"]')).toBeNull();
    expect(panel().querySelector(".ps-intro-media")).not.toBeNull();
  });

  it("đoạn có bài đọc thật (bảng, danh sách, ảnh, tiêu đề hoặc chữ dài) vẫn là thẻ đoạn văn hai cột", async () => {
    const e = embed();
    await render({ ...e, passages: [e.passages[0]!, withP2(para("Đọc."), { type: "table", content: [] })] });
    await click(host.querySelectorAll('[role="tab"]')[1]!);
    expect(host.querySelector('[data-testid="lp-passage"]')).not.toBeNull();
    expect(panel().querySelector(".ps-intro, .ps-intro-media")).toBeNull();
  });
});

describe("Phiếu bài tập — đề biến đổi câu (câu gốc / TỪ KHOÁ / câu có chỗ trống)", () => {
  it("splitTransform tách ba phần; không đúng dạng thì null", () => {
    expect(splitTransform("Someone fixed our washing machine yesterday.\nHAD\nWe ______ yesterday.")).toEqual({ head: "Someone fixed our washing machine yesterday.", key: "HAD", rest: "We ______ yesterday." });
    expect(splitTransform("Một dòng ______.")).toBeNull();
    expect(splitTransform("A.\nhad\nB ______.")).toBeNull(); // từ khoá phải viết hoa
    expect(splitTransform("A.\nHAD\nB.\nC ______.")).toBeNull();
  });

  it("hiện trên một dòng: câu gốc, từ khoá trong ngoặc, phần viết lại (có chỗ trống) màu khác", async () => {
    const e = embed();
    await render({
      ...e,
      questions: [{ ...e.questions[0]!, id: "t1", type: "short_answer", passageId: "p1", prompt: "Someone fixed our washing machine yesterday.\nHAD\nWe ______ yesterday.", config: {} }],
      passages: [e.passages[0]!],
    });
    const row = panel().querySelector(".ps-row")!;
    expect(row.querySelector(".ps-key-inline")!.textContent).toBe("(HAD)");
    const rewrite = row.querySelector(".ps-rewrite")!;
    expect(rewrite.textContent).toContain("We");
    expect(rewrite.textContent).toContain("yesterday.");
    expect(rewrite.querySelector("input.ps-blank")).not.toBeNull(); // chỗ điền nằm trong phần viết lại
    expect(row.querySelector(".ps-body")!.textContent).toMatch(/^Someone fixed our washing machine yesterday\. \(HAD\) We/);
  });
});

describe("Phiếu bài tập — khoá tiếng Trung: pinyin dưới chữ ở đề, ngân hàng từ và phương án", () => {
  const zh = (): PracticeEmbed => {
    const e = embed();
    return {
      ...e,
      courseLanguage: "zh",
      questions: [
        q("z1", "drag_drop_fill", "我在超市买了一[[1]]面包和一[[2]]铅笔。", "p1", {
          tokens: [{ id: "T1", label: "幅" }, { id: "T2", label: "袋" }],
          promptAid: { reading: "Wǒ zài chāoshì mǎi le yí ____ miànbāo hé yì ____ qiānbǐ." },
        }),
        q("z2", "mcq", "他家里新买了一____洗衣机。", "p1", { options: [{ id: "o1", label: "台" }, { id: "o2", label: "银行" }] }),
      ],
      passages: [e.passages[0]!],
    };
  };
  const rt = (el: Element) => [...el.querySelectorAll("rt")].map((x) => x.textContent);
  /** Bộ tính pinyin nạp lười (import động): chờ nó xong rồi mới vẽ lại. */
  const loaded = async () => {
    await act(async () => {
      await import("@/lib/hanPinyin");
    });
    await flush(50);
  };

  it("đề có pinyin tác giả: pinyin dưới từng chữ, không còn dòng pinyin riêng; chỗ trống là một ô có số thứ tự", async () => {
    await render(zh());
    await loaded();
    const row = panel().querySelectorAll(".ps-row")[0]!;
    expect(row.querySelector('[data-testid="prompt-aid-reading"]')).toBeNull();
    expect(rt(row.querySelector(".ps-drag-line")!)).toContain("chāo");
    expect(row.querySelectorAll(".ps-slot")).toHaveLength(2);
    expect([...row.querySelectorAll(".ps-slot-n")].map((n) => n.textContent)).toEqual(["1", "2"]);
    // ngân hàng từ có pinyin tự tính
    expect(rt(row.querySelector(".ps-words")!)).toEqual(["fú", "dài"]);
  });

  it("chọn từ vào ô: ô hiện từ đã chọn kèm pinyin dưới chữ; lưu đúng dạng cũ", async () => {
    await render(zh());
    await loaded();
    const slot = panel().querySelectorAll<HTMLSelectElement>(".ps-slot select.ps-slot-select")[1]!;
    expect([...slot.options].map((o) => o.textContent)).toEqual(["—", "幅 (fú)", "袋 (dài)"]);
    await choose(slot, "T2");
    await flush(600);
    const filled = panel().querySelectorAll(".ps-slot")[1]!;
    expect(filled.getAttribute("data-filled")).toBe("true");
    expect(rt(filled.querySelector(".ps-slot-face")!)).toEqual(["dài"]);
    expect(calls.filter((c) => c.url.endsWith("/answers/z1")).at(-1)!.body).toEqual({ answerJson: { placed: { "2": "T2" } } });
  });

  it("phương án trắc nghiệm có pinyin tự tính (chữ đa âm theo từ); đề không có pinyin tác giả cũng có pinyin dưới chữ", async () => {
    await render(zh());
    await loaded();
    const row = panel().querySelectorAll(".ps-row")[1]!;
    expect(rt(row.querySelector(".ps-alts")!)).toEqual(["tái", "yín", "háng"]);
    expect(rt(row).length).toBeGreaterThan(8); // đề cũng có pinyin dưới chữ (tự tính)
  });

  it("khoá khác tiếng Trung (en) không đặt pinyin: chữ hiện trơn, vẫn là ô chọn bình thường", async () => {
    const e = zh();
    await render({ ...e, courseLanguage: "en", questions: [e.questions[1]!] });
    await loaded();
    expect(panel().querySelector("ruby")).toBeNull();
    expect(panel().querySelectorAll(".ps-alt")).toHaveLength(2);
  });

  it("đề lẫn chữ Việt: chữ Việt giữ font bài (ps-latin) và tự xuống dòng; từ Hán ngắn là một khối không ngắt", async () => {
    const e = zh();
    await render({ ...e, questions: [q("m1", "mcq", "Màn hình đang 播放 một đoạn video.", "p1", { options: [{ id: "o1", label: "台" }, { id: "o2", label: "袋" }] })] });
    await loaded();
    const line = panel().querySelector(".ps-row .ruby-line")!;
    expect(line.querySelectorAll(".ps-latin").length).toBeGreaterThan(0);
    expect([...line.querySelectorAll(".ps-latin")].map((x) => x.textContent?.trim())).toEqual(["Màn hình đang", "một đoạn video."]);
    const unit = [...line.querySelectorAll("span.whitespace-nowrap")].find((x) => x.textContent?.includes("播"))!;
    expect(unit.textContent).toContain("放");
    expect(rt(unit)).toEqual(["bō", "fàng"]);
  });

  it("câu hỏi cách đọc: không pinyin dưới chữ Hán của đề, không dòng pinyin của đề, không ruby ở bất kỳ chỗ nào của câu", async () => {
    const e = zh();
    await render({
      ...e,
      questions: [
        q("p1", "mcq", "Màn hình đang 播放 một đoạn video. Chọn pinyin đúng của 播放.", "p1", {
          options: [{ id: "o1", label: "bōfāng" }, { id: "o2", label: "bōfàng" }, { id: "o3", label: "bófàng" }, { id: "o4", label: "bǒfàng" }],
          promptAid: { reading: "Pīnyīn ... bōfàng", translation: "Dịch" },
        }),
        q("p2", "mcq", "Chọn chữ Hán cho bōfàng.", "p1", { options: [{ id: "o1", label: "播放" }, { id: "o2", label: "插放" }], hidePinyin: true }),
      ],
    });
    await loaded();
    const rows = panel().querySelectorAll(".ps-row");
    for (const r of rows) expect(r.querySelector("ruby")).toBeNull();
    expect(rows[0]!.querySelector('[data-testid="prompt-aid-reading"]')).toBeNull();
    expect(rows[0]!.textContent).toContain("Hiện bản dịch");
  });

  it("sắp xếp: chạm mảnh rồi chạm ô để đặt; chạm mảnh đã đặt để bỏ ra; mũi tên đổi chỗ; chỉ lưu khi đủ", async () => {
    await render();
    await click(button(/Bài 2/));
    const pool = () => [...panel().querySelectorAll<HTMLButtonElement>(".ps-pool .ps-card")];
    const slots = () => [...panel().querySelectorAll<HTMLElement>(".ps-oslot")];
    expect(pool().map((c) => c.textContent)).toEqual(["wake up", "get dressed"]);
    expect(slots()).toHaveLength(2);
    // chạm "get dressed" (sáng lên) rồi chạm ô 1
    await click(pool()[1]!);
    expect(pool()[1]!.getAttribute("aria-pressed")).toBe("true");
    await click(slots()[0]!.querySelector<HTMLButtonElement>(".ps-oslot-empty")!);
    expect(slots()[0]!.textContent).toContain("get dressed");
    expect(pool().map((c) => c.textContent)).toEqual(["wake up"]);
    await flush(600);
    expect(calls.some((c) => c.url.endsWith("/answers/od1"))).toBe(false); // chưa đủ
    await click(pool()[0]!);
    await click(slots()[1]!.querySelector<HTMLButtonElement>(".ps-oslot-empty")!);
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/od1")).at(-1)!.body).toEqual({ answerJson: { order: ["I2", "I1"] } });
    // mũi tên phải ở ô 1: đổi chỗ với ô 2
    await act(async () => {
      slots()[0]!.querySelector(".ps-card")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/od1")).at(-1)!.body).toEqual({ answerJson: { order: ["I1", "I2"] } });
    // chạm mảnh đã đặt: về khay
    await click(slots()[0]!.querySelector(".ps-card")!);
    expect(pool().map((c) => c.textContent)).toEqual(["wake up"]);
  });

  it("kéo thả điền: chạm từ ở ngân hàng rồi chạm chỗ trống để đặt (mỗi từ một chỗ)", async () => {
    await render();
    await click(button(/Bài 2/));
    const cards = () => [...panel().querySelectorAll<HTMLButtonElement>(".ps-words .ps-card")];
    await click(cards()[1]!);
    await click(panel().querySelector<HTMLElement>(".ps-slot")!);
    await flush(600);
    expect(calls.filter((c) => c.url.endsWith("/answers/d1")).at(-1)!.body).toEqual({ answerJson: { placed: { "1": "T2" } } });
    expect(panel().querySelector(".ps-slot-face")!.textContent).toBe("reads");
  });
});

describe("Phiếu bài tập — dòng yêu cầu và tên khối", () => {
  it("câu không có dòng yêu cầu riêng nhận dòng mặc định theo dạng câu, một lần cho cụm cùng dạng; câu đã có 'Chọn…/Nối…' thì không thêm", async () => {
    const e = embed();
    await render({
      ...e,
      questions: [
        q("a1", "drag_drop_fill", "我买了一[[1]]面包。", "p1", { tokens: [{ id: "T1", label: "袋" }, { id: "T2", label: "台" }] }),
        q("a2", "drag_drop_fill", "我买了一[[1]]铅笔。", "p1", { tokens: [{ id: "T1", label: "袋" }, { id: "T2", label: "台" }] }),
        q("a3", "matching", "Nối từ tiếng Trung với nghĩa tiếng Việt.", "p1", { lefts: [{ id: "L1", label: "桶" }], rights: [{ id: "R1", label: "cái xô" }] }),
        q("a4", "mcq", "Hôm nay là ngày mấy?", "p1", { options: [{ id: "o1", label: "một" }, { id: "o2", label: "hai" }] }),
      ],
      passages: [e.passages[0]!],
    });
    const lines = [...panel().querySelectorAll('[data-testid="ps-instr"]')].map((x) => x.textContent);
    expect(lines).toEqual(["Chọn từ thích hợp điền vào chỗ trống.", "Chọn đáp án đúng."]);
  });

  it("trường config.instruction của câu được dùng làm dòng yêu cầu", async () => {
    const e = embed();
    await render({ ...e, questions: [q("i1", "mcq", "Hôm nay là ngày mấy?", "p1", { instruction: "Nghe rồi chọn.", options: [{ id: "o1", label: "một" }, { id: "o2", label: "hai" }] })], passages: [e.passages[0]!] });
    expect([...panel().querySelectorAll('[data-testid="ps-instr"]')].map((x) => x.textContent)).toEqual(["Nghe rồi chọn."]);
  });

  it("nhiều tab: tab đang chọn mở đầu bằng tên khối và số câu", async () => {
    await render();
    const head = panel().querySelector(".ps-tabtitle")!;
    expect(head.textContent).toContain("Ex 1A · Present forms");
    expect(head.textContent).toMatch(/\d+ câu/);
  });
});

describe("PracticeSheet — phương án trắc nghiệm ngắn xếp một hàng ngang", () => {
  const optsOf = () => host.querySelector<HTMLElement>(".ps-opts")!;
  const opt = (id: string, label: string) => ({ id, label });

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    mockFetch();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const show = async (options: Array<{ id: string; label: string }>) => {
    const e = embed();
    await act(async () => root.render(<LessonPractice slug="c" embed={{ ...e, questions: [q("c1", "mcq", "Chọn.", "p1", { options })] }} sheet />));
  };

  it("mọi phương án ngắn → hàng ngang (ps-opts-row)", async () => {
    await show([opt("o1", "里面"), opt("o2", "后面"), opt("o3", "旁边"), opt("o4", "对面")]);
    expect(optsOf().classList.contains("ps-opts-row")).toBe(true);
  });

  it("có phương án dài → vẫn danh sách dọc", async () => {
    await show([opt("o1", "里面"), opt("o2", "后面"), opt("o3", "旁边"), opt("o4", "x".repeat(COMPACT_OPTION_CHARS + 1))]);
    expect(optsOf().classList.contains("ps-opts-row")).toBe(false);
  });
});
