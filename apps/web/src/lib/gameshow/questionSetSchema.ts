import { z } from "zod";

export const QUESTION_TIME_LIMIT_MIN_SEC = 5;
export const QUESTION_TIME_LIMIT_MAX_SEC = 120;
export const QUESTION_TIME_LIMIT_DEFAULT_SEC = 20;

const OptionSchema = z.object({
  label: z.string().trim().min(1).max(200),
  isCorrect: z.boolean(),
});

export const QuestionItemInput = z
  .object({
    type: z.enum(["mcq", "true_false"]),
    prompt: z.string().trim().min(1).max(2000),
    timeLimitSec: z
      .number()
      .int()
      .min(QUESTION_TIME_LIMIT_MIN_SEC)
      .max(QUESTION_TIME_LIMIT_MAX_SEC)
      .default(QUESTION_TIME_LIMIT_DEFAULT_SEC),
    options: z.array(OptionSchema).min(2).max(6),
  })
  .superRefine((val, ctx) => {
    const correctCount = val.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phải có đúng 1 đáp án đúng",
        path: ["options"],
      });
    }
    if (val.type === "true_false" && val.options.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Câu đúng/sai phải có đúng 2 lựa chọn",
        path: ["options"],
      });
    }
  });
