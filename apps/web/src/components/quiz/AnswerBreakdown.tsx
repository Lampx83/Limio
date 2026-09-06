import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";

/**
 * Đáp án của một câu sau khi nộp: người học đã chọn gì, đáp án đúng là gì.
 *
 * Trang kết quả trước đây chỉ có đề bài và phần giải thích — người học sai một
 * câu nhưng không thấy mình đã chọn gì, cũng không thấy đáp án đúng, nên phần
 * giải thích nói về một thứ họ không nhìn thấy.
 *
 * Mỗi loại câu hỏi cần một cách trình bày riêng vì hình dạng câu trả lời khác
 * nhau hoàn toàn (xem `packages/core-lms/src/quizzes/grading.ts`): chọn phương
 * án là mảng id, sắp thứ tự là mảng id CÓ THỨ TỰ, nối cặp là mảng {leftId,
 * rightId}, điền vào chỗ trống là bản đồ ô → token.
 */

type Option = {
  id: string;
  label: string;
  isCorrect: boolean;
  orderIndex: number;
  extra: Record<string, unknown> | null;
};

export type ReviewItem = {
  type: string;
  options: Option[];
  yourResponse: unknown;
  meta: { expected: number | null; tolerance: number | null };
};

const LABEL = "text-xs font-semibold uppercase tracking-wide text-muted";

/** Nhãn phương án có thể chứa HTML (hình minh hoạ, chữ in đậm) như lúc làm bài. */
function OptionLabel({ text }: { text: string }) {
  return (
    <SafeHtml
      html={plainToRichHtml(text)}
      className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-0"
    />
  );
}

