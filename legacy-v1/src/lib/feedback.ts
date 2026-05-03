import OpenAI from "openai";
import { db } from "./db";
import type { LSScore } from "./learning-style";
import { describeStyle } from "./learning-style";
import { srlLevel, type SRLScore } from "./srl-questions";

import { decrypt } from "./crypto";

function getSetting(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM system_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function getApiKey(): string | null {
  const stored = getSetting("openai_api_key");
  if (stored) {
    try {
      return decrypt(stored);
    } catch {
      return null;
    }
  }
  return process.env.OPENAI_API_KEY ?? null;
}
function getModel(): string {
  return (
    getSetting("openai_model") ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
  );
}

function getClient(): OpenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY chưa được cấu hình. Hệ thống admin có thể cấu hình ở /admin/settings.",
    );
  }
  return new OpenAI({ apiKey });
}

export interface FeedbackRequest {
  assignmentTitle: string;
  assignmentPrompt: string;
  learningObjectives: string;
  rubric: string;
  studentAnswer: string;
  condition: "control" | "personalized";
  // Personalization context (chỉ dùng khi condition = personalized)
  studentName?: string;
  learningStyle?: LSScore | null;
  srl?: SRLScore | null;
  behavioralHints?: {
    timeSpentSec: number;
    editCount: number;
    pasteCount: number;
    wordCount: number;
  };
}

export interface FeedbackResult {
  feed_up: string;
  feed_back_task: string;
  feed_back_process: string;
  feed_back_self_reg: string;
  feed_forward: string;
  metacog_prompt: string;
  score: number; // 0-100
}

const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    feed_up: {
      type: "string",
      description:
        "Nhắc lại MỤC TIÊU học tập (Tôi đang đi đâu?). 1-2 câu, bám sát learning objectives.",
    },
    feed_back_task: {
      type: "string",
      description:
        "Phản hồi cấp NHIỆM VỤ: đúng/sai cụ thể trong bài làm, dẫn chiếu nội dung sinh viên viết.",
    },
    feed_back_process: {
      type: "string",
      description:
        "Phản hồi cấp QUÁ TRÌNH: cách tiếp cận/lập luận của sinh viên có gì hay, cần điều chỉnh chỗ nào.",
    },
    feed_back_self_reg: {
      type: "string",
      description:
        "Phản hồi cấp TỰ ĐIỀU CHỈNH: gợi ý cách sinh viên có thể tự kiểm tra, tự sửa khi gặp tình huống tương tự.",
    },
    feed_forward: {
      type: "string",
      description:
        "Bước tiếp theo CỤ THỂ (Bước tiếp theo là gì?). 2-3 hành động thực hiện được trong tuần tới.",
    },
    metacog_prompt: {
      type: "string",
      description:
        "Một câu hỏi siêu nhận thức (metacognitive prompt) buộc sinh viên tự suy ngẫm, KHÔNG được cho đáp án.",
    },
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Điểm tổng dựa trên rubric, thang 0-100.",
    },
  },
  required: [
    "feed_up",
    "feed_back_task",
    "feed_back_process",
    "feed_back_self_reg",
    "feed_forward",
    "metacog_prompt",
    "score",
  ],
} as const;

