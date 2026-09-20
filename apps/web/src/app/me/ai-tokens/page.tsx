import { notFound, redirect } from "next/navigation";
import { Sparkles, Wallet, MessageCircleQuestion } from "lucide-react";
import {
  ASSUMED_ESSAY_WORDS,
  AVG_TOKENS_PER_GRADING,
  AVG_TOKENS_PER_TURN,
  getTokenBudget,
  listActivePackages,
  listUserOrders,
  resolveMonthlyAllowance,
} from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import { getAiTokensPageLocked, getSiteSetting } from "@/lib/site-settings";
import BuyTokensClient from "./BuyTokensClient";

export const dynamic = "force-dynamic";

export default async function AiTokensPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?next=/me/ai-tokens");
  if (await getAiTokensPageLocked()) notFound();

  const [budget, allowance, packages, orders, bankName, accountNumber, accountName] =
    await Promise.all([
      getTokenBudget(userId),
      resolveMonthlyAllowance(userId),
      listActivePackages(),
      listUserOrders(userId),
      getSiteSetting("ai.bank.name"),
      getSiteSetting("ai.bank.account_number"),
      getSiteSetting("ai.bank.account_name"),
    ]);

  // Đã dùng = hạn mức tháng - còn lại. Hạn mức có thể đổi giữa tháng (admin
  // sửa SiteSetting) nên chặn ở [0, 100] thay vì tin tưởng phép trừ tuyệt đối.
  const usedThisMonth = Math.max(0, allowance - budget.monthlyRemaining);
  const usedPercent =
    allowance > 0 ? Math.min(100, Math.round((usedThisMonth / allowance) * 100)) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Lượt hỏi AI</h1>
      <p className="mt-1 text-meta">
        Mỗi tháng bạn được cấp một hạn mức miễn phí. Dùng hết mà vẫn cần hỏi
        thêm thì mua gói bên dưới.
      </p>

      <section className="card mt-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-1.5 text-caption">
              <Sparkles size={14} aria-hidden />
              Còn lại tháng này
            </div>
            <p className="text-h2 mt-1">
              {budget.monthlyRemaining.toLocaleString("vi-VN")}
            </p>
            <p className="text-caption">/ {allowance.toLocaleString("vi-VN")} token</p>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
              role="progressbar"
              aria-valuenow={usedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Phần trăm hạn mức tháng đã dùng"
            >
              <div
                className="h-full rounded-full bg-[rgb(var(--brand))] transition-[width]"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-caption">
              <Wallet size={14} aria-hidden />
              Đã mua thêm
            </div>
            <p className="text-h2 mt-1">{budget.purchased.toLocaleString("vi-VN")}</p>
            <p className="text-caption">token — không mất khi sang tháng</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-caption">
              <MessageCircleQuestion size={14} aria-hidden />
              Ước tính còn dùng được
            </div>
            <p className="text-h2 mt-1">
              {budget.estimatedTurns.toLocaleString("vi-VN")}
            </p>
            <p className="text-caption">lượt hỏi AI</p>
            <p className="mt-2 font-semibold">
              ≈ {budget.estimatedGradableAnswers.toLocaleString("vi-VN")}
            </p>
            <p className="text-caption">bài chấm (gợi ý điểm tự luận)</p>
          </div>
        </div>
        <p className="mt-4 border-t border-token pt-3 text-caption">
          * Ước lượng tương đối, giả định bài làm ~{ASSUMED_ESSAY_WORDS} từ —
          số bài chấm được thực tế phụ thuộc độ dài bài làm.
        </p>
      </section>

      <BuyTokensClient
        packages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          tokens: p.tokens,
          priceVnd: p.priceVnd,
          estimatedTurns: Math.floor(p.tokens / AVG_TOKENS_PER_TURN),
          estimatedGradableAnswers: Math.floor(p.tokens / AVG_TOKENS_PER_GRADING),
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
        assumedEssayWords={ASSUMED_ESSAY_WORDS}
      />
    </main>
  );
}
