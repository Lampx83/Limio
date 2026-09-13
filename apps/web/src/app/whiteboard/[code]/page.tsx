"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import WhiteboardCanvas from "@/app/instructor/classroom/WhiteboardCanvas";

// Trang guest join — vẽ chung không cần đăng nhập, giống /join/[code] của
// InteractiveBoard nhưng route riêng (`/join` đã bị board Padlet chiếm).
// Đủ tối giản để dùng làm kiosk triển lãm: full-screen, không chrome thừa.
export default function WhiteboardJoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();
  const [title, setTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/public/whiteboards/${code}`));
        if (res.status === 404) {
          setError("Không tìm thấy whiteboard với code này.");
          return;
        }
        if (!res.ok) {
          setError("Lỗi tải whiteboard");
          return;
        }
        const data = await res.json();
        setTitle(data.title);
        setStatus(data.status);
      } catch {
        setError("Lỗi mạng");
      }
    })();
  }, [code]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-bold">Không vào được</h1>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-zinc-900">
      <header className="shrink-0 bg-gradient-to-br from-sky-300 via-cyan-300 to-teal-300 px-4 py-2.5 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-bold">{title || "Whiteboard"}</p>
          <div className="flex items-center gap-2 shrink-0">
            {status === "closed" && (
              <span className="rounded-full bg-white/30 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                🔒 Đã đóng — chỉ xem
              </span>
            )}
            {totalPages > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                Trang {currentPage + 1}/{totalPages}
              </span>
            )}
            <span className="font-mono text-xs tracking-widest opacity-90">{code}</span>
          </div>
        </div>
      </header>
      <div className="relative flex-1 min-h-0">
        <WhiteboardCanvas
          code={code}
          onPageInfo={(page, total) => {
            setCurrentPage(page);
            setTotalPages(total);
          }}
        />
      </div>
    </div>
  );
}
