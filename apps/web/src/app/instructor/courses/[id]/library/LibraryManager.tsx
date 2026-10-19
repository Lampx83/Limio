"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { PAPER_TYPE_TEXT } from "@/lib/practiceLibraryQuery";
import { buildBulkBody, summarizeBulk, type BulkKind, type BulkRow } from "@/lib/libraryTable";
import CollectionsPanel, { type CollectionRow } from "./CollectionsPanel";
import ImportPanel from "./ImportPanel";

interface Row {
  id: string;
  title: string;
  status: string;
  collectionId: string | null;
  collectionTitle: string | null;
  seq: number | null;
  paperType: string | null;
  sourceLabel: string | null;
  yearLabel: string | null;
  difficulty: number | null;
  tags: string[];
  freePreview: boolean;
  allowMock: boolean;
  allowPractice: boolean;
  questionCount: number;
  attemptCount: number;
}
interface TableData {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_TEXT: Record<string, string> = { draft: "Nháp", published: "Đã xuất bản", archived: "Lưu trữ" };

const BULK_ACTIONS: { kind: BulkKind; label: string; input: "none" | "text" | "paper" | "diff" | "coll" | "onoff" }[] = [
  { kind: "collection", label: "Chuyển vào bộ…", input: "coll" },
  { kind: "paperType", label: "Gán loại đề…", input: "paper" },
  { kind: "difficulty", label: "Gán độ khó…", input: "diff" },
  { kind: "sourceLabel", label: "Gán nguồn…", input: "text" },
  { kind: "yearLabel", label: "Gán năm…", input: "text" },
  { kind: "tagsAdd", label: "Thêm tag…", input: "text" },
  { kind: "tagsRemove", label: "Bỏ tag…", input: "text" },
  { kind: "allowPractice", label: "Bật/tắt Luyện đề…", input: "onoff" },
  { kind: "allowMock", label: "Bật/tắt Phòng thi mô phỏng…", input: "onoff" },
  { kind: "freePreview", label: "Bật/tắt Học thử…", input: "onoff" },
  { kind: "publish", label: "Xuất bản", input: "none" },
  { kind: "archive", label: "Lưu trữ", input: "none" },
  { kind: "clone", label: "Nhân bản", input: "none" },
];

/**
 * LANG L6.6 — quản lý vài trăm đề của khoá luyện đề: bảng phân trang phía máy chủ (tìm, lọc, sắp xếp), chọn nhiều dòng
 * rồi thao tác hàng loạt (kết quả TỪNG DÒNG), thêm đề mới, quản lý bộ, nhập hàng loạt.
 */
export default function LibraryManager({ courseId, initialCollections }: { courseId: string; initialCollections: CollectionRow[] }) {
  const [filters, setFilters] = useState({ q: "", c: "", t: "", s: "", d: "", sort: "seq", dir: "asc" as "asc" | "desc", page: 1 });
  const [data, setData] = useState<TableData | null>(null);
  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ kind: BulkKind; value: string }>({ kind: "collection", value: "" });
  const [bulkMsg, setBulkMsg] = useState<{ message: string; failures: { title: string; reason: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "add" | "import" | "collections">("none");
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v !== "" && v !== 1) p.set(k, String(v));
    if (filters.page > 1) p.set("page", String(filters.page));
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/exams-table?${query}`));
      if (!r.ok) throw new Error();
      setData((await r.json()) as TableData);
    } catch {
      setError("Không tải được danh sách đề. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [courseId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadCollections = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/courses/${courseId}/exam-collections`));
    if (r.ok) setCollections(((await r.json()) as { collections: CollectionRow[] }).collections);
    void load();
  }, [courseId, load]);

  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, page: 1, ...patch }));
    setSelected(new Set());
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const allOnPage = !!data && data.rows.length > 0 && data.rows.every((r) => selected.has(r.id));

  async function applyBulk() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    setBulkMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/exams-bulk`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBulkBody(bulk.kind, bulk.value, ids)),
      });
      const j = (await r.json().catch(() => null)) as { results?: BulkRow[]; error?: string } | null;
      if (!r.ok || !j?.results) {
        setBulkMsg({ message: j?.error === "validation_failed" ? "Giá trị chưa hợp lệ." : "Không thực hiện được. Vui lòng thử lại.", failures: [] });
        return;
      }
      const titles = new Map((data?.rows ?? []).map((x) => [x.id, x.title]));
      const s = summarizeBulk(j.results, titles);
      setBulkMsg({ message: s.message, failures: s.failures });
      setSelected(new Set(s.failures.map((f) => f.examId)));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const action = BULK_ACTIONS.find((a) => a.kind === bulk.kind)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["add", "import", "collections"] as const).map((p) => (
          <button key={p} type="button" className={panel === p ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setPanel(panel === p ? "none" : p)} aria-expanded={panel === p}>
            {p === "add" ? "Thêm đề" : p === "import" ? "Nhập hàng loạt" : `Bộ / Part (${collections.length})`}
          </button>
        ))}
      </div>

      {panel === "add" && <AddExam courseId={courseId} collections={collections} onCreated={() => { void load(); setPanel("none"); }} />}
      {panel === "import" && <ImportPanel courseId={courseId} onDone={() => void reloadCollections()} />}
      {panel === "collections" && <CollectionsPanel courseId={courseId} collections={collections} onChanged={() => void reloadCollections()} />}

      <form
        className="flex flex-wrap items-end gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
        onSubmit={(e) => {
          e.preventDefault();
        }}
        aria-label="Lọc đề"
      >
        <label className="min-w-[10rem] flex-1 text-sm">
          <span className="text-caption block text-muted">Tìm</span>
          <input className="input mt-1 w-full" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Tên, nguồn, tag…" />
        </label>
        <Sel label="Bộ" value={filters.c} onChange={(v) => set({ c: v })} options={[["", "Tất cả"], ["none", "Chưa thuộc bộ"], ...collections.map((c) => [c.id, c.title] as [string, string])]} />
        <Sel label="Loại" value={filters.t} onChange={(v) => set({ t: v })} options={[["", "Mọi loại"], ...Object.entries(PAPER_TYPE_TEXT)]} />
        <Sel label="Trạng thái" value={filters.s} onChange={(v) => set({ s: v })} options={[["", "Đang soạn + xuất bản"], ["draft", "Nháp"], ["published", "Đã xuất bản"], ["archived", "Lưu trữ"]]} />
        <Sel label="Độ khó" value={filters.d} onChange={(v) => set({ d: v })} options={[["", "Mọi độ khó"], ...[1, 2, 3, 4, 5].map((n) => [String(n), `${n}/5`] as [string, string])]} />
        <Sel label="Sắp xếp" value={`${filters.sort}:${filters.dir}`} onChange={(v) => { const [sort, dir] = v.split(":"); set({ sort: sort!, dir: dir as "asc" | "desc" }); }} options={[["seq:asc", "Thứ tự ↑"], ["seq:desc", "Thứ tự ↓"], ["title:asc", "Tên A→Z"], ["updatedAt:desc", "Mới sửa"], ["difficulty:asc", "Độ khó ↑"], ["status:asc", "Trạng thái"]]} />
      </form>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-brand-300 bg-brand-soft p-3" role="region" aria-label="Thao tác hàng loạt">
          <span className="text-sm font-medium">Đã chọn {selected.size} đề</span>
          <Sel label="Thao tác" value={bulk.kind} onChange={(v) => setBulk({ kind: v as BulkKind, value: "" })} options={BULK_ACTIONS.map((a) => [a.kind, a.label] as [string, string])} />
          {action.input === "text" && <input className="input h-9" aria-label="Giá trị" value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value })} placeholder={action.kind.startsWith("tags") ? "tag1, tag2" : "Giá trị"} />}
          {action.input === "paper" && <Sel label="Loại" value={bulk.value} onChange={(v) => setBulk({ ...bulk, value: v })} options={[["", "(bỏ phân loại)"], ...Object.entries(PAPER_TYPE_TEXT)]} />}
          {action.input === "diff" && <Sel label="Độ khó" value={bulk.value} onChange={(v) => setBulk({ ...bulk, value: v })} options={[["", "(bỏ)"], ...[1, 2, 3, 4, 5].map((n) => [String(n), `${n}/5`] as [string, string])]} />}
          {action.input === "coll" && <Sel label="Bộ" value={bulk.value} onChange={(v) => setBulk({ ...bulk, value: v })} options={[["", "(Khác — bỏ khỏi bộ)"], ...collections.map((c) => [c.id, c.title] as [string, string])]} />}
          {action.input === "onoff" && <Sel label="Giá trị" value={bulk.value || "on"} onChange={(v) => setBulk({ ...bulk, value: v })} options={[["on", "Bật"], ["off", "Tắt"]]} />}
          <button type="button" className="btn-primary btn-sm" onClick={() => void applyBulk()} disabled={busy}>
            {busy ? "Đang làm…" : "Áp dụng"}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}
      {bulkMsg && (
        <div role="status" className={`rounded-lg border p-3 text-sm ${bulkMsg.failures.length ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
          <p className="font-medium">{bulkMsg.message}</p>
          {bulkMsg.failures.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {bulkMsg.failures.slice(0, 20).map((f) => (
                <li key={f.title}><b>{f.title}</b>: {f.reason}</li>
              ))}
              {bulkMsg.failures.length > 20 && <li>… và {bulkMsg.failures.length - 20} đề khác.</li>}
            </ul>
          )}
        </div>
      )}

      {error && <p role="alert" className="banner-danger text-sm">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-token bg-[rgb(var(--surface))]" aria-busy={loading}>
        <table className="w-full text-sm" data-testid="exam-table">
          <thead className="text-left text-caption">
            <tr className="border-b border-token">
              <th className="w-9 px-3 py-2">
                <input type="checkbox" aria-label="Chọn cả trang" checked={allOnPage} onChange={(e) => setSelected(e.target.checked && data ? new Set([...selected, ...data.rows.map((r) => r.id)]) : new Set())} />
              </th>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Đề</th>
              <th className="px-2 py-2">Bộ</th>
              <th className="px-2 py-2">Loại · Nguồn</th>
              <th className="px-2 py-2">Độ khó</th>
              <th className="px-2 py-2 text-right">Câu</th>
              <th className="px-2 py-2">Trạng thái</th>
              <th className="px-2 py-2 text-right">Lượt làm</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-token last:border-0">
                <td className="px-3 py-2">
                  <input type="checkbox" aria-label={`Chọn ${r.title}`} checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                </td>
                <td className="px-2 py-2 tabular-nums text-muted">{r.seq ?? "·"}</td>
                <td className="px-2 py-2">
                  <Link href={`/instructor/courses/${courseId}/exams/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                  <div className="text-caption text-muted">
                    {[r.allowPractice && "Luyện đề", r.allowMock && "Mô phỏng", r.freePreview && "Học thử"].filter(Boolean).join(" · ") || "Đã tắt cả hai chế độ"}
                  </div>
                </td>
                <td className="px-2 py-2 text-muted">{r.collectionTitle ?? "—"}</td>
                <td className="px-2 py-2 text-muted">{[r.paperType ? PAPER_TYPE_TEXT[r.paperType as keyof typeof PAPER_TYPE_TEXT] : null, r.sourceLabel, r.yearLabel].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2 py-2 tabular-nums">{r.difficulty ? `${r.difficulty}/5` : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.questionCount}</td>
                <td className="px-2 py-2">{STATUS_TEXT[r.status] ?? r.status}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.attemptCount}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">Không có đề nào phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted" aria-live="polite">{data.total} đề · trang {data.page}/{pages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm" disabled={filters.page <= 1 || loading} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>← Trước</button>
            <button type="button" className="btn-secondary btn-sm" disabled={filters.page >= pages || loading} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Sau →</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: ReadonlyArray<readonly [string, string]> }) {
  return (
    <label className="text-sm">
      <span className="text-caption block text-muted">{label}</span>
      <select className="select mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function AddExam({ courseId, collections, onCreated }: { courseId: string; collections: CollectionRow[]; onCreated: () => void }) {
  const [f, setF] = useState({ title: "", skill: "listening", minutes: "", collectionId: "", seq: "", paperType: "", sourceLabel: "", difficulty: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4"
      aria-label="Thêm đề"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await fetch(apiUrl(`/api/courses/${courseId}/practice-exams`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: f.title,
              skill: f.skill,
              ...(f.minutes ? { minutes: Number(f.minutes) } : {}),
              ...(f.collectionId ? { collectionId: f.collectionId } : {}),
              ...(f.seq ? { seq: Number(f.seq) } : {}),
              ...(f.paperType ? { paperType: f.paperType } : {}),
              ...(f.sourceLabel ? { sourceLabel: f.sourceLabel } : {}),
              ...(f.difficulty ? { difficulty: Number(f.difficulty) } : {}),
            }),
          });
          if (!r.ok) {
            setError("Không tạo được đề. Kiểm tra tên và các giá trị rồi thử lại.");
            return;
          }
          onCreated();
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-h3">Thêm đề</h2>
      <p className="text-meta mt-1">Tạo đề trống ở trạng thái nháp rồi mở ra thêm bài đọc và câu hỏi. Nhiều đề cùng lúc: dùng “Nhập hàng loạt”.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-2"><span className="text-caption block text-muted">Tên đề</span><input className="input mt-1 w-full" required maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="text-sm"><span className="text-caption block text-muted">Kỹ năng</span>
          <select className="select mt-1 w-full" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })}>
            <option value="listening">Nghe</option><option value="reading">Đọc</option><option value="writing">Viết</option><option value="speaking">Nói</option>
          </select>
        </label>
        <label className="text-sm"><span className="text-caption block text-muted">Bộ</span>
          <select className="select mt-1 w-full" value={f.collectionId} onChange={(e) => setF({ ...f, collectionId: e.target.value })}>
            <option value="">— chưa thuộc bộ —</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="text-caption block text-muted">Số thứ tự</span><input className="input mt-1 w-full" inputMode="numeric" value={f.seq} onChange={(e) => setF({ ...f, seq: e.target.value })} /></label>
        <label className="text-sm"><span className="text-caption block text-muted">Số phút</span><input className="input mt-1 w-full" inputMode="numeric" placeholder="mặc định theo kỹ năng" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></label>
        <label className="text-sm"><span className="text-caption block text-muted">Loại đề</span>
          <select className="select mt-1 w-full" value={f.paperType} onChange={(e) => setF({ ...f, paperType: e.target.value })}>
            <option value="">—</option>{Object.entries(PAPER_TYPE_TEXT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="text-caption block text-muted">Nguồn</span><input className="input mt-1 w-full" maxLength={120} placeholder="vd HSK 2023-05" value={f.sourceLabel} onChange={(e) => setF({ ...f, sourceLabel: e.target.value })} /></label>
        <label className="text-sm"><span className="text-caption block text-muted">Độ khó (1–5)</span><input className="input mt-1 w-full" inputMode="numeric" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} /></label>
      </div>
      {f.paperType === "official" && !f.sourceLabel.trim() && <p className="banner-warning mt-3 text-xs">Đề thật nên ghi nguồn để học viên thấy trích dẫn; người đăng chịu trách nhiệm về bản quyền đề.</p>}
      {error && <p role="alert" className="banner-danger mt-3 text-sm">{error}</p>}
      <button type="submit" className="btn-primary btn-sm mt-3" disabled={busy || !f.title.trim()}>{busy ? "Đang tạo…" : "Tạo đề"}</button>
    </form>
  );
}
