"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LS_QUESTIONS } from "@/lib/learning-style";
import { SRL_QUESTIONS } from "@/lib/srl-questions";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "ls" | "srl" | "done">("intro");
  const [lsAns, setLsAns] = useState<Record<string, -1 | 1>>({});
  const [srlAns, setSrlAns] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lsAllDone = LS_QUESTIONS.every((q) => lsAns[q.id] !== undefined);
  const srlAllDone = SRL_QUESTIONS.every((q) => typeof srlAns[q.id] === "number");

  async function submitLS() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/learning-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: lsAns }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Lưu câu trả lời thất bại");
        return;
      }
      setStep("srl");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSRL() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/srl?phase=pre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: srlAns }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Lưu câu trả lời thất bại");
        return;
      }
      setStep("done");
      setTimeout(() => router.push("/student"), 1200);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Step active={step === "intro"} done={step !== "intro"}>
            1. Giới thiệu
          </Step>
          <span className="text-slate-300">→</span>
          <Step active={step === "ls"} done={step === "srl" || step === "done"}>
            2. Phong cách học
          </Step>
          <span className="text-slate-300">→</span>
          <Step active={step === "srl"} done={step === "done"}>
            3. Tự đánh giá học tập
          </Step>
        </div>

        {step === "intro" && (
          <div className="card p-6">
            <h1 className="text-2xl font-bold mb-3">Chào mừng đến với FeedBackMe</h1>
            <p className="text-slate-700 mb-3">
              Bạn đang tham gia một nghiên cứu thực nghiệm về phản hồi cá nhân hoá
              dựa trên AI trong khoá <em>Nhập môn Công nghệ Giáo dục</em>.
            </p>
            <p className="text-slate-700 mb-3">
              Trước khi bắt đầu, hãy hoàn tất 2 bảng hỏi ngắn (~5 phút):
            </p>
            <ol className="list-decimal pl-6 text-slate-700 space-y-1 mb-4">
              <li>8 câu xác định <b>phong cách học (Felder-Silverman)</b></li>
              <li>12 câu đánh giá <b>kỹ năng tự điều chỉnh học tập (SRL)</b></li>
            </ol>
            <p className="text-sm text-slate-500 mb-4">
              Dữ liệu của bạn được sử dụng cho mục đích nghiên cứu và ẩn danh khi báo cáo.
            </p>
            <button onClick={() => setStep("ls")} className="btn-primary">
              Bắt đầu
            </button>
          </div>
        )}

        {step === "ls" && (
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-1">
              Bảng hỏi Phong cách học (Felder-Silverman, rút gọn)
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Mỗi câu chọn 1 trong 2 đáp án phù hợp với bạn nhất.
            </p>
            <ol className="space-y-5">
              {LS_QUESTIONS.map((q, idx) => (
                <li key={q.id}>
                  <p className="font-medium mb-2">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <ChoiceButton
                      selected={lsAns[q.id] === -1}
                      onClick={() =>
                        setLsAns((prev) => ({ ...prev, [q.id]: -1 }))
                      }
                    >
                      A. {q.optionA.text}
                    </ChoiceButton>
                    <ChoiceButton
                      selected={lsAns[q.id] === 1}
                      onClick={() =>
                        setLsAns((prev) => ({ ...prev, [q.id]: 1 }))
                      }
                    >
                      B. {q.optionB.text}
                    </ChoiceButton>
                  </div>
                </li>
              ))}
            </ol>
            {error && (
              <div className="text-sm text-rose-600 mt-4">{error}</div>
            )}
            <div className="mt-6">
              <button
                disabled={!lsAllDone || submitting}
                onClick={submitLS}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Đang lưu..." : "Tiếp tục →"}
              </button>
            </div>
          </div>
        )}

        {step === "srl" && (
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-1">
              Bảng hỏi tự điều chỉnh học tập (SRL)
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Đánh giá mức độ đồng ý của bạn với mỗi phát biểu (1 = rất không
              đồng ý, 5 = rất đồng ý).
            </p>
            <ol className="space-y-5">
              {SRL_QUESTIONS.map((q, idx) => (
                <li key={q.id}>
                  <p className="font-medium mb-2">
                    {idx + 1}. {q.text}
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setSrlAns((prev) => ({ ...prev, [q.id]: v }))
                        }
                        className={`w-12 h-12 rounded-full border-2 font-medium transition ${
                          srlAns[q.id] === v
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-slate-300 hover:border-brand-400"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            {error && (
              <div className="text-sm text-rose-600 mt-4">{error}</div>
            )}
            <div className="mt-6">
              <button
                disabled={!srlAllDone || submitting}
                onClick={submitSRL}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Đang lưu..." : "Hoàn tất onboarding"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-xl font-bold mb-2">Hoàn tất onboarding</h2>
            <p className="text-slate-600">Đang chuyển đến bảng điều khiển...</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Step({
  children,
  active,
  done,
}: {
  children: React.ReactNode;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <span
      className={
        active
          ? "font-semibold text-brand-700"
          : done
            ? "text-emerald-600"
            : "text-slate-400"
      }
    >
      {children}
    </span>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2 rounded border transition ${
        selected
          ? "border-brand-600 bg-brand-50 text-brand-900"
          : "border-slate-300 hover:border-brand-400"
      }`}
    >
      {children}
    </button>
  );
}
