import { PrismaClient, TimerTemplate } from "@feedbackme/db";

export interface CreateTimerTemplateInput {
  userId: string;
  name: string;
  durationSeconds: number;
  description?: string;
  notes?: string;
  musicId?: string;
  courseId?: string;
  isPublic?: boolean;
}

export interface UpdateTimerTemplateInput {
  name?: string;
  description?: string;
  durationSeconds?: number;
  notes?: string;
  musicId?: string;
  courseId?: string;
  isPublic?: boolean;
}

/**
 * Create a new timer template for an instructor
 */
export async function createTimerTemplate(
  input: CreateTimerTemplateInput,
  db: PrismaClient
): Promise<TimerTemplate> {
  // Validate duration
  if (input.durationSeconds < 1) {
    throw new Error("Duration must be at least 1 second");
  }

  const template = await db.timerTemplate.create({
    data: {
      userId: input.userId,
      name: input.name,
      description: input.description,
      durationSeconds: input.durationSeconds,
      notes: input.notes,
      musicId: input.musicId,
      courseId: input.courseId || null,
      isPublic: input.isPublic || false,
    },
  });

  return template;
}

/**
 * Get all timer templates for a user, optionally filtered by course
 */
export async function getUserTimerTemplates(
  userId: string,
  options: { courseId?: string; limit?: number; offset?: number } = {},
  db: PrismaClient
): Promise<{ templates: TimerTemplate[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const where: any = { userId };
  if (options.courseId) {
    where.courseId = options.courseId;
  }

  const [templates, total] = await Promise.all([
    db.timerTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.timerTemplate.count({ where }),
  ]);

  return { templates, total };
}

/**
 * Get a single timer template by ID (with ownership check)
 */
export async function getTimerTemplate(
  templateId: string,
  userId: string,
  db: PrismaClient
): Promise<TimerTemplate | null> {
  const template = await db.timerTemplate.findUnique({
    where: { id: templateId },
  });

  // Only return if user is the owner
  if (template && template.userId !== userId) {
    return null;
  }

  return template;
}

/**
 * Update a timer template (ownership check required)
 */
export async function updateTimerTemplate(
  templateId: string,
  userId: string,
  updates: UpdateTimerTemplateInput,
  db: PrismaClient
): Promise<TimerTemplate> {
  // Verify ownership
  const existing = await db.timerTemplate.findUnique({
    where: { id: templateId },
  });

  if (!existing || existing.userId !== userId) {
    throw new Error("Not authorized to update this template");
  }

  // Validate duration if provided
  if (updates.durationSeconds !== undefined && updates.durationSeconds < 1) {
    throw new Error("Duration must be at least 1 second");
  }

  const template = await db.timerTemplate.update({
    where: { id: templateId },
    data: updates,
  });

  return template;
}

/**
 * Delete a timer template (ownership check required)
 */
export async function deleteTimerTemplate(
  templateId: string,
  userId: string,
  db: PrismaClient
): Promise<void> {
  // Verify ownership
  const existing = await db.timerTemplate.findUnique({
    where: { id: templateId },
  });

  if (!existing || existing.userId !== userId) {
    throw new Error("Not authorized to delete this template");
  }

  await db.timerTemplate.delete({
    where: { id: templateId },
  });
}

/**
 * Helper: Convert duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
