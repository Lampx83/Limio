/**
 * Bộ nhớ đệm audio ghi ra TỆP: khi đường hầm SSH tới 224 đứt giữa chừng, chạy lại script thì các từ/lượt đã đọc xong được dùng lại
 * (khoá → đường dẫn đã lưu), không phải đọc lại từ đầu. Chỉ dùng cho script chạy tay (fill-*-audio).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export class PersistentCache extends Map<string, string> {
  constructor(private readonly file: string) {
    super();
    if (existsSync(file)) {
      try {
        for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, "utf8")) as Record<string, string>)) super.set(k, v);
      } catch {
        // tệp hỏng: bỏ qua, đọc lại từ đầu
      }
    }
  }

  override set(key: string, value: string): this {
    super.set(key, value);
    writeFileSync(this.file, JSON.stringify(Object.fromEntries(this)));
    return this;
  }
}
