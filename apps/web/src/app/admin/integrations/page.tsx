import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, listIntegrationStatuses } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import IntegrationsManager from "./IntegrationsManager";

export const dynamic = "force-dynamic";

export default async function IntegrationsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/integrations");
  if (!(await isAdmin(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Chỉ admin mới quản lý được integration credentials.
        </p>
      </main>
    );
  }

  const statuses = await listIntegrationStatuses();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm underline">
        ← Trang chủ
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Integration credentials</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Lưu API keys (OpenAI, Stripe, VNPay, Momo) — encrypted AES-256-GCM với
        master key từ env <code>SECRETS_MASTER_KEY</code>. Plaintext không bao
        giờ trả về client.
      </p>
      <IntegrationsManager initialStatuses={statuses} />
    </main>
  );
}
