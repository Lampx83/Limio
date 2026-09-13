"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, Dices, Grid3x3 } from "lucide-react";
import BlueprintPanel from "./BlueprintPanel";

type Item = {
  id: string;
  bankId: string;
  bankName: string;
  type: string;
  prompt: string;
  points: number;
  difficulty: number;
  status: "draft" | "published" | "archived";
  skillIds: string[];
};

type Bank = { id: string; name: string };

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tất cả loại" },
  { value: "mcq", label: "MCQ" },
  { value: "multi", label: "Multi" },
  { value: "true_false_notgiven", label: "T/F/NG" },
  { value: "gap_fill", label: "Gap fill" },
  { value: "short_answer", label: "Ngắn" },
  { value: "essay", label: "Tự luận" },
];

/** Dropdown lọc chủ đề — chọn nhiều (checkbox), trông như 1 select bình
 *  thường (đồng bộ hình dáng với "Tất cả loại"/"Tất cả độ khó" bên cạnh) chứ
 *  không phải hàng chip rời rạc như trước. Bỏ trống = lấy toàn bộ chủ đề. */
function TopicMultiSelectDropdown({
  topics,
  selected,
  onToggle,
}: {
  topics: string[];
  selected: Set<string>;
  onToggle: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = selected.size === 0 ? "Toàn bộ chủ đề" : `${selected.size} chủ đề đã chọn`;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-default bg-white px-3 py-2 text-sm text-slate-700"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-default bg-white py-1 shadow-lg">
            {topics.map((t) => {
              const checked = selected.has(t);
              return (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(t)}
                    className="h-4 w-4 shrink-0"
                  />
                  {t}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

type BankPanel = "browse" | "random" | "blueprint";

const ADVANCED_TABS: Array<{ key: BankPanel; label: string; Icon: typeof BookOpen }> = [
  { key: "random", label: "Chọn nhanh theo tiêu chí", Icon: Dices },
  { key: "blueprint", label: "Theo ma trận đề thi", Icon: Grid3x3 },
];

/** "Chọn thủ công" là mặc định, luôn hiện. 2 cách còn lại (rút nhanh theo
 *  tiêu chí, theo ma trận đề thi) phức tạp hơn hẳn — chỉ hiện tên khi bấm
 *  "Nâng cao", đỡ 1 hàng tab đầy ngay từ đầu cho người chỉ cần chọn tay.
 *  Đã mở "Nâng cao" 1 lần thì giữ mở, không tự thu lại — đổi qua lại giữa 2
 *  nhánh nâng cao không nên lại phải bấm "Nâng cao" thêm lần nữa.
 */
function BankPanelTabs({
  active,
  onChange,
  advancedOpen,
  onOpenAdvanced,
}: {
  active: BankPanel;
  onChange: (p: BankPanel) => void;
  advancedOpen: boolean;
  onOpenAdvanced: () => void;
}) {
  return (
    <div className="border-b border-default px-4 py-2.5">
      <p className="mb-2 text-sm text-faint">
        Bạn muốn rút câu từ ngân hàng đề theo hình thức nào dưới đây?
      </p>
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-default bg-slate-50 p-0.5">
        <button
          type="button"
          onClick={() => onChange("browse")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === "browse" ? "bg-white text-slate-900 shadow-sm" : "text-faint hover:text-slate-700"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          Chọn thủ công
        </button>
        {!advancedOpen && (
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-faint hover:text-slate-700"
          >
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            Nâng cao
          </button>
        )}
        {advancedOpen &&
          ADVANCED_TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-white text-slate-900 shadow-sm" : "text-faint hover:text-slate-700"
                }`}
              >
                <t.Icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}

/**
 * Bảng chọn câu hỏi từ ngân hàng — gộp 3 đường (chọn tay từng câu, rút nhanh
 * theo tiêu chí, theo ma trận đề thi) vào một cửa sổ, trình bày ngang hàng
 * bằng tab thay vì leo thang qua link ẩn.
 */
export default function BankPickerModal({
  examId,
  sectionId = null,
  onClose,
}: {
  examId: string;
  /** Đang thêm vào 1 "Phần" cụ thể (đề đã chia nhiều phần) — ẩn nhánh "rút
   *  ngẫu nhiên"/"thiết kế ma trận" vì 2 nhánh đó tự tạo section riêng của
   *  chúng, không gán được vào 1 section có sẵn. */
  sectionId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<BankPanel>("browse");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Đóng modal từ nút "✕"/click ra ngoài — dù đang ở nhánh nào cũng đồng bộ
  // lại "Chia đề thành nhiều phần" phòng khi đã tạo/chỉnh section ngầm (rút
  // ngẫu nhiên hoặc thiết kế ma trận) mà đóng thẳng, không qua nút "Quay lại".
  const closeAll = () => {
    window.dispatchEvent(new Event("fbm:exam-sections-changed"));
    router.refresh();
    onClose();
  };

  // ── Chọn tay (mặc định) ──────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [bankId, setBankId] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Danh sách ngân hàng — dùng chung cho cả bộ lọc chọn tay lẫn panel rút
  // ngẫu nhiên, tải 1 lần để 2 nơi luôn thấy cùng danh sách. Chỉ 1 ngân hàng
  // → chọn sẵn, khỏi bắt người dùng chọn cái không có lựa chọn thật.
  const [banks, setBanks] = useState<Bank[]>([]);
  useEffect(() => {
    fetch("/api/question-banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { banks: Bank[] } | null) => {
        if (!j) return;
        setBanks(j.banks);
        if (j.banks.length === 1) setBankId(j.banks[0]!.id);
      });
  }, []);

  // Đổi ngân hàng → nạp lại danh sách chủ đề của riêng ngân hàng đó (chủ đề
  // lưu theo BankQuestion.config.topic, không gộp được xuyên ngân hàng) và
  // bỏ chủ đề đang chọn vì có thể không còn thuộc ngân hàng mới.
  useEffect(() => {
    setSelectedTopics(new Set());
    if (!bankId) {
      setTopics([]);
      return;
    }
    fetch(`/api/question-banks/${bankId}/topics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { topics: string[] } | null) => setTopics(j?.topics ?? []));
  }, [bankId]);

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  useEffect(() => {
    if (panel !== "browse") return;
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      const p = new URLSearchParams();
      p.append("status", "published");
      if (q.trim()) p.append("q", q.trim());
      if (type) p.append("type", type);
      if (difficulty) p.append("difficulty", difficulty);
      if (bankId) p.append("bank", bankId);
      selectedTopics.forEach((t2) => p.append("topic", t2));
      p.append("limit", "30");
      try {
        const r = await fetch(`/api/bank-questions?${p.toString()}`);
        if (!r.ok) {
          setErr(`HTTP ${r.status}`);
          return;
        }
        const j = (await r.json()) as { items: Item[] };
        setItems(j.items);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, type, difficulty, bankId, selectedTopics, panel]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setErr(null);
    try {
      for (const bankQuestionId of selected) {
        const r = await fetch(`/api/exams/${examId}/questions/from-bank`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bankQuestionId, passageId: null, sectionId }),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { error?: string } | null;
          setErr(j?.error ?? `HTTP ${r.status}`);
          return;
        }
      }
      // Thêm vào 1 section có sẵn (khung "Phần N") làm itemCount của nó lệch
      // khỏi "Chia đề thành nhiều phần" cho tới khi có sự kiện này.
      if (sectionId) window.dispatchEvent(new Event("fbm:exam-sections-changed"));
      router.refresh();
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      data-testid="bank-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeAll}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-default p-4">
          <h3 className="flex items-center gap-1.5 text-base font-semibold">
            <BookOpen className="h-4 w-4 shrink-0 text-slate-400" /> Thêm câu hỏi từ ngân hàng
          </h3>
          <button onClick={closeAll} className="text-slate-500 hover:text-slate-900">
            ✕
          </button>
        </div>

        {!sectionId && (
          <BankPanelTabs
            active={panel}
            onChange={setPanel}
            advancedOpen={advancedOpen}
            onOpenAdvanced={() => setAdvancedOpen(true)}
          />
        )}

        {panel === "browse" && (
          <>
            <div className="border-b border-default p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Tìm theo nội dung..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="flex-1 rounded border border-default px-3 py-2 text-sm"
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="rounded border border-default px-3 py-2 text-sm"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="rounded border border-default px-3 py-2 text-sm"
                >
                  <option value="">Tất cả độ khó</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>
                      ✦ {n}/5
                    </option>
                  ))}
                </select>
                {topics.length > 0 && (
                  <TopicMultiSelectDropdown
                    topics={topics}
                    selected={selectedTopics}
                    onToggle={toggleTopic}
                  />
                )}
              </div>
              {banks.length > 1 && (
                <div className="mt-2">
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="rounded border border-default px-3 py-2 text-sm"
                  >
                    <option value="">Tất cả ngân hàng</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loading && <div className="text-center text-sm text-faint">Đang tải...</div>}
              {!loading && items.length === 0 && (
                <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
                  {q || type || difficulty || bankId || selectedTopics.size > 0
                    ? "Không có câu hỏi nào khớp bộ lọc."
                    : "Chưa có câu hỏi published nào. Tạo + publish trong tab Question Bank trước."}
                </div>
              )}
              <ul className="space-y-2">
                {items.map((it) => {
                  const checked = selected.has(it.id);
                  return (
                    <li key={it.id}>
                      <label
                        data-testid={`bank-pick-${it.id}`}
                        className={`flex cursor-pointer items-start gap-3 rounded border p-3 hover:bg-slate-50 ${
                          checked ? "border-brand-400 bg-brand-50/40" : "border-default"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(it.id)}
                          className="mt-1 h-4 w-4 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="rounded bg-slate-100 px-2 py-0.5 uppercase text-slate-700">
                              {it.type}
                            </span>
                            <span className="text-faint">
                              {it.points} điểm · ✦{it.difficulty}/5 · {it.skillIds.length} skill
                            </span>
                            <span className="ml-auto inline-flex items-center gap-1 text-faint">
                              <BookOpen className="h-3 w-3 shrink-0" />
                              {it.bankName}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm">{it.prompt}</p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {err && (
              <div className="border-t border-default p-3">
                <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-default bg-slate-50 px-4 py-2.5">
              <span className="text-xs text-faint">
                {selected.size === 0 ? "Chưa chọn câu nào" : `Đã chọn ${selected.size} câu`}
              </span>
              <button
                type="button"
                onClick={() => void addSelected()}
                disabled={selected.size === 0 || adding}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adding ? "Đang thêm…" : `Thêm ${selected.size || ""} câu vào đề`}
              </button>
            </div>
          </>
        )}

        {panel === "random" && (
          <RandomFromBankPanel
            examId={examId}
            banks={banks}
            onDone={() => {
              router.refresh();
              onClose();
            }}
          />
        )}

        {panel === "blueprint" && (
          <BlueprintPanel
            examId={examId}
            onDone={() => {
              router.refresh();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

interface PreviewQuestion {
  id: string;
  code: string | null;
  prompt: string;
  type: string;
  difficulty: number;
  topic: string | null;
}

/**
 * Nhánh "rút ngẫu nhiên theo bộ lọc" — phía sau vẫn tạo 1 ExamSection
 * (selectionMode=random_from_bank) như SectionsPanel cũ, chỉ đổi cách hỏi
 * sang ngôn ngữ thường và gộp bước tạo + xem trước + chốt vào 1 luồng.
 * Section tạo dở mà đóng modal giữa chừng sẽ bị xoá lại (không để rác).
 */
function RandomFromBankPanel({
  examId,
  banks,
  onDone,
}: {
  examId: string;
  banks: Bank[];
  onDone: () => void;
}) {
  const [bankId, setBankId] = useState(() => (banks.length === 1 ? banks[0]!.id : ""));
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [count, setCount] = useState("10");
  const [difficulties, setDifficulties] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sectionId, setSectionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalRequested: number;
    totalSampled: number;
    questions: PreviewQuestion[];
  } | null>(null);
  const [reshuffleSeed, setReshuffleSeed] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTopics(new Set());
    if (!bankId) {
      setTopics([]);
      return;
    }
    fetch(`/api/question-banks/${bankId}/topics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { topics: string[] } | null) => setTopics(j?.topics ?? []));
  }, [bankId]);

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  // Đóng/chuyển tab giữa chừng (chưa chốt) → xoá section nháp, không để rác
  // trong "Chia đề thành nhiều phần". Điều hướng giờ qua tab (không còn nút
  // "Quay lại" riêng của panel này), nên dọn dẹp phải bám theo unmount thay
  // vì 1 hành động bấm cụ thể — dùng ref để cleanup luôn thấy sectionId mới
  // nhất dù effect chỉ đăng ký 1 lần lúc mount.
  const sectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sectionIdRef.current = sectionId;
  }, [sectionId]);
  useEffect(() => {
    return () => {
      if (sectionIdRef.current) {
        fetch(`/api/exam-sections/${sectionIdRef.current}`, { method: "DELETE" }).catch(
          () => undefined,
        );
      }
    };
  }, []);

  const loadPreview = async (id: string, seed?: string | null) => {
    const url = seed
      ? `/api/exams/${examId}/sections/${id}/preview-pool?reshuffle=${encodeURIComponent(seed)}`
      : `/api/exams/${examId}/sections/${id}/preview-pool`;
    const r = await fetch(url);
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    setPreview(await r.json());
  };

  // Không chọn chủ đề nào: lọc độ khó ở top-level poolFilter.difficulty
  // (sampler tự chia đều theo mức). Có ≥1 chủ đề: PoolFilter không có field
  // "topic" ở top-level, chỉ PoolBucket mới lọc theo chủ đề — nên phải gói
  // mỗi tổ hợp (chủ đề × mức độ khó đã chọn) thành 1 bucket, chia đều count
  // cho tất cả tổ hợp.
  const buildPoolFilter = () => {
    const totalCount = Number(count) || 10;
    if (selectedTopics.size === 0) {
      return {
        bankIds: [bankId],
        count: totalCount,
        ...(difficulties.size > 0 ? { difficulty: [...difficulties] } : {}),
      };
    }
    const topicList = [...selectedTopics];
    const levels = difficulties.size > 0 ? [...difficulties].sort((a, b) => a - b) : [null];
    const combos = topicList.flatMap((t) => levels.map((level) => ({ topic: t, level })));
    const base = Math.floor(totalCount / combos.length);
    const remainder = totalCount - base * combos.length;
    const buckets = combos
      .map(({ topic, level }, i) => ({
        topic,
        ...(level !== null ? { difficulty: level } : {}),
        count: base + (i < remainder ? 1 : 0),
      }))
      .filter((b) => b.count > 0);
    return { bankIds: [bankId], count: totalCount, buckets };
  };

  const onXemTruoc = async () => {
    if (!bankId) {
      setErr("Chọn ngân hàng câu hỏi trước");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Rút ngẫu nhiên từ ngân hàng",
          selectionMode: "random_from_bank",
          // Chỉ hỗ trợ "cả lớp làm chung 1 đề" (per_publish + chốt ngay) —
          // "mỗi học sinh 1 bộ khác nhau" (per_attempt) cần màn thi đọc và
          // hiển thị câu hỏi rút động lúc làm bài, phần đó CHƯA được xây nên
          // tạm ẩn khỏi UI để khỏi tạo cảm giác đã xong mà học sinh không
          // thấy câu nào khi vào thi.
          resolutionMode: "per_publish",
          poolFilter: buildPoolFilter(),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const { id } = (await r.json()) as { id: string };
      setSectionId(id);
      await loadPreview(id);
    } finally {
      setBusy(false);
    }
  };

  const onXemBoKhac = async () => {
    if (!sectionId) return;
    const seed = `${Math.random()}`;
    setReshuffleSeed(seed);
    await loadPreview(sectionId, seed);
  };

  const onChot = async () => {
    if (!sectionId) return;
    setBusy(true);
    setErr(null);
    try {
      const body = reshuffleSeed ? { reshuffleSeed } : {};
      const r = await fetch(`/api/exams/${examId}/sections/${sectionId}/import-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      window.dispatchEvent(new Event("fbm:exam-sections-changed"));
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const toggleDifficulty = (n: number) => {
    setDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {!preview && (
        <div className="space-y-3">
          <p className="text-sm text-faint">
            Hệ thống sẽ tự bốc ngẫu nhiên câu hỏi từ ngân hàng theo điều kiện bên dưới, thay vì bạn
            phải chọn tay từng câu.
          </p>

          {banks.length > 1 && (
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">Ngân hàng câu hỏi</span>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
              >
                <option value="">Chọn ngân hàng...</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {topics.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-slate-600">Chủ đề</span>
              <div className="mt-1">
                <TopicMultiSelectDropdown
                  topics={topics}
                  selected={selectedTopics}
                  onToggle={toggleTopic}
                />
              </div>
            </div>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Số câu muốn lấy</span>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="mt-1 w-32 rounded border border-default bg-white px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="block text-xs font-medium text-slate-600">
              Mức độ khó (bỏ trống = lấy đủ mức)
            </span>
            <div className="mt-1 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = difficulties.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleDifficulty(n)}
                    className={`h-8 w-8 rounded-full border text-xs font-semibold ${
                      on
                        ? "border-brand-500 bg-brand-600 text-white"
                        : "border-default bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="rounded border border-default bg-slate-50 px-3 py-2 text-xs text-faint">
            Hệ thống lấy ngẫu nhiên số câu ở trên rồi cố định lại cho cả lớp — mọi học sinh làm
            chung bộ câu này, chỉ khác thứ tự câu hỏi giữa các em.
          </p>

          {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onXemTruoc()}
              disabled={busy || !bankId}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Đang bốc…" : "Xem trước"}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Đã bốc được <strong className="tabular-nums text-slate-900">{preview.totalSampled}</strong> /{" "}
              {preview.totalRequested} câu
              {preview.totalSampled < preview.totalRequested && (
                <span className="ml-2 text-amber-700">
                  ⚠ thiếu {preview.totalRequested - preview.totalSampled} — ngân hàng chưa đủ câu đã publish
                </span>
              )}
            </span>
            <button
              onClick={() => void onXemBoKhac()}
              className="rounded border border-default px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              🎲 Xem bộ khác
            </button>
          </div>

          <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded border border-default p-2">
            {preview.questions.map((qq, idx) => (
              <li key={qq.id} className="flex items-start gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs">
                <span className="shrink-0 text-faint">{idx + 1}.</span>
                {qq.code && (
                  <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                    {qq.code}
                  </span>
                )}
                <span className="line-clamp-1 flex-1 text-slate-800">{qq.prompt}</span>
                <span className="shrink-0 text-faint">✦{qq.difficulty}/5</span>
              </li>
            ))}
          </ul>

          {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {err}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void onChot()}
              disabled={busy || preview.totalSampled === 0}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Đang thêm…" : `Thêm ${preview.totalSampled} câu này vào đề`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
