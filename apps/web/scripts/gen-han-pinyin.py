#!/usr/bin/env python3
"""
Sinh `src/lib/hanPinyinData.ts`: bảng pinyin dùng để đặt pinyin dưới chữ Hán của phương án / ngân hàng từ trong Bài luyện
(những chỗ dữ liệu câu hỏi không có pinyin tác giả viết). Không thêm thư viện vào web: bảng sinh sẵn từ pypinyin.

  - CHARS: 6763 chữ GB2312 (cấp 1 + 2), mỗi chữ một âm mặc định.
  - WORDS: từ 2-3 chữ thông dụng (cấp 1) có âm KHÁC cách đọc từng chữ (银行 yín háng, 觉得 jué de, 着急 zháo jí…), để xử lý chữ đa âm theo từ.
    Phần đổi thanh của 一 / 不 làm bằng luật trong hanPinyin.ts nên không đưa vào bảng.

  - Bảng từ chuẩn HSK 3.0 (cột Pinyin của hsk30.csv, cấp 1–6) GHI ĐÈ pypinyin: đó là cách ghi của sách chuẩn (thanh nhẹ không dấu: péngyou, dōngxi, xǐhuan, shíhou;
    儿化 viết r: nǎr, wánr, yīdiǎnr; 一 / 不 giữ thanh gốc trong bảng, đổi thanh do luật trong hanPinyin.ts).

Chạy: python3 apps/web/scripts/gen-han-pinyin.py [đường-dẫn/hsk30.csv]   (cần `pip install pypinyin`)
  hsk30.csv mặc định: ~/Documents/Limio/hsk4-goc/hsk30.csv (cột Simplified, Pinyin, Level); không có tệp thì chỉ dùng pypinyin.
"""
import csv, os, re, sys, unicodedata
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

# ---- bảng chuẩn HSK 3.0 ghi đè
def strip_tone(sy):
    return "".join(c for c in unicodedata.normalize("NFD", sy) if unicodedata.category(c) != "Mn").replace("ü", "u").replace("v", "u")
from pypinyin.pinyin_dict import pinyin_dict
SYL = set()
for v in pinyin_dict.values():
    for sy in v.split(","):
        SYL.add(unicodedata.normalize("NFC", sy.lower()))
        SYL.add(unicodedata.normalize("NFC", re.sub(r"[\u0300-\u0304\u030c]", "", unicodedata.normalize("NFD", sy.lower()))))
SYL.discard("")
MAXSYL = max(map(len, SYL))

def split_syl(s, n):
    """Tách chuỗi pinyin liền (không dấu cách) thành đúng n âm tiết; None nếu không tách được."""
    s = unicodedata.normalize("NFC", s)
    memo = {}
    def go(i, k):
        if k == 0: return [] if i == len(s) else None
        if (i, k) in memo: return memo[(i, k)]
        r = None
        for j in range(min(len(s), i + MAXSYL), i, -1):
            if s[i:j] in SYL:
                rest = go(j, k - 1)
                if rest is not None: r = [s[i:j]] + rest; break
        memo[(i, k)] = r
        return r
    return go(0, n)

std = {}
csv_path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Documents/Limio/hsk4-goc/hsk30.csv")
if os.path.exists(csv_path):
    for row in csv.DictReader(open(csv_path, encoding="utf-8")):
        han, py, lv = row.get("Simplified", ""), row.get("Pinyin", ""), row.get("Level", "")
        if not (2 <= len(han) <= 4) or lv not in {"1", "2", "3", "4", "5", "6"} or han in std: continue
        if not all(c in L1 or c == "儿" for c in han) or not py: continue
        py = py.split("/")[0].strip().lower()
        parts = [x for x in re.split(r"[\s'’]+", py) if x]
        n = len(han)
        # 儿化: pinyin kết thúc bằng 'r' đứng riêng ứng với chữ 儿 cuối (nǎr, nánháir); 儿 là âm tiết thật (nǚ'ér, érzi) thì giữ ér
        er_final = han.endswith("儿") and py.endswith("r") and not re.search(r"['’][eēéěè]r$", py)
        body = "".join(parts)
        if er_final:
            sy = split_syl(body[:-1], n - 1)
            if sy is None: continue
            sy = sy + ["r"]
        else:
            sy = split_syl(body, n)
            if sy is None: continue
        std[han] = " ".join(sy)
words.update(std)
# 都会 (đô thị, dū huì) hiếm hơn nhiều 都会 = "đều sẽ" (我们都会去): bỏ khỏi bảng để 都 chọn âm theo ngữ cảnh trong hanPinyin.ts
for w in ("都会", "大都会"):
    words.pop(w, None)
print(len(std), "từ chuẩn HSK ghi đè")

out = pathlib.Path(__file__).resolve().parent.parent / "src" / "lib" / "hanPinyinData.ts"
out.write_text(
    "// TỆP SINH TỰ ĐỘNG bởi apps/web/scripts/gen-han-pinyin.py (pypinyin). Đừng sửa tay.\n"
    f"export const HAN_CHARS = {';'.join(f'{c}:{p}' for c, p in base.items())!r};\n"
    f"export const HAN_WORDS = {';'.join(f'{w}:{p}' for w, p in words.items())!r};\n",
    encoding="utf-8",
)
print(len(base), "chars,", len(words), "words ->", out)
