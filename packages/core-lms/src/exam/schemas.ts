import { z } from "zod";

/**
 * Zod schemas for ExamQuestion.config — one per question type.
 * The DB column is Json; these schemas validate shape at create/update time.
 */

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(2_000),
  isCorrect: z.boolean(),
});

export const McqConfig = z
  .object({
    options: z.array(optionSchema).min(2).max(10),
  })
  .refine((c) => c.options.filter((o) => o.isCorrect).length === 1, {
    message: "MCQ must have exactly one correct option",
  })
  .refine((c) => new Set(c.options.map((o) => o.id)).size === c.options.length, {
    message: "option ids must be unique",
  });

export const MultiConfig = z
  .object({
    options: z.array(optionSchema).min(2).max(10),
  })
  .refine((c) => c.options.some((o) => o.isCorrect), {
    message: "MULTI must have at least one correct option",
  })
  .refine((c) => new Set(c.options.map((o) => o.id)).size === c.options.length, {
    message: "option ids must be unique",
  });

export const TrueFalseNotGivenConfig = z.object({
  correct: z.enum(["true", "false", "notgiven"]),
});

const blankSchema = z.object({
  id: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1).max(200)).min(1).max(20),
  matchMode: z.enum(["exact", "case_insensitive"]).default("case_insensitive"),
});

export const GapFillConfig = z.object({
  blanks: z.array(blankSchema).min(1).max(20),
});

export const ShortAnswerConfig = z.object({
  acceptedAnswers: z.array(z.string().min(1).max(200)).min(1).max(20),
  matchMode: z.enum(["exact", "case_insensitive"]).default("case_insensitive"),
});

export const EssayConfig = z.object({
  rubric: z.string().max(5_000).optional(),
  minWords: z.number().int().positive().max(10_000).optional(),
});

/** Discriminated by ExamQuestion.type. */
export function configSchemaForType(type: string): z.ZodTypeAny {
  switch (type) {
    case "mcq":
      return McqConfig;
    case "multi":
      return MultiConfig;
    case "true_false_notgiven":
      return TrueFalseNotGivenConfig;
    case "gap_fill":
      return GapFillConfig;
    case "short_answer":
      return ShortAnswerConfig;
    case "essay":
      return EssayConfig;
    default:
      // matching_heading (P1) and unknown types — reject in P0.
      return z.never();
  }
}
