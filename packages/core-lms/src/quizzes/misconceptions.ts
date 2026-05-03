import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { QuizError } from "./types";

export const CreateMisconceptionInput = z.object({
  code: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "lowercase + underscores only"),
  name: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(5_000).trim(),
});

export class MisconceptionError extends Error {
  constructor(public readonly code: "validation_failed" | "code_taken") {
    super(code);
  }
}

export async function createMisconception(
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ misconceptionId: string }> {
  const parsed = CreateMisconceptionInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new MisconceptionError("validation_failed");
  }
  const existing = await db.misconception.findUnique({ where: { code: parsed.data.code } });
  if (existing) throw new MisconceptionError("code_taken");
  const m = await db.misconception.create({ data: parsed.data });
  return { misconceptionId: m.id };
}

export async function listMisconceptions(db: PrismaClient = prisma) {
  return db.misconception.findMany({ orderBy: { code: "asc" } });
}

export { QuizError };
