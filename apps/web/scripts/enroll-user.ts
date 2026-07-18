/**
 * Enroll a user into a course by email + slug. Idempotent (the service
 * returns created:false if the enrollment already exists).
 *
 *   tsx scripts/enroll-user.ts <email> <course-slug> [...more-slugs]
 */
import { prisma } from "@feedbackme/db";
import { enrollInCourse } from "@feedbackme/core-lms";

async function main() {
  const [email, ...slugs] = process.argv.slice(2);
  if (!email || slugs.length === 0) {
    console.error("usage: enroll-user.ts <email> <course-slug> [...more-slugs]");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no user ${email}`);

  for (const slug of slugs) {
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course) throw new Error(`no course ${slug}`);
    const r = await enrollInCourse(user.id, course.id, prisma);
    console.log(`${slug}: ${r.created ? "enrolled" : "already enrolled"}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
