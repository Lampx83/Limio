import { redirect } from "next/navigation";
import { listOrdersForAdmin } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getAiTokensPageLocked } from "@/lib/site-settings";
import AiTokensPageLockCard from "./AiTokensPageLockCard";
import AdminTokensClient from "./AdminTokensClient";

export const dynamic = "force-dynamic";

export default async function AdminAiTokensPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?next=/admin/ai-tokens");
  if (!(await isAdmin(userId))) redirect("/");

  const status = (["pending", "paid", "cancelled", "all"] as const).includes(
    searchParams.status as "pending",
  )
    ? (searchParams.status as "pending" | "paid" | "cancelled" | "all")
    : "pending";
  const [orders, pageLocked] = await Promise.all([listOrdersForAdmin(status), getAiTokensPageLocked()]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Token AI — đối soát</h1>
      <p className="mt-1 text-meta">
        Người học đặt đơn rồi chuyển khoản kèm mã. Đối chiếu sao kê, thấy đúng
        số tiền và đúng mã thì xác nhận — token được cộng ngay.
      </p>

      <AiTokensPageLockCard initialLocked={pageLocked} />

      <AdminTokensClient
        status={status}
        orders={orders.map((o) => ({
          id: o.id,
          code: o.code,
          status: o.status,
          tokens: o.tokens,
          priceVnd: o.priceVnd,
          packageName: o.package.name,
          email: o.user.email,
          displayName: o.user.displayName,
          createdAt: o.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
