"use client";

// Nhập bài giảng PowerPoint: bước 1 (đọc file ngay trên trình duyệt, chưa tải lên), bước 2 (chọn cách chuyển), gửi file lên
// để máy chủ đọc lại, lưu hình và dựng dàn ý, bước 3 (đối chiếu slide gốc với dàn ý mới), rồi sang trang dàn ý.
// Bản mẫu: docs/mockup/nhap-powerpoint.html.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DURATIONS, slideRange, type Outline } from "@/lib/limioLiveOutline";
import type { PptxDeck } from "@/lib/pptxImport";
import { appendBack, estimateRestructureTokens, importSourceText, toImportedSlide, type ImportReport } from "@/lib/limioLivePptx";
import { takeHandedOffPptx } from "@/lib/limioLiveCreateSource";
import CompareView from "./CompareView";

const MAX_MB = 50;

const ERROR_TEXT: Record<string, string> = {
  legacy_ppt:
    "File .ppt là định dạng PowerPoint đời cũ. Hãy mở file bằng PowerPoint, chọn Lưu thành (Save As), chọn định dạng .pptx rồi tải file mới lên.",
  encrypted_pptx: "File có đặt mật khẩu nên không đọc được. Hãy mở bằng PowerPoint, bỏ mật khẩu, lưu lại thành .pptx rồi tải lên.",
  not_pptx: "Không đọc được file này như một bài trình chiếu PowerPoint. File có thể bị hỏng; hãy mở bằng PowerPoint và lưu lại.",
  no_slides: "File không có slide nào.",
  file_too_large: `File lớn hơn ${MAX_MB} MB. Trong PowerPoint, dùng chức năng Nén ảnh (Compress Pictures) rồi lưu lại.`,
  unsupported_file_type: "Chỉ nhận file PowerPoint dạng .pptx.",
  import_failed: "Không tạo được bài giảng. Vui lòng thử lại.",
  deck_has_slides: "Bài giảng này đã có slide nên không đổi cách chuyển được nữa. Hãy sửa trong trang dàn ý.",
  validation_failed: "Bài trình chiếu quá ít chữ để AI soạn lại mạch. Hãy dùng cách \u201cGiữ ý, làm đẹp lại\u201d.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Hãy dùng cách \u201cGiữ ý, làm đẹp lại\u201d hoặc báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau, hoặc dùng cách \u201cGiữ ý, làm đẹp lại\u201d.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Cách \u201cGiữ ý, làm đẹp lại\u201d vẫn nhập được, chỉ chưa có slide tương tác do AI viết thêm.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này. Cách \u201cGiữ ý, làm đẹp lại\u201d vẫn nhập được, chỉ chưa có slide tương tác do AI viết thêm.",
  empty_outline: "AI chưa soạn được dàn ý. Hãy thử lại.",
  openai_error: "AI đang bận hoặc gặp lỗi. Vui lòng thử lại sau ít phút.",
  json_parse_failed: "AI trả lời chưa đúng định dạng. Vui lòng thử lại.",
};

type Step = 1 | 2 | 3;
type Mode = "keep" | "restructure";

interface Read {
  file: File;
  deck: PptxDeck;
  report: ImportReport;
  /** Ảnh xem nhanh (hình lớn nhất) theo số slide. */
  thumbs: Record<number, string>;
}

type Ev = { type: string; deckId?: string; error?: string; done?: number; total?: number; images?: number | Record<number, string>; outline?: Outline; warnings?: string[] };

/** Đọc luồng NDJSON (ping … done | error) của các route nhập. */
async function readEvents(res: Response, on: (ev: Ev) => void): Promise<void> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) on(JSON.parse(line) as Ev);
    }
  }
}

