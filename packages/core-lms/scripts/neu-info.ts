/**
 * In địa chỉ cổng NEU TTS (giao thức, máy chủ, cổng, đường dẫn — KHÔNG in khoá) đọc từ DB, để script nhập prod mở đường hầm SSH tới đúng cổng.
 * Chạy với `--env-file=../db/.env.prod-import` (DATABASE_URL + SECRETS_MASTER_KEY).
 */
import { prisma } from "@feedbackme/db";
import { getIntegrationSecret } from "../src/integrations/integrations";

async function main() {
  const u = new URL(await getIntegrationSecret("neutts.base_url"));
  console.log(`NEU_SCHEME=${u.protocol.replace(":", "")}`);
  console.log(`NEU_HOST=${u.hostname}`);
  console.log(`NEU_PORT=${u.port || (u.protocol === "https:" ? "443" : "80")}`);
  // Gateway Kong route theo đường dẫn (vd /tts → /v1/speech): giữ nguyên khi đổi sang địa chỉ qua đường hầm.
  console.log(`NEU_PATH=${u.pathname.replace(/\/+$/, "")}`);
}

main()
  .catch((e) => {
    console.error(`Không đọc được cấu hình NEU: ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
