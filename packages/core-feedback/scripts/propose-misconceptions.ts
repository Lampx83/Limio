/**
 * B9.3 bước 1 — đề xuất misconception cho phương án nhiễu chưa gắn.
 *
 * CHỈ ĐỌC, không ghi nội dung vào DB. Kết quả ra file JSON để giảng viên duyệt,
 * rồi mới chạy apply-misconceptions.ts.
 *
 * Hai chế độ:
 *
 *   (a) Đọc thẳng DB — cần DATABASE_URL trỏ tới nơi có dữ liệu:
 *       pnpm --filter @feedbackme/core-feedback propose:misconceptions -- \
 *         --course=thiet-ke-ui-ux --out=./uiux.misconceptions.json
 *
 *   (b) Offline, đọc file đã trích sẵn — không cần nối tới DB production,
 *       không cần mật khẩu DB. Chỉ cần OPENAI_API_KEY:
 *       pnpm --filter @feedbackme/core-feedback propose:misconceptions -- \
 *         --from-export=./tt3.export.json --out=./tt3.misconceptions.json
 */

import OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  suggestMisconceptionsForQuestion,
  type MisconceptionCatalogueEntry,
  type MisconceptionProposal,
} from "../src/aiTutor/generators";
import fs from "node:fs";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const courseSlug = arg("course");
const outPath = arg("out");
const limit = Number(arg("limit") ?? "0");
const model = arg("model") ?? "gpt-4o-mini";
/**
 * Chế độ offline: đọc câu hỏi từ file trích sẵn thay vì từ DB. Dùng khi dữ liệu
 * nằm ở production mà máy chạy script không nối tới được — không cần tunnel,
 * không cần mật khẩu DB, và không ghi gì vào DB nào cả.
 */
const fromExport = arg("from-export");

/** Chỉ hai loại này khớp được misconception — xem AC nhóm 1. */
const TAGGABLE = ["mcq", "true_false"] as const;

async function resolveOpenAiKey(): Promise<string> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (fromExport) {
    // Offline thì không có DB prod để lấy khoá — phải có sẵn trong env.
    throw new Error(
      "Chế độ --from-export cần OPENAI_API_KEY trong môi trường (hoặc trong packages/db/.env).",
    );
  }
  // Khoá thật nằm trong IntegrationCredential (đã mã hoá). core-lms là
  // devDependency của package này, dùng được trong script tooling.
  const { getIntegrationSecret } = await import("@feedbackme/core-lms");
  return getIntegrationSecret("openai");
}

interface SourceOption {
  id: string;
  label: string;
  isCorrect: boolean;
  misconceptionId: string | null;
}

interface SourceQuestion {
  id: string;
  type: string;
  prompt: string;
  lessonTitle: string | null;
  options: SourceOption[];
}

interface Source {
  label: string;
  courseSlug: string;
  /** null ⇒ để suggester tự đọc danh mục từ DB. */
  catalogue: MisconceptionCatalogueEntry[] | null;
  /** Người chịu trách nhiệm, dùng để ghi AiUsageLog. Offline thì bỏ ghi. */
  actorUserId: string;
  logUsage: boolean;
  questions: SourceQuestion[];
}

/** Hình dạng file do bước trích dữ liệu sinh ra. */
interface ExportFile {
  course: string;
  catalogue: MisconceptionCatalogueEntry[] | null;
  questions:
    | Array<{
        questionId: string;
        type: string;
        prompt: string;
        lessonTitle: string | null;
        options: SourceOption[] | null;
      }>
    | null;
}

function loadFromExport(path: string): Source {
  const data = JSON.parse(fs.readFileSync(path, "utf8")) as ExportFile;
  const questions = (data.questions ?? [])
    .filter((q) => (TAGGABLE as readonly string[]).includes(q.type))
    .map((q) => ({
      id: q.questionId,
      type: q.type,
      prompt: q.prompt,
      lessonTitle: q.lessonTitle,
      options: q.options ?? [],
    }));
  return {
    label: `${data.course} (offline, từ ${path})`,
    courseSlug: data.course,
    catalogue: data.catalogue ?? [],
    actorUserId: "offline",
    logUsage: false,
    questions,
  };
}

