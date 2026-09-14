export type OralAvatarState = "idle" | "thinking" | "talking" | "listening";

const STATE_LABEL: Record<OralAvatarState, string> = {
  idle: "Sẵn sàng",
  thinking: "Đang soạn câu hỏi…",
  talking: "Đang hỏi…",
  listening: "Đang lắng nghe…",
};

/**
 * A6.6 (UI) — mặt AI giám khảo trong phòng vấn đáp. Vẽ bằng SVG + animation
 * CSS thuần (xem tailwind.config.ts `avatar-*`) — không cần asset ảnh, đổi
 * trạng thái tức thời theo state của phòng thi (đang hỏi/nghe/soạn câu).
 */
export default function OralAiAvatar({
  state,
  className,
}: {
  state: OralAvatarState;
  className?: string;
}) {
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
