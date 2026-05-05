import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, listIntegrationStatuses } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import IntegrationsManager from "./IntegrationsManager";

export const dynamic = "force-dynamic";

export default async function IntegrationsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/integrations");
  if (!(await isAdmin(session.user.id)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ admin mới quản lý được integration credentials.
        </div>
      </main>
    );
  }

  const statuses = await listIntegrationStatuses();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="link inline-flex items-center gap-1 text-sm">
        ← Trang chủ
      </Link>

      <div className="mt-4">
        <span className="chip-brand">Admin · Secrets</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Integration credentials
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Lưu API keys (OpenAI, Stripe, VNPay, Momo) — encrypted AES-256-GCM
          với master key từ env{" "}
          <code className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 font-mono text-xs">
            SECRETS_MASTER_KEY
          </code>
          . Plaintext không bao giờ trả về client.
        </p>
      </div>

      <div className="mt-8">
        <IntegrationsManager initialStatuses={statuses} />
      </div>
    </main>
  );
}
