/** Biểu tượng bút lông (毛笔): cán chéo, đầu lông nhọn. */
export default function BrushIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.6 2.6 21.4 4.4 12.9 12.9 11.1 11.1Z" />
      <path d="M10.4 11.8 12.2 13.6C11.8 16.4 9.4 18.8 4.6 20.4 3.6 20.7 3.3 20.4 3.6 19.4 5.2 14.6 7.6 12.2 10.4 11.8Z" />
    </svg>
  );
}
