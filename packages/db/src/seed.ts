import { PrismaClient } from "@prisma/client";
import { RoleName } from "@feedbackme/shared-types";

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
