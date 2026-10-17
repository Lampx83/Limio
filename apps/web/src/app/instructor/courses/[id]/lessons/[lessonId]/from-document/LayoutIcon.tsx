import type { LessonLayoutKey } from "@feedbackme/shared-types";

/** Hình thu nhỏ của từng bố cục — để nhận ra bố cục bằng mắt, không phải đọc chữ. */
export default function LayoutIcon({ layout, className = "" }: { layout: LessonLayoutKey; className?: string }) {
  const c = "currentColor";
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      {layout === "text" && (
        <>
          <rect x="2" y="3" width="24" height="2.5" rx="1" fill={c} />
          <rect x="2" y="8" width="20" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="2" y="12" width="22" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="2" y="16" width="16" height="2" rx="1" fill={c} opacity=".45" />
        </>
      )}
      {layout === "image" && (
        <>
          <rect x="2" y="3" width="12" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="2" y="7" width="12" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="2" y="11" width="10" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="16" y="3" width="10" height="13" rx="2" fill={c} />
        </>
      )}
      {layout === "cards" && (
        <>
          <rect x="2" y="4" width="7" height="12" rx="1.5" fill={c} />
          <rect x="10.5" y="4" width="7" height="12" rx="1.5" fill={c} opacity=".7" />
          <rect x="19" y="4" width="7" height="12" rx="1.5" fill={c} opacity=".45" />
        </>
      )}
      {layout === "compare" && (
        <>
          <rect x="2" y="3" width="11" height="14" rx="1.5" fill={c} />
          <rect x="15" y="3" width="11" height="14" rx="1.5" fill="none" stroke={c} strokeWidth="1.6" />
        </>
      )}
      {layout === "steps" && (
        <>
          <circle cx="5" cy="4" r="2.6" fill={c} />
          <circle cx="5" cy="10" r="2.6" fill={c} opacity=".7" />
          <circle cx="5" cy="16" r="2.6" fill={c} opacity=".45" />
          <rect x="10" y="3" width="15" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="10" y="9" width="13" height="2" rx="1" fill={c} opacity=".45" />
          <rect x="10" y="15" width="14" height="2" rx="1" fill={c} opacity=".45" />
        </>
      )}
      {layout === "faq" && (
        <>
          <rect x="2" y="2.5" width="24" height="6" rx="1.5" fill="none" stroke={c} strokeWidth="1.6" />
          <rect x="2" y="11.5" width="24" height="6" rx="1.5" fill="none" stroke={c} strokeWidth="1.6" opacity=".55" />
          <path d="M5 5.5h2M6 4.5v2" stroke={c} strokeWidth="1.4" />
        </>
      )}
      {layout === "stats" && (
        <>
          <rect x="2" y="3" width="11" height="14" rx="1.5" fill={c} opacity=".25" />
          <rect x="15" y="3" width="11" height="14" rx="1.5" fill={c} opacity=".25" />
          <rect x="4" y="6" width="6" height="4" rx="1" fill={c} />
          <rect x="17" y="6" width="6" height="4" rx="1" fill={c} />
        </>
      )}
    </svg>
  );
}