function buildSystemPrompt(condition: "control" | "personalized"): string {
  const base = `Bạn là trợ giảng AI cho khoá "Nhập môn Công nghệ Giáo dục" tại đại học Việt Nam.
Bạn sinh phản hồi cho bài làm của sinh viên theo khung Hattie & Timperley (2007).

NGUYÊN TẮC BẮT BUỘC:
1. Phản hồi bằng tiếng Việt, học thuật, lịch sự, mang tính xây dựng.
2. KHÔNG cung cấp đáp án trực tiếp; KHÔNG viết lại bài hộ sinh viên.
3. Dẫn chiếu cụ thể tới các phần sinh viên đã viết (trích đoạn ngắn nếu cần).
4. Phản hồi 3 cấp Hattie & Timperley: Task (đúng/sai), Process (cách làm), Self-regulation (tự kiểm tra).
5. Cấu trúc 3 chiều thời gian: Feed Up (mục tiêu) - Feed Back (hiện trạng) - Feed Forward (bước tiếp).
6. Luôn kết bằng MỘT câu hỏi siêu nhận thức để chống "metacognitive laziness".
7. Trả về ĐÚNG định dạng JSON theo schema được yêu cầu.`;

  if (condition === "control") {
    return (
      base +
      `

CHẾ ĐỘ HIỆN TẠI: ĐỐI CHỨNG (control) - phản hồi chuẩn, KHÔNG cá nhân hoá theo phong cách học hay năng lực.
Giữ giọng văn trung tính, dùng cấu trúc cố định.`
    );
  }

  return (
    base +
    `

CHẾ ĐỘ HIỆN TẠI: CÁ NHÂN HOÁ (personalized).
Bạn sẽ được cung cấp:
- Phong cách học (Felder-Silverman): điều chỉnh ví dụ, dạng minh hoạ phù hợp (Visual: dùng sơ đồ/bảng; Verbal: dùng giải thích bằng lời; Sensing: ví dụ thực tế; Intuitive: nguyên lý tổng quát; Active: gợi ý hoạt động làm thử; Reflective: gợi ý câu hỏi suy ngẫm; Sequential: hướng dẫn từng bước; Global: nhìn tổng thể trước).
- Mức tự điều chỉnh học tập (SRL):
  + SRL THẤP: tăng scaffold, đưa câu hỏi gợi mở rõ ràng, chia nhỏ Feed Forward.
  + SRL TRUNG BÌNH: cân bằng scaffold và độc lập.
  + SRL CAO: scaffold tối thiểu (tránh overscaffolding), tin tưởng năng lực tự học.
- Dấu vết hành vi (thời gian làm, số lần sửa, paste): nếu thời gian quá ngắn hoặc paste nhiều, lồng ghép nhắc nhở về liêm chính học thuật vào phần Self-regulation.
- Tên sinh viên: dùng tên (không họ) trong Feed Up và Feed Forward để tăng cảm giác cá nhân hoá.

LUÔN giữ trọng tâm sư phạm, không tâng bốc cá nhân (tránh feedback cấp "Self" vô bổ kiểu "Em giỏi lắm").`
  );
}

function buildUserPrompt(req: FeedbackRequest): string {
  const lines: string[] = [];
  lines.push(`# BÀI TẬP\nTiêu đề: ${req.assignmentTitle}`);
  lines.push(`\n## Đề bài\n${req.assignmentPrompt}`);
  lines.push(`\n## Mục tiêu học tập\n${req.learningObjectives}`);
  lines.push(`\n## Rubric chấm\n${req.rubric}`);
  lines.push(`\n# BÀI LÀM CỦA SINH VIÊN\n${req.studentAnswer}`);

  if (req.condition === "personalized") {
    lines.push(`\n# THÔNG TIN CÁ NHÂN HOÁ`);
    if (req.studentName) lines.push(`- Tên gọi: ${req.studentName}`);
    if (req.learningStyle) {
      lines.push(`- Phong cách học: ${describeStyle(req.learningStyle)}`);
      lines.push(
        `  (điểm thô: AR=${req.learningStyle.active_reflective}, SI=${req.learningStyle.sensing_intuitive}, VV=${req.learningStyle.visual_verbal}, SG=${req.learningStyle.sequential_global})`,
      );
    }
    if (req.srl) {
      lines.push(
        `- SRL tổng: ${req.srl.total} (mức ${srlLevel(req.srl.total)}); forethought=${req.srl.forethought}, performance=${req.srl.performance}, reflection=${req.srl.reflection}`,
      );
    }
    if (req.behavioralHints) {
      const b = req.behavioralHints;
      lines.push(
        `- Dấu vết hành vi: làm trong ${b.timeSpentSec}s, ${b.wordCount} từ, ${b.editCount} lần chỉnh sửa, ${b.pasteCount} lần paste.`,
      );
    }
  }

  lines.push(
    `\n# YÊU CẦU\nSinh phản hồi đầy đủ 7 trường (feed_up, feed_back_task, feed_back_process, feed_back_self_reg, feed_forward, metacog_prompt, score) đúng schema JSON.`,
  );
  return lines.join("\n");
}

