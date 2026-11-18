#!/usr/bin/env python3
"""
Sinh `src/lib/hanPinyinData.ts`: bảng pinyin dùng để đặt pinyin dưới chữ Hán của phương án / ngân hàng từ trong Bài luyện
(những chỗ dữ liệu câu hỏi không có pinyin tác giả viết). Không thêm thư viện vào web: bảng sinh sẵn từ pypinyin.

  - CHARS: 6763 chữ GB2312 (cấp 1 + 2), mỗi chữ một âm mặc định.
  - WORDS: từ 2-3 chữ thông dụng (cấp 1) có âm KHÁC cách đọc từng chữ (银行 yín háng, 觉得 jué de, 着急 zháo jí…), để xử lý chữ đa âm theo từ.
    Phần đổi thanh của 一 / 不 làm bằng luật trong hanPinyin.ts nên không đưa vào bảng.

Chạy: python3 apps/web/scripts/gen-han-pinyin.py   (cần `pip install pypinyin`)
"""
import pathlib
from pypinyin import pinyin, Style
from pypinyin.phrases_dict import phrases_dict

chars = []
for hi in range(0xB0, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            chars.append(bytes([hi, lo]).decode("gb2312"))
        except UnicodeDecodeError:
            pass
L1 = set(chars[:3755])  # cấp 1 (0xB0-0xD7) đứng trước cấp 2 trong thứ tự duyệt
base = {c: pinyin(c, style=Style.TONE, heteronym=False)[0][0] for c in chars}

words = {}
for w, r in phrases_dict.items():
    if not 2 <= len(w) <= 3 or not all(c in L1 for c in w):
        continue
    cur = [x[0] for x in r]
    if any(base[c] != cur[i] for i, c in enumerate(w) if c not in "一不"):
        words[w] = " ".join(cur)

out = pathlib.Path(__file__).resolve().parent.parent / "src" / "lib" / "hanPinyinData.ts"
out.write_text(
    "// TỆP SINH TỰ ĐỘNG bởi apps/web/scripts/gen-han-pinyin.py (pypinyin). Đừng sửa tay.\n"
    f"export const HAN_CHARS = {';'.join(f'{c}:{p}' for c, p in base.items())!r};\n"
    f"export const HAN_WORDS = {';'.join(f'{w}:{p}' for w, p in words.items())!r};\n",
    encoding="utf-8",
)
print(len(base), "chars,", len(words), "words ->", out)
