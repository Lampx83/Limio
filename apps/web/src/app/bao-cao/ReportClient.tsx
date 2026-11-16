"use client";

/**
 * Bốn khối của trang Báo cáo nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC2–AC7).
 * Mỗi khối tự tải từ route riêng để trang hiện dần.
 */
import { useEffect, useState, type ReactNode } from "react";
import type {
  ActivationReport,
  HardQuestionsQuiz,
  LearnerReport,
  MasteryReport,
  RemediationMonthRow,
  RevenueReport,
} from "@feedbackme/core-lms";
import KpiCard from "@/components/ui/KpiCard";
import { apiUrl } from "@/lib/apiUrl";
import { formatPrice } from "@/lib/formatPrice";
import { SkeletonCard } from "@/components/Skeleton";

type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ok"; data: T; generatedAt: string };

function useBlock<T>(courseId: string, block: string, range: string): Loaded<T> {
  const [s, setS] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    setS({ state: "loading" });
    fetch(apiUrl(`/api/reports/courses/${courseId}/${block}?range=${range}`), { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { data: T; generatedAt: string };
        if (alive) setS({ state: "ok", data: j.data, generatedAt: j.generatedAt });
      })
      .catch(() => alive && setS({ state: "error" }));
    return () => {
      alive = false;
    };
  }, [courseId, block, range]);
  return s;
}

const RANGE_LABEL: Record<string, string> = { "30": "30 ngày qua", "90": "90 ngày qua", all: "từ đầu" };

function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`;
}

function money(amount: number, currency: string): string {
  return formatPrice(amount, currency);
}

function weekLabel(week: string): string {
  const [, m, d] = week.split("-");
  return `${d}/${m}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

