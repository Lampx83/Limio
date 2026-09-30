// Huy hiệu tròn kiểu "con dấu" — bản SVG của SealBadge trong
// apps/web/src/lib/certificatePdf.tsx (cùng toạ độ, cùng màu). Sửa một bên
// thì sửa bên kia.
export default function CertificateSeal() {
  const cx = 34;
  const cy = 32;
  const r = 26;
  const scale = (r * 2) / 32;
  const tx = cx - 16 * scale;
  const ty = cy - 16 * scale;
  return (
    <svg width={68} height={92} viewBox="0 0 68 92" aria-hidden="true">
      <polygon points="20,58 27,84 34,72" fill="#3f6212" />
      <polygon points="48,58 41,84 34,72" fill="#84cc16" />
      <circle cx={cx} cy={cy} r={r + 2} fill="#ffffff" stroke="#3f6212" strokeWidth={1.5} />
      <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
        <circle cx="16" cy="16" r="15" fill="#3F6212" />
        <circle cx="16" cy="16" r="14" fill="#65A30D" />
        <circle cx="16" cy="16" r="12" fill="#ECFCCB" />
        <g stroke="#84CC16" strokeWidth="1.4" strokeLinecap="round">
          <line x1="16" y1="4.5" x2="16" y2="27.5" />
          <line x1="4.5" y1="16" x2="27.5" y2="16" />
          <line x1="7.9" y1="7.9" x2="24.1" y2="24.1" />
          <line x1="24.1" y1="7.9" x2="7.9" y2="24.1" />
        </g>
        <g fill="#D9F99D" opacity="0.6">
          <ellipse cx="16" cy="10.5" rx="2" ry="1" />
          <ellipse cx="16" cy="21.5" rx="2" ry="1" />
          <ellipse cx="10.5" cy="16" rx="1" ry="2" />
          <ellipse cx="21.5" cy="16" rx="1" ry="2" />
        </g>
        <circle cx="16" cy="16" r="1.6" fill="#84CC16" />
        <ellipse cx="13" cy="13" rx="0.6" ry="1" fill="#365314" />
        <ellipse cx="19" cy="19" rx="0.6" ry="1" fill="#365314" />
      </g>
    </svg>
  );
}
