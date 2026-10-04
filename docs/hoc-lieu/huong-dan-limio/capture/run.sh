#!/bin/bash
# Chạy một lượt chụp có giới hạn thời gian: ./run.sh <tên-ảnh ...>
# Mật khẩu mẫu đọc từ scratchpad, không in ra.
S=/private/tmp/claude-501/-Users-joynguyen-Code-FeedBackMe/bd4ac9de-f70a-42d5-a254-1ba94d7e569a/scratchpad
cd "$(dirname "$0")"
( DEMO_EMAIL=${DEMO_EMAIL:-giangvien.mau@feedbackme.dev} DEMO_PASSWORD="$(cat $S/demo-pw.txt)" node shoot.mjs "$@" > $S/shoot.out 2>&1 & echo $! > $S/shoot.pid )
for i in $(seq 1 ${WAIT:-45}); do sleep 4; kill -0 $(cat $S/shoot.pid) 2>/dev/null || break; done
pkill -9 -f "shoot.mjs" 2>/dev/null; pkill -9 -f "limio-shot-" 2>/dev/null
cat $S/shoot.out | tail -${TAIL:-8}
