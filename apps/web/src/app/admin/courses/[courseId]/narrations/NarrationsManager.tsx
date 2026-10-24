"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

type State = "script" | "generating" | "ready" | "stale" | "failed";

interface Row {
  id: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  kind: "lecture" | "podcast";
  state: State;
  progress: number;
  error: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  generatedAt: string | null;
  chars: number;
}

interface ListResponse {
  course: { id: string; title: string; slug: string };
  rows: Row[];
  fakeTts: boolean;
}

interface VoicesResponse {
  ok: boolean;
  mode?: "neu" | "fake" | "none";
  voices?: Array<{ voice: string; language: string }>;
  default?: string | null;
}

interface Voices {
  lecturer: string;
  A: string;
  B: string;
}

const KIND_LABEL: Record<Row["kind"], string> = { lecture: "Nghe giảng", podcast: "Podcast" };
const STATE_LABEL: Record<State, string> = {
  script: "Chưa có giọng",
  generating: "Đang tạo",
  ready: "Sẵn sàng",
  stale: "Giọng đã cũ",
  failed: "Lỗi",
};
const STATE_CHIP: Record<State, string> = {
  script: "chip",
  generating: "chip-brand",
  ready: "chip-success",
  stale: "chip-warning",
  failed: "chip-danger",
};
const STORAGE_KEY = "limio.narration.voices";
const POLL_MS = 3_000;

