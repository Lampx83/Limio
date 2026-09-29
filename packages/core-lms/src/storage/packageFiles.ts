import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Giải nén gói SCORM/H5P có giới hạn.
 *
 * Trước đây chỉ chặn dung lượng file zip (200 MB, đã nén). Một zip nhỏ có thể
 * phình ra hàng chục GB khi giải nén ("zip bomb") và làm đầy ổ đĩa của cả hệ
 * thống — ảnh hưởng mọi người dùng, không chỉ người upload.
 */

export interface PackageLimits {
  /** Tổng dung lượng SAU giải nén. */
  maxUnpackedBytes: number;
  maxFiles: number;
}

export const DEFAULT_PACKAGE_LIMITS: PackageLimits = {
  maxUnpackedBytes: 1024 * 1024 * 1024, // 1 GB — đã chốt với chủ sản phẩm
  maxFiles: 20_000,
};

export class PackageLimitError extends Error {
  constructor(
    public readonly code: "package_unpacked_too_large" | "package_too_many_files",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/** Phần tối thiểu của entry trong adm-zip mà ta dùng (để test được bằng entry giả). */
export interface ZipEntryLike {
  entryName: string;
  isDirectory: boolean;
  header: { size: number };
  getData(): Buffer;
}

/**
 * Kiểm tra theo kích thước KHAI BÁO trong zip — rẻ, chạy trước khi ghi gì ra đĩa.
 * Kích thước khai báo có thể bị làm giả, nên extractEntries còn đếm dung lượng thật.
 */
export function assertDeclaredWithinLimits(
  entries: ZipEntryLike[],
  limits: PackageLimits = DEFAULT_PACKAGE_LIMITS,
): void {
  let files = 0;
  let bytes = 0;
  for (const e of entries) {
    if (e.isDirectory) continue;
    files++;
    bytes += e.header.size;
    if (files > limits.maxFiles) {
      throw new PackageLimitError("package_too_many_files", { maxFiles: limits.maxFiles });
    }
    if (bytes > limits.maxUnpackedBytes) {
      throw new PackageLimitError("package_unpacked_too_large", {
        maxUnpackedBytes: limits.maxUnpackedBytes,
      });
    }
  }
}

/**
 * Ghi các file ra `targetDir`. Đếm dung lượng THẬT của dữ liệu đã giải nén (không
 * tin kích thước khai báo). Vượt giới hạn thì ném lỗi — người gọi chịu trách
 * nhiệm dọn thư mục dở dang.
 */
export async function extractEntries(params: {
  entries: ZipEntryLike[];
  stripPrefix: string;
  targetDir: string;
  limits?: PackageLimits;
}): Promise<{ bytes: number; files: number }> {
  const { entries, stripPrefix, targetDir } = params;
  const limits = params.limits ?? DEFAULT_PACKAGE_LIMITS;
  const root = path.resolve(targetDir);
  let bytes = 0;
  let files = 0;

  for (const e of entries) {
    if (e.isDirectory) continue;
    const rel = e.entryName.startsWith(stripPrefix)
      ? e.entryName.slice(stripPrefix.length)
      : e.entryName;
    if (!rel || rel.includes("..")) continue; // path traversal guard
    const dest = path.resolve(root, rel);
    // Chốt thứ hai: dù tên có "lách" qua kiểm tra chuỗi, đích phải nằm trong thư mục gói.
    if (dest !== root && !dest.startsWith(root + path.sep)) continue;

    const data = e.getData();
    files++;
    bytes += data.length;
    if (files > limits.maxFiles) {
      throw new PackageLimitError("package_too_many_files", { maxFiles: limits.maxFiles });
    }
    if (bytes > limits.maxUnpackedBytes) {
      throw new PackageLimitError("package_unpacked_too_large", {
        maxUnpackedBytes: limits.maxUnpackedBytes,
      });
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
  }
  return { bytes, files };
}

/** Tổng dung lượng các file trong thư mục (đệ quy); 0 nếu thư mục không tồn tại. */
export async function dirSizeBytes(dir: string): Promise<number> {
  let total = 0;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSizeBytes(abs);
    else if (e.isFile()) total += (await fs.stat(abs)).size;
  }
  return total;
}
