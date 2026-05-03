// Mascot: con hổ (tiger) — biểu tượng FeedBackMe
export function BrandIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      {/* Tai */}
      <path d="M14 14 L8 4 L20 8 Z" fill="#ea580c" />
      <path d="M50 14 L56 4 L44 8 Z" fill="#ea580c" />
      <path d="M14 14 L11 8 L18 10 Z" fill="#fda4af" />
      <path d="M50 14 L53 8 L46 10 Z" fill="#fda4af" />
      {/* Đầu hổ */}
      <ellipse cx="32" cy="34" rx="22" ry="20" fill="#f97316" />
      {/* Vạch sọc */}
      <path d="M14 22 Q18 18 14 14" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M50 22 Q46 18 50 14" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M10 32 Q14 33 12 38" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M54 32 Q50 33 52 38" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M22 18 Q23 22 21 25" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M42 18 Q41 22 43 25" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Phần mặt sáng */}
      <ellipse cx="32" cy="40" rx="14" ry="11" fill="#fef3c7" />
      {/* Mắt */}
      <circle cx="24" cy="30" r="3.5" fill="#1c1917" />
      <circle cx="40" cy="30" r="3.5" fill="#1c1917" />
      <circle cx="25" cy="29" r="1" fill="#fff" />
      <circle cx="41" cy="29" r="1" fill="#fff" />
      {/* Mũi */}
      <path d="M30 38 L34 38 L32 41 Z" fill="#1c1917" />
      {/* Miệng */}
      <path d="M32 41 L32 44 M32 44 Q28 47 26 45 M32 44 Q36 47 38 45" stroke="#1c1917" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Râu */}
      <path d="M22 42 L14 41 M22 44 L14 46 M42 42 L50 41 M42 44 L50 46" stroke="#78716c" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center justify-center gap-2">
      <BrandIcon className={big ? "w-12 h-12" : "w-8 h-8"} />
      <span
        className={`${big ? "text-3xl md:text-4xl" : "text-lg"} font-bold text-slate-900 dark:text-slate-50`}
      >
        FeedBackMe
      </span>
    </div>
  );
}
