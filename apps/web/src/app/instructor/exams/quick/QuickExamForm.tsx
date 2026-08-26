"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, QrCode } from "lucide-react";
import dynamic from "next/dynamic";
import { apiUrl, shareUrl } from "@/lib/apiUrl";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-lg border border-emerald-300 bg-white"
        style={{ width: 180, height: 180 }}
      />
    ),
  },
);

type RevealPolicy = "immediately" | "never" | "after_close";

interface Paper {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  questionCount: number;
}

/** datetime-local cần giờ ĐỊA PHƯƠNG, không phải ISO UTC. */
function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * Mở buổi thi từ một gói đề có sẵn.
 *
 * Chỉ hỏi hai thứ ở mức cơ bản: dùng gói nào, mỗi học sinh bao nhiêu phút.
 * Giờ mở/đóng nằm sau "Tuỳ chọn nâng cao" vì phần lớn buổi kiểm tra trên lớp
 * không cần — mở ngay, đóng khi giáo viên bấm.
 */
export default function QuickExamForm({
  purpose,
  courses,
  papers,
}: {
  purpose: "assessment" | "field_test";
  courses: Array<{ id: string; title: string }>;
  papers: Paper[];
}) {
  const [paperId, setPaperId] = useState(papers[0]?.id ?? "");
  const paper = useMemo(
    () => papers.find((p) => p.id === paperId) ?? null,
    [papers, paperId],
  );

  // 15 phút cố định, KHÔNG lấy theo durationMin của gói đề.
  //
  // Thời lượng thuộc buổi thi chứ không thuộc gói đề (xem quick-share.ts) —
  // cùng một gói chạy 15 phút ở lớp này, 30 phút ở lớp kia. Lấy theo gói đề
  // thì con số nhảy mỗi lần đổi gói, và nhảy về một giá trị đặt từ hồi soạn
  // đề, chẳng liên quan buổi đang mở. 15 phút hợp với thứ màn này phục vụ:
  // khảo sát, điểm danh, kiểm tra nhanh tại lớp.
  const [durationMin, setDurationMin] = useState(15);
  // Mặc định khác nhau theo mục đích, vì rủi ro khác nhau: đề thử nghiệm mà
  // lộ đáp án là đốt câu hỏi, không dùng lại được cho đợt sau.
  const [reveal, setReveal] = useState<RevealPolicy>(
    purpose === "field_test" ? "never" : "immediately",
  );
  const [advanced, setAdvanced] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleClose, setScheduleClose] = useState(false);
  const [opensAt, setOpensAt] = useState(() => toLocalInput(new Date()));
  const [closesAt, setClosesAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 60 * 60_000)),
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    code: string;
    path: string;
    sessionId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Đổi gói đề KHÔNG đụng tới thời lượng đã gõ — thời lượng là lựa chọn cho
  // buổi thi, người dùng vừa đặt nó thì đừng giật lại.
  const onPickPaper = (id: string) => setPaperId(id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paper) return;
    setBusy(true);
    setErr(null);
    try {
      // Bật bất kỳ mốc giờ nào là chuyển sang chế độ hẹn giờ; không bật thì ca
      // chạy thủ công — mở ngay, đóng khi bấm.
      const scheduled = scheduleOpen || scheduleClose;
      const res = await fetch(apiUrl(`/api/exams/${paper.id}/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timingMode: scheduled ? "scheduled" : "manual",
          durationMin,
          revealAnswers: reveal,
          // Mục đích thuộc BUỔI THI: cùng một gói đề, mở từ trang thử nghiệm
          // thì buổi đó là đợt thử; mở từ link nhanh thì là bài thi thật.
          purpose,
          ...(scheduleOpen ? { opensAt: new Date(opensAt).toISOString() } : {}),
          ...(scheduleClose ? { closesAt: new Date(closesAt).toISOString() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        path?: string;
        sessionId?: string;
        error?: string;
        details?: { message?: string };
      };
      if (!res.ok || !data.code) {
        setErr(data.details?.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult({
        code: data.code,
        path: data.path!,
        sessionId: data.sessionId!,
      });
    } finally {
      setBusy(false);
    }
  };

  if (papers.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-default bg-white p-5">
        <p className="text-sm">
          Chưa có gói đề nào có câu hỏi.
        </p>
        <p className="mt-1 text-caption text-faint">
          Gói đề là phần nội dung — soạn ở mục Đề thi, rồi quay lại đây để mở
          buổi thi.
        </p>
        <Link
          href={`/instructor/courses/${courses[0]!.id}/exams/new`}
          className="mt-3 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + Soạn gói đề mới
        </Link>
      </div>
    );
  }

  if (result) {
    // shareUrl, KHÔNG ghép tay với window.location.origin: production chạy
    // dưới một tiền tố đường dẫn nên ghép tay ra link thiếu tiền tố → 404.
    const fullUrl = shareUrl(result.path);
    return (
      <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-5">
        <p className="text-sm font-medium text-emerald-900">Đã mở buổi thi.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tracking-widest text-emerald-900">
            {result.code}
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* trình duyệt chặn clipboard — link vẫn hiện để chọn tay */
              }
            }}
            className="rounded border border-emerald-300 p-1.5 text-emerald-800 hover:bg-emerald-100"
            aria-label="Sao chép link"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className={`rounded border border-emerald-300 p-1.5 text-emerald-800 hover:bg-emerald-100 ${
              showQr ? "bg-emerald-100" : ""
            }`}
            aria-label={showQr ? "Ẩn mã QR" : "Hiện mã QR"}
          >
            <QrCode className="h-4 w-4" />
          </button>
        </div>

        {showQr && (
          <div className="mt-3 flex flex-col items-start gap-2">
            {/* Nền trắng + viền quiet zone: QR trên nền màu hoặc sát mép thì
                máy quét hay không bắt được. */}
            <div className="rounded-lg border border-emerald-300 bg-white p-3">
              <QRCode value={fullUrl} size={180} level="M" />
            </div>
            <p className="text-caption text-emerald-800">
              Chiếu lên màn hình để cả lớp quét. Ai không quét được thì gõ mã{" "}
              <span className="font-mono font-semibold">{result.code}</span>.
            </p>
          </div>
        )}
        <p className="mt-2 break-all text-caption text-emerald-800">{fullUrl}</p>
        {/* Không nút nào nổi bật ở đây. Vừa mở xong thì việc của giáo viên là
            phát link/QR ở trên — đã xong. "Xem kết quả" từng là nút chính màu
            xanh đậm, mà lúc đó chưa ai vào thi nên nó mời người ta đi tới một
            trang trống. Cả hai nay là liên kết chữ, để lúc nào cần thì có. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/instructor/organize"
            className="text-sm text-emerald-900 underline underline-offset-2"
          >
            Mở buổi khác
          </Link>
          <Link
            // Trang gói đề KHÔNG có tab "Kết quả" (bỏ có chủ ý — kết quả nói
            // về ai đã làm, mà "ai" thuộc buổi thi chứ không thuộc gói đề).
            // Link cũ trỏ ?tab=results, parseExamTab không nhận ra nên rơi về
            // tab Tổng quan — bấm "Xem kết quả" lại về màn soạn đề.
            href={`/instructor/exam-runs/${result.sessionId}`}
            className="text-sm text-emerald-800 underline underline-offset-2"
          >
            Xem kết quả
          </Link>
          <span className="text-caption text-emerald-800">
            Kết quả hiện dần khi học sinh nộp.
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="block text-sm font-medium">Gói đề</span>
        <select
          value={paperId}
          onChange={(e) => onPickPaper(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        >
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {p.questionCount} câu
              {courses.length > 1 ? ` · ${p.courseTitle}` : ""}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-caption text-faint">
          Chỉ là phần nội dung. Cùng một gói mở được nhiều buổi thi khác nhau.
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-medium">Thời lượng làm bài (phút)</span>
        <input
          type="number"
          required
          min={1}
          max={1440}
          value={durationMin}
          onChange={(e) => setDurationMin(Number(e.target.value))}
          className="mt-1 w-32 rounded border border-default bg-white px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-caption text-faint">
          Đếm từ lúc từng học sinh bấm bắt đầu, không phải giờ đồng hồ.
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-medium">Hiện đáp án và kết quả</span>
        <select
          value={reveal}
          onChange={(e) => setReveal(e.target.value as RevealPolicy)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        >
          <option value="immediately">Hiện ngay sau khi nộp</option>
          <option value="after_close">Hiện sau khi đóng buổi thi</option>
          <option value="never">Không hiện</option>
        </select>
        <span className="mt-1 block text-caption text-faint">
          {reveal === "immediately"
            ? "Học sinh xem được điểm từng câu và đáp án đúng ngay khi nộp."
            : reveal === "after_close"
              ? "Học sinh chỉ xem được sau khi bạn đóng buổi thi — cả lớp nộp xong mới lộ đề."
              : "Học sinh chỉ thấy đã nộp, không thấy điểm chi tiết hay đáp án."}
        </span>
        {purpose === "field_test" && reveal !== "never" && (
          <span className="banner-warning mt-2 block px-3 py-2 text-caption">
            Đề thử nghiệm mà lộ đáp án là đốt câu hỏi — đợt sau không dùng lại
            được nữa.
          </span>
        )}
      </label>

      {/* Chỉ là một liên kết, không phải ô nhập.
          Trước đây nó là hộp có viền trắng full-width, trông y hệt ba ô nhập
          phía trên — mắt đọc thành "ô thứ tư" rồi khựng lại vì không nhập
          được gì. Phần lớn buổi kiểm tra tại lớp không cần hẹn giờ, nên thứ
          này phải lùi hẳn ra sau, không tranh chỗ với thứ người ta thật sự
          phải điền. */}
      <div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="text-sm text-blue-700 underline underline-offset-2 hover:text-blue-800"
          aria-expanded={advanced}
        >
          {advanced ? "Ẩn tuỳ chọn nâng cao" : "Tuỳ chọn nâng cao — giờ mở/đóng"}
        </button>

        {advanced && (
          <div className="mt-3 space-y-3 border-l-2 border-default pl-3">
            <TimeRow
              label="Hẹn giờ mở"
              hintOff="Bài mở ngay, không chờ giờ."
              hintOn="Bài chỉ mở từ thời điểm này."
              on={scheduleOpen}
              setOn={setScheduleOpen}
              value={opensAt}
              setValue={setOpensAt}
            />
            <TimeRow
              label="Hẹn giờ đóng"
              hintOff="Bài mở tới khi bạn bấm đóng."
              hintOn="Bài tự đóng vào thời điểm này."
              on={scheduleClose}
              setOn={setScheduleClose}
              value={closesAt}
              setValue={setClosesAt}
            />
            <p className="text-caption text-faint">
              {scheduleOpen || scheduleClose
                ? "Buổi thi chạy theo giờ đã đặt."
                : "Buổi thi mở ngay và chỉ đóng khi bạn bấm — hợp với kiểm tra tại lớp."}
            </p>
          </div>
        )}
      </div>

      {err && <div className="banner-danger px-3 py-2 text-sm">{err}</div>}

      <button
        type="submit"
        disabled={busy || !paper}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Đang mở…" : "Mở"}
      </button>
    </form>
  );
}

/**
 * Một dòng hẹn giờ.
 *
 * Ghi chú mô tả ĐIỀU ĐANG XẢY RA theo trạng thái công tắc, không phải "tắt =
 * ...". Kiểu cũ bắt người đọc suy ngược từ trạng thái họ không chọn, và câu
 * "Tắt = mở ngay" đọc nhanh thành tự mâu thuẫn.
 */
function TimeRow({
  label,
  hintOn,
  hintOff,
  on,
  setOn,
  value,
  setValue,
}: {
  label: string;
  hintOn: string;
  hintOff: string;
  on: boolean;
  setOn: (v: boolean) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {/* Công tắc kèm chữ Bật/Tắt ngay bên cạnh, theo mẫu Teams. Chỉ nhìn
            màu và vị trí núm thì phải biết trước quy ước mới đọc được trạng
            thái; có chữ thì đọc thẳng. Chữ cũng là vùng bấm luôn — đích bấm
            rộng gấp đôi, và người dùng hay bấm vào nhãn thay vì cái núm. */}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={() => setOn(!on)}
          className="flex shrink-0 items-center gap-2"
        >
          <span
            className={`relative block h-5 w-9 rounded-full transition-colors ${
              on ? "bg-emerald-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                on ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
          {/* w-7 cố định: "Bật" và "Tắt" khác độ rộng, để tự co thì cả hàng
              nhích mỗi lần bấm. */}
          <span
            aria-hidden="true"
            className={`w-7 text-sm ${on ? "font-medium text-ink" : "text-faint"}`}
          >
            {on ? "Bật" : "Tắt"}
          </span>
        </button>
      </div>
      {on && (
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        />
      )}
      <span className="mt-1 block text-caption text-faint">
        {on ? hintOn : hintOff}
      </span>
    </div>
  );
}
