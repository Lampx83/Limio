#!/usr/bin/env bash
# Đẩy "Bài 2.5" lên server 224 (limio.vn). Chạy:  bash scripts/push-lesson/server-224.sh
# SSH sẽ hỏi mật khẩu của codelab MỘT lần (không lưu trong file).
# Đổi bài:  LESSON="Bài 2.4" EXPECT_ID_PREFIX=db66c8ed bash scripts/push-lesson/server-224.sh
LABEL="224 limio.vn"
SSH_HOST="codelab@101.96.66.224"
SSH_PORT=8901
OWNER="joynguyen7@gmail.com"
LOCAL_PORT=55434
EXPECT_ID_PREFIX="${EXPECT_ID_PREFIX:-56705477}"   # id Bài 2.5 trên 224
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
