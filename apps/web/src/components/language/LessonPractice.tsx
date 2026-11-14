"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Columns2, RotateCcw, Rows2, XCircle } from "lucide-react";
import type { PracticeEmbed, PracticeResult } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import {
  buildSheetSteps,
  buildSteps,
  countProgress,
  progressLabel,
  readLayoutPref,
  stepIndexOf,
  summaryRows,
  writeLayoutPref,
  type LayoutPref,
} from "@/lib/lessonPracticeView";
import ExamQuestion, { isAnswerValueAnswered as isAnswered, type AnswerValue } from "@/components/exam/ExamQuestion";
import PassageView from "@/components/exam/PassageView";
import { QuestionCard } from "@/components/exam/AnswerReview";
import EssayVoiceAnswer, { VoiceUseError } from "./EssayVoiceAnswer";
import EssayFeedback from "./EssayFeedback";
import RolePlay from "./RolePlay";
import FreeChat, { FreeChatError } from "./FreeChat";
import { learnerTurnCount, parseFreeChatView, FREECHAT_MIN_FEEDBACK_TURNS } from "@/lib/freeChatView";
import { instructionOnlyText, isShortAudioPassage } from "@/lib/lessonPracticeView";
import { parseRolePlay } from "@/lib/rolePlayView";
import PracticeSheet, { SheetTabBar } from "./PracticeSheet";
import { tabLabel, tabShortLabels } from "@/lib/practiceSheetView";
import { accentVar } from "@/lib/courseAccent";
import { essayFeedbackEnabled, essayVoiceEnabled, parseFeedback, type FeedbackView } from "@/lib/practiceEssayView";

interface CheckResult {
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number;
  manual: boolean;
  config: unknown;
  /** Câu mở: góp ý AI (bỏ toạ độ và số mục bị lọc ở máy chủ) hoặc mã ngắn vì sao chưa có. */
  feedback?: unknown;
  feedbackError?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const err = {
  save: "Chưa lưu được một câu trả lời. Hãy kiểm tra mạng, bài làm vẫn còn trên màn hình.",
  check: "Không kiểm tra được. Vui lòng thử lại.",
  start: "Chưa bắt đầu được bài luyện. Vui lòng thử lại.",
};

/** Màu nhấn của khoá → biến `--brand` của khối (xem lib/courseAccent.ts); không hợp lệ thì mặc định. */
function accentStyle(accent: string | null): CSSProperties | undefined {
  const v = accentVar(accent);
  return v ? ({ ["--brand" as string]: v } as CSSProperties) : undefined;
}

/** Giải thích của giảng viên nằm trong `config.explanation` (chữ thuần). */
function explanationOf(config: unknown): string | null {
  const e = (config as { explanation?: unknown } | null)?.explanation;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

/** Bỏ khoá `qid` khỏi một bản đồ theo câu (không đổi tham chiếu nếu khoá không có). */
function without<T>(m: Record<string, T>, qid: string): Record<string, T> {
  if (!(qid in m)) return m;
  const { [qid]: _gone, ...rest } = m;
  return rest;
}

/**
 * LANG đợt 3b — khối "Bài luyện" nhúng trong bài học (Figma "Chi tiết bài học"). Dùng bộ máy luyện đề sẵn có
 * (buổi luyện, tự lưu, kiểm tra từng câu) nhưng với vỏ giao diện Language và không chuyển trang. Buổi luyện chỉ được
 * tạo khi học viên chọn đáp án đầu tiên. Chỉ import ExamQuestion/PassageView/QuestionCard, không sửa chúng.
 */
export default function LessonPractice({
  slug,
  embed,
  blockTitle,
  lessonId,
  preview = false,
  sheet = false,
  skillLabel = null,
  accent = null,
}: {
  slug: string;
  embed: PracticeEmbed;
  blockTitle?: string;
  lessonId?: string;
  /** Khoá ngoại ngữ: dựng Phiếu bài tập (tab bài tập, mỗi câu một dòng) thay cho thẻ từng câu. Khoá khác giữ thẻ cũ. */
  sheet?: boolean;
  /** Tên kỹ năng của bài học (dải đầu phiếu); null thì không có dải. */
  skillLabel?: string | null;
  /** Màu nhấn của bộ sách "r,g,b" (`Course.themeColor`): khối luyện tập dùng cùng màu với thân bài; null = màu Limio. */
  accent?: string | null;
  /** Xem trước của giảng viên: chấm như học viên nhưng không tạo buổi luyện, không lưu đáp án, không ghi sự kiện. */
  preview?: boolean;
}) {
  const { questions, passages } = embed;
  const router = useRouter();
  const steps = useMemo(() => (sheet ? buildSheetSteps(questions, passages.map((x) => x.id)) : buildSteps(questions)), [questions, passages, sheet]);
  // Số câu: phiếu bài tập đánh số lại từ 1 trong MỖI bài tập (như sách: Exercise 3A có câu 1–7, Exercise 4A lại bắt đầu từ 1); luyện đề thường đánh liên tục.
  const numberOf = useMemo(
    () => (sheet ? new Map(steps.flatMap((st) => st.questionIds.map((id, i) => [id, i + 1] as [string, number]))) : new Map(questions.map((q, i) => [q.id, i + 1]))),
    [questions, steps, sheet],
  );
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const hasPassage = passages.length > 0;

  const [sessionId, setSessionId] = useState<string | null>(embed.sessionId);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(embed.answers.map((a) => [a.questionId, a.answerJson as AnswerValue])),
  );
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  // Câu đã kiểm tra ở lần mở trước: kết quả không được lưu phía trình duyệt, nên nạp lại từ máy chủ khi mở bài.
  const [restoring, setRestoring] = useState<Set<string>>(() => new Set(embed.answers.filter((a) => a.checked).map((a) => a.questionId)));
  // Câu mở: góp ý AI hiện có (khôi phục từ máy chủ khi mở lại bài), lý do chưa có góp ý, và bản ghi âm của học viên
  // (số lần ghi: 0 = chưa ghi; dùng làm tham số chống bộ nhớ đệm của trình phát).
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackView>>(() => {
    const out: Record<string, FeedbackView> = {};
    for (const a of embed.answers) {
      const f = parseFeedback(a.aiFeedback);
      if (f) out[a.questionId] = f;
    }
    return out;
  });
  const [feedbackErrors, setFeedbackErrors] = useState<Record<string, string>>({});
  const [audioVer, setAudioVer] = useState<Record<string, number>>(() =>
    Object.fromEntries(embed.answers.filter((a) => a.hasAudio).map((a) => [a.questionId, 1])),
  );
  const [busyCheck, setBusyCheck] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [layout, setLayout] = useState<LayoutPref>("split");
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);

