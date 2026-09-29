/** 1536 → "1,5 KB". Hệ nhị phân (1 KB = 1024 byte), dấu phẩy thập phân kiểu Việt. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}
