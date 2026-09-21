"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import type { LiveJoinState } from "@/lib/limioLiveJoin";
import PollVotingPage from "../../poll/[pollId]/PollVotingPage";
import WordCloudSubmitPage from "../../word-cloud/[cloudId]/WordCloudSubmitPage";

const POLL_MS = 2000;

export default function LiveJoinClient({ code, initial }: { code: string; initial: LiveJoinState }) {
  const [state, setState] = useState<LiveJoinState>(initial);

  // Poll thay vì SSE: cả lớp dùng chung 1 origin, mỗi kết nối SSE giữ 1 slot HTTP/1.1.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(apiUrl(`/api/public/live/${code}/state`), { cache: "no-store" });
        if (!res.ok || stopped) return;
        setState(await res.json());
      } catch {
        /* mất mạng thoáng qua — lần poll sau tự sửa */
      }
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [code]);

  if (state.status === "not_found") return <Card><p className="text-center text-sm text-muted">Không tìm thấy phiên này.</p></Card>;

  if (state.status === "ended") {
    return (
      <Card title={state.title}>
        <p className="text-center text-sm text-muted">Buổi trình chiếu đã kết thúc. Cảm ơn bạn đã tham gia!</p>
      </Card>
    );
  }

  if (state.status === "waiting") {
    return (
      <Card title={state.title}>
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden />
          <p className="text-base font-semibold">Đang chờ câu hỏi tiếp theo…</p>
          <p className="mt-1 text-xs text-muted">Giữ trang này mở — câu hỏi sẽ tự hiện khi giảng viên chuyển slide.</p>
        </div>
      </Card>
    );
  }

  const { slide } = state;
  return (
    <Card title={state.title}>
      {/* key theo slide: sang câu mới thì trạng thái "đã bình chọn/đã gửi" của câu cũ bị bỏ */}
      {(slide.kind === "poll" || slide.kind === "quiz") && (
        <PollVotingPage key={slide.slideId} poll={{ ...slide.poll, isAnonymous: state.identityMode === "anonymous", session: { lesson: null } }} />
      )}
      {slide.kind === "word_cloud" && (
        <WordCloudSubmitPage key={slide.slideId} wordCloud={{ ...slide.wordCloud, session: { lesson: null } }} />
      )}
      {(slide.kind === "collaborate_board" || slide.kind === "whiteboard") && (
        <div className="py-4 text-center">
          <p className="mb-4 text-base font-semibold">
            {slide.kind === "whiteboard" ? "Cả lớp cùng vẽ trên bảng trắng" : "Cả lớp cùng dán ghi chú lên bảng"}
          </p>
          <a
            href={slide.joinPath}
            className="inline-block rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Mở {slide.kind === "whiteboard" ? "bảng trắng" : "bảng ghi chú"}
          </a>
        </div>
      )}
    </Card>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-brand-200 bg-white p-6 shadow-lg">
      {title && <div className="mb-5 text-center text-xs font-semibold text-muted">{title}</div>}
      {children}
    </div>
  );
}
