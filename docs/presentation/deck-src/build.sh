#!/bin/bash
# Ghép nguồn thành trang tĩnh apps/web/public/gioi-thieu/index.html (chạy từ bất kỳ đâu).
D="$(cd "$(dirname "$0")" && pwd)"
OUT="$D/../../../apps/web/public/gioi-thieu"
mkdir -p "$OUT/img" "$OUT/video"
{ cat "$D/head.html" "$D/shell.css" "$D/shell2.css" "$D/mid.html" "$D/qrcode.min.js" "$D/shell.js" "$D/shell2.js" "$D/mid2.html"; for f in $(ls "$D"/slides/s*.html | sort); do cat "$f"; echo; done; cat "$D/tail.html"; } > "$OUT/index.html"
cp "$D"/img/*.jpg "$OUT/img/"
echo "built $(wc -c < "$OUT/index.html") bytes"
