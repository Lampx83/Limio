import { redirect } from "next/navigation";
import {
  getTokenBudget,
  listActivePackages,
  listUserOrders,
} from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import { getSiteSetting } from "@/lib/site-settings";
import BuyTokensClient from "./BuyTokensClient";

export const dynamic = "force-dynamic";

export default async function AiTokensPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?next=/me/ai-tokens");

  const [budget, packages, orders, bankName, accountNumber, accountName] =
    await Promise.all([
      getTokenBudget(userId),
      listActivePackages(),
      listUserOrders(userId),
      getSiteSetting("ai.bank.name"),
      getSiteSetting("ai.bank.account_number"),
      getSiteSetting("ai.bank.account_name"),
    ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Lượt hỏi AI</h1>
      <p className="mt-1 text-meta">
        Mỗi tháng bạn được cấp một hạn mức miễn phí. Dùng hết mà vẫn cần hỏi
        thêm thì mua gói bên dưới.
      </p>

      <section className="card mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-caption">Còn lại tháng này</p>
            <p className="text-h2">{budget.monthlyRemaining.toLocaleString("vi-VN")}</p>
            <p className="text-caption">token</p>
          </div>
          <div>
            <p className="text-caption">Đã mua thêm</p>
            <p className="text-h2">{budget.purchased.toLocaleString("vi-VN")}</p>
            <p className="text-caption">token — không mất khi sang tháng</p>
          </div>
          <div>
            <p className="text-caption">Ước tính</p>
            <p className="text-h2">{budget.estimatedTurns.toLocaleString("vi-VN")}</p>
            <p className="text-caption">lượt hỏi còn lại</p>
          </div>
        </div>
      </section>

      <BuyTokensClient
        packages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          tokens: p.tokens,
          priceVnd: p.priceVnd,
        }))}
        orders={orders.map((o) => ({
          id: o.id,
          code: o.code,
          status: o.status,
          tokens: o.tokens,
          priceVnd: o.priceVnd,
          packageName: o.package.name,
          createdAt: o.createdAt.toISOString(),
        }))}
        bank={{ bankName, accountNumber, accountName }}
      />
    </main>
  );
}
