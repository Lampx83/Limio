/**
 * Seed 4 demo accounts for manual testing:
 *   - alice@feedbackme.dev   (Instructor — owner of "Đại số cơ bản")
 *   - bob@feedbackme.dev     (Learner đã enroll, đã hoàn thành 2/4 lesson)
 *   - charlie@feedbackme.dev (Learner mới, chưa enroll)
 *   - admin@feedbackme.dev   (Admin — full platform access)
 *
 * alice/bob/charlie password: password1234 (intentionally public demo creds,
 * no elevated privilege — fine to hardcode).
 *
 * admin@feedbackme.dev password: DEMO_ADMIN_PASSWORD env var. This account
 * has real Admin role, so its password must never live in tracked source
 * (repo is public). In production (NODE_ENV=production) the var is
 * required — the seed fails loudly rather than silently falling back to a
 * hardcoded value. Outside production it falls back to password1234 so
 * local/dev seeding keeps working without extra setup.
 *
 * Idempotent: safe to run repeatedly.
 *
 * Run AFTER seed-sample-course.ts so the course exists for Bob to enroll in.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";
import { RoleName } from "@feedbackme/shared-types";
import { seedDefaultSectionId } from "./seedHelpers";

const prisma = new PrismaClient();
const PASSWORD = "password1234";

function adminPassword(): string {
  const fromEnv = process.env.DEMO_ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DEMO_ADMIN_PASSWORD chưa được set. admin@feedbackme.dev có role Admin " +
        "thật — không được seed bằng password cứng trong code (repo public). " +
        "Set DEMO_ADMIN_PASSWORD trong .env.prod rồi deploy lại.",
    );
  }
  return PASSWORD;
}

interface DemoUser {
  email: string;
  displayName: string;
  roles: string[];
  password: string;
}

const USERS: DemoUser[] = [
  {
    email: "alice@feedbackme.dev",
    displayName: "Alice (Demo Instructor)",
    roles: [RoleName.Learner, RoleName.Instructor],
    password: PASSWORD,
  },
  {
    email: "bob@feedbackme.dev",
    displayName: "Bob (Demo Learner — đang học)",
    roles: [RoleName.Learner],
    password: PASSWORD,
  },
  {
    email: "charlie@feedbackme.dev",
    displayName: "Charlie (Demo Learner — mới)",
    roles: [RoleName.Learner],
    password: PASSWORD,
  },
  {
    email: "admin@feedbackme.dev",
    displayName: "Admin (Demo)",
    roles: [RoleName.Learner, RoleName.Admin],
    password: adminPassword(),
  },
];

async function ensureUser(u: DemoUser): Promise<string> {
  // Always (re-)hash so running the seed on an existing DB resets demo passwords.
  // bcrypt is slow by design — 12 rounds is fine for a one-off seed script.
  const passwordHash = await bcrypt.hash(u.password, 12);

  const existing = await prisma.user.findUnique({
    where: { email: u.email },
    include: { authProviders: true },
  });

  const userId = existing ? existing.id : (await (async () => {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        displayName: u.displayName,
        emailVerifiedAt: new Date(),
        authProviders: { create: { provider: "password", providerUserId: u.email } },
      },
    });
    console.log(`Created ${u.email}`);
    return created.id;
  })());

  if (existing) {
    // Refresh password + mark email verified in case the row was created by
    // direct SQL or an older seed that left passwordHash/emailVerifiedAt wrong.
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, emailVerifiedAt: new Date() },
    });
    // Ensure the password AuthProvider row exists (direct-SQL inserts may omit it).
    const hasPasswordProvider = existing.authProviders.some(
      (p) => p.provider === "password",
    );
    if (!hasPasswordProvider) {
      await prisma.authProvider.create({
        data: { userId, provider: "password", providerUserId: u.email },
      });
    }
  }

  // Ensure all expected roles are assigned (idempotent for existing users).
  for (const roleName of u.roles) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const hasRole = await prisma.userRole.findFirst({
      where: { userId, roleId: role.id },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId, roleId: role.id, grantedBy: userId },
      });
    }
  }
  console.log(`${existing ? "Refreshed" : "Created"} ${u.email} (${u.roles.join(", ")})`);
  return userId;
}

async function ensureBobIsHalfwayThrough(bobId: string) {
  const course = await prisma.course.findUnique({
    where: { slug: "dai-so-co-ban" },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: { lessons: { orderBy: { orderIndex: "asc" } } },
      },
    },
  });
  if (!course) {
    console.log("Course dai-so-co-ban not found — run seed:sample-course first.");
    return;
  }

  // Enroll if not already.
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: bobId, courseId: course.id } },
  });
  if (!existingEnrollment) {
    const sectionId = await seedDefaultSectionId(course.id, prisma);
    await prisma.enrollment.create({
      data: {
        userId: bobId,
        courseId: course.id,
        sectionId,
        courseVersion: course.version,
        status: "active",
      },
    });
    await prisma.learningEvent.create({
      data: {
        userId: bobId,
        eventType: "enrollment.created",
        payload: { courseId: course.id, courseVersion: course.version },
        courseId: course.id,
      },
    });
  }

  // Complete first 2 lessons (idempotent via eventKey).
  const firstTwo = course.modules.flatMap((m) => m.lessons).slice(0, 2);
  for (const lesson of firstTwo) {
    const eventKey = `lesson.completed:${bobId}:${lesson.id}`;
    const existing = await prisma.learningEvent.findUnique({ where: { eventKey } });
    if (!existing) {
      await prisma.learningEvent.create({
        data: {
          userId: bobId,
          eventType: "lesson.completed",
          payload: { lessonId: lesson.id, reason: "marked_complete" },
          courseId: course.id,
          eventKey,
        },
      });
    }
  }

  // Set last lesson + position so resume link shows up.
  const thirdLesson = course.modules.flatMap((m) => m.lessons)[2];
  if (thirdLesson) {
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: bobId, courseId: course.id } },
      data: { lastLessonId: thirdLesson.id, lastPositionSec: 60 },
    });
  }
  console.log(`Bob enrolled in dai-so-co-ban + completed 2/4 lessons.`);
}

async function main() {
  // Roles must already exist — ensure them defensively.
  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  const ids: Record<string, string> = {};
  for (const u of USERS) {
    ids[u.email] = await ensureUser(u);
  }
  await ensureBobIsHalfwayThrough(ids["bob@feedbackme.dev"]!);

  console.log(
    "\nDemo accounts (alice/bob/charlie password = password1234; admin password = DEMO_ADMIN_PASSWORD, not logged):",
  );
  for (const u of USERS) {
    console.log(`  - ${u.email}  →  ${u.roles.join(" + ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