function Chip({ tone, children }: { tone: "correct" | "wrong" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "correct"
      ? "bg-success-100 text-success-700"
      : tone === "wrong"
        ? "bg-danger-100 text-danger-700"
        : "bg-[rgb(var(--surface-muted))] text-muted";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

/** Khung một dòng đáp án, tô theo đúng/sai/không liên quan. */
function Row({
  state,
  children,
  chips,
}: {
  state: "correct" | "wrong" | "neutral";
  children: React.ReactNode;
  chips?: React.ReactNode;
}) {
  const border =
    state === "correct"
      ? "border-success-300 bg-success-50"
      : state === "wrong"
        ? "border-danger-300 bg-danger-50"
        : "border-token";
  return (
    <li className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 ${border}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {chips && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{chips}</div>}
    </li>
  );
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

/** Không trả lời — dùng chung cho mọi loại câu. */
function Blank() {
  return <span className="text-sm italic text-faint">(bỏ trống)</span>;
}

export default function AnswerBreakdown({ item }: { item: ReviewItem }) {
  const { type, options, yourResponse } = item;

  // ── Chọn phương án ────────────────────────────────────────────────────────
  if (type === "mcq" || type === "true_false") {
    const picked = new Set(asStringArray(yourResponse));
    return (
      <section className="mt-4">
        <p className={LABEL}>Các phương án</p>
        <ul className="mt-2 space-y-1.5">
          {options.map((o) => {
            const chosen = picked.has(o.id);
            const state = o.isCorrect ? "correct" : chosen ? "wrong" : "neutral";
            return (
              <Row
                key={o.id}
                state={state}
                chips={
                  <>
                    {chosen && <Chip tone={o.isCorrect ? "correct" : "wrong"}>Bạn chọn</Chip>}
                    {o.isCorrect && <Chip tone="correct">Đáp án đúng</Chip>}
                  </>
                }
              >
                <OptionLabel text={o.label} />
              </Row>
            );
          })}
        </ul>
        {picked.size === 0 && <p className="mt-2 text-sm italic text-faint">Bạn không chọn phương án nào.</p>}
      </section>
    );
  }

  // ── Sắp thứ tự ────────────────────────────────────────────────────────────
  if (type === "ordering") {
    const canonical = [...options].sort((a, b) => a.orderIndex - b.orderIndex);
    const byId = new Map(options.map((o) => [o.id, o]));
    const yours = asStringArray(yourResponse).map((id) => byId.get(id) ?? null);
    return (
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className={LABEL}>Thứ tự bạn xếp</p>
          {yours.length === 0 ? (
            <p className="mt-2"><Blank /></p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {yours.map((o, i) => (
                <Row key={i} state={canonical[i]?.id === o?.id ? "correct" : "wrong"}>
                  <span className="mr-2 text-sm font-semibold tabular-nums text-muted">{i + 1}.</span>
                  {o ? <OptionLabel text={o.label} /> : <Blank />}
                </Row>
              ))}
            </ol>
          )}
        </div>
        <div>
          <p className={LABEL}>Thứ tự đúng</p>
          <ol className="mt-2 space-y-1.5">
            {canonical.map((o, i) => (
              <Row key={o.id} state="correct">
                <span className="mr-2 text-sm font-semibold tabular-nums text-muted">{i + 1}.</span>
                <OptionLabel text={o.label} />
              </Row>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  // ── Nối cặp ───────────────────────────────────────────────────────────────
  if (type === "matching") {
    const side = (o: Option) => (o.extra as { side?: string } | null)?.side;
    const pairKey = (o: Option) => (o.extra as { pairKey?: string } | null)?.pairKey;
    const lefts = options.filter((o) => side(o) === "left");
    const byId = new Map(options.map((o) => [o.id, o]));
    const pairs = Array.isArray(yourResponse)
      ? (yourResponse as { leftId?: unknown; rightId?: unknown }[]).filter(
          (p) => typeof p?.leftId === "string" && typeof p?.rightId === "string",
        )
      : [];
    const yourRightFor = new Map(pairs.map((p) => [p.leftId as string, p.rightId as string]));
    return (
      <section className="mt-4">
        <p className={LABEL}>Từng cặp bạn nối</p>
        <ul className="mt-2 space-y-1.5">
          {lefts.map((left) => {
            const correctRight = options.find(
              (o) => side(o) === "right" && pairKey(o) === pairKey(left),
            );
            const yourRight = byId.get(yourRightFor.get(left.id) ?? "") ?? null;
            const ok = yourRight?.id === correctRight?.id;
            return (
              <Row key={left.id} state={ok ? "correct" : "wrong"}>
                <div className="text-sm">
                  <span className="font-medium">{left.label}</span>
                  <span className="mx-2 text-faint">→</span>
                  {yourRight ? <span>{yourRight.label}</span> : <Blank />}
                  {!ok && correctRight && (
                    <div className="mt-1 text-sm text-success-700">
                      Đúng phải là: <span className="font-medium">{correctRight.label}</span>
                    </div>
                  )}
                </div>
              </Row>
            );
          })}
        </ul>
      </section>
    );
  }

  // ── Kéo token vào chỗ trống ───────────────────────────────────────────────
  if (type === "drag_drop_fill") {
    const blankIndex = (o: Option) => {
      const v = (o.extra as { blankIndex?: unknown } | null)?.blankIndex;
      return typeof v === "number" ? v : null;
    };
    const expected = options
      .filter((o) => blankIndex(o) !== null)
      .sort((a, b) => (blankIndex(a) ?? 0) - (blankIndex(b) ?? 0));
    const byId = new Map(options.map((o) => [o.id, o]));
    const tokens =
      (yourResponse as { tokens?: Record<string, unknown> } | null)?.tokens ?? {};
    return (
      <section className="mt-4">
        <p className={LABEL}>Từng ô trống</p>
        <ul className="mt-2 space-y-1.5">
          {expected.map((o) => {
            const idx = blankIndex(o)!;
            const placedId = tokens[String(idx)];
            const placed = typeof placedId === "string" ? byId.get(placedId) ?? null : null;
            const ok = placed?.id === o.id;
            return (
              <Row key={o.id} state={ok ? "correct" : "wrong"}>
                <div className="text-sm">
                  <span className="font-semibold tabular-nums text-muted">Ô {idx}:</span>{" "}
                  {placed ? <span className="font-medium">{placed.label}</span> : <Blank />}
                  {!ok && (
                    <div className="mt-1 text-sm text-success-700">
                      Đúng phải là: <span className="font-medium">{o.label}</span>
                    </div>
                  )}
                </div>
              </Row>
            );
          })}
        </ul>
      </section>
    );
  }

  // ── Tự luận: không có đáp án mẫu để đối chiếu ─────────────────────────────
  if (type === "essay") {
    const text = textOf(yourResponse);
    return (
      <section className="mt-4">
        <p className={LABEL}>Bài làm của bạn</p>
        <div className="mt-2 whitespace-pre-wrap rounded-xl border border-token px-3 py-2 text-sm">
          {text || <Blank />}
        </div>
      </section>
    );
  }

  // ── Điền / trả lời ngắn / số ──────────────────────────────────────────────
  const accepted = options.filter((o) => o.isCorrect);
  const yourText = textOf(yourResponse);
  return (
    <section className="mt-4 space-y-3">
      <div>
        <p className={LABEL}>Bạn trả lời</p>
        <div className="mt-2 rounded-xl border border-token px-3 py-2 text-sm">
          {yourText || <Blank />}
        </div>
      </div>
      <div>
        <p className={LABEL}>Đáp án được chấp nhận</p>
        {type === "numerical" && item.meta.expected !== null ? (
          <p className="mt-2 text-sm font-medium text-success-700">
            {item.meta.expected}
            {item.meta.tolerance ? ` (sai số cho phép ±${item.meta.tolerance})` : ""}
          </p>
        ) : accepted.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {accepted.map((o) => (
              <li
                key={o.id}
                className="rounded-full bg-success-100 px-2.5 py-1 text-sm font-medium text-success-700"
              >
                {o.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm italic text-faint">Câu này do giảng viên chấm.</p>
        )}
      </div>
    </section>
  );
}
