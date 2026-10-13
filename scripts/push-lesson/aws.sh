#!/usr/bin/env bash
# Đẩy "Bài 2.5" lên AWS (limio.hust.edu.vn). Chạy từ bất kỳ đâu:  bash scripts/push-lesson/aws.sh
# Đổi bài:  LESSON="Bài 2.4" EXPECT_ID_PREFIX=19240f92 bash scripts/push-lesson/aws.sh
LABEL="AWS limio.hust.edu.vn"
SSH_HOST="ubuntu@54.79.192.182"
SSH_PORT=22
SSH_KEY="${SSH_KEY:-$HOME/Desktop/Key aws/limio key.pem}"
OWNER="huyen.nguyenthi2@hust.edu.vn"   # chủ khoá trên AWS (joynguyen7 bị forbidden)
LOCAL_PORT=55433
EXPECT_ID_PREFIX="${EXPECT_ID_PREFIX:-6952d351}"   # id Bài 2.5 trên AWS
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