export async function generateFeedback(
  req: FeedbackRequest,
): Promise<{ result: FeedbackResult; raw: string }> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.4,
    messages: [
      { role: "system", content: buildSystemPrompt(req.condition) },
      { role: "user", content: buildUserPrompt(req) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "feedback",
        schema: FEEDBACK_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  let parsed: FeedbackResult;
  try {
    parsed = JSON.parse(content) as FeedbackResult;
  } catch {
    throw new Error("AI trả về JSON không hợp lệ");
  }
  return { result: parsed, raw: content };
}

// ===== Per-material feedback (video/PDF/quiz) =====

export interface MaterialFeedbackRequest {
  materialType: "video" | "pdf" | "quiz";
  materialTitle: string;
  materialDescription: string;
  // Tóm tắt nội dung tài liệu để AI có ngữ cảnh
  materialSummary: string;
  // Thông tin tương tác:
  // - video: thời gian xem (s), % hoàn thành ước tính
  // - pdf: thời gian đọc (s), reflection text của sinh viên
  // - quiz: điểm + danh sách câu sai + reflection
  interactionData: Record<string, unknown>;
  reflectionText?: string;
  condition: "control" | "personalized";
  studentName?: string;
  learningStyle?: LSScore | null;
  srl?: SRLScore | null;
}

export interface MaterialFeedbackResult {
  summary: string;       // Tóm tắt nhanh hiệu suất
  strengths: string;     // Điều sinh viên đã làm tốt
  gaps: string;          // Khoảng trống cần lấp (Feed Back)
  next_steps: string;    // 2-3 hành động cụ thể (Feed Forward)
  metacog_prompt: string; // Câu hỏi siêu nhận thức
}

const MATERIAL_FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "1-2 câu tóm tắt hiệu suất tương tác với học liệu." },
    strengths: { type: "string", description: "Điều sinh viên đã làm tốt (cụ thể, dựa trên dữ liệu tương tác)." },
    gaps: { type: "string", description: "Khoảng trống/điểm cần cải thiện." },
    next_steps: { type: "string", description: "2-3 bước tiếp theo cụ thể để củng cố/mở rộng kiến thức từ học liệu này." },
    metacog_prompt: { type: "string", description: "1 câu hỏi siêu nhận thức buộc sinh viên tự suy ngẫm về quá trình học, KHÔNG đưa đáp án." },
  },
  required: ["summary", "strengths", "gaps", "next_steps", "metacog_prompt"],
} as const;

function buildMaterialSystemPrompt(req: MaterialFeedbackRequest): string {
  const base = `Bạn là trợ giảng AI cho khoá "Nhập môn Công nghệ Giáo dục".
Sinh viên vừa hoàn thành một học liệu (${req.materialType === "video" ? "video bài giảng" : req.materialType === "pdf" ? "tài liệu đọc" : "bài quiz"}).
Bạn sinh phản hồi NGẮN GỌN, có cấu trúc, để củng cố việc học từ học liệu này.

NGUYÊN TẮC BẮT BUỘC:
1. Tiếng Việt, học thuật, lịch sự.
2. KHÔNG cho đáp án trực tiếp với câu quiz sai - chỉ gợi ý và để sinh viên suy ngẫm.
3. Bám vào dữ liệu tương tác CỤ THỂ (điểm quiz, câu trả lời, reflection).
4. Tránh feedback cấp Self ("em giỏi lắm").
5. Luôn kết bằng câu hỏi siêu nhận thức.
6. Trả về JSON đúng schema.`;
  if (req.condition === "control") {
    return base + `\n\nCHẾ ĐỘ: ĐỐI CHỨNG (control) - phản hồi chuẩn, không cá nhân hoá.`;
  }
  return (
    base +
    `\n\nCHẾ ĐỘ: CÁ NHÂN HOÁ (personalized).
Điều chỉnh theo:
- Phong cách học (Visual: dùng từ "hình dung/sơ đồ"; Verbal: dùng giải thích bằng lời; Sensing: ví dụ thực tế; Intuitive: nguyên lý; Active: gợi ý hoạt động làm thử; Reflective: gợi ý câu hỏi suy ngẫm; Sequential: chia bước; Global: nhìn tổng thể).
- SRL: thấp → scaffold mạnh, gợi mở rõ; cao → ít scaffold để tránh overscaffolding.`
  );
}