async function loadFromDb(slug: string): Promise<Source | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true },
  });
  if (!course) {
    console.error(`Không tìm thấy course slug=${slug}`);
    return null;
  }
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) {
    console.error("Course không có owner — không xác định được actor để log usage.");
    return null;
  }

  // AC-2.1 — câu taggable còn ít nhất một phương án sai chưa gắn.
  const rows = await prisma.quizQuestion.findMany({
    where: {
      quiz: { courseId: course.id },
      type: { in: [...TAGGABLE] },
      options: { some: { isCorrect: false, misconceptionId: null } },
    },
    select: {
      id: true,
      type: true,
      prompt: true,
      options: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, label: true, isCorrect: true, misconceptionId: true },
      },
      quiz: { select: { lesson: { select: { title: true } } } },
    },
    orderBy: { id: "asc" },
  });

  return {
    label: `${course.title} (${course.slug})`,
    courseSlug: course.slug,
    catalogue: null,
    actorUserId: owner.userId,
    logUsage: true,
    questions: rows.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      lessonTitle: q.quiz.lesson?.title ?? null,
      options: q.options,
    })),
  };
}

async function main() {
  if (!outPath || (!courseSlug && !fromExport)) {
    console.error(
      "Thiếu tham số. Một trong hai:\n" +
        "  --course=<slug> --out=<file.json>            (đọc DB)\n" +
        "  --from-export=<file.json> --out=<file.json>  (offline)\n" +
        "Tuỳ chọn: --limit=N --model=gpt-4o",
    );
    process.exitCode = 1;
    return;
  }

  const source = fromExport
    ? loadFromExport(fromExport)
    : await loadFromDb(courseSlug!);
  if (!source) {
    process.exitCode = 1;
    return;
  }

  // Chỉ giữ câu còn phương án sai chưa gắn (file export có thể rộng hơn).
  let questions = source.questions.filter((q) =>
    q.options.some((o) => !o.isCorrect && o.misconceptionId === null),
  );
  if (limit > 0) questions = questions.slice(0, limit);

  if (questions.length === 0) {
    console.log("Không có câu nào cần đề xuất.");
    return;
  }

  // Log trước khi lấy khoá API — thiếu khoá thì vẫn thấy được phạm vi công việc.
  console.log(
    `Nguồn: ${source.label}\nCâu cần xử lý: ${questions.length} · model=${model}\n`,
  );

  const openai = new OpenAI({ apiKey: await resolveOpenAiKey() });

  const items: Array<{
    questionId: string;
    type: string;
    lesson: string | null;
    prompt: string;
    correct: string;
    options: Array<MisconceptionProposal & { skip: boolean }>;
  }> = [];

  let done = 0;
  let proposed = 0;
  let declined = 0;

  for (const q of questions) {
    // Chỉ gửi phương án CHƯA gắn; cái đã gắn giữ nguyên, không đụng vào.
    const pending = q.options.filter((o) => !o.isCorrect && o.misconceptionId === null);
    try {
      const proposals = await suggestMisconceptionsForQuestion(
        source.actorUserId,
        {
          questionId: q.id,
          prompt: q.prompt,
          lessonTitle: q.lessonTitle ?? undefined,
          options: [...q.options.filter((o) => o.isCorrect), ...pending].map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
          })),
        },
        openai,
        model,
        prisma,
        {
          ...(source.catalogue ? { catalogue: source.catalogue } : {}),
          skipUsageLog: !source.logUsage,
        },
      );

      proposed += proposals.filter((p) => p.misconceptionCode !== null).length;
      declined += proposals.filter((p) => p.misconceptionCode === null).length;

      items.push({
        questionId: q.id,
        type: q.type,
        lesson: q.lessonTitle,
        prompt: q.prompt,
        correct: q.options.filter((o) => o.isCorrect).map((o) => o.label).join(" / "),
        options: proposals.map((p) => ({ ...p, skip: false })),
      });
    } catch (e) {
      console.error(`  ! câu ${q.id}: ${(e as Error).message}`);
    }

    done += 1;
    if (done % 10 === 0) console.log(`  ...${done}/${questions.length}`);
  }

  const payload = {
    course: source.courseSlug,
    generatedAt: new Date().toISOString(),
    model,
    huongDan:
      "Duyệt từng phương án. Đặt skip=true để bỏ qua. Sửa thoải mái misconceptionCode / feedbackBody. " +
      "misconceptionCode=null nghĩa là phương án đó không lộ hiểu nhầm nào — để nguyên là hợp lệ.",
    items,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(
    `\nXong. ${items.length} câu → ${outPath}\n` +
      `  đề xuất gắn: ${proposed}\n` +
      `  để trống (không lộ hiểu nhầm): ${declined}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
