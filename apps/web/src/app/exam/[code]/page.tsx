import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@feedbackme/db";
import { Clock, Lock, AlertCircle, XCircle } from "lucide-react";
import ClaimForm from "./ClaimForm";
import SebBrowserPrompt from "@/components/exam/SebBrowserPrompt";
import { detectSeb, requiresSeb } from "@/lib/seb";
import { formatVN } from "@/lib/datetime";

export const dynamic = "force-dynamic";

interface ResolvedOk {
  state: "ok";
  mode: "open" | "assigned";
  examTitle: string;
  candidateName: string | null;
  proctoringLevel: "none" | "basic" | "strict";
  // PR2.12 — Khi code resolve qua ExamSession.openCode, courseId được truyền
  // xuống ClaimForm để preview cohort. Null khi resolve qua Exam.openCode legacy.
  courseId: string | null;
}
interface ResolvedNotYet {
  state: "not_yet";
  examTitle: string;
  opensAt: Date;
}
interface ResolvedClosed {
  state: "closed";
  examTitle: string;
  closesAt: Date;
}
interface ResolvedNotReady {
  state: "not_ready";
  reason: "not_published" | "disabled" | "wrong_mode";
  examTitle: string;
}
type Resolved =
  | ResolvedOk
  | ResolvedNotYet
  | ResolvedClosed
  | ResolvedNotReady;

/**
 * A5.8 — Public claim landing. URL pattern:
 *   /exam/ABCD12     — open mode (6-char code, candidate types name + phone + email)
 *   /exam/X65DMJZD   — assigned mode (8-char personal code, only confirm)
 *
 * Resolves the code to one of several states (ok / not yet started / closed /
 * not ready / not found) so the student gets a friendly message instead of a
 * bare 404 for legitimate codes that just aren't active yet.
 */
async function resolveCode(code: string): Promise<Resolved | null> {
  const now = new Date();

  if (code.length === 6) {
    // PR2.12 — Try ExamSession.openCode (per-session) first.
    const session = await prisma.examSession.findFirst({
      where: { openCode: code, accessMode: "open_code" },
      select: {
        opensAt: true,
        closesAt: true,
        exam: {
          select: {
            courseId: true,
            title: true,
            status: true,
            proctoringLevel: true,
          },
        },
      },
    });
    if (session) {
      const exam = session.exam;
      if (exam.status !== "published")
        return { state: "not_ready", reason: "not_published", examTitle: exam.title };
      if (now < session.opensAt)
        return { state: "not_yet", examTitle: exam.title, opensAt: session.opensAt };
      if (now >= session.closesAt)
        return { state: "closed", examTitle: exam.title, closesAt: session.closesAt };
      return {
        state: "ok",
        mode: "open",
        examTitle: exam.title,
        candidateName: null,
        proctoringLevel: exam.proctoringLevel,
        courseId: exam.courseId,
      };
    }
    // Fallback to Exam.openCode (legacy).
    const exam = await prisma.exam.findUnique({
      where: { openCode: code },
      select: {
        courseId: true,
        title: true,
        accessMode: true,
        status: true,
        openAt: true,
        closeAt: true,
        proctoringLevel: true,
      },
    });
    if (!exam) return null;
    if (exam.status !== "published")
      return { state: "not_ready", reason: "not_published", examTitle: exam.title };
    if (exam.accessMode !== "open_code")
      return { state: "not_ready", reason: "wrong_mode", examTitle: exam.title };
    if (now < exam.openAt)
      return { state: "not_yet", examTitle: exam.title, opensAt: exam.openAt };
    if (now >= exam.closeAt)
      return { state: "closed", examTitle: exam.title, closesAt: exam.closeAt };
    return {
      state: "ok",
      mode: "open",
      examTitle: exam.title,
      candidateName: null,
      proctoringLevel: exam.proctoringLevel,
      courseId: exam.courseId,
    };
  }

  if (code.length === 8) {
    const candidate = await prisma.examCandidate.findFirst({
      where: { accessCode: code },
      select: {
        displayName: true,
        disabledAt: true,
        session: {
          select: { opensAt: true, closesAt: true },
        },
        exam: {
          select: {
            title: true,
            accessMode: true,
            status: true,
            openAt: true,
            closeAt: true,
            proctoringLevel: true,
          },
        },
      },
    });
    if (!candidate) return null;
    if (candidate.disabledAt)
      return {
        state: "not_ready",
        reason: "disabled",
        examTitle: candidate.exam.title,
      };
    if (candidate.exam.status !== "published")
      return {
        state: "not_ready",
        reason: "not_published",
        examTitle: candidate.exam.title,
      };
    if (candidate.exam.accessMode !== "assigned_code")
      return {
        state: "not_ready",
        reason: "wrong_mode",
        examTitle: candidate.exam.title,
      };
    // Use the candidate's session window if available, else exam window.
    const opens = candidate.session?.opensAt ?? candidate.exam.openAt;
    const closes = candidate.session?.closesAt ?? candidate.exam.closeAt;
    if (now < opens)
      return { state: "not_yet", examTitle: candidate.exam.title, opensAt: opens };
    if (now >= closes)
      return { state: "closed", examTitle: candidate.exam.title, closesAt: closes };
    return {
      state: "ok",
      mode: "assigned",
      examTitle: candidate.exam.title,
      candidateName: candidate.displayName,
      proctoringLevel: candidate.exam.proctoringLevel,
      courseId: null,
    };
  }

  return null; // wrong length entirely
}