const mb = (n: number) => (n / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

export default function PptxImportFlow() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [minutes, setMinutes] = useState<number>(30);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("keep");
  const [intent, setIntent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Bài nháp tạo ở lần gửi đầu; đổi cách chuyển sau đó dựng lại dàn ý trên chính bài này (không tải file lên lại).
  const [deckId, setDeckId] = useState<string | null>(null);
  const [images, setImages] = useState<Record<number, string>>({});
  // Dàn ý đã dựng theo từng cách và thời lượng: đổi qua lại không gọi AI lần nữa.
  const [cache, setCache] = useState<Record<string, { outline: Outline; warnings: string[] }>>({});
  const [current, setCurrent] = useState<{ mode: Mode; outline: Outline; warnings: string[] } | null>(null);

  // Giải phóng ảnh xem nhanh khi đổi file hoặc rời trang.
  useEffect(() => () => Object.values(read?.thumbs ?? {}).forEach((u) => URL.revokeObjectURL(u)), [read]);

  const srcSlides = useMemo(() => (read ? read.deck.slides.map((s) => toImportedSlide(s, images[s.n] ?? null)) : []), [read, images]);
  const sourceChars = useMemo(() => (srcSlides.length ? importSourceText({ slides: srcSlides }).length : 0), [srcSlides]);

  const pick = async (file: File | null | undefined) => {
    setError(null);
    if (!file) return;
    if (/\.ppt$/i.test(file.name)) return setError(ERROR_TEXT.legacy_ppt!);
    if (!/\.pptx$/i.test(file.name)) return setError(ERROR_TEXT.unsupported_file_type!);
    if (file.size > MAX_MB * 1024 * 1024) return setError(ERROR_TEXT.file_too_large!);
    setReading(true);
    try {
      // Đọc ngay trên trình duyệt: chưa tải file lên, chưa tốn dung lượng (tiêu chí P12).
      const [{ parsePptx, pptxErrorCode, suggestMinutes }, { importReport }] = await Promise.all([
        import("@/lib/pptxImport"),
        import("@/lib/limioLivePptx"),
      ]);
      let parsed;
      try {
        parsed = await parsePptx(await file.arrayBuffer());
      } catch (e) {
        setError(ERROR_TEXT[pptxErrorCode(e, file.name)] ?? ERROR_TEXT.not_pptx!);
        return;
      }
      const thumbs: Record<number, string> = {};
      for (const s of parsed.deck.slides.slice(0, 80)) {
        const im = s.images[0];
        if (!im) continue;
        const bytes = await parsed.media(im.target);
        if (bytes) thumbs[s.n] = URL.createObjectURL(new Blob([bytes as BlobPart], { type: im.ext === "jpg" ? "image/jpeg" : `image/${im.ext}` }));
      }
      const m = suggestMinutes(parsed.deck.slides.length);
      setMinutes(m);
      setSuggested(m);
      setRead({ file, deck: parsed.deck, report: importReport(parsed.deck), thumbs });
      // File mới: bài nháp và các dàn ý cũ không còn đúng.
      setDeckId(null);
      setImages({});
      setCache({});
      setCurrent(null);
    } finally {
      setReading(false);
    }
  };

  // Tệp đính kèm ở trang Tạo bài giảng: đọc ngay, không bắt chọn lại; mô tả của giảng viên đi cùng lên máy chủ
  // (docs/tieu-chi/tao-bai-giang-mot-o.md, M7).
  useEffect(() => {
    const h = takeHandedOffPptx();
    if (h) {
      setIntent(h.intent);
      void pick(h.file);
    }
    // Chỉ chạy một lần khi mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Dàn ý theo cách `m`: lần đầu tải file lên và tạo bài; sau đó dựng lại trên bài đã tạo, hoặc lấy bản đã dựng. */
  const showOutline = async (m: Mode) => {
    if (!read) return;
    setError(null);
    setMode(m);
    const key = `${m}:${minutes}`;
    const aiText = "AI đang đọc cả bài và soạn lại mạch, thường mất từ 20 đến 60 giây.";
    try {
      if (!deckId) {
        setBusy("Đang tải file lên và đọc lại...");
        const fd = new FormData();
        fd.set("file", read.file);
        fd.set("minutes", String(minutes));
        fd.set("mode", m);
        if (intent) fd.set("intent", intent);
        const res = await fetch(apiUrl("/api/instructor/limio-live/import-pptx"), { method: "POST", body: fd });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          return setError(ERROR_TEXT[j?.error ?? ""] ?? ERROR_TEXT.import_failed!);
        }
        let got: Ev | null = null;
        let failed: string | null = null;
        await readEvents(res, (ev) => {
          if (ev.type === "start" && typeof ev.images === "number" && ev.images > 0) setBusy(`Đang lưu hình 0/${ev.images}...`);
          else if (ev.type === "progress") setBusy(`Đang lưu hình ${ev.done}/${ev.total}...`);
          else if (ev.type === "ai") setBusy(aiText);
          else if (ev.type === "done") got = ev;
          else if (ev.type === "error") failed = ev.error ?? "import_failed";
        });
        const done = got as Ev | null;
        if (!done?.deckId || !done.outline) return setError(ERROR_TEXT[failed ?? ""] ?? ERROR_TEXT.import_failed!);
        setDeckId(done.deckId);
        setImages((done.images as Record<number, string>) ?? {});
        const entry = { outline: done.outline, warnings: done.warnings ?? [] };
        setCache((c) => ({ ...c, [key]: entry }));
        setCurrent({ mode: m, ...entry });
        setStep(3);
        return;
      }
      const cached = cache[key];
      if (cached) {
        setBusy("Đang lưu dàn ý...");
        const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/outline`), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outline: cached.outline, minutes }),
        });
        if (!res.ok) return setError(ERROR_TEXT.import_failed!);
        setCurrent({ mode: m, ...cached });
        setStep(3);
        return;
      }
      setBusy(m === "restructure" ? aiText : "Đang dựng dàn ý...");
      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/import-mode`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: m, minutes }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        return setError(ERROR_TEXT[j?.error ?? ""] ?? ERROR_TEXT.import_failed!);
      }
      let got: Ev | null = null;
      let failed: string | null = null;
      await readEvents(res, (ev) => {
        if (ev.type === "done") got = ev;
        else if (ev.type === "error") failed = ev.error ?? "import_failed";
      });
      const done = got as Ev | null;
      if (!done?.outline) return setError(ERROR_TEXT[failed ?? ""] ?? ERROR_TEXT.import_failed!);
      const entry = { outline: done.outline, warnings: done.warnings ?? [] };
      setCache((c) => ({ ...c, [key]: entry }));
      setCurrent({ mode: m, ...entry });
      setStep(3);
    } catch {
      setError("Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(null);
    }
  };

  /** "Thêm lại vào dàn ý" (P30): lưu ngay dàn ý mới của bài. */
  const addBack = async (n: number) => {
    if (!current || !deckId) return;
    const outline = appendBack(current.outline, { slides: srcSlides }, n);
    setBusy("Đang lưu dàn ý...");
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/outline`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outline, minutes }),
      });
      if (!res.ok) return setError(ERROR_TEXT.import_failed!);
      const entry = { outline, warnings: current.warnings };
      setCache((c) => ({ ...c, [`${current.mode}:${minutes}`]: entry }));
      setCurrent({ mode: current.mode, ...entry });
    } catch {
      setError("Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(null);
    }
  };

  const r = read?.report;
  const steps: Array<[Step | 4, string]> = [
    [1, "Tải file"],
    [2, "Chọn cách chuyển"],
    [3, "Đối chiếu"],
    [4, "Sửa dàn ý và tạo slide"],
  ];
  const tokens = r ? estimateRestructureTokens(sourceChars, slideRange(minutes).max) : 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-24">
      <div>
        <a href="/instructor/limio-live/from-document" className="text-sm text-muted hover:underline">
          Tạo slide
        </a>
        <h1 className="mt-1 text-2xl font-bold">Tạo slide từ PowerPoint</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Limio đọc từng slide của file, giữ chữ, hình và ghi chú giảng, rồi dựng lại bài theo giao diện Limio. Thiết kế gốc
          (màu, phông, hiệu ứng) không được sao chép.
        </p>
        <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Các bước">
          {steps.map(([n, label]) => {
            const current_ = n === step;
            const done = n < step;
            const enabled = n === 1 || (n === 2 && !!read) || (n === 3 && !!current) || (n === 4 && !!deckId);
            return (
              <li key={n}>
                <button
                  type="button"
                  disabled={!enabled || !!busy}
                  aria-current={current_ ? "step" : undefined}
                  onClick={() => (n === 4 ? router.push(`/instructor/limio-live/${deckId}/outline`) : setStep(n))}
                  className={`inline-flex items-center gap-2 font-medium ${current_ ? "font-bold text-[rgb(var(--text))]" : "text-muted"}`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full border-2 text-xs font-bold ${
                      current_ ? "border-brand-600 bg-brand-600 text-white" : done ? "border-brand-600 text-brand-700" : "border-token"
                    }`}
                  >
                    {n}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {step === 1 && (
        <section className="space-y-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-5" aria-labelledby="s1-h">
          <div>
            <h2 id="s1-h" className="text-lg font-semibold">
              1. Tải file PowerPoint
            </h2>
            <p className="text-sm text-muted">
              Nhận file .pptx. File .ppt đời cũ cần mở bằng PowerPoint rồi lưu lại thành .pptx. Bài trên Google Slides hoặc
              Keynote: tải xuống dạng PowerPoint (.pptx) rồi tải lên đây.
            </p>
          </div>

          {!read ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void pick(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center ${drag ? "border-brand-500 bg-brand-50" : "border-token bg-[rgb(var(--surface-muted))]"}`}
            >
              {reading ? <Loader2 size={36} className="animate-spin text-brand-700" /> : <UploadCloud size={36} className="text-brand-700" />}
              <p className="font-semibold">{reading ? "Đang đọc file..." : "Kéo file .pptx vào đây"}</p>
              {!reading && (
                <>
                  <span className="text-sm text-muted">hoặc</span>
                  <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                    Chọn file
                  </button>
                </>
              )}
              <p className="text-sm text-muted">Tối đa {MAX_MB} MB. Hình trong file được tính vào dung lượng lưu trữ của thầy/cô.</p>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-token px-4 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-700 text-[13px] font-extrabold text-white">PPT</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{read.file.name}</span>
                  <span className="text-sm text-muted">{mb(read.file.size)} MB · đã đọc xong</span>
                </span>
                <button type="button" className="btn-secondary ml-auto" onClick={() => setRead(null)}>
                  Chọn file khác
                </button>
              </div>

              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                <Fact n={r!.slides} label="slide" />
                <Fact n={r!.withNotes} label="slide có ghi chú giảng, giữ nguyên chữ" />
                <Fact n={r!.images} label={r!.droppedLogos ? "hình được giữ (đã bỏ logo lặp ở các slide)" : "hình được giữ"} />
                <Fact
                  n={r!.tables + r!.charts}
                  label={`bảng và biểu đồ (${r!.tables} bảng, ${r!.charts} biểu đồ${r!.fromExcel ? `; ${r!.fromExcel} đọc số từ bảng Excel nhúng trong file` : ""})`}
                />
              </div>

              {r!.warnings.length > 0 && (
                <div className="banner-warning text-sm">
                  <div>
                    <b>Một số phần chỉ lấy được chữ hoặc chưa chuyển được:</b>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {r!.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-sm text-muted">Các slide đã đọc (kéo ngang để xem hết)</p>
                <div className="flex snap-x gap-2.5 overflow-x-auto pb-2">
                  {read.deck.slides.map((s) => (
                    <div key={s.n} className="w-[150px] flex-none snap-start">
                      <div className="flex aspect-video flex-col gap-1 overflow-hidden rounded-lg border border-token bg-[#fbfaf6] p-2 text-[10px] leading-tight text-[#2b2f28]">
                        <b className="line-clamp-2 text-[10.5px]">{s.title || `Slide ${s.n}`}</b>
                        {read.thumbs[s.n] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={read.thumbs[s.n]} alt="" className="min-h-0 flex-1 object-contain" />
                        ) : (
                          [...s.paragraphs, ...s.smartArt, ...s.tables.flatMap((t) => t.map((r) => ({ text: r.join(" · ") })))].slice(0, 3).map((p, i) => (
                            <span key={i} className="truncate text-[9px] text-[#5d6355]">
                              {p.text}
                            </span>
                          ))
                        )}
                      </div>
                      <small className="mt-1 block truncate text-xs text-muted">
                        {s.n}. {s.title || "(không có tiêu đề)"}
                        {s.hidden ? " · ẩn" : ""}
                      </small>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <b className="text-sm">Thời lượng buổi giảng</b>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Thời lượng buổi giảng">
                  {DURATIONS.map((d) => (
                    <label
                      key={d.minutes}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${minutes === d.minutes ? "border-brand-500 bg-brand-50 font-semibold" : "border-token"}`}
                    >
                      <input type="radio" name="minutes" checked={minutes === d.minutes} onChange={() => setMinutes(d.minutes)} />
                      {d.minutes} phút ({d.min}–{d.max} slide)
                    </label>
                  ))}
                </div>
                {suggested && (
                  <p className="mt-1.5 text-sm text-muted">
                    Hệ thống gợi ý {suggested} phút vì file có {r!.slides} slide.
                    {r!.slides > 25 ? " Cách giữ ý vẫn giữ đủ mọi slide; cách soạn lại mạch sẽ rút gọn theo thời lượng." : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="banner-danger text-sm font-medium">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={!read} onClick={() => setStep(2)}>
              Tiếp: chọn cách chuyển <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        </section>
      )}

      {step === 2 && read && (
        <section className="space-y-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-5" aria-labelledby="s2-h">
          <div>
            <h2 id="s2-h" className="text-lg font-semibold">
              2. Chọn cách chuyển bài giảng
            </h2>
            <p className="text-sm text-muted">
              Chọn một lần cho cả bài. Bước sau vẫn sửa được từng slide trong dàn ý, và có thể quay lại đây để đổi cách.
            </p>
          </div>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <ModeCard
              active={mode === "keep"}
              onClick={() => setMode("keep")}
              badge="Mặc định"
              title="Giữ ý, làm đẹp lại"
              points={[
                "Mỗi slide gốc thành một slide Limio, giữ nguyên thứ tự. Slide quá nhiều chữ được chia thành slide tiếp theo, không bỏ chữ nào.",
                "Chữ, hình và ghi chú giảng giữ nguyên; hệ thống chỉ chọn bố cục phù hợp cho từng slide.",
                "Hợp khi bài đã có mạch tốt và chỉ cần giao diện mới, chữ lớn hơn, dễ đọc hơn trên máy chiếu.",
              ]}
              cost="Giữ nguyên slide gốc; AI chỉ viết thêm các slide tương tác (tốn ít lượt). Slide nào chưa có ghi chú giảng thì để trống; thầy/cô có thể nhờ AI viết sau."
            />
            <ModeCard
              active={mode === "restructure"}
              onClick={() => setMode("restructure")}
              title="Soạn lại mạch"
              points={[
                "AI đọc cả bài và đề xuất dàn ý theo mạch: Mục tiêu, Hook, các phần có bìa phần, Tổng kết.",
                "Được gộp các slide nói cùng một ý, tách slide quá dài, thêm slide tương tác (trắc nghiệm, bình chọn, đám mây từ).",
                "Ghi chú giảng gốc vẫn giữ nguyên chữ; mỗi slide mới ghi rõ lấy từ slide gốc nào.",
              ]}
              cost={`Dùng AI để đề xuất dàn ý và viết các slide mới, khoảng ${Math.max(1, Math.round(tokens / 1000)).toLocaleString("vi-VN")} nghìn token với file ${r!.slides} slide.`}
            />
          </div>
          {error && (
            <p role="alert" className="banner-danger text-sm font-medium">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {busy && (
              <p className="mr-auto flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" />
                {busy} Vui lòng không đóng trang.
              </p>
            )}
            <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => setStep(1)}>
              Quay lại
            </button>
            <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={!!busy} onClick={() => void showOutline(mode)}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "restructure" ? <Sparkles size={16} aria-hidden /> : null}
              Tiếp: xem đối chiếu {!busy && <ArrowRight size={16} aria-hidden />}
            </button>
          </div>
        </section>
      )}

      {step === 3 && read && current && (
        <section className="space-y-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-5" aria-labelledby="s3-h">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 id="s3-h" className="text-lg font-semibold">
              3. Đối chiếu slide gốc với dàn ý mới
            </h2>
            <span className="inline-flex overflow-hidden rounded-lg border border-token text-sm" role="group" aria-label="Cách chuyển">
              {(["keep", "restructure"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={current.mode === m}
                  disabled={!!busy}
                  onClick={() => current.mode !== m && void showOutline(m)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${current.mode === m ? "bg-brand-50 font-bold" : ""} ${m === "restructure" ? "border-l border-token" : ""}`}
                >
                  {m === "restructure" && !cache[`restructure:${minutes}`] && <Sparkles size={14} aria-hidden />}
                  {m === "keep" ? "Giữ ý, làm đẹp lại" : "Soạn lại mạch"}
                </button>
              ))}
            </span>
          </div>
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" />
              {busy}
            </p>
          )}
          {error && (
            <p role="alert" className="banner-danger text-sm font-medium">
              {error}
            </p>
          )}
          {current.warnings.length > 0 && (
            <ul className="banner-info list-disc space-y-0.5 pl-8 text-sm">
              {current.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <CompareView slides={srcSlides} outline={current.outline} mode={current.mode} onAddBack={(n) => void addBack(n)} busy={!!busy} />
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => setStep(2)}>
              Đổi cách chuyển
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              disabled={!!busy}
              onClick={() => router.push(`/instructor/limio-live/${deckId}/outline`)}
            >
              Tiếp: sửa dàn ý và tạo slide <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Fact({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl border border-token px-3 py-2.5">
      <b className="block text-2xl leading-tight tabular-nums">{n}</b>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

function ModeCard(props: { active: boolean; disabled?: boolean; onClick: () => void; badge?: string; title: string; points: string[]; cost: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`grid gap-2.5 rounded-2xl border-2 p-4 text-left transition ${
        props.active ? "border-brand-500 bg-brand-50" : "border-token bg-[rgb(var(--surface))] hover:border-brand-500"
      } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-token`}
    >
      <span className={`text-[13px] font-bold text-brand-700 ${props.badge ? "" : "invisible"}`}>{props.badge ?? "."}</span>
      <h3 className="text-[17px] font-bold">{props.title}</h3>
      <ul className="grid list-disc gap-1 pl-[18px] text-sm text-muted">
        {props.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <span className="border-t border-token pt-2 text-[13px] text-muted">{props.cost}</span>
    </button>
  );
}
