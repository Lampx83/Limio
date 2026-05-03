/**
 * Limio brand SVG icons.
 *
 * - LimeSliceIcon: circular cross-section of a lime — outer green rind, pale
 *   pulp, 8 wedge dividers, small dark seeds. Logo identity.
 * - WatermelonSliceIcon: wedge slice — green rind, white inner rind, pink
 *   flesh, black seeds. Decoration / accent.
 *
 * Colors hard-coded to brand tokens (lime + pink) so the icons read as Limio
 * regardless of surrounding context. Pass `className` for sizing.
 */

export function LimeSliceIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer rind */}
      <circle cx="16" cy="16" r="15" fill="#3F6212" />
      <circle cx="16" cy="16" r="14" fill="#65A30D" />
      {/* Pulp */}
      <circle cx="16" cy="16" r="12" fill="#ECFCCB" />
      {/* Wedge dividers (8 sectors) */}
      <g stroke="#84CC16" strokeWidth="1.4" strokeLinecap="round">
        <line x1="16" y1="4.5" x2="16" y2="27.5" />
        <line x1="4.5" y1="16" x2="27.5" y2="16" />
        <line x1="7.9" y1="7.9" x2="24.1" y2="24.1" />
        <line x1="24.1" y1="7.9" x2="7.9" y2="24.1" />
      </g>
      {/* Pulp blobs (subtle) */}
      <g fill="#D9F99D" opacity="0.6">
        <ellipse cx="16" cy="10.5" rx="2" ry="1" />
        <ellipse cx="16" cy="21.5" rx="2" ry="1" />
        <ellipse cx="10.5" cy="16" rx="1" ry="2" />
        <ellipse cx="21.5" cy="16" rx="1" ry="2" />
      </g>
      {/* Center pith */}
      <circle cx="16" cy="16" r="1.6" fill="#84CC16" />
      {/* A couple of seeds */}
      <ellipse cx="13" cy="13" rx="0.6" ry="1" fill="#365314" />
      <ellipse cx="19" cy="19" rx="0.6" ry="1" fill="#365314" />
    </svg>
  );
}

export function WatermelonSliceIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer green rind (dark) */}
      <path d="M 2 50 A 30 30 0 0 1 62 50 L 60 50 A 28 28 0 0 0 4 50 Z" fill="#3F6212" />
      <path d="M 4 50 A 28 28 0 0 1 60 50 L 58 50 A 26 26 0 0 0 6 50 Z" fill="#65A30D" />
      {/* White inner rind layer */}
      <path d="M 6 50 A 26 26 0 0 1 58 50 L 55 50 A 23 23 0 0 0 9 50 Z" fill="#F7FEE7" />
      {/* Pink flesh */}
      <path d="M 9 50 A 23 23 0 0 1 55 50 Z" fill="#EC4899" />
      {/* Subtle pink lighter highlight */}
      <path d="M 14 47 A 18 18 0 0 1 50 47 L 48 49 A 16 16 0 0 0 16 49 Z" fill="#F472B6" opacity="0.6" />
      {/* Seeds */}
      <g fill="#0F172A">
        <ellipse cx="20" cy="42" rx="1.2" ry="2" transform="rotate(-15 20 42)" />
        <ellipse cx="32" cy="40" rx="1.2" ry="2" />
        <ellipse cx="44" cy="42" rx="1.2" ry="2" transform="rotate(15 44 42)" />
        <ellipse cx="26" cy="46" rx="1.2" ry="2" transform="rotate(-8 26 46)" />
        <ellipse cx="38" cy="46" rx="1.2" ry="2" transform="rotate(8 38 46)" />
        <ellipse cx="32" cy="48" rx="1.2" ry="2" />
      </g>
    </svg>
  );
}

/**
 * Composite "Limio mark" — lime slice with optional watermelon companion.
 * Use this where you want stronger fruit identity than just the lime slice.
 */
export function LimioMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      <LimeSliceIcon className="absolute inset-0 h-full w-full drop-shadow-sm" />
    </span>
  );
}