export default async function ExamClaimPage({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code.trim().toUpperCase();
  const r = await resolveCode(code);
  if (!r) return <NotFoundCode code={code} />;

  if (r.state === "not_yet")
    return <NotYet examTitle={r.examTitle} opensAt={r.opensAt} />;
  if (r.state === "closed")
    return <Closed examTitle={r.examTitle} closesAt={r.closesAt} />;
  if (r.state === "not_ready")
    return <NotReady examTitle={r.examTitle} reason={r.reason} />;

  // r.state === "ok"
  // A7.8 — Strict proctoring requires Safe Exam Browser.
  if (requiresSeb(r.proctoringLevel)) {
    const { isSeb } = detectSeb(headers());
    if (!isSeb) {
      const h = headers();
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? "http";
      return (
        <SebBrowserPrompt
          examTitle={r.examTitle}
          targetUrl={`${proto}://${host}/exam/${code}`}
        />
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{r.examTitle}</h1>
      <p className="mt-1 text-sm text-faint">
        {r.mode === "open"
          ? "Nhập thông tin để vào ca thi"
          : "Xác nhận danh tính để bắt đầu thi"}
      </p>
      <ClaimForm
        code={code}
        mode={r.mode}
        candidateName={r.candidateName}
        courseId={r.courseId}
      />
    </main>
  );
}

// ----------------------------------------------------------------------------
// State screens (server components, no JS needed — auto-refresh via meta tag).
// ----------------------------------------------------------------------------

function NotYet({ examTitle, opensAt }: { examTitle: string; opensAt: Date }) {
  const diffMs = opensAt.getTime() - Date.now();
  // Auto-refresh page so the form appears once the window opens, but cap the
  // interval so we don't hammer the server when the wait is hours long.
  const refreshSec = Math.max(15, Math.min(120, Math.floor(diffMs / 1000)));
  return (
    <>
      <meta httpEquiv="refresh" content={`${refreshSec}`} />
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <Clock className="mx-auto h-16 w-16 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Ca thi chưa bắt đầu
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Bài thi <strong>{examTitle}</strong> sẽ mở lúc:
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {formatFull(opensAt)}
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Trang sẽ tự cập nhật. Bạn không cần làm gì cả — đợi đến giờ là form
          vào thi sẽ tự hiện.
        </p>
        <BackToLanding />
      </main>
    </>
  );
}

function Closed({
  examTitle,
  closesAt,
}: {
  examTitle: string;
  closesAt: Date;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <Lock className="mx-auto h-16 w-16 text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Ca thi đã kết thúc
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Bài thi <strong>{examTitle}</strong> đã đóng lúc{" "}
        {formatFull(closesAt)}.
      </p>
      <p className="mt-4 text-xs text-slate-400">
        Nếu bạn nghĩ đây là nhầm lẫn, vui lòng liên hệ giám thị.
      </p>
      <BackToLanding />
    </main>
  );
}

function NotReady({
  examTitle,
  reason,
}: {
  examTitle: string;
  reason: "not_published" | "disabled" | "wrong_mode";
}) {
  const msg =
    reason === "disabled"
      ? "Mã thi của bạn đã bị giám thị khoá."
      : reason === "wrong_mode"
        ? "Mã không khớp với chế độ đề thi hiện tại."
        : "Đề thi chưa được publish, vui lòng chờ giảng viên xác nhận.";
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <AlertCircle className="mx-auto h-16 w-16 text-amber-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Chưa thể vào thi
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Bài thi <strong>{examTitle}</strong>: {msg}
      </p>
      <p className="mt-4 text-xs text-slate-400">
        Liên hệ giám thị nếu vấn đề kéo dài.
      </p>
      <BackToLanding />
    </main>
  );
}

function NotFoundCode({ code }: { code: string }) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <XCircle className="mx-auto h-16 w-16 text-red-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Mã thi không đúng
      </h1>
      <p className="mt-3 text-sm text-slate-600">Mã bạn vừa nhập:</p>
      <div className="mt-1 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-red-700">
        {code || "(trống)"}
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Vui lòng kiểm tra lại mã từ phiếu rồi thử lại.
      </p>
      <BackToLanding />
    </main>
  );
}

function BackToLanding() {
  return (
    <Link
      href="/thi"
      className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      ← Quay lại nhập mã khác
    </Link>
  );
}

function formatFull(d: Date): string {
  return formatVN(d, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
