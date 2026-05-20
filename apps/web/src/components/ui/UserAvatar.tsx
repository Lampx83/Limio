/**
 * Avatar người dùng: ảnh (nếu có) → fallback initial trên nền màu hash từ tên.
 * Đảm bảo có ARIA label + xử lý tên rỗng / không hợp lệ.
 */

const COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
];

const SIZE_MAP = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
} as const;

type Size = keyof typeof SIZE_MAP;

interface UserAvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: Size;
  className?: string;
  title?: string;
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLORS[h % COLORS.length]!;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // First non-whitespace grapheme of first word; uppercase.
  const ch = [...trimmed][0]!;
  return ch.toUpperCase();
}

export default function UserAvatar({
  name,
  imageUrl,
  size = "md",
  className = "",
  title,
}: UserAvatarProps) {
  const safeName = (name ?? "").toString();
  const initial = getInitial(safeName);
  const color = safeName ? hashColor(safeName) : "bg-gray-500";
  const sizeCls = SIZE_MAP[size];
  const label = title || safeName || "Người dùng";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        title={label}
        className={`${sizeCls} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`${sizeCls} ${color} ${className} inline-flex items-center justify-center rounded-full font-semibold text-white select-none`}
    >
      {initial}
    </div>
  );
}
