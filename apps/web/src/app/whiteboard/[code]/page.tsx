"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import WhiteboardCanvas from "@/app/instructor/classroom/WhiteboardCanvas";

// Trang guest join — vẽ chung không cần đăng nhập, giống /join/[code] của
// InteractiveBoard nhưng route riêng (`/join` đã bị board Padlet chiếm).
// Đủ tối giản để dùng làm kiosk triển lãm: full-screen, không chrome thừa.
const WB_NAME_KEY = "fbm-whiteboard-name";

export default function WhiteboardJoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();
  const [title, setTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Tên người vẽ — gắn vào từng nét để giáo viên biết ai vẽ gì. Đã đăng nhập thì dùng tên tài khoản;
  // chưa thì hỏi 1 lần lúc vào (nhớ trên máy). Canvas chỉ mount sau khi có tên để nét đầu tiên đã có tên.
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [nameChecked, setNameChecked] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let name: string | null = null;
      try {
        const res = await fetch(apiUrl("/api/auth/session"));
        if (res.ok) {
          const session = (await res.json()) as { user?: { name?: string | null } } | null;
          name = session?.user?.name?.trim() || null;
        }
      } catch {
        /* không đọc được phiên = coi như chưa đăng nhập */
      }
      if (!name) {
        try {
          name = localStorage.getItem(WB_NAME_KEY)?.trim() || null;
        } catch {
          /* localStorage bị chặn — sẽ hỏi lại mỗi lần */
        }
      }
      if (cancelled) return;
      if (name) setAuthorName(name);
      setNameChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitName = () => {
    const name = nameDraft.trim();
    if (!name) return;
    try {
      localStorage.setItem(WB_NAME_KEY, name);
    } catch {
      /* bỏ qua */
    }
    setAuthorName(name);
  };

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
        {nameChecked && !authorName && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 p-6 dark:bg-zinc-900/90">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitName();
              }}
              className="w-full max-w-sm space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            >
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bạn tên là gì?</h2>
              <p className="text-sm text-gray-600 dark:text-zinc-300">Tên sẽ hiện cạnh nét vẽ của bạn để giáo viên biết ai vẽ gì.</p>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Vd. Nguyễn Văn A"
                maxLength={40}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={!nameDraft.trim()}
                className="w-full rounded-lg bg-brand-gradient px-5 py-2 font-semibold text-white shadow transition-all hover:shadow-brand-glow active:scale-[0.98] disabled:opacity-50"
              >
                Vào vẽ
              </button>
            </form>
          </div>
        )}
        {authorName && <WhiteboardCanvas
          code={code}
          authorName={authorName}
          onPageInfo={(page, total) => {
            setCurrentPage(page);
            setTotalPages(total);
          }}
        />}
      </div>
    </div>
  );
}
