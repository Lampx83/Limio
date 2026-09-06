#!/usr/bin/env bash
#
# Cập nhật 21 bài học của khoá Tiếng Trung Cơ sở III trên production.
#
# Chạy từ gốc repo, SAU KHI đã mở đường hầm SSH ở một cửa sổ khác:
#   ssh -p 8901 -N -L 55432:172.31.4.9:5432 codelab@101.96.66.224
#
#   bash docs/hoc-lieu/tieng-trung-co-so-3/cap-nhat-prod.sh --dry-run   # xem trước
#   bash docs/hoc-lieu/tieng-trung-co-so-3/cap-nhat-prod.sh             # ghi thật
#
# Dừng ngay ở bài đầu tiên lỗi, không chạy tiếp: hỏng giữa chừng mà vẫn chạy
# nốt thì phần sau ghi đè lên một trạng thái không ai còn biết là gì.
set -euo pipefail

DRY="${1:-}"
OWNER="joynguyen7@gmail.com"
DIR="docs/hoc-lieu/tieng-trung-co-so-3"

if [ ! -f "$DIR/bai-22.json" ]; then
  echo "Phải chạy từ gốc repo (thư mục chứa package.json)." >&2
  exit 1
fi

if ! nc -z localhost 55432 2>/dev/null; then
  echo "Chưa thấy đường hầm ở cổng 55432." >&2
  echo "Mở ở cửa sổ khác rồi chạy lại:" >&2
  echo "  ssh -p 8901 -N -L 55432:172.31.4.9:5432 codelab@101.96.66.224" >&2
  exit 1
fi

n=0
run() {  # $1 = số bài (22/23/25/26), $2 = chuỗi khớp tên bài học
  n=$((n + 1))
  printf '\n[%2d/21] bài %s · %s\n' "$n" "$1" "$2"
  pnpm update:lesson:prod -- \
    --file "$DIR/bai-$1.json" --owner "$OWNER" --lesson "$2" $DRY \
    2>&1 | grep -vE '^>|^$|^Tiếng Trung' | sed 's/^/        /'
}

run 22 "课文（一）我看看皮大衣"
run 22 "课文（二）这种一件多少钱"
run 22 "语法（一）动词重叠"
run 22 "语法（二）又"
run 22 "语法（三）一点儿"
run 22 "练习"

run 23 "课文（一）你哪一年大学毕业"
run 23 "课文（二）你的生日是几月几号"
run 23 "语法（一）名词谓语句"
run 23 "语法（二）年、月、日"
run 23 "语法（三）疑问语调"
run 23 "练习"

run 25 "课文（一）我的一天"
run 25 "课文（二）我们七点一刻出发"
run 25 "语法（一）时刻的表达"
run 25 "语法（二）Trật tự"
run 25 "练习"

run 26 "课文 我打算请老师教京剧"
run 26 "注释 是啊"
run 26 "语法 兼语句"
run 26 "练习"

echo
echo "Xong 21 bài."
echo "Còn một việc làm tay: bài 语法（二）Trật tự… của 第二十五课 sẽ có 6 câu hỏi."
echo "Vào UI xoá 2 câu có prompt 'Câu nào ĐÚNG trật tự?' (loại KHÔNG có phần trong ngoặc)."