const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const fmtSize = (bytes: number) => `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;

function loadVoices(): Partial<Voices> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Voices>;
  } catch {
    return {};
  }
}

export default function NarrationsManager({ courseId }: { courseId: string }) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [voiceList, setVoiceList] = useState<VoicesResponse | null>(null);
  const [voices, setVoices] = useState<Voices>({ lecturer: "", A: "", B: "" });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/admin/courses/${courseId}/narrations`), { cache: "no-store" });
    if (r.ok) setData((await r.json()) as ListResponse);
  }, [courseId]);

  // Tải danh sách giọng một lần; dùng lại lựa chọn lần trước nếu giọng đó còn trong danh sách.
  useEffect(() => {
    void (async () => {
      const r = await fetch(apiUrl("/api/admin/narration/voices"), { cache: "no-store" });
      const j = (await r.json().catch(() => ({ ok: false }))) as VoicesResponse;
      setVoiceList(j);
      const names = new Set((j.voices ?? []).map((v) => v.voice));
      const saved = loadVoices();
      const first = j.default && names.has(j.default) ? j.default : (j.voices?.[0]?.voice ?? "");
      const pick = (v: string | undefined) => (v && names.has(v) ? v : first);
      setVoices({ lecturer: pick(saved.lecturer), A: pick(saved.A), B: pick(saved.B) });
    })();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Hỏi lại mỗi vài giây khi còn dòng đang tạo.
  const anyGenerating = data?.rows.some((r) => r.state === "generating") ?? false;
  useEffect(() => {
    if (!anyGenerating) return;
    timer.current = setTimeout(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anyGenerating, data, refresh]);

  const setVoice = (role: keyof Voices, value: string) => {
    const next = { ...voices, [role]: value };
    setVoices(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Không lưu được lựa chọn cũng không sao.
    }
  };

  const pending = useMemo(() => (data?.rows ?? []).filter((r) => r.state === "script" || r.state === "stale" || r.state === "failed"), [data]);
  const voicesReady = voices.lecturer && voices.A && voices.B;

  async function generate(ids?: string[]) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(apiUrl(`/api/admin/courses/${courseId}/narrations/generate`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voices, ...(ids ? { ids } : {}) }),
      });
      const j = (await r.json().catch(() => ({}))) as { queued?: number; alreadyRunning?: number; error?: string; lessonTitle?: string };
      if (r.status === 409) setMessage({ tone: "error", text: "Dòng này đang được tạo giọng. Đợi xong rồi bấm lại nếu cần." });
      else if (!r.ok) setMessage({ tone: "error", text: j.error === "voice_required" ? "Chọn giọng cho đủ ba vai rồi bấm lại." : "Không bắt đầu được việc tạo giọng. Thử lại sau." });
      else setMessage({ tone: "ok", text: `Đã xếp ${j.queued ?? 0} việc tạo giọng, chạy lần lượt. Bạn có thể rời trang; kết quả hiện ở đây.` });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data || !voiceList) return <p className="text-sm text-muted">Đang tải…</p>;

  const sameHost = voices.A !== "" && voices.A === voices.B;

  return (
    <div className="space-y-5">
      {data.fakeTts && (
        <div className="banner-info">
          <p>
            Máy này đang dùng <strong>bộ đọc giả</strong> (tiếng bíp có độ dài theo lời) để thử luồng. Giọng thật chỉ có khi cấu
            hình NEU TTS ở Quản trị › Tích hợp.
          </p>
        </div>
      )}
      {voiceList.mode === "none" && (
        <div className="banner-danger">
          <p>
            Chưa cấu hình NEU TTS nên chưa tạo được giọng. Vào{" "}
            <Link href="/admin/integrations" className="link font-medium">
              Quản trị › Tích hợp
            </Link>{" "}
            để nhập địa chỉ cổng và khoá.
          </p>
        </div>
      )}

      <section className="card">
        <h2 className="text-h3">Chọn giọng</h2>
        <p className="mt-1 text-sm text-muted">Nghe thử từng giọng ở Quản trị › Tích hợp. Lựa chọn được nhớ cho lần sau.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["lecturer", "Giảng viên (Nghe giảng)"],
              ["A", "Người dẫn 1 (Podcast)"],
              ["B", "Người dẫn 2 (Podcast)"],
            ] as const
          ).map(([role, label]) => (
            <label key={role} className="block text-sm">
              <span className="label">{label}</span>
              <select
                className="input mt-1.5"
                value={voices[role]}
                onChange={(e) => setVoice(role, e.target.value)}
                disabled={!voiceList.voices?.length}
              >
                {(voiceList.voices ?? []).map((v) => (
                  <option key={v.voice} value={v.voice}>
                    {v.voice} ({v.language})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {sameHost && (
          <p className="mt-3 text-sm text-warning-700">Hai người dẫn đang dùng cùng một giọng. Podcast vẫn tạo được nhưng người nghe khó phân biệt hai người.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !voicesReady || pending.length === 0}
            onClick={() => void generate()}
          >
            {pending.length > 0 ? `Tạo giọng cho cả khoá (${pending.length})` : "Không còn gì để tạo"}
          </button>
          <span className="text-sm text-muted">Chỉ làm các dòng chưa có giọng, giọng đã cũ hoặc đang lỗi.</span>
        </div>
        {message && (
          <div role="status" className={`mt-3 ${message.tone === "ok" ? "banner-success" : "banner-danger"}`}>
            <p>{message.text}</p>
          </div>
        )}
      </section>

      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-token p-8 text-center text-sm text-muted">
          Khoá này chưa có bài nào kèm lời giảng hay podcast. Thêm <code>lecture</code> / <code>podcast</code> vào tệp nhập khoá rồi nhập lại.
        </p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Bài</th>
                <th className="px-4 py-2 text-left font-medium">Loại</th>
                <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-2 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {data.rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.lessonTitle}</p>
                    <p className="text-xs text-faint">{r.moduleTitle}</p>
                  </td>
                  <td className="px-4 py-2.5">{KIND_LABEL[r.kind]}</td>
                  <td className="px-4 py-2.5">
                    <span className={STATE_CHIP[r.state]}>
                      {STATE_LABEL[r.state]}
                      {r.state === "generating" ? ` ${r.progress}%` : ""}
                    </span>
                    {r.state === "ready" && r.durationSec != null && (
                      <p className="mt-1 text-xs text-muted tabular-nums">
                        {fmtDuration(r.durationSec)}
                        {r.sizeBytes != null ? ` · ${fmtSize(r.sizeBytes)}` : ""}
                      </p>
                    )}
                    {r.state === "stale" && (
                      <p className="mt-1 max-w-xs text-xs text-muted">Lời của bài đã đổi; học viên không thấy nút nghe cho tới khi tạo lại.</p>
                    )}
                    {r.state === "failed" && r.error && <p className="mt-1 max-w-sm text-xs text-danger-700">{r.error}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.state !== "generating" && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busy || !voicesReady}
                          onClick={() => void generate([r.id])}
                        >
                          {r.state === "ready" ? "Tạo lại" : r.state === "failed" ? "Thử lại" : "Tạo giọng"}
                        </button>
                      )}
                      <Link href={`/learn/${data.course.slug}/lessons/${r.lessonId}`} className="btn-ghost btn-sm" prefetch={false}>
                        Mở bài
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
