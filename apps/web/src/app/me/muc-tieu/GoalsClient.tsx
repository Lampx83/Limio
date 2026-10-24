"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GoalProgress } from "@feedbackme/core-feedback";
import type { GoalView, SectionGoalView } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import GoalForm, { goalErrorText, type GoalFormValues } from "@/components/goals/GoalForm";
import GoalProgressView from "@/components/goals/GoalProgressView";

export interface CourseGoalCard {
  courseId: string;
  courseTitle: string;
  sectionName: string | null;
  personal: GoalView | null;
  sectionGoal: SectionGoalView | null;
  source: "personal" | "section" | "none";
  effective: { targetLevel: string; framework: string; targetDate: string | null; hoursPerWeek: number | null } | null;
  progress: GoalProgress | null;
}

const dmy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "chưa có hạn");

const STATUS_TEXT: Record<string, string> = { active: "Đang theo đuổi", achieved: "Đã đạt", archived: "Đã lưu trữ" };

interface HistoryItem {
  at: string;
  kind: "set" | "changed" | "status_changed";
  changes?: Record<string, { from: string | number | null; to: string | number | null }>;
  from?: string;
  to?: string;
}

const FIELD_TEXT: Record<string, string> = { framework: "Khung", targetLevel: "Cấp độ", targetDate: "Hạn", hoursPerWeek: "Giờ mỗi tuần" };

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const r = await fetch(apiUrl(url), { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, data: { error: "network" } };
  }
}

