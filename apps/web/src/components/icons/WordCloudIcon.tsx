import type { LucideProps } from "lucide-react";

// Đám mây chữ thật: vài từ to nhỏ khác nhau xếp cụm, một màu theo màu chữ của ô — lucide không có icon này.
// Vẽ lớn hơn cỡ icon được truyền vào (×1.5) vì chữ cần chỗ mới đọc được; ô chứa không cắt phần tràn.
export function WordCloudIcon({ size = 28, strokeWidth = 2 }: LucideProps) {
  const px = Number(size) * 1.5;
  return (
    <svg width={px} height={px} viewBox="0 0 40 40" fill="currentColor" fontWeight={Number(strokeWidth) < 2 ? 600 : 800} fontFamily="system-ui, sans-serif" textAnchor="middle" aria-hidden>
      <text x="20" y="22" fontSize="16">học</text>
      <text x="9" y="9" fontSize="8">AI</text>
      <text x="30" y="10" fontSize="9">lớp</text>
      <text x="9" y="34" fontSize="9">vui</text>
      <text x="30" y="35" fontSize="10">mới</text>
    </svg>
  );
}
