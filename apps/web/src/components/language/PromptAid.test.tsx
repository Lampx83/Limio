// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PromptAid from "./PromptAid";

vi.mock("@/lib/i18n/client", () => ({ useT: () => (k: string) => (k === "practice.aid.showTranslation" ? "Show translation" : k === "practice.aid.hideTranslation" ? "Hide translation" : k) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
function render(config: unknown) {
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => createRoot(host!).render(<PromptAid config={config} />));
  return host;
}
afterEach(() => {
  host?.remove();
  host = null;
});

describe("PromptAid", () => {
  const config = { promptAid: { reading: "Nǐ hǎo ma?", translation: "How are you?" } };

  it("hiện phiên âm sẵn, ẩn bản dịch cho tới khi bấm", () => {
    const h = render(config);
    expect(h.querySelector('[data-testid="prompt-aid-reading"]')!.textContent).toBe("Nǐ hǎo ma?");
    expect(h.querySelector('[data-testid="prompt-aid-translation"]')).toBeNull();
    const btn = h.querySelector("button")!;
    expect(btn.textContent).toContain("Show translation");
    act(() => btn.click());
    expect(h.querySelector('[data-testid="prompt-aid-translation"]')!.textContent).toBe("How are you?");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    act(() => btn.click());
    expect(h.querySelector('[data-testid="prompt-aid-translation"]')).toBeNull();
  });

  it("không có promptAid thì không vẽ gì; chỉ có phiên âm thì không có nút", () => {
    expect(render({}).innerHTML).toBe("");
    host!.remove();
    const h = render({ promptAid: { reading: "Nǐ hǎo?" } });
    expect(h.querySelector("button")).toBeNull();
    expect(h.querySelector('[data-testid="prompt-aid-reading"]')).not.toBeNull();
  });
});
