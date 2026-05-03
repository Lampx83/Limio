"use client";

import { useEffect, useRef, useState } from "react";
import FeedbackPanel, { type MaterialFeedback } from "./feedback-panel";

export default function PdfMaterial({
  materialId,
  readingText,
  pdfUrl,
  initialDone,
  initialReflection,
  initialFeedback,
}: {
  materialId: number;
  readingText: string;
  pdfUrl: string | null;
  initialDone: boolean;
  initialReflection: string;
  initialFeedback: MaterialFeedback | null;
}) {
  const [done, setDone] = useState(initialDone);
  const [marking, setMarking] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  async function markDone() {
    setMarking(true);
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    const res = await fetch(`/api/materials/${materialId}/interaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { type: "pdf", read_seconds: elapsed },
      }),
    });
    if (res.ok) setDone(true);
    setMarking(false);
  }

  // Render markdown đơn giản: # → h1, ## → h2, > → quote, - → list, **bold**, `code`
  function renderInline(text: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIdx)
        out.push(text.slice(lastIdx, match.index));
      const token = match[0];
      if (token.startsWith("**")) {
        out.push(
          <strong key={key++} className="font-semibold text-slate-900 dark:text-slate-50">
            {token.slice(2, -2)}
          </strong>,
        );
      } else if (token.startsWith("`")) {
        out.push(
          <code key={key++} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">
            {token.slice(1, -1)}
          </code>,
        );
      }
      lastIdx = match.index + token.length;
    }
    if (lastIdx < text.length) out.push(text.slice(lastIdx));
    return out;
  }

  const lines = readingText.split("\n");
  const rendered: React.ReactNode[] = [];
  let listBuf: string[] = [];
  function flushList(idx: number) {
    if (listBuf.length === 0) return;
    rendered.push(
      <ul key={`ul-${idx}`} className="list-disc pl-6 space-y-1 my-2">
        {listBuf.map((t, i) => (
          <li key={i}>{renderInline(t)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  }
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      flushList(idx);
      rendered.push(
        <h1 key={idx} className="text-xl sm:text-2xl font-bold mt-5 mb-2">
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushList(idx);
      rendered.push(
        <h2 key={idx} className="text-lg sm:text-xl font-semibold mt-4 mb-2">
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("> ")) {
      flushList(idx);
      rendered.push(
        <blockquote
          key={idx}
          className="border-l-4 border-brand-400 pl-3 italic text-slate-600 my-2"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line.startsWith("- ")) {
      listBuf.push(line.slice(2));
    } else if (line === "") {
      flushList(idx);
    } else {
      flushList(idx);
      rendered.push(
        <p key={idx} className="my-2 leading-relaxed">
          {renderInline(line)}
        </p>,
      );
    }
  });
  flushList(lines.length);

  return (
    <>
      <article className="card p-4 sm:p-6 prose-fb max-w-none text-sm sm:text-base">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline text-sm"
          >
            Mở file PDF gốc ↗
          </a>
        )}
        {rendered}
      </article>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2 text-sm">
        <p className="text-slate-500">
          Đọc xong rồi? Đánh dấu hoàn thành để mở khoá AI feedback.
        </p>
        {done ? (
          <span className="badge-green">✓ Đã hoàn thành</span>
        ) : (
          <button onClick={markDone} disabled={marking} className="btn-primary">
            {marking ? "Đang lưu..." : "Đánh dấu đã đọc"}
          </button>
        )}
      </div>

      <FeedbackPanel
        materialId={materialId}
        done={done}
        initialReflection={initialReflection}
        initialFeedback={initialFeedback}
      />
    </>
  );
}
