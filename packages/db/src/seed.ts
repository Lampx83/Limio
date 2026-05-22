import { PrismaClient } from "./generated/client";
import { RoleName } from "@feedbackme/shared-types";
import { seedMissionTemplates } from "./seed-mission-templates";

const prisma = new PrismaClient();

async function main() {
  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("Seeded roles:", Object.values(RoleName).join(", "));

  // Mission templates — required by the COURSE_LINKED tournament mission
  // picker. Idempotent (upsert by code).
  await seedMissionTemplates(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
