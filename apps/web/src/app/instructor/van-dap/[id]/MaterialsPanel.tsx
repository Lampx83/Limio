"use client";

import { useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { LIMITS, errorText } from "./types";
import type { PanelProps } from "./VanDapEditor";

function size(n: number | null): string {
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Tài liệu = NGUỒN để sinh dàn. Chỉ dùng lúc soạn đề; lúc thi AI không tự tìm trong tài liệu. */
export default function MaterialsPanel({
  data,
  reload,
  say,
  onPendingFile,
}: PanelProps & { onPendingFile: (pending: boolean) => void }) {
  const draft = data.exam.status === "draft";
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  function choose(f: File | null) {
    setFile(f);
    setWarn(null);
    onPendingFile(f !== null);
  }

  async function upload() {
    if (!file) return;
    if (file.size > LIMITS.materialMaxBytes) return setWarn(errorText("file_too_large"));
    setBusy(true);
    setWarn(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/materials`), { method: "POST", body: form });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        // AC1.2: nói rõ ngay, không im lặng.
        setWarn(errorText(out.error));
        return;
      }
      choose(null);
      if (inputRef.current) inputRef.current.value = "";
      say("ok", "Đã tải tài liệu lên.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Xoá tài liệu này khỏi đề?")) return;
    const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/materials/${id}`), { method: "DELETE" });
    if (!res.ok) {
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      return say("error", errorText(out.error));
    }
    await reload();
  }

  return (
    <section aria-labelledby="vd-materials" className="card space-y-3">
      <div>
        <h2 id="vd-materials" className="text-h3">
          Tài liệu nguồn
        </h2>
        <p className="mt-1 text-sm text-faint">
          Tài liệu chỉ dùng để AI đề xuất dàn câu hỏi ở bước dưới. Lúc thi AI không tự tìm trong tài liệu. PDF, Word (.docx), .txt hoặc .md, tối đa 20 MB mỗi tệp.
        </p>
      </div>

      {data.materials.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có tài liệu nào.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-default">
          {data.materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{m.title}</p>
                <p className="text-xs text-slate-500">
                  {m.chars.toLocaleString("vi-VN")} ký tự chữ{m.sizeBytes ? ` · ${size(m.sizeBytes)}` : ""}
                </p>
              </div>
              {draft && (
                <button type="button" onClick={() => remove(m.id)} className="btn btn-secondary btn-sm">
                  Xoá
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="space-y-2 rounded-lg border border-default bg-slate-50 p-3">
          <label htmlFor="vd-file" className="block text-caption font-medium">
            Chọn tệp tài liệu
          </label>
          <input
            ref={inputRef}
            id="vd-file"
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {file && (
            <p className="banner-warning text-sm" role="status">
              Tệp &quot;{file.name}&quot; mới chọn, chưa được tải lên. Bấm &quot;Tải lên&quot; để lưu vào đề.
            </p>
          )}
          {warn && (
            <p className="banner-danger text-sm" role="alert">
              {warn}
            </p>
          )}
          <button type="button" onClick={upload} disabled={!file || busy} className="btn btn-secondary btn-sm disabled:opacity-50">
            {busy ? "Đang tải lên…" : "Tải lên"}
          </button>
        </div>
      )}
    </section>
  );
}
