// Pastel palette — phải match server's COLORS trong public/boards/[code]/notes.
export const BOARD_NOTE_COLORS = [
  "#FEF3C7", // amber
  "#DBEAFE", // blue
  "#D1FAE5", // green
  "#FCE7F3", // pink
  "#E9D5FF", // purple
  "#FED7AA", // orange
] as const;

// Random rotation -2deg..+2deg dựa trên hash id — deterministic để cùng note luôn
// quay cùng góc trên mọi client. Tạo cảm giác "giấy dán thật" như Padlet.
export function rotationForNote(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  // Map hash → -2..+2 deg
  const deg = ((Math.abs(hash) % 41) - 20) / 10;
  return `${deg.toFixed(1)}deg`;
}
