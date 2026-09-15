export type OralAvatarState = "idle" | "thinking" | "talking" | "listening";

const STATE_LABEL: Record<OralAvatarState, string> = {
  idle: "Sẵn sàng",
  thinking: "Đang soạn câu hỏi…",
  talking: "Đang hỏi…",
  listening: "Đang lắng nghe…",
};

// A6.6 (UI) — video loop thật cho từng state (quay/tạo sẵn 1 lần, phục vụ
// như asset tĩnh — không sinh theo lượt nên không tốn thêm chi phí/độ trễ).
// State nào chưa có video thì rơi về mặt SVG robot cũ bên dưới.
const STATE_VIDEO: Partial<Record<OralAvatarState, string>> = {
  idle: "/oral-avatar/idle.mp4",
  thinking: "/oral-avatar/thinking.mp4",
};
// Frame đầu của mỗi video — hiện ngay trong lúc video còn đang buffer lần
// đầu (mạng SV chậm), tránh khung trống.
const STATE_POSTER: Partial<Record<OralAvatarState, string>> = {
  idle: "/oral-avatar/idle-poster.png",
  thinking: "/oral-avatar/thinking-poster.png",
};
const ALL_VIDEO_SRCS = Object.values(STATE_VIDEO);

/**
 * A6.6 (UI) — mặt AI giám khảo trong phòng vấn đáp. Ưu tiên video loop thật
 * (STATE_VIDEO) nếu state đó đã có; chưa có thì rơi về SVG robot vẽ bằng
 * animation CSS thuần (xem tailwind.config.ts `avatar-*`) — đổi trạng thái
 * tức thời theo state của phòng thi (đang hỏi/nghe/soạn câu).
 */
export default function OralAiAvatar({
  state,
  className,
}: {
  state: OralAvatarState;
  className?: string;
}) {
  const videoSrc = STATE_VIDEO[state];
  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ""}`}>
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
        {state === "listening" && (
          <>
            <span className="absolute inset-0 rounded-full bg-brand-400/40 animate-avatar-listen-ring" />
            <span
              className="absolute inset-0 rounded-full bg-brand-400/40 animate-avatar-listen-ring"
              style={{ animationDelay: "0.8s" }}
            />
          </>
        )}
        {videoSrc ? (
          <video
            key={videoSrc}
            className="h-20 w-20 rounded-full object-cover shadow-brand-glow"
            src={videoSrc}
            poster={STATE_POSTER[state]}
            preload="auto"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient shadow-brand-glow ${
              state === "idle" ? "animate-avatar-bob" : ""
            } ${state === "thinking" ? "animate-avatar-think-tilt" : ""}`}
          >
            <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden="true" focusable="false">
              <ellipse
                cx="32"
                cy="42"
                rx="7"
                ry="9"
                fill="white"
                className="animate-avatar-blink"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              <ellipse
                cx="68"
                cy="42"
                rx="7"
                ry="9"
                fill="white"
                className="animate-avatar-blink"
                style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: "0.15s" }}
              />
              <rect
                x="38"
                y="62"
                width="24"
                height="12"
                rx="6"
                fill="white"
                className={state === "talking" ? "animate-avatar-talk-mouth" : ""}
                style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
              />
            </svg>
          </div>
        )}
        {/* Preload sẵn các video state khác — để lúc đổi state (vd idle →
            thinking giữa buổi thi) không phải chờ tải từ đầu, tránh khung
            trống khi mạng SV chậm. Không hiển thị, không phát âm thanh. */}
        {ALL_VIDEO_SRCS.filter((src) => src !== videoSrc).map((src) => (
          <video
            key={src}
            src={src}
            muted
            preload="auto"
            aria-hidden="true"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-caption text-faint">
        {state === "thinking" && (
          <span className="flex gap-0.5" aria-hidden="true">
            <span className="h-1 w-1 rounded-full bg-current animate-avatar-think-dot" />
            <span
              className="h-1 w-1 rounded-full bg-current animate-avatar-think-dot"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="h-1 w-1 rounded-full bg-current animate-avatar-think-dot"
              style={{ animationDelay: "0.3s" }}
            />
          </span>
        )}
        <span>{STATE_LABEL[state]}</span>
      </div>
    </div>
  );
}