function buildMaterialUserPrompt(req: MaterialFeedbackRequest): string {
  const lines: string[] = [];
  lines.push(`# HỌC LIỆU\nLoại: ${req.materialType.toUpperCase()}`);
  lines.push(`Tiêu đề: ${req.materialTitle}`);
  if (req.materialDescription) lines.push(`Mô tả: ${req.materialDescription}`);
  lines.push(`\n## Tóm tắt nội dung\n${req.materialSummary}`);
  lines.push(`\n## Tương tác của sinh viên\n${JSON.stringify(req.interactionData, null, 2)}`);
  if (req.reflectionText) {
    lines.push(`\n## Suy ngẫm của sinh viên\n"${req.reflectionText}"`);
  }
  if (req.condition === "personalized") {
    lines.push(`\n# THÔNG TIN CÁ NHÂN HOÁ`);
    if (req.studentName) lines.push(`- Tên: ${req.studentName}`);
    if (req.learningStyle)
      lines.push(`- Phong cách học: ${describeStyle(req.learningStyle)}`);
    if (req.srl)
      lines.push(
        `- SRL: ${req.srl.total} (mức ${srlLevel(req.srl.total)})`,
      );
  }
  lines.push(`\n# YÊU CẦU\nSinh feedback theo schema JSON.`);
  return lines.join("\n");
}

export async function generateMaterialFeedback(
  req: MaterialFeedbackRequest,
): Promise<{ result: MaterialFeedbackResult; raw: string }> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.5,
    messages: [
      { role: "system", content: buildMaterialSystemPrompt(req) },
      { role: "user", content: buildMaterialUserPrompt(req) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "material_feedback",
        schema: MATERIAL_FEEDBACK_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });
  const content = completion.choices[0]?.message?.content ?? "{}";
  let parsed: MaterialFeedbackResult;
  try {
    parsed = JSON.parse(content) as MaterialFeedbackResult;
  } catch {
    throw new Error("AI trả về JSON không hợp lệ");
  }
  return { result: parsed, raw: content };
}

export interface PersonalizationContext {
  studentName: string;
  learningStyle: LSScore | null;
  srl: SRLScore | null;
}

export function loadPersonalizationContext(
  userId: number,
): PersonalizationContext {
  const user = db
    .prepare("SELECT full_name FROM users WHERE id = ?")
    .get(userId) as { full_name: string } | undefined;
  const ls = db
    .prepare(
      "SELECT active_reflective, sensing_intuitive, visual_verbal, sequential_global FROM learning_styles WHERE user_id = ?",
    )
    .get(userId) as LSScore | undefined;
  const srlRow = db
    .prepare(
      "SELECT score_total as total, score_forethought as forethought, score_performance as performance, score_reflection as reflection FROM srl_responses WHERE user_id = ? AND phase = 'pre'",
    )
    .get(userId) as SRLScore | undefined;
  return {
    studentName: user?.full_name?.split(" ").slice(-1)[0] ?? "bạn",
    learningStyle: ls ?? null,
    srl: srlRow ?? null,
  };
}
