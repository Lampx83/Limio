"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { errorText, type EditorData } from "./types";
import SettingsPanel from "./SettingsPanel";
import MaterialsPanel from "./MaterialsPanel";
import PlanPanel from "./PlanPanel";
import ScenariosPanel from "./ScenariosPanel";
import QuestionMapPanel from "./QuestionMapPanel";

const STATUS_LABEL = { draft: "Nháp", published: "Đã xuất bản", archived: "Lưu trữ" } as const;

/**
 * Màn soạn đề Limio Vấn đáp. Mỗi đầu vào chỉ có một vai trò (docs/tieu-chi/limio-van-dap.md §3):
 * tài liệu → nguồn sinh dàn; dàn → hỏi gì, thứ tự nào; kịch bản → bối cảnh; ghi chú giọng điệu → hỏi thế nào; rubric → chấm thế nào.
 * State nằm ở đây; sau mỗi thao tác tải lại toàn bộ chi tiết đề (kèm bản đồ câu hỏi tính ở máy chủ).
 */
export default function VanDapEditor({ initial }: { initial: EditorData }) {
  const [data, setData] = useState(initial);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pendingFile, setPendingFile] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const draft = data.exam.status === "draft";

  const reload = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/van-dap/exams/${initial.exam.id}`), { cache: "no-store" });
    if (res.ok) setData((await res.json()) as EditorData);
  }, [initial.exam.id]);

  const say = useCallback((kind: "ok" | "error", text: string) => setNotice({ kind, text }), []);

  async function publish() {
    // AC1.1: không âm thầm bỏ tệp đang chọn dở.
    if (pendingFile) {
      say("error", "Còn một tệp đã chọn nhưng chưa bấm \"Tải lên\". Hãy tải lên hoặc bỏ chọn trước khi xuất bản.");
      return;
    }
    if (!window.confirm("Xuất bản đề? Sau đó tài liệu, dàn câu hỏi và kịch bản sẽ bị khoá để mọi học viên gặp cùng một đề.")) return;
    setPublishing(true);
    try {
      const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/publish`), { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return say("error", errorText(body.error));
      say("ok", "Đã xuất bản đề.");
      await reload();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="pb-24">
      <p className="text-xs">
        <Link href="/instructor/van-dap" className="text-slate-500 hover:text-brand-700">
          ← Limio Vấn đáp
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 break-words">{data.exam.title}</h1>
          <p className="mt-1 text-sm text-faint">
            {STATUS_LABEL[data.exam.status]} · {data.exam.durationMin} phút · {data.items.length} ý cần hỏi · {data.scenarios.length} kịch bản
          </p>
        </div>
        {draft && (
          <button type="button" onClick={publish} disabled={publishing} className="btn btn-primary btn-sm disabled:opacity-50">
            {publishing ? "Đang xuất bản…" : "Xuất bản"}
          </button>
        )}
      </div>

      {!draft && (
        <p className="banner-info mt-4 text-sm" role="status">
          Đề đã xuất bản: tài liệu, dàn câu hỏi và kịch bản đã khoá để mọi học viên gặp cùng một đề. Rubric và ghi chú giọng điệu vẫn sửa được.
        </p>
      )}
      {notice && (
        <p className={`${notice.kind === "ok" ? "banner-success" : "banner-danger"} mt-4 text-sm`} role={notice.kind === "ok" ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <div className="mt-6 space-y-8">
        <SettingsPanel data={data} reload={reload} say={say} />
        <MaterialsPanel data={data} reload={reload} say={say} onPendingFile={setPendingFile} />
        <PlanPanel data={data} reload={reload} say={say} pendingFile={pendingFile} />
        <ScenariosPanel data={data} reload={reload} say={say} />
        <QuestionMapPanel map={data.questionMap} durationMin={data.exam.durationMin} />
      </div>
    </main>
  );
}

export interface PanelProps {
  data: EditorData;
  reload: () => Promise<void>;
  say: (kind: "ok" | "error", text: string) => void;
}