function dateVN(iso: string | Date | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function Section({ title, intro, children, updatedAt }: { title: string; intro?: string; children: ReactNode; updatedAt?: string }) {
  return (
    <section className="card mb-6 p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-h2">{title}</h2>
        {updatedAt && (
          <span className="text-caption">
            Cập nhật lúc{" "}
            {new Date(updatedAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {intro && <p className="text-meta mb-4">{intro}</p>}
      {children}
    </section>
  );
}

function BlockState({ s, children }: { s: Loaded<unknown>; children: () => ReactNode }) {
  if (s.state === "loading") return <SkeletonCard />;
  if (s.state === "error") return <p className="banner-danger">Không tải được số liệu. Hãy tải lại trang.</p>;
  return <>{children()}</>;
}

/** Biểu đồ cột đơn giản theo tuần; không cần thư viện. */
function WeekBars({ series, unit }: { series: { week: string; count: number }[]; unit: string }) {
  const max = Math.max(1, ...series.map((x) => x.count));
  const total = series.reduce((a, x) => a + x.count, 0);
  if (total === 0) return <p className="text-meta">Chưa có {unit} nào trong khoảng này.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex h-36 min-w-[320px] items-end gap-1" role="img" aria-label={`Số ${unit} theo tuần`}>
        {series.map((x) => (
          <div key={x.week} className="flex flex-1 flex-col items-center justify-end gap-1" title={`Tuần ${weekLabel(x.week)}: ${x.count}`}>
            <span className="text-caption">{x.count > 0 ? x.count : ""}</span>
            <div className="w-full rounded-t bg-brand-500" style={{ height: `${(x.count / max) * 100}%`, minHeight: x.count > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex min-w-[320px] justify-between text-caption">
        <span>Tuần {weekLabel(series[0]!.week)}</span>
        <span>Tuần {weekLabel(series[series.length - 1]!.week)}</span>
      </div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-token text-left text-meta">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-token last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivationBlock({ courseId, range }: { courseId: string; range: string }) {
  const s = useBlock<ActivationReport>(courseId, "activation", range);
  return (
    <Section
      title="Phát hành"
      intro="Mã kích hoạt in kèm sách. Tỉ lệ kích hoạt = số mã đã kích hoạt trên số mã còn hiệu lực (không tính mã đã thu hồi)."
      updatedAt={s.state === "ok" ? s.generatedAt : undefined}
    >
      <BlockState s={s}>
        {() => {
          const d = (s as { data: ActivationReport }).data;
          if (d.batches.length === 0) return <p className="text-meta">Khoá chưa có lô mã kích hoạt nào.</p>;
          const live = d.totals.total - d.totals.revoked;
          return (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Mã đã phát hành" value={d.totals.total.toLocaleString("vi-VN")} />
                <KpiCard label="Đã kích hoạt" value={d.totals.redeemed.toLocaleString("vi-VN")} tone="brand" />
                <KpiCard label="Tỉ lệ kích hoạt" value={pct(live > 0 ? d.totals.redeemed / live : null)} />
                <KpiCard label="Đã thu hồi" value={d.totals.revoked.toLocaleString("vi-VN")} />
              </div>
              <h3 className="text-h4 mb-2">Mã kích hoạt theo tuần ({RANGE_LABEL[range]})</h3>
              <WeekBars series={d.weekly} unit="lượt kích hoạt" />
              <h3 className="text-h4 mb-2 mt-6">Theo lô</h3>
              <Table
                head={["Lô", "Số mã", "Đã kích hoạt", "Chưa dùng", "Thu hồi", "Tỉ lệ", "Thời hạn", "Hạn kích hoạt"]}
                rows={d.batches.map((b) => [
                  <span key="l" className="font-medium">{b.label}</span>,
                  b.total.toLocaleString("vi-VN"),
                  b.redeemed.toLocaleString("vi-VN"),
                  b.unused.toLocaleString("vi-VN"),
                  b.revoked.toLocaleString("vi-VN"),
                  pct(b.activationRate),
                  b.batchId === null ? "—" : b.accessDurationMonths ? `${b.accessDurationMonths} tháng` : "Vĩnh viễn",
                  <span key="h">
                    {dateVN(b.activateBefore)}
                    {b.expiringSoon && <span className="chip-warning ml-2">Sắp hết hạn kích hoạt</span>}
                    {b.activationClosed && <span className="chip ml-2">Đã hết hạn kích hoạt</span>}
                  </span>,
                ])}
              />
            </>
          );
        }}
      </BlockState>
    </Section>
  );
}

function RevenueBlock({ courseId, range }: { courseId: string; range: string }) {
  const s = useBlock<RevenueReport>(courseId, "revenue", range);
  return (
    <Section
      title="Doanh thu"
      intro={`Đơn mua trực tiếp trên Limio, ${RANGE_LABEL[range]}. Mỗi loại tiền tính riêng. Doanh thu thuần = đã thu trừ đã hoàn.`}
      updatedAt={s.state === "ok" ? s.generatedAt : undefined}
    >
      <BlockState s={s}>
        {() => {
          const d = (s as { data: RevenueReport }).data;
          return (
            <>
              {d.currencies.length === 0 ? (
                <p className="text-meta">Chưa có đơn mua trực tiếp trong khoảng này.</p>
              ) : (
                d.currencies.map((c) => (
                  <div key={c.currency} className="mb-6">
                    {d.currencies.length > 1 && <h3 className="text-h4 mb-2">Thanh toán bằng {c.currency}</h3>}
                    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <KpiCard label="Doanh thu thuần" value={money(c.totals.net, c.currency)} tone="brand" />
                      <KpiCard label="Đã thu" value={money(c.totals.gross, c.currency)} />
                      <KpiCard label="Đã hoàn" value={money(c.totals.refunded, c.currency)} />
                      <KpiCard label="Số đơn" value={c.totals.orders.toLocaleString("vi-VN")} />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <h4 className="text-h4 mb-2">Theo tháng</h4>
                        <Table
                          head={["Tháng", "Số đơn", "Đã thu", "Đã hoàn", "Thuần"]}
                          rows={c.monthly.map((m) => [
                            monthLabel(m.month),
                            m.orders,
                            money(m.gross, c.currency),
                            money(m.refunded, c.currency),
                            money(m.net, c.currency),
                          ])}
                        />
                      </div>
                      <div>
                        <h4 className="text-h4 mb-2">Theo gói và cổng thanh toán</h4>
                        <Table
                          head={["Gói / cổng", "Số đơn", "Thuần"]}
                          rows={[
                            ...c.byPlan.map((p) => [`Gói: ${p.plan}`, p.orders, money(p.net, c.currency)]),
                            ...c.byProvider.map((p) => [`Cổng: ${p.provider}`, p.orders, money(p.net, c.currency)]),
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-meta">
                  Đơn chưa hoàn tất (người mua bắt đầu thanh toán nhưng chưa xong): <strong>{d.incompleteOrders}</strong>
                </p>
                <a className="btn-secondary btn-sm" href={apiUrl(`/api/reports/courses/${courseId}/revenue-export`)}>
                  Xuất CSV đối soát
                </a>
              </div>
            </>
          );
        }}
      </BlockState>
    </Section>
  );
}

function LearnersBlock({ courseId, range }: { courseId: string; range: string }) {
  const s = useBlock<LearnerReport>(courseId, "learners", range);
  return (
    <Section
      title="Người học"
      intro="Số người, không kèm danh tính. Một người vừa nhập mã vừa mua trực tiếp được tính ở cả hai nguồn."
      updatedAt={s.state === "ok" ? s.generatedAt : undefined}
    >
      <BlockState s={s}>
        {() => {
          const d = (s as { data: LearnerReport }).data;
          return (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Đã ghi danh" value={d.enrolled.toLocaleString("vi-VN")} tone="brand" />
                <KpiCard label="Đang học (30 ngày qua)" value={d.activeLast30Days.toLocaleString("vi-VN")} />
                <KpiCard label="Đã hoàn thành" value={d.byStatus.completed.toLocaleString("vi-VN")} />
                <KpiCard
                  label="Hết hạn / hoàn tiền"
                  value={`${d.byStatus.expired.toLocaleString("vi-VN")} / ${d.byStatus.refunded.toLocaleString("vi-VN")}`}
                />
              </div>
              <p className="text-meta mb-4">
                Nguồn ghi danh: nhập mã <strong>{d.bySource.accessCode}</strong> · mua trực tiếp{" "}
                <strong>{d.bySource.directPurchase}</strong> · khác <strong>{d.bySource.other}</strong>
              </p>
              <h3 className="text-h4 mb-2">Ghi danh mới theo tuần ({RANGE_LABEL[range]})</h3>
              <WeekBars series={d.weeklyNew} unit="lượt ghi danh mới" />
            </>
          );
        }}
      </BlockState>
    </Section>
  );
}

function MasteryBar({ review, practice, solid }: { review: number; practice: number; solid: number }) {
  return (
    <div className="flex h-3 w-full min-w-[120px] overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden>
      <div className="bg-amber-400" style={{ width: `${review}%` }} />
      <div className="bg-sky-400" style={{ width: `${practice}%` }} />
      <div className="bg-emerald-500" style={{ width: `${solid}%` }} />
    </div>
  );
}

function LearningBlock({ courseId, range }: { courseId: string; range: string }) {
  const mastery = useBlock<MasteryReport>(courseId, "mastery", range);
  const questions = useBlock<HardQuestionsQuiz[]>(courseId, "questions", range);
  const uptake = useBlock<RemediationMonthRow[]>(courseId, "remediation", range);
  return (
    <Section
      title="Học liệu"
      intro="Giúp biên tập viên thấy bài nào khó, câu nào hay bị nhầm. Nhóm dưới 10 người không hiện tỉ lệ để không suy ra được từng người."
      updatedAt={mastery.state === "ok" ? mastery.generatedAt : undefined}
    >
      <h3 className="text-h4 mb-2">Mức nắm vững theo bài</h3>
      <BlockState s={mastery}>
        {() => {
          const d = (mastery as { data: MasteryReport }).data;
          if (!d.enabled) {
            return (
              <p className="banner-info">
                Khoá chưa bật cá nhân hoá, nên chưa có mức nắm vững theo bài. Bật cá nhân hoá ở trang sửa khoá để người
                học nhận lộ trình riêng và để có số liệu này.
              </p>
            );
          }
          return (
            <>
              <p className="text-meta mb-3">
                <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Cần ôn</span>
                <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" />Nên luyện</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Vững</span>
              </p>
              <Table
                head={["Bài", "Số người có dữ liệu", "Cần ôn / Nên luyện / Vững", ""]}
                rows={d.lessons.map((l) => [
                  <span key="t">
                    <span className="font-medium">{l.title}</span>
                    <span className="block text-caption">{l.moduleTitle}</span>
                  </span>,
                  l.insufficient ? "—" : l.learners,
                  l.insufficient ? (
                    <span className="text-meta">Chưa đủ dữ liệu (dưới 10 người)</span>
                  ) : (
                    <span key="b" className="flex items-center gap-2">
                      <MasteryBar review={l.reviewPct ?? 0} practice={l.practicePct ?? 0} solid={l.solidPct ?? 0} />
                      <span className="whitespace-nowrap text-caption">
                        {l.reviewPct}% / {l.practicePct}% / {l.solidPct}%
                      </span>
                    </span>
                  ),
                  l.mostNeedsReview ? <span key="f" className="chip-warning">Nên xem lại nội dung</span> : "",
                ])}
              />
            </>
          );
        }}
      </BlockState>

      <h3 className="text-h4 mb-2 mt-6">Câu hỏi bị sai nhiều</h3>
      <BlockState s={questions}>
        {() => {
          const d = (questions as { data: HardQuestionsQuiz[] }).data;
          if (d.length === 0) {
            return <p className="text-meta">Chưa có câu nào đủ 10 người làm (chỉ tính lần làm đầu tiên của mỗi người).</p>;
          }
          return (
            <div className="space-y-5">
              {d.map((q) => (
                <div key={q.quizId}>
                  <p className="mb-2 font-medium">
                    {q.quizTitle} <span className="text-meta">· {q.lessonTitle}</span>
                  </p>
                  <Table
                    head={["Câu hỏi", "Tỉ lệ đúng", "Phương án sai chọn nhiều nhất"]}
                    rows={q.questions.map((x) => [
                      <span key="p">{x.prompt}<span className="block text-caption">{x.responses} người làm</span></span>,
                      `${x.correctPct}%`,
                      x.topWrongOption ? (
                        <span key="w">
                          “{x.topWrongOption.label}” ({x.topWrongOption.chosenPct}%)
                          {x.topWrongOption.misconception && (
                            <span className="block text-caption">Nhầm lẫn: {x.topWrongOption.misconception}</span>
                          )}
                        </span>
                      ) : (
                        "—"
                      ),
                    ])}
                  />
                </div>
              ))}
            </div>
          );
        }}
      </BlockState>

      <h3 className="text-h4 mb-2 mt-6">Tỉ lệ người học mở bài nên xem lại sau khi làm sai</h3>
      <p className="text-meta mb-2">
        Khi trả lời sai, người học nhận phản hồi kèm liên kết tới bài nên xem lại. Tỉ lệ này cho biết phản hồi có được
        dùng hay không.
      </p>
      <BlockState s={uptake}>
        {() => {
          const d = (uptake as { data: RemediationMonthRow[] }).data;
          if (d.length === 0) return <p className="text-meta">Chưa có phản hồi kèm bài nên xem lại trong khoảng này.</p>;
          return (
            <Table
              head={["Tháng", "Phản hồi có gợi ý", "Đã mở bài", "Tỉ lệ"]}
              rows={d.map((m) =>
                m.insufficient
                  ? [monthLabel(m.month), <span key="i" className="text-meta">Chưa đủ dữ liệu (dưới 10 người)</span>, "—", "—"]
                  : [monthLabel(m.month), m.deliveries, m.clicked, `${m.clickRatePct}%`],
              )}
            />
          );
        }}
      </BlockState>
    </Section>
  );
}

export default function ReportClient({ courseId, range }: { courseId: string; range: string }) {
  return (
    <>
      <ActivationBlock courseId={courseId} range={range} />
      <RevenueBlock courseId={courseId} range={range} />
      <LearnersBlock courseId={courseId} range={range} />
      <LearningBlock courseId={courseId} range={range} />
    </>
  );
}
