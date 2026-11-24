/**
 * Tách MỘT khoá thành nhiều khoá, mỗi khoá nhận một nhóm chương (vd giáo trình HSK 4 → 5 quyển).
 *
 *   pnpm split:course -- --plan plan.json --out ket-qua.json                    # chạy thử, không ghi DB
 *   (thêm --only slug1,slug2 để chỉ làm một vài khoá trong kế hoạch)
 *   pnpm split:course -- --plan plan.json --out ket-qua.json --covers ./covers --stage ./stage --apply
 *   (dùng split:course:prod để trỏ vào DB production qua đường hầm)
 *
 * plan.json:
 *   { "source": "hsk-4-goc", "owner": "gv@example.com",
 *     "courses": [ { "slug": "...", "title": "...", "description": "<p>..</p>", "modules": [0,1,2,3,4], "cover": "bia-q1.jpg" } ] }
 *   `modules` là orderIndex của chương trong khoá gốc; `cover` là tên tệp trong thư mục --covers (tuỳ chọn).
 *
 * Làm gì: dùng đúng `cloneModuleTree` của nhân bản khoá (bài, khối, quiz, câu hỏi, Bài luyện sao sâu, nhãn kỹ năng),
 * nên bản sao độc lập với khoá gốc và media dùng chung tham chiếu (không nhân đôi tệp). Khoá gốc KHÔNG bị đụng:
 * không xoá chương, không đổi ghi danh. Khoá mới ở trạng thái NHÁP; chủ khoá = `owner`.
 *
 * Ảnh bìa: với `cover`, script ghi tệp vào `--stage/public/course-covers/<courseId>/<tên>` (để đóng gói rồi chép vào
 * thư mục uploads của máy chủ) và đặt `coverUrl` theo đúng quy ước của route tải bìa. Tên tệp mang hậu tố ngẫu nhiên.
 *
 * Idempotent theo slug: khoá có slug đã tồn tại thì bỏ qua (không ghi đè).
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@feedbackme/db";
import { cloneModuleTree, MODULE_TREE_INCLUDE } from "../src/courses/courses";
import { setCourseProtectedMedia } from "../src/courses/protectedMedia";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

interface PlanCourse {
  slug: string;
  title: string;
  description: string;
  modules: number[];
  cover?: string;
}
interface Plan {
  source: string;
  owner: string;
  courses: PlanCourse[];
}

async function main() {
  const planPath = arg("plan");
  if (!planPath) throw new Error("Thiếu --plan <tệp.json>");
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
  const apply = has("apply");
  const covers = arg("covers");
  const stage = arg("stage");
  const outPath = arg("out");

  const owner = await prisma.user.findFirst({ where: { email: plan.owner }, select: { id: true, email: true } });
  if (!owner) throw new Error(`Không thấy người dùng ${plan.owner}`);
  const src = await prisma.course.findUnique({
    where: { slug: plan.source },
    include: { modules: { orderBy: { orderIndex: "asc" }, include: MODULE_TREE_INCLUDE } },
  });
  if (!src) throw new Error(`Không thấy khoá nguồn ${plan.source}`);

  // Mọi chương được phân đúng một lần, không sót, không trùng.
  const seen = new Set<number>();
  for (const c of plan.courses) {
    for (const idx of c.modules) {
      if (seen.has(idx)) throw new Error(`Chương orderIndex=${idx} bị chia cho hai khoá`);
      seen.add(idx);
      if (!src.modules.some((m) => m.orderIndex === idx)) throw new Error(`Khoá nguồn không có chương orderIndex=${idx}`);
    }
  }
  const missing = src.modules.filter((m) => !seen.has(m.orderIndex)).map((m) => m.orderIndex);
  if (missing.length) throw new Error(`Còn chương chưa được chia: ${missing.join(", ")}`);

  const results: unknown[] = [];
  const only = arg("only")?.split(",");
  for (const c of plan.courses) {
    if (only && !only.includes(c.slug)) continue;
    const mods = c.modules.map((i) => src.modules.find((m) => m.orderIndex === i)!);
    const lessons = mods.flatMap((m) => m.lessons);
    const items = lessons.reduce((n, l) => n + l.contentItems.length, 0);
    const practice = lessons.reduce((n, l) => n + l.contentItems.filter((x) => x.type === "exam_practice").length, 0);
    console.log(`\n== ${c.slug} · ${c.title}\n   ${mods.length} chương, ${lessons.length} bài, ${items} khối (${practice} Bài luyện), cover=${c.cover ?? "-"}`);
    for (const m of mods) console.log(`   - [${m.orderIndex}] ${m.title} (${m.lessons.length} bài)`);

    const exists = await prisma.course.findUnique({ where: { slug: c.slug }, select: { id: true } });
    if (exists) {
      console.log(`   BỎ QUA: slug đã tồn tại (${exists.id})`);
      results.push({ slug: c.slug, skipped: true, courseId: exists.id });
      continue;
    }
    if (!apply) continue;

    const created = await prisma.$transaction(
      async (tx) => {
        const nc = await tx.course.create({
          data: {
            slug: c.slug,
            title: c.title,
            description: c.description,
            language: src.language,
            level: src.level,
            category: src.category,
            personalizationEnabled: src.personalizationEnabled,
            languageMode: src.languageMode,
            publicAccess: src.publicAccess,
            enrollMode: src.enrollMode,
            protectedMedia: src.protectedMedia,
            currency: src.currency,
            priceCents: null,
            organizationId: src.organizationId,
            status: "draft",
            version: 1,
          },
        });
        await tx.courseInstructor.create({ data: { courseId: nc.id, userId: owner.id, role: "owner" } });
        const map: Array<{ title: string; lessons: Array<{ title: string; oldId: string; newId: string }> }> = [];
        let pos = 0;
        for (const m of mods) {
          const { lessonIdMap } = await cloneModuleTree(tx, m, nc.id, pos++);
          map.push({
            title: m.title,
            lessons: m.lessons.map((l) => ({ title: l.title, oldId: l.id, newId: lessonIdMap.get(l.id)! })),
          });
        }
        return { courseId: nc.id, map };
      },
      { timeout: 60 * 60 * 1000, maxWait: 60 * 1000 },
    );
    console.log(`   ĐÃ TẠO ${created.courseId}`);

    // Bảng tra tệp được bảo vệ của khoá mới (cờ protectedMedia đã bật ở khoá gốc).
    if (src.protectedMedia) {
      const r = await setCourseProtectedMedia(owner.id, created.courseId, true);
      console.log(`   protectedMedia: ${r.files} tệp`);
    }

    let coverUrl: string | null = null;
    if (c.cover && covers && stage) {
      const ext = path.extname(c.cover).toLowerCase().replace(".", "") || "jpg";
      const filename = `${created.courseId}-${randomBytes(6).toString("hex")}.${ext}`;
      const dir = path.join(stage, "public", "course-covers", created.courseId);
      mkdirSync(dir, { recursive: true });
      copyFileSync(path.join(covers, c.cover), path.join(dir, filename));
      coverUrl = `/api/course-covers/${filename}`;
      await prisma.course.update({ where: { id: created.courseId }, data: { coverUrl } });
      console.log(`   bìa: ${coverUrl}`);
    }
    results.push({ slug: c.slug, courseId: created.courseId, coverUrl, modules: created.map });
  }

  if (outPath) writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(apply ? "\nXong (đã ghi DB)." : "\nChạy thử xong (chưa ghi gì). Thêm --apply để thực hiện.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