export default function GoalsClient({ cards, general, closed }: { cards: CourseGoalCard[]; general: GoalView[]; closed: GoalView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // "new:<courseId|general>" | goalId
  const [history, setHistory] = useState<Record<string, HistoryItem[] | null>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setEditing(null);
    router.refresh();
  };

  const create = (courseId: string | null) => async (v: GoalFormValues): Promise<string | null> => {
    const r = await call("/api/goals", "POST", { courseId, framework: v.framework, targetLevel: v.targetLevel, targetDate: v.targetDate, hoursPerWeek: v.hoursPerWeek });
    if (!r.ok) return goalErrorText(r.data.error as string);
    refresh();
    return null;
  };

  const update = (g: GoalView) => async (v: GoalFormValues): Promise<string | null> => {
    const r = await call(`/api/goals/${g.id}`, "PATCH", { patch: { framework: v.framework, targetLevel: v.targetLevel, targetDate: v.targetDate, hoursPerWeek: v.hoursPerWeek } });
    if (!r.ok) return goalErrorText(r.data.error as string);
    refresh();
    return null;
  };

  const setStatus = async (g: GoalView, status: "active" | "achieved" | "archived") => {
    setError(null);
    const r = await call(`/api/goals/${g.id}`, "PATCH", { status });
    if (!r.ok) setError(goalErrorText(r.data.error as string));
    else router.refresh();
  };

  const adopt = async (courseId: string) => {
    setError(null);
    const r = await call("/api/goals/adopt", "POST", { courseId });
    if (!r.ok) {
      if (r.data.error === "validation_failed") setEditing(`adopt:${courseId}`); // mục tiêu lớp chưa có hạn: nhập hạn
      else setError(goalErrorText(r.data.error as string));
    } else router.refresh();
  };

  const toggleHistory = async (g: GoalView) => {
    if (history[g.id]) return setHistory((h) => ({ ...h, [g.id]: null }));
    const r = await call(`/api/goals/${g.id}/history`, "GET");
    if (r.ok) setHistory((h) => ({ ...h, [g.id]: r.data.history as HistoryItem[] }));
  };

  const goalLine = (g: { framework: string; targetLevel: string; targetDate: string | null }) =>
    `${g.targetLevel} · hạn ${dmy(g.targetDate)}`;

  const historyView = (g: GoalView) =>
    history[g.id] ? (
      <ol className="mt-2 space-y-1 border-l-2 border-token pl-3 text-sm">
        {history[g.id]!.map((h, i) => (
          <li key={i}>
            <span className="text-meta text-muted">{new Date(h.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>{" "}
            {h.kind === "set" && "Đặt mục tiêu."}
            {h.kind === "changed" &&
              Object.entries(h.changes ?? {})
                .map(([k, c]) => `${FIELD_TEXT[k] ?? k}: ${c.from ?? "—"} → ${c.to ?? "—"}`)
                .join("; ")}
            {h.kind === "status_changed" && `Đổi trạng thái: ${STATUS_TEXT[h.from ?? ""] ?? h.from} → ${STATUS_TEXT[h.to ?? ""] ?? h.to}.`}
          </li>
        ))}
      </ol>
    ) : null;

  const actions = (g: GoalView) => (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(g.id)}>
        Đổi mục tiêu
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setStatus(g, "achieved")}>
        Đã đạt
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setStatus(g, "archived")}>
        Lưu trữ
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => toggleHistory(g)}>
        {history[g.id] ? "Ẩn lịch sử" : "Xem lịch sử"}
      </button>
    </div>
  );

  return (
    <div className="mt-6 space-y-5">
      {error && (
        <p className="banner-danger text-sm" role="alert">
          {error}
        </p>
      )}

      {cards.length === 0 && (
        <p className="rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted">
          Chưa có khoá học nào thuộc lớp có lịch. Bạn vẫn có thể đặt mục tiêu chung ở phía dưới.
        </p>
      )}

      {cards.map((c) => (
        <section key={c.courseId} className="card p-4" aria-label={c.courseTitle}>
          <h2 className="text-h3">{c.courseTitle}</h2>
          {c.sectionName && <p className="text-meta text-muted">{c.sectionName}</p>}

          {c.source !== "none" && c.effective && (
            <div className="mt-3">
              <p className="font-semibold">
                {goalLine(c.effective)}
                {c.effective.hoursPerWeek != null ? ` · ${c.effective.hoursPerWeek} giờ/tuần` : ""}
                {c.source === "section" && <span className="chip-brand ml-2 text-xs">Mục tiêu của lớp</span>}
              </p>
              {c.progress && <GoalProgressView progress={c.progress} hoursPerWeek={c.effective.hoursPerWeek} />}
            </div>
          )}

          {c.source === "section" && c.sectionGoal && (
            <div className="mt-3 rounded-lg border border-token p-3 text-sm">
              <p>
                Lớp đặt mục tiêu <strong>{goalLine(c.sectionGoal)}</strong> làm gợi ý. Bạn có thể dùng mục tiêu này hoặc tự đặt mục tiêu riêng.
              </p>
              {editing === `adopt:${c.courseId}` ? (
                <div className="mt-3">
                  <p className="mb-2 text-meta text-muted">Mục tiêu của lớp chưa có hạn, bạn chọn hạn cho riêng mình:</p>
                  <GoalForm
                    initial={{ framework: c.sectionGoal.framework, targetLevel: c.sectionGoal.targetLevel, hoursPerWeek: c.sectionGoal.hoursPerWeek }}
                    submitLabel="Dùng mục tiêu này"
                    onCancel={() => setEditing(null)}
                    onSubmit={async (v) => {
                      const r = await call("/api/goals/adopt", "POST", { courseId: c.courseId, targetDate: v.targetDate, hoursPerWeek: v.hoursPerWeek });
                      if (!r.ok) return goalErrorText(r.data.error as string);
                      refresh();
                      return null;
                    }}
                  />
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => adopt(c.courseId)}>
                    Dùng mục tiêu này
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(`new:${c.courseId}`)}>
                    Tự đặt mục tiêu riêng
                  </button>
                </div>
              )}
            </div>
          )}

          {c.personal && editing !== c.personal.id && (
            <>
              {actions(c.personal)}
              {historyView(c.personal)}
            </>
          )}
          {c.personal && editing === c.personal.id && (
            <div className="mt-3">
              <GoalForm initial={c.personal} submitLabel="Lưu thay đổi" onCancel={() => setEditing(null)} onSubmit={update(c.personal)} />
            </div>
          )}

          {c.source === "none" && editing !== `new:${c.courseId}` && (
            <div className="mt-3">
              <p className="text-sm text-muted">Bạn chưa đặt mục tiêu cho khoá này.</p>
              <button type="button" className="btn-primary btn-sm mt-2" onClick={() => setEditing(`new:${c.courseId}`)}>
                Đặt mục tiêu
              </button>
            </div>
          )}
          {editing === `new:${c.courseId}` && (
            <div className="mt-3">
              <GoalForm submitLabel="Lưu mục tiêu" onCancel={() => setEditing(null)} onSubmit={create(c.courseId)} />
            </div>
          )}
        </section>
      ))}

      <section className="card p-4" aria-label="Mục tiêu chung">
        <h2 className="text-h3">Mục tiêu chung</h2>
        <p className="text-meta text-muted">Không gắn với khoá nào (ví dụ thi IELTS 6.5). Giáo viên không xem mục tiêu chung.</p>
        {general.filter((g) => g.status === "active").map((g) => (
          <div key={g.id} className="mt-3">
            {editing === g.id ? (
              <GoalForm initial={g} submitLabel="Lưu thay đổi" onCancel={() => setEditing(null)} onSubmit={update(g)} />
            ) : (
              <>
                <p className="font-semibold">
                  {goalLine(g)}
                  {g.hoursPerWeek != null ? ` · ${g.hoursPerWeek} giờ/tuần` : ""}
                </p>
                {actions(g)}
                {historyView(g)}
              </>
            )}
          </div>
        ))}
        {!general.some((g) => g.status === "active") && editing !== "new:general" && (
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setEditing("new:general")}>
            Đặt mục tiêu chung
          </button>
        )}
        {editing === "new:general" && (
          <div className="mt-3">
            <GoalForm submitLabel="Lưu mục tiêu" onCancel={() => setEditing(null)} onSubmit={create(null)} />
          </div>
        )}
      </section>

      {(closed.length > 0 || general.some((g) => g.status !== "active")) && (
        <section className="card p-4" aria-label="Mục tiêu đã đóng">
          <h2 className="text-h3">Mục tiêu đã đóng</h2>
          <ul className="mt-3 space-y-2">
            {[...closed, ...general.filter((g) => g.status !== "active")].map((g) => (
              <li key={g.id} className="rounded-lg border border-token p-3 text-sm">
                <span className="font-semibold">{goalLine(g)}</span> · {STATUS_TEXT[g.status]}
                <button type="button" className="btn-ghost btn-sm ml-2" onClick={() => setStatus(g, "active")}>
                  Theo đuổi lại
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