  // Gửi kèm bài chứa khối để máy chủ ghi nhận lượt quan sát kỹ năng (kiểm tra liên kết ở máy chủ; không có thì như cũ).
  const checkInit: RequestInit = lessonId
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId }) }
    : { method: "POST" };
  // Nạp lại kết quả khi mở bài: báo máy chủ đây không phải lần bấm "Kiểm tra" mới, để không tự gọi AI (góp ý đã lưu nằm trong embed).
  const restoreInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(lessonId ? { lessonId } : {}), restore: true }),
  };
  const sessionRef = useRef<string | null>(embed.sessionId);
  const startingRef = useRef<Promise<string> | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    setLayout(readLayoutPref(typeof window === "undefined" ? null : window.localStorage));
  }, []);

  function changeLayout(next: LayoutPref) {
    setLayout(next);
    writeLayoutPref(window.localStorage, next);
  }

  /** Tạo buổi luyện nếu chưa có (một lần, kể cả khi hai thao tác chạy song song). */
  const ensureSession = useCallback(async (): Promise<string> => {
    if (preview) return "preview";
    if (sessionRef.current) return sessionRef.current;
    if (!startingRef.current) {
      startingRef.current = (async () => {
        const res = await fetch(apiUrl(`/api/exams/${embed.examId}/practice`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
        if (!res.ok) throw new Error("start_failed");
        const data = (await res.json()) as { sessionId: string };
        sessionRef.current = data.sessionId;
        setSessionId(data.sessionId);
        return data.sessionId;
      })().finally(() => {
        startingRef.current = null;
      });
    }
    return startingRef.current;
  }, [embed.examId, preview]);

  const save = useCallback(
    async (qid: string, v: AnswerValue) => {
      if (preview) return; // xem trước: không lưu đáp án
      setSaveState("saving");
      try {
        const sid = await ensureSession();
        const res = await fetch(apiUrl(`/api/practice-sessions/${sid}/answers/${qid}`), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answerJson: v }),
        });
        if (!res.ok) throw new Error("save_failed");
        setSaveState("saved");
        setError(null);
      } catch {
        setSaveState("error");
        setError(err.save);
      }
    },
    [ensureSession, preview],
  );

  // Nạp lại kết quả của các câu đã kiểm tra từ lần trước (gọi kiểm tra lại là idempotent ở máy chủ).
  useEffect(() => {
    const ids = [...restoring];
    if (ids.length === 0 || !embed.sessionId) return;
    let cancelled = false;
    (async () => {
      for (const qid of ids) {
        try {
          const res = await fetch(apiUrl(`/api/practice-sessions/${embed.sessionId}/check/${qid}`), restoreInit);
          if (res.ok && !cancelled) {
            const data = (await res.json().catch(() => null)) as CheckResult | null;
            if (data) setChecks((p) => ({ ...p, [qid]: data }));
          }
        } catch {
          /* câu đó coi như chưa kiểm tra: học viên bấm lại được */
        }
        if (!cancelled) setRestoring((p) => { const n = new Set(p); n.delete(qid); return n; });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy một lần khi mở bài.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(qid: string, v: AnswerValue) {
    // Câu mở còn bản ghi âm: chữ sửa tay vẫn là bản chữ của lời nói, nên giữ cờ `viaVoice` để tiêu chí Lưu loát còn được xét.
    if (qid in audioVer && qById.get(qid)?.type === "essay" && v && "text" in v) v = { ...v, viaVoice: true } as AnswerValue;
    setAnswers((p) => ({ ...p, [qid]: v }));
    setChecks((p) => without(p, qid)); // sửa đáp án → phải kiểm tra lại (hành vi của luyện đề)
    setFeedbacks((p) => without(p, qid)); // góp ý AI của câu trả lời cũ không còn đúng
    setFeedbackErrors((p) => without(p, qid));
    clearTimeout(timers.current[qid]);
    timers.current[qid] = setTimeout(() => void save(qid, v), 500);
  }

  /**
   * Dùng bản ghi âm làm câu trả lời: máy chủ chuyển chữ, lưu bản ghi và câu trả lời (đã xoá kết quả kiểm tra và góp ý cũ),
   * rồi trả bản chữ để điền vào ô. Ném `VoiceUseError(mã)` để ô giọng nói hiện lời nhắn đúng; ô gõ vẫn dùng được.
   */
  async function useVoice(qid: string, file: File): Promise<AnswerValue> {
    // Xem thử của giảng viên: chỉ chuyển chữ (trừ ví giảng viên), không buổi luyện, không lưu bản ghi hay câu trả lời.
    let url: string;
    if (preview) {
      url = apiUrl(`/api/practice-preview/${embed.examId}/voice/${qid}`);
    } else {
      let sid: string;
      try {
        sid = await ensureSession();
      } catch {
        throw new VoiceUseError("network");
      }
      url = apiUrl(`/api/practice-sessions/${sid}/voice/${qid}`);
    }
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch {
      throw new VoiceUseError("network");
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
      throw new VoiceUseError(typeof j?.error === "string" ? j.error : "failed");
    }
    const data = (await res.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof data?.text !== "string" || data.text.trim() === "") throw new VoiceUseError("no_speech");
    clearTimeout(timers.current[qid]); // chữ gõ dở chưa kịp lưu không được ghi đè bản chữ vừa lưu
    const spoken = { text: data.text as string, viaVoice: true } as AnswerValue;
    setAnswers((p) => ({ ...p, [qid]: spoken }));
    setChecks((p) => without(p, qid));
    setFeedbacks((p) => without(p, qid));
    setFeedbackErrors((p) => without(p, qid));
    if (!preview) {
      setAudioVer((p) => ({ ...p, [qid]: (p[qid] ?? 0) + 1 }));
      setSaveState("saved");
    }
    setError(null);
    return spoken;
  }

  /** Nút "Nhận xét bằng AI" của ngăn ghi âm: lấy bản chữ rồi kiểm tra luôn, học viên không phải bấm "Kiểm tra" thêm lần nữa. */
  async function useVoiceThenCheck(qid: string, file: File, withFeedback: boolean): Promise<void> {
    const spoken = await useVoice(qid, file);
    if (withFeedback) await check(qid, spoken);
  }

  /**
   * Hội thoại đóng vai: chuyển chữ MỘT lượt nói. Không lưu bản ghi và không lưu câu trả lời (RolePlay đưa bản chữ lên qua `onAnswer`).
   * Xem thử của giảng viên dùng route xem thử (không buổi luyện, không lưu gì).
   */
  async function transcribeTurn(qid: string, turn: number, file: File): Promise<string> {
    let url: string;
    if (preview) {
      url = apiUrl(`/api/practice-preview/${embed.examId}/voice/${qid}`);
    } else {
      let sid: string;
      try {
        sid = await ensureSession();
      } catch {
        throw new VoiceUseError("network");
      }
      url = apiUrl(`/api/practice-sessions/${sid}/roleplay/${qid}?turn=${turn}`);
    }
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch {
      throw new VoiceUseError("network");
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
      throw new VoiceUseError(typeof j?.error === "string" ? j.error : "failed");
    }
    const data = (await res.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof data?.text !== "string" || data.text.trim() === "") throw new VoiceUseError("no_speech");
    return data.text;
  }

  /**
   * "Thử nói tự do": gửi MỘT lượt cho bạn ảo, trả lời của bạn ảo. Lịch sử do RolePlay-giống-FreeChat giữ ở trình duyệt; máy chủ không lưu.
   * Xem thử của giảng viên dùng route xem thử (không buổi luyện, không lưu gì). Ném `FreeChatError(mã)` khi lỗi.
   */
  async function sendFreeChat(qid: string, history: Array<{ role: string; text: string }>, message: string): Promise<string> {
    let url: string;
    if (preview) {
      url = apiUrl(`/api/practice-preview/${embed.examId}/freechat/${qid}`);
    } else {
      let sid: string;
      try {
        sid = await ensureSession();
      } catch {
        throw new FreeChatError("network");
      }
      url = apiUrl(`/api/practice-sessions/${sid}/freechat/${qid}`);
    }
    let res: Response;
    // Mô hình treo thì không để dòng "Bạn ảo đang trả lời…" kéo dài: quá 30 giây thì báo, học viên gửi lại được.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30_000);
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ history, message }), signal: ctl.signal });
    } catch (e) {
      throw new FreeChatError((e as { name?: string })?.name === "AbortError" ? "openai_error" : "network");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
      throw new FreeChatError(typeof j?.error === "string" ? j.error : "failed");
    }
    const data = (await res.json().catch(() => null)) as { reply?: unknown } | null;
    if (typeof data?.reply !== "string" || !data.reply.trim()) throw new FreeChatError("openai_error");
    return data.reply;
  }

  async function check(qid: string, answerNow?: AnswerValue, refreshAfter = true): Promise<boolean> {
    setBusyCheck(qid);
    setError(null);
    try {
      clearTimeout(timers.current[qid]);
      const answerJson = answerNow ?? answersRef.current[qid] ?? null; // sau khi nói, state chưa kịp cập nhật nên nhận đáp án trực tiếp
      await save(qid, answerJson);
      const sid = await ensureSession();
      const res = preview
        ? await fetch(apiUrl(`/api/practice-preview/${embed.examId}/check/${qid}`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answerJson }),
          })
        : await fetch(apiUrl(`/api/practice-sessions/${sid}/check/${qid}`), checkInit);
      if (!res.ok) {
        setError(res.status === 409 ? "Hãy trả lời câu này trước khi kiểm tra." : err.check);
        return false;
      }
      const data = (await res.json()) as CheckResult;
      setChecks((p) => ({ ...p, [qid]: data }));
      // Câu đã kiểm tra tính vào hoàn thành bài: làm mới dữ liệu máy chủ để số "Bài luyện n / m" đầu trang (và việc tự hoàn thành bài) cập nhật,
      // không tải lại trang đang làm dở. Xem thử của giảng viên không ghi gì nên không cần.
      if (!preview && refreshAfter) router.refresh();
      if (data.manual) {
        const f = parseFeedback(data.feedback);
        setFeedbacks((p) => (f ? { ...p, [qid]: f } : without(p, qid)));
        setFeedbackErrors((p) => (data.feedbackError && !f ? { ...p, [qid]: data.feedbackError } : without(p, qid)));
      }
      return true;
    } catch {
      setError(err.check);
      return false;
    } finally {
      setBusyCheck(null);
    }
  }

  /** Phiếu bài tập: kiểm tra lần lượt nhiều câu như bấm từng nút; lỗi một câu không dừng cả loạt. */
  async function checkMany(ids: string[]) {
    setBatch({ done: 0, total: ids.length });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      // Không làm mới giữa chừng (làm mới máy chủ khi vòng kiểm tra còn chạy làm gián đoạn nó): một lần sau khi cả loạt xong.
      if (!(await check(ids[i]!, undefined, false))) failed++;
      setBatch({ done: i + 1, total: ids.length });
    }
    setBatch(null);
    if (!preview && failed < ids.length) router.refresh();
    if (failed > 0) setError(`Không kiểm tra được ${failed} câu. Bấm lại để thử lần nữa.`);
  }

  async function finish() {
    const left = questions.filter((q) => !isAnswered(answers[q.id] ?? null)).length;
    if (left > 0 && !window.confirm(`Còn ${left} câu chưa trả lời, sẽ tính là sai trong kết quả. Kết thúc bài luyện?`)) return;
    setFinishing(true);
    setError(null);
    try {
      for (const t of Object.values(timers.current)) clearTimeout(t);
      await Promise.all(Object.entries(answers).filter(([, v]) => isAnswered(v)).map(([qid, v]) => save(qid, v)));
      const sid = await ensureSession();
      const res = await fetch(apiUrl(`/api/practice-sessions/${sid}/complete`), { method: "POST" });
      if (!res.ok) throw new Error("complete_failed");
      setResult((await res.json()) as PracticeResult);
    } catch {
      setError("Không kết thúc được. Vui lòng thử lại.");
    } finally {
      setFinishing(false);
    }
  }

  function restart() {
    sessionRef.current = null;
    setSessionId(null);
    setAnswers({});
    setChecks({});
    setFeedbacks({});
    setFeedbackErrors({});
    setAudioVer({});
    setResult(null);
    setStepIdx(0);
    setSaveState("idle");
    setError(null);
  }

  const answeredCount = questions.filter((q) => isAnswered(answers[q.id] ?? null)).length;
  const counts = countProgress(
    questions.map((q) => q.id),
    (id) => isAnswered(answers[id] ?? null),
    (id) => id in checks,
  );
  const step = steps[stepIdx];
  // Phiếu: đoạn văn chỉ là câu yêu cầu (không bài đọc, audio, ảnh, bảng, danh sách) không cần cột riêng; hiện thành câu yêu cầu ở đầu bài tập, một cột.
  // Bài nghe chỉ có câu yêu cầu ngắn và trình phát: trình phát hiện ngay trên các câu hỏi (cùng cách).
  const intros = useMemo(
    () =>
      new Map<string, ReactNode>(
        sheet
          ? passages.flatMap((x): Array<[string, ReactNode]> => {
              const text = instructionOnlyText(x.contentJson);
              if (text) return [[x.id, text]];
              if (isShortAudioPassage(x.contentJson)) {
                const p = { ...x, title: "" } as unknown as { id: string; title: string; contentJson: { type: "doc"; content: unknown[] } };
                return [[x.id, <PassageView key={x.id} passage={p} attemptId={`lesson-practice-${embed.examId}`} />]];
              }
              return [];
            })
          : [],
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passages, sheet],
  );
  const introOf = (st: { passageId: string | null; questionIds: string[] } | undefined): ReactNode | null =>
    st?.passageId && st.questionIds.length > 0 ? intros.get(st.passageId) ?? null : null;
  const lightIntro = introOf(step);
  const split = hasPassage && layout === "split" && !!step?.passageId && !lightIntro;

  function jumpTo(qid: string) {
    const i = stepIndexOf(steps, qid);
    if (i >= 0) setStepIdx(i);
    setTimeout(() => document.getElementById(`lp-${qid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  if (result) {
    const rows = summaryRows(result.bySkill);
    return (
      <section aria-labelledby="lp-summary" className="my-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
        <h2 id="lp-summary" className="text-h3">
          Kết quả bài luyện
        </h2>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.skill} className="flex items-center justify-between text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums font-semibold">
                {r.correct} / {r.total} câu đúng
              </span>
            </li>
          ))}
        </ul>
        {result.wrong.length > 0 && <p className="text-meta mt-3">{result.wrong.length} câu chưa đúng hoặc chưa làm.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/learn/${slug}/exams/${embed.examId}/practice/${result.sessionId}/result`} className="btn-ghost btn-sm">
            Xem chi tiết
          </Link>
          <button type="button" onClick={restart} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <RotateCcw size={14} aria-hidden /> Luyện lại
          </button>
        </div>
      </section>
    );
  }

  const renderQuestion = (qid: string) => {
    const q = qById.get(qid)!;
    const n = numberOf.get(qid) ?? 0;
    const value = answers[qid] ?? null;
    const res = checks[qid];
    const explanation = res ? explanationOf(res.config) : null;
    const isEssay = q.type === "essay";
    const aiOn = isEssay && essayFeedbackEnabled(q.config);
    const rolePlay = isEssay ? parseRolePlay(q.config) : null;
    const freeChat = isEssay && !rolePlay ? parseFreeChatView(q.config) : null;
    const chatTurns = freeChat && value && "text" in value ? learnerTurnCount(String(value.text ?? "")) : 0;
    const hasRecording = (audioVer[qid] ?? 0) > 0;
    return (
      <div key={qid} id={`lp-${qid}`} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-lime-700">Câu {n}</h3>
          {res && !res.manual && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${res.isCorrect ? "text-lime-700" : "text-danger-600"}`}>
              {res.isCorrect ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
              Đã kiểm tra
            </span>
          )}
        </div>
        {rolePlay ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-[rgb(var(--text))]">{q.prompt}</p>
            <RolePlay
              rp={rolePlay}
              savedText={value && "text" in value ? String(value.text ?? "") : ""}
              transcribe={(turn, file) => transcribeTurn(qid, turn, file)}
              onAnswer={(text) => onChange(qid, { text, viaVoice: true } as AnswerValue)}
              audioUrl={(path) => apiUrl(path)}
              preview={preview}
            />
          </div>
        ) : freeChat ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-[rgb(var(--text))]">{q.prompt}</p>
            <FreeChat
              view={freeChat}
              savedText={value && "text" in value ? String(value.text ?? "") : ""}
              preview={preview}
              send={(history, message) => sendFreeChat(qid, history, message)}
              voiceEnabled={essayVoiceEnabled(q.config)}
              transcribe={(turn, file) => transcribeTurn(qid, turn, file)}
              onAnswer={(text) => onChange(qid, { text } as AnswerValue)}
            />
          </div>
        ) : (
          <ExamQuestion question={q} value={value} onChange={(v) => onChange(qid, v)} compact />
        )}
        {(() => {
          const checkButton = embed.checkEnabled ? (
            <button
              type="button"
              onClick={() => void check(qid)}
              disabled={!isAnswered(value) || busyCheck === qid || restoring.has(qid) || (!!freeChat && chatTurns < FREECHAT_MIN_FEEDBACK_TURNS)}
              className="btn-primary btn-sm disabled:opacity-50"
            >
              {busyCheck === qid ? (aiOn && !preview ? "Đang nhận xét…" : "Đang kiểm tra…") : (rolePlay || freeChat) && aiOn && !preview ? "Nhận xét bằng AI" : `Kiểm tra câu ${n}`}
            </button>
          ) : null;
          const note = embed.checkEnabled && !res ? (
            <span className="text-caption text-muted">
              {freeChat && chatTurns < FREECHAT_MIN_FEEDBACK_TURNS
                ? `Cần ít nhất ${FREECHAT_MIN_FEEDBACK_TURNS} lượt của bạn để nhận xét.`
                : aiOn && !preview
                  ? "Khi bấm Kiểm tra, câu trả lời của bạn được gửi tới AI để nhận xét."
                  : "Bạn có thể đổi đáp án trước khi kiểm tra."}
            </span>
          ) : null;
          const voiceRow = isEssay && !rolePlay && !freeChat && essayVoiceEnabled(q.config);
          if (voiceRow) {
            // Ô gõ → một hàng: [Trả lời bằng giọng nói] … [Kiểm tra] → một dòng chú thích nhỏ.
            return (
              <>
                <EssayVoiceAnswer
                  preview={preview}
                  recordingSrc={hasRecording && sessionId ? apiUrl(`/api/practice-sessions/${sessionId}/audio/${qid}?v=${audioVer[qid]}`) : null}
                  viaVoiceText={!!value && "viaVoice" in value && (value as { viaVoice?: unknown }).viaVoice === true}
                  hasText={isAnswered(value)}
                  feedbackOn={aiOn && embed.checkEnabled && !preview}
                  onUse={(file, withFeedback) => useVoiceThenCheck(qid, file, withFeedback)}
                  trailing={checkButton}
                />
                {note && <p className="mt-1.5">{note}</p>}
              </>
            );
          }
          return (
            embed.checkEnabled && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {note ?? <span />}
                {checkButton}
              </div>
            )
          );
        })()}
        {res && res.manual && (
          <EssayFeedback config={res.config} feedback={feedbacks[qid] ?? null} feedbackError={feedbackErrors[qid] ?? null} preview={preview} />
        )}
        {res && !res.manual && (
          <div role="status" className={`mt-3 rounded-lg border p-3 text-sm ${res.isCorrect ? "border-lime-300 bg-lime-50" : "border-red-200 bg-red-50"}`}>
            <div className={`font-semibold ${res.isCorrect ? "text-lime-800" : "text-danger-600"}`}>{res.isCorrect ? "Chính xác" : "Chưa chính xác"}</div>
            {explanation && <p className="mt-1 whitespace-pre-wrap text-[rgb(var(--text))]">{explanation}</p>}
            <details className="mt-2" open={!res.isCorrect} data-testid="lp-answer">
              <summary className="cursor-pointer text-xs font-semibold text-muted">Xem đáp án và bài làm của bạn</summary>
              <div className="mt-2">
                <QuestionCard
                  idx={n - 1}
                  q={{
                    id: q.id,
                    orderInExam: 0,
                    type: q.type,
                    prompt: q.prompt,
                    points: q.points,
                    config: res.config,
                    explanation: null,
                    answer: { answerJson: value, score: res.score, needsGrading: false, comment: null },
                  } as never}
                />
              </div>
            </details>
          </div>
        )}
        {!res && restoring.has(qid) && <p className="text-caption mt-2 text-muted">Đang tải kết quả đã kiểm tra…</p>}
      </div>
    );
  };

  /** Bài làm và đáp án đầy đủ của một câu đã chấm (dùng trong Phiếu bài tập cho dạng chưa có đáp án bằng chữ). */
  const reviewCardOf = (qid: string) => {
    const q = qById.get(qid)!;
    const res = checks[qid];
    if (!res) return null;
    return (
      <QuestionCard
        idx={(numberOf.get(qid) ?? 1) - 1}
        q={{
          id: q.id,
          orderInExam: 0,
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          config: res.config,
          explanation: null,
          answer: { answerJson: answers[qid] ?? null, score: res.score, needsGrading: false, comment: null },
        } as never}
      />
    );
  };

  const layoutToggle = hasPassage ? (
    <div role="group" aria-label="Bố cục" className="hidden items-center gap-1 lg:flex">
      <button
        type="button"
        aria-pressed={layout === "split"}
        onClick={() => changeLayout("split")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${layout === "split" ? "border-lime-400 bg-lime-50 font-semibold text-lime-800" : "border-token text-muted"}`}
      >
        <Columns2 size={14} aria-hidden /> Chia đôi
      </button>
      <button
        type="button"
        aria-pressed={layout === "single"}
        onClick={() => changeLayout("single")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${layout === "single" ? "border-lime-400 bg-lime-50 font-semibold text-lime-800" : "border-token text-muted"}`}
      >
        <Rows2 size={14} aria-hidden /> Một cột
      </button>
    </div>
  ) : null;

  const titleBlock = (
    <div className="min-w-0">
      <h2 id="lp-title" className="text-base font-semibold leading-snug">
        {blockTitle || embed.title}
      </h2>
      <p className="text-xs text-muted" aria-live="polite">
        {progressLabel(counts)}
      </p>
    </div>
  );

  const questionNav = (
    <nav aria-label="Các câu" className="flex flex-wrap justify-end gap-1.5">
      {questions.map((q) => {
        const n = numberOf.get(q.id)!;
        const state = q.id in checks ? "checked" : isAnswered(answers[q.id] ?? null) ? "chosen" : "none";
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => jumpTo(q.id)}
            aria-label={`Câu ${n}${state === "checked" ? ", đã kiểm tra" : state === "chosen" ? ", đã chọn" : ", chưa trả lời"}`}
            className={`h-8 min-w-8 rounded-lg border px-2 text-sm tabular-nums ${
              state === "checked" ? "border-lime-600 bg-lime-600 text-white" : state === "chosen" ? "border-lime-300 bg-lime-50 text-lime-800" : "border-token text-muted"
            }`}
          >
            {n}
          </button>
        );
      })}
    </nav>
  );

  const sheetTitles = steps.map((st) => (st.passageId ? passages.find((x) => x.id === st.passageId)?.title : null));
  const sheetShorts = tabShortLabels(sheetTitles);
  const sheetTabs = steps.map((st, i) => ({
    key: st.key.replace(/[^A-Za-z0-9_-]/g, "-"),
    label: tabLabel(sheetTitles[i], i),
    short: sheetShorts[i],
    questionIds: st.questionIds,
    ...(introOf(st) ? { intro: introOf(st), introTitle: sheetTitles[i] ?? undefined } : {}),
  }));
  const sheetNode = sheet ? (
    <PracticeSheet
      tabs={sheetTabs}
      activeIdx={stepIdx}
      onTab={setStepIdx}
      questions={qById}
      numberOf={numberOf}
      answers={answers}
      onAnswer={onChange}
      checks={checks}
      restoring={restoring}
      checkEnabled={embed.checkEnabled}
      batch={batch}
      onCheck={(ids) => void checkMany(ids)}
      renderEssay={renderQuestion}
      renderReview={reviewCardOf}
      explanationOf={explanationOf}
      banner={skillLabel}
      hideTabs
      header={
        // Phiếu: một hàng mỏng (tên bài luyện + nút bố cục dạng biểu tượng); tiến độ nằm ở đếm của tab và chân phiếu.
        <div className="flex items-center justify-end gap-3">
          {/* Sách không đặt tên cho phần luyện của một bài: tên khối chỉ để trình đọc màn hình, không hiện thành một dòng tiêu đề thừa. */}
          <h2 id="lp-title" className="sr-only">
            {blockTitle || embed.title}
          </h2>
          {hasPassage && !lightIntro && (
            <div role="group" aria-label="Bố cục" className="hidden shrink-0 items-center gap-1 lg:flex">
              <button
                type="button"
                aria-pressed={layout === "split"}
                aria-label="Chia đôi"
                title="Chia đôi: đoạn văn một bên, câu hỏi một bên"
                onClick={() => changeLayout("split")}
                className={`rounded-lg border p-1.5 ${layout === "split" ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand)/0.08)] text-[rgb(var(--brand))]" : "border-token text-muted"}`}
              >
                <Columns2 size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-pressed={layout === "single"}
                aria-label="Một cột"
                title="Một cột: đoạn văn rồi tới câu hỏi"
                onClick={() => changeLayout("single")}
                className={`rounded-lg border p-1.5 ${layout === "single" ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand)/0.08)] text-[rgb(var(--brand))]" : "border-token text-muted"}`}
              >
                <Rows2 size={16} aria-hidden />
              </button>
            </div>
          )}
        </div>
      }
    />
  ) : null;

  // Bố cục chia đôi (theo mẫu Figma): tiêu đề, tiến độ, các số câu và nút đổi bố cục gom vào MỘT thẻ đầu cột câu hỏi, nên không tốn
  // thêm hàng phía trên; thẻ đoạn văn bên trái dính theo cuộn và tự cuộn riêng khi bài đọc dài.
  const splitView = !!(step?.passageId && split);

  return (
    <section aria-labelledby="lp-title" className="lp-large my-2" data-testid="lesson-practice" style={accentStyle(accent)}>
      {!splitView && !sheet && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {titleBlock}
            {layoutToggle}
          </div>
          <div className="mt-3">{questionNav}</div>
        </>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Tab đổi cả đoạn văn lẫn phiếu câu hỏi, nên đặt trên cả hai chứ không nằm trong cột câu hỏi. */}
      {sheet && (
        <div className="mt-4">
          <SheetTabBar tabs={sheetTabs} activeIdx={stepIdx} onTab={setStepIdx} questions={qById} answers={answers} checks={checks} standalone />
        </div>
      )}

      {step &&
        (step.passageId && !lightIntro ? (
          <div className={`${sheet ? "mt-3" : "mt-4"} grid gap-4 ${split ? "lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-2.5" : ""}`}>
            <div
              className={`${sheet ? "ps-paper-card" : "rounded-xl border border-token bg-[rgb(var(--surface))]"} p-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lp-scroll ${split ? "lg:sticky lg:top-20" : ""} [&_p]:leading-8`}
              data-testid="lp-passage"
            >
              {(() => {
                const p = passages.find((x) => x.id === step.passageId);
                return p ? <PassageView passage={p as { id: string; title: string; contentJson: { type: "doc"; content: unknown[] } }} attemptId={`lesson-practice-${embed.examId}`} /> : null;
              })()}
            </div>
            {/* Chia đôi: cột câu hỏi cũng tự cuộn riêng (như cột đoạn văn) khi nhiều câu dài; thẻ đầu cột (bản đồ câu hỏi) dính ở đỉnh nên luôn thấy. */}
            <div className={`min-w-0 space-y-3 ${splitView ? "lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lp-scroll" : ""}`}>
              {splitView && !sheet && (
                <div className="sticky top-0 z-10 -mb-3 bg-[rgb(var(--bg))] pb-3">
                <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    {titleBlock}
                    {layoutToggle}
                  </div>
                  <div className="mt-3">{questionNav}</div>
                </div>
                </div>
              )}
              {sheet ? sheetNode : step.questionIds.map(renderQuestion)}
            </div>
          </div>
        ) : (
          <div className={`${sheet ? "mt-3" : "mt-4"} space-y-3`}>{sheet ? sheetNode : step.questionIds.map(renderQuestion)}</div>
        ))}

      {/* Một hàng chân khối: trạng thái lưu bên trái, "Kết thúc bài luyện" bên phải ở dạng nút phụ (nút hồng chính chỉ dành cho việc của câu đang làm: Kiểm tra / Nhận xét). */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-caption text-muted" aria-live="polite">
          {preview
            ? `Xem trước: không lưu đáp án · ${answeredCount} / ${questions.length} câu`
            : `${saveState === "error" ? "Chưa lưu được" : "Đã lưu câu trả lời"} · ${answeredCount} / ${questions.length} câu`}
          {preview || sessionId ? "" : answeredCount === 0 ? " (bài luyện bắt đầu khi bạn chọn đáp án đầu tiên)" : ""}
        </p>
        {!preview && (
          <button type="button" onClick={() => void finish()} disabled={finishing} className="btn-ghost btn-sm font-semibold disabled:opacity-50">
            {finishing ? "Đang kết thúc…" : "Kết thúc bài luyện"}
          </button>
        )}
      </div>
    </section>
  );
}
