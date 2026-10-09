import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { formatLessonContent } from "../aiTutor/generators";
import { AiTutorError } from "../aiTutor/errors";
import { DEFAULT_MODEL } from "../aiTutor/aiTutor";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";

/**
 * "Định dạng bằng AI" — GV dán nội dung thô vào ô richtext, chọn template,
 * AI trả HTML sạch theo đúng cấu trúc + phong cách. Không chạm DB nào khác
 * ngoài sổ token (AiUsageLog + AiTokenLedger/Balance, dùng chung với AI Tutor).
 */

function fakeOpenAI(html: string, inputTokens = 500, outputTokens = 300): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ html }) } }],
          usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
        }),
      },
    },
  } as unknown as OpenAI;
}

async function makeUser(slug: string) {
  const u = await prisma.user.create({
    data: { email: `fmt-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug },
  });
  return u.id;
}

describe("formatLessonContent — validation (không chạm OpenAI/DB)", () => {
  it("nội dung rỗng → validation_failed, không gọi OpenAI", async () => {
    const openai = fakeOpenAI("<p>x</p>");
    await expect(
      formatLessonContent("no-such-user", { html: "   ", template: "clean" }, openai),
    ).rejects.toMatchObject({ code: "validation_failed", details: "empty_content" });
  });

  it("nội dung vượt 100.000 ký tự → validation_failed", async () => {
    const openai = fakeOpenAI("<p>x</p>");
    const huge = "a".repeat(100_001);
    await expect(
      formatLessonContent("no-such-user", { html: huge, template: "clean" }, openai),
    ).rejects.toMatchObject({ code: "validation_failed", details: "too_long" });
  });

  it("template không hợp lệ → validation_failed", async () => {
    const openai = fakeOpenAI("<p>x</p>");
    await expect(
      formatLessonContent(
        "no-such-user",
        { html: "<p>ok</p>", template: "bogus" as never },
        openai,
      ),
    ).rejects.toMatchObject({ code: "validation_failed", details: "unknown_template" });
  });
});

describe("formatLessonContent — happy path", () => {
  it("trả HTML từ model + ghi AiUsageLog đúng token", async () => {
    const userId = await makeUser("ok");
    const openai = fakeOpenAI("<h2 style=\"color:#1e40af\">Mở đầu</h2><p>chữ</p>", 600, 400);

    const r = await formatLessonContent(
      userId,
      { html: "<p>bài chưa định dạng</p>", template: "clean" },
      openai,
    );

    expect(r.html).toContain("<h2");
    expect(r.html).toContain("Mở đầu");

    const dayKey = new Date().toISOString().slice(0, 10);
    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_dayKey_model: { userId, dayKey, model: DEFAULT_MODEL } },
    });
    expect(log?.tokensInput).toBe(600);
    expect(log?.tokensOutput).toBe(400);
  });

  it("HTML rỗng từ model → openai_error, không nuốt lỗi im lặng", async () => {
    const userId = await makeUser("empty-out");
    const openai = fakeOpenAI("   ");
    await expect(
      formatLessonContent(userId, { html: "<p>x</p>", template: "modern" }, openai),
    ).rejects.toMatchObject({ code: "openai_error", details: "empty_html_output" });
  });

  it("cả 4 template đều chạy được", async () => {
    for (const template of ["clean", "academic", "modern", "vibrant"] as const) {
      const userId = await makeUser(`tpl-${template}`);
      const openai = fakeOpenAI("<h2>ok</h2>");
      const r = await formatLessonContent(userId, { html: "<p>x</p>", template }, openai);
      expect(r.html).toContain("<h2>ok</h2>");
    }
  });

  it("cả 4 template đều dặn cỡ chữ 1.25rem cho <td>/<blockquote> — không bỏ sót như <p>/<li>", async () => {
    // Từng có bug: guide.rules chỉ dặn font-size cho h2/h3/p/li/callout, quên
    // hẳn <table>/<th>/<td> — AI trả bảng không style gì, chữ trong bảng nhỏ
    // hẳn so với phần còn lại của bài (phát hiện khi GV test thật với 1 bài có
    // bảng, theme "Sinh động"). Rà soát lại phát hiện thêm <blockquote>/<img>
    // cũng thiếu — test này chặn cả 2 lớp cùng dạng.
    for (const template of ["clean", "academic", "modern", "vibrant"] as const) {
      const userId = await makeUser(`tpl-gap-${template}`);
      let capturedSystemPrompt = "";
      const openai = {
        chat: {
          completions: {
            create: async (req: { messages: Array<{ role: string; content: string }> }) => {
              capturedSystemPrompt = req.messages.find((m) => m.role === "system")?.content ?? "";
              return {
                choices: [{ message: { content: JSON.stringify({ html: "<table></table>" }) } }],
                usage: { prompt_tokens: 1, completion_tokens: 1 },
              };
            },
          },
        },
      } as unknown as OpenAI;

      await formatLessonContent(userId, { html: "<table><tr><td>x</td></tr></table>", template }, openai);

      expect(capturedSystemPrompt).toMatch(/<td>:\s*style="[^"]*font-size:1\.25rem/);
      expect(capturedSystemPrompt).toMatch(/<blockquote>:\s*style="[^"]*font-size:1\.25rem/);
    }
  });

  it("cả 4 template đều dặn <img> không tràn khung (max-width:100%)", async () => {
    for (const template of ["clean", "academic", "modern", "vibrant"] as const) {
      const userId = await makeUser(`tpl-img-${template}`);
      let capturedSystemPrompt = "";
      const openai = {
        chat: {
          completions: {
            create: async (req: { messages: Array<{ role: string; content: string }> }) => {
              capturedSystemPrompt = req.messages.find((m) => m.role === "system")?.content ?? "";
              return {
                choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
                usage: { prompt_tokens: 1, completion_tokens: 1 },
              };
            },
          },
        },
      } as unknown as OpenAI;

      await formatLessonContent(userId, { html: "<p>x</p>", template }, openai);

      // Ảnh docx giữ nguyên kích thước gốc (có thể rất to/lệch tỉ lệ) — chỉ
      // max-width:100% không đủ nếu ảnh cao bất thường (portrait); cần thêm
      // max-height để ảnh luôn vừa khung nội dung, không tràn dọc trang.
      // Hẹp hơn lề ~1.5cm mỗi bên (trừ 3cm tổng) + margin:auto căn giữa.
      expect(capturedSystemPrompt).toMatch(/<img>:\s*style="[^"]*max-width:calc\(100% - 3cm\)/);
      expect(capturedSystemPrompt).toMatch(/<img>:\s*style="[^"]*max-height:\d+px/);
      expect(capturedSystemPrompt).toMatch(/<img>:\s*style="[^"]*margin:12px auto/);
    }
  });

  it("dặn bọc <table> trong overflow-x:auto để không vỡ layout mobile", async () => {
    const userId = await makeUser("tpl-table-wrap");
    let capturedSystemPrompt = "";
    const openai = {
      chat: {
        completions: {
          create: async (req: { messages: Array<{ role: string; content: string }> }) => {
            capturedSystemPrompt = req.messages.find((m) => m.role === "system")?.content ?? "";
            return {
              choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    } as unknown as OpenAI;

    await formatLessonContent(userId, { html: "<p>x</p>", template: "clean" }, openai);

    expect(capturedSystemPrompt).toContain("overflow-x:auto");
  });
});

describe("formatLessonContent — tuỳ chọn thêm mục tiêu & tổng kết", () => {
  async function captureSystemPrompt(
    slug: string,
    extra: { addObjectivesSummary?: boolean },
  ): Promise<string> {
    const userId = await makeUser(slug);
    let captured = "";
    const openai = {
      chat: {
        completions: {
          create: async (req: { messages: Array<{ role: string; content: string }> }) => {
            captured = req.messages.find((m) => m.role === "system")?.content ?? "";
            return {
              choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    } as unknown as OpenAI;
    await formatLessonContent(userId, { html: "<p>x</p>", template: "clean", ...extra }, openai);
    return captured;
  }

  it("mặc định (không truyền cờ) = BẬT: bắt buộc có cả Mục tiêu học tập lẫn Tổng kết", async () => {
    const prompt = await captureSystemPrompt("objsum-default", {});
    expect(prompt).toContain("LUÔN thêm");
    expect(prompt).toContain("lesson-objectives");
    expect(prompt).toContain("lesson-summary");
    // Không còn đường "bỏ qua thay vì đoán" — chính câu này khiến AI hay bỏ phần cuối.
    expect(prompt).not.toContain("bỏ qua phần đó thay vì đoán");
    // Vẫn chặn kiến thức ngoài bài.
    expect(prompt).toContain("CHỈ được rút từ nội dung bài");
  });

  it("TẮT: giữ hành vi cũ — chỉ thêm khi đủ cơ sở, cho phép bỏ qua", async () => {
    const prompt = await captureSystemPrompt("objsum-off", { addObjectivesSummary: false });
    expect(prompt).not.toContain("LUÔN thêm");
    expect(prompt).toContain("bỏ qua phần đó thay vì đoán");
  });
});

describe("formatLessonContent — quy tắc biên tập", () => {
  it("cho phép sửa chính tả/câu cú + thêm bớt nhẹ, nhưng vẫn cấm đổi nghĩa/số liệu/kiến thức mới (cả hai chế độ cờ)", async () => {
    for (const addObjectivesSummary of [true, false]) {
      const userId = await makeUser(`edit-${addObjectivesSummary}`);
      let prompt = "";
      const openai = {
        chat: {
          completions: {
            create: async (req: { messages: Array<{ role: string; content: string }> }) => {
              prompt = req.messages.find((m) => m.role === "system")?.content ?? "";
              return {
                choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
                usage: { prompt_tokens: 1, completion_tokens: 1 },
              };
            },
          },
        },
      } as unknown as OpenAI;
      await formatLessonContent(
        userId,
        { html: "<p>x</p>", template: "clean", addObjectivesSummary },
        openai,
      );
      expect(prompt).toContain("sửa lỗi chính tả");
      expect(prompt).toContain("lược phần lặp thừa");
      expect(prompt).toContain("KHÔNG ĐƯỢC: đổi ý nghĩa, số liệu");
      // Luật cũ "không thêm bớt" đã bị gỡ — mâu thuẫn với quy tắc biên tập.
      expect(prompt).not.toContain("KHÔNG thêm, xoá, hay diễn giải lại Ý NGHĨA");
      expect(prompt).not.toContain("giữ nguyên câu chữ trong");
    }
  });
});

describe("formatLessonContent — phân cấp đề mục", () => {
  it("dặn dựng 2 tầng h2/h3, nhận diện đề mục ngầm, giữ trần 5 h2, không dùng h4 — cả hai chế độ cờ và cả 4 template", async () => {
    for (const template of ["clean", "academic", "modern", "vibrant"] as const) {
      for (const addObjectivesSummary of [true, false]) {
        const userId = await makeUser(`hier-${template}-${addObjectivesSummary}`);
        let prompt = "";
        const openai = {
          chat: {
            completions: {
              create: async (req: { messages: Array<{ role: string; content: string }> }) => {
                prompt = req.messages.find((m) => m.role === "system")?.content ?? "";
                return {
                  choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
                  usage: { prompt_tokens: 1, completion_tokens: 1 },
                };
              },
            },
          },
        } as unknown as OpenAI;
        await formatLessonContent(
          userId,
          { html: "<p>x</p>", template, addObjectivesSummary },
          openai,
        );
        expect(prompt).toContain("phân cấp đề mục 2 tầng");
        expect(prompt).toContain("mục con <h3>");
        expect(prompt).toContain("Nhận diện đề mục ngầm");
        expect(prompt).toContain("TỐI ĐA 5 mục");
        expect(prompt).toContain("Không dùng cấp sâu hơn <h3>");
        // Danh sách thẻ cho phép KHÔNG được thêm h4 (output sanitize theo tập này).
        expect(prompt).toContain("Output CHỈ chứa thẻ: div, h2, h3, p,");
        expect(prompt).not.toContain("<h4>");
      }
    }
  });
});

describe("formatLessonContent — style khối Mục tiêu / Tổng kết", () => {
  it("cả 4 theme đều dặn style cho lesson-objectives & lesson-summary; Sinh động dùng màu cố định (khối nằm ngoài mọi h2)", async () => {
    // Bug: khối Mục tiêu nằm ngoài mọi <h2>, mà quy tắc <h3> của "Sinh động" chỉ
    // nói "dùng màu của mục cha" → AI để tiêu đề đen/mặc định, không khớp theme.
    for (const template of ["clean", "academic", "modern", "vibrant"] as const) {
      const userId = await makeUser(`objstyle-${template}`);
      let prompt = "";
      const openai = {
        chat: {
          completions: {
            create: async (req: { messages: Array<{ role: string; content: string }> }) => {
              prompt = req.messages.find((m) => m.role === "system")?.content ?? "";
              return {
                choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
                usage: { prompt_tokens: 1, completion_tokens: 1 },
              };
            },
          },
        },
      } as unknown as OpenAI;
      await formatLessonContent(userId, { html: "<p>x</p>", template }, openai);
      expect(prompt).toMatch(/<div class="lesson-objectives"> \(Mục tiêu học tập\) và <div class="lesson-summary">/);
    }
  });

  it("Sinh động: khối mục tiêu/tổng kết có màu lam cố định cho cả nền lẫn h3", async () => {
    const userId = await makeUser("objstyle-vibrant-color");
    let prompt = "";
    const openai = {
      chat: {
        completions: {
          create: async (req: { messages: Array<{ role: string; content: string }> }) => {
            prompt = req.messages.find((m) => m.role === "system")?.content ?? "";
            return {
              choices: [{ message: { content: JSON.stringify({ html: "<p>x</p>" }) } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    } as unknown as OpenAI;
    await formatLessonContent(userId, { html: "<p>x</p>", template: "vibrant" }, openai);
    expect(prompt).toContain("lấy màu 1 (lam) cố định");
    expect(prompt).toMatch(/lesson-summary">[^\n]*background:rgba\(59,130,246,\.14\)/);
    expect(prompt).toMatch(/lesson-summary">[^\n]*<h3> bên trong style="color:rgb\(40,118,245\)/);
  });
});

describe("formatLessonContent — hạn mức ví token", () => {
  it("hết ví tháng → no_token_budget, KHÔNG gọi OpenAI (chặn trước khi tốn tiền)", async () => {
    const userId = await makeUser("broke");
    // Tiêu gần hết ví trước khi gọi — đủ để rơi dưới RESERVE_TOKENS_PER_TURN.
    const budget = await getTokenBudget(userId);
    await chargeTokens(userId, budget.total - 100, null);

    let called = false;
    const openai = {
      chat: {
        completions: {
          create: async () => {
            called = true;
            return { choices: [{ message: { content: "{}" } }], usage: {} };
          },
        },
      },
    } as unknown as OpenAI;

    await expect(
      formatLessonContent(userId, { html: "<p>x</p>", template: "clean" }, openai),
    ).rejects.toBeInstanceOf(AiTutorError);
    expect(called).toBe(false);
  });
});
