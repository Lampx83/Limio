"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { VOICE_REGION_LABEL, VOICE_REGION_UNKNOWN_LABEL, type VoiceRegion } from "@/lib/narration/voiceCatalog";

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
  voices?: VoiceOption[];
  default?: string | null;
}

interface VoiceOption {
  voice: string;
  language: string;
  region: VoiceRegion | null;
}

/** Thứ tự nhóm trong hộp chọn giọng; nhóm trống không hiện. */
const REGION_GROUPS: Array<{ region: VoiceRegion | null; label: string }> = [
  { region: "bac", label: VOICE_REGION_LABEL.bac },
  { region: "nam", label: VOICE_REGION_LABEL.nam },
  { region: null, label: VOICE_REGION_UNKNOWN_LABEL },
];

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
  // Một bộ phát dùng chung cho cả ba ô chọn giọng, để bấm giọng khác thì giọng đang phát dừng.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sample, setSample] = useState<{ voice: string | null; status: "idle" | "loading" | "playing" | "error" }>({
    voice: null,
    status: "idle",
  });

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggleSample = (voice: string) => {
    audioRef.current?.pause();
    if (sample.voice === voice && sample.status !== "idle" && sample.status !== "error") {
      setSample({ voice: null, status: "idle" });
      return;
    }
    const audio = new Audio(apiUrl(`/api/admin/narration/voices/sample?voice=${encodeURIComponent(voice)}`));
    audioRef.current = audio;
    setSample({ voice, status: "loading" });
    audio.onplaying = () => setSample({ voice, status: "playing" });
    audio.onended = () => setSample({ voice: null, status: "idle" });
    audio.onerror = () => setSample({ voice, status: "error" });
    void audio.play().catch(() => setSample({ voice, status: "error" }));
  };

  const [savingLabel, setSavingLabel] = useState(false);

  /** Dán (hoặc gỡ) nhãn vùng miền cho một giọng; lưu trên server nên mọi admin thấy cùng nhóm. */
  const setRegion = async (voice: string, region: VoiceRegion | null) => {
    setSavingLabel(true);
    try {
      const r = await fetch(apiUrl("/api/admin/narration/voices/label"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, region }),
      });
      if (!r.ok) {
        setMessage({ tone: "error", text: "Không lưu được nhãn của giọng. Thử lại sau." });
        return;
      }
      setVoiceList((prev) =>
        prev ? { ...prev, voices: prev.voices?.map((v) => (v.voice === voice ? { ...v, region } : v)) } : prev,
      );
    } finally {
      setSavingLabel(false);
    }
  };

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
        <p className="mt-1 text-sm text-muted">
          Bấm “Nghe thử” để nghe giọng đang chọn. Lần đầu hệ thống tạo bản thử rồi lưu lại, các lần sau nghe ngay. Nghe
          xong, thầy/cô bấm “Miền Bắc” hoặc “Miền Nam” để gắn nhãn; giọng được xếp nhóm theo nhãn cho mọi khoá học.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["lecturer", "Giảng viên (Nghe giảng)"],
              ["A", "Người dẫn 1 (Podcast)"],
              ["B", "Người dẫn 2 (Podcast)"],
            ] as const
          ).map(([role, label]) => (
            <div key={role} className="text-sm">
              <label htmlFor={`voice-${role}`} className="label">
                {label}
              </label>
              <div className="mt-1.5 flex gap-2">
                <select
                  id={`voice-${role}`}
                  className="input min-w-0 flex-1"
                  value={voices[role]}
                  onChange={(e) => setVoice(role, e.target.value)}
                  disabled={!voiceList.voices?.length}
                >
                  {REGION_GROUPS.map(({ region, label: groupLabel }) => {
                    const group = (voiceList.voices ?? []).filter((v) => v.region === region);
                    if (group.length === 0) return null;
                    return (
                      <optgroup key={groupLabel} label={groupLabel}>
                        {group.map((v) => (
                          <option key={v.voice} value={v.voice}>
                            {v.voice} ({v.language})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="btn-secondary btn-sm shrink-0"
                  disabled={!voices[role] || (sample.voice !== null && sample.voice !== voices[role] && sample.status === "loading")}
                  onClick={() => toggleSample(voices[role])}
                  aria-label={`Nghe thử giọng ${voices[role]}`}
                >
                  {sample.voice === voices[role] && sample.status === "loading"
                    ? "Đang tạo…"
                    : sample.voice === voices[role] && sample.status === "playing"
                      ? "Dừng"
                      : "Nghe thử"}
                </button>
              </div>
              {sample.voice === voices[role] && sample.status === "error" && (
                <p role="alert" className="mt-1 text-xs text-danger-700">
                  Không phát được bản thử, thử lại sau.
                </p>
              )}
              {voices[role] && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted">Giọng này là:</span>
                  {(["bac", "nam"] as const).map((region) => {
                    const current = voiceList.voices?.find((v) => v.voice === voices[role])?.region ?? null;
                    const on = current === region;
                    return (
                      <button
                        key={region}
                        type="button"
                        aria-pressed={on}
                        disabled={savingLabel}
                        onClick={() => void setRegion(voices[role], on ? null : region)}
                        className={on ? "chip-brand" : "chip hover:bg-[rgb(var(--border))]"}
                        title={on ? "Bấm lần nữa để bỏ nhãn" : undefined}
                      >
                        {region === "bac" ? "Miền Bắc" : "Miền Nam"}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
