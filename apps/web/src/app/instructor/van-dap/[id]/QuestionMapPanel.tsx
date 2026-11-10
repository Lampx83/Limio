import type { QuestionMapData } from "./types";

const LEVEL_LABEL: Record<string, string> = { basic: "Cơ bản", intermediate: "Trung bình", advanced: "Nâng cao" };

/** Bản đồ câu hỏi: xem trước AI sẽ hỏi gì, theo thứ tự nào, trong bao nhiêu câu (ước lượng theo thời lượng). */
export default function QuestionMapPanel({ map, durationMin }: { map: QuestionMapData; durationMin: number }) {
  return (
    <section aria-labelledby="vd-map" className="card space-y-3">
      <div>
        <h2 id="vd-map" className="text-h3">
          Bản đồ câu hỏi
        </h2>
        <p className="mt-1 text-sm text-faint">
          Ước lượng thô: mỗi lượt hỏi–đáp khoảng 1,5 phút, nên {durationMin} phút hỏi được khoảng {map.capacity} câu. Ý đứng trước được ưu tiên; ý đứng sau có thể không kịp.
        </p>
      </div>

      {map.rows.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có ý nào trong dàn.</p>
      ) : (
        <>
          <p className="text-sm">
            <b>{map.coveredCount}</b> ý được hỏi kịp, khoảng <b>{map.totalEstimatedQuestions}</b> câu
            {map.uncoveredCount > 0 && (
              <>
                ; <b>{map.uncoveredCount}</b> ý cuối <span className="text-amber-700">không kịp</span> trong thời lượng này
              </>
            )}
            .
          </p>
          <ol className="divide-y divide-slate-100 rounded-lg border border-default">
            {map.rows.map((r) => (
              <li key={r.id} className={`flex items-start gap-3 px-3 py-2 ${r.covered ? "" : "bg-amber-50/50 text-slate-500"}`}>
                <span className="w-6 shrink-0 text-sm font-semibold">{r.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm">{r.core}</p>
                  <p className="text-xs text-slate-500">{LEVEL_LABEL[r.level] ?? r.level}</p>
                </div>
                <span className="shrink-0 text-xs">{r.covered ? `~${r.estimatedQuestions} câu` : "không kịp"}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div>
        <p className="text-caption font-medium">Kịch bản (dùng chung dàn ở trên)</p>
        {map.scenarios.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có kịch bản: cả lớp hỏi trong một bối cảnh chung.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {map.scenarios.map((s) => (
              <li key={s.id}>• {s.title}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
