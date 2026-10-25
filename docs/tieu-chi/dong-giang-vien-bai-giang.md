# Đồng giảng viên của bài giảng Limio-Live — tiêu chí chấp nhận

> Đã chốt 25/10/2026 (thêm bằng email tài khoản đã có; quyền như AC2; không tự thêm đồng giảng viên của khoá). Đã làm xong và thử trên dev, chờ duyệt. Liên quan `nghe-giang-slide.md` (bài giảng slide của bài học).

## Vì sao làm

Bài giảng Limio-Live hiện chỉ có **một chủ** (`LiveDeck.userId`): mọi trang và API (trình soạn, trình chiếu, dàn ý, lịch sử, chia sẻ…) chỉ mở cho
người đó. Với bài giảng gắn vào bài học, chủ khoá và đồng giảng viên cùng dạy một khoá nhưng chỉ người tạo mở được bài giảng; người còn lại chỉ xem
được slideshow. Cho phép **thêm đồng giảng viên vào bài giảng** để cùng soạn và cùng chiếu.

## Đề xuất (chờ bạn chốt các điểm có dấu ❓)

### AC1 — Thêm / gỡ đồng giảng viên
- Trong trình soạn bài giảng có nút **"Đồng giảng viên"** (cạnh Chia sẻ) mở hộp: danh sách người đang có quyền (chủ + đồng giảng viên) và ô thêm bằng **email**.
- ❓ Người được thêm phải là **tài khoản đã có** và có quyền dùng Limio-Live; email chưa có tài khoản thì báo "chưa có tài khoản", **không** gửi thư mời.
- Chỉ **chủ bài giảng** thêm, gỡ đồng giảng viên; đồng giảng viên tự rời được.
- Mọi lần thêm / gỡ ghi sự kiện (`live.deck.collaborator_added`, `live.deck.collaborator_removed`), payload chỉ mang id.

### AC2 — Đồng giảng viên làm được gì
- **Được:** mở và sửa slide, dàn ý, tạo / chỉnh slide bằng AI, trình chiếu (bắt đầu phiên), xem kết quả và lịch sử phiên, nhân bản về tài khoản của mình.
- **Không:** xoá bài giảng, tạo / đổi / tắt link chia sẻ, đổi nhóm, thêm / gỡ đồng giảng viên khác, chuyển quyền chủ.
- ❓ Token AI khi đồng giảng viên bấm tạo / chỉnh slide tính vào **ví của người bấm** (như mọi thao tác AI hiện nay).

### AC3 — Hiện ở đâu
- Trang danh sách Limio-Live có mục **"Được chia sẻ với tôi"** liệt kê bài giảng mình là đồng giảng viên, kèm tên chủ; thẻ có nhãn "Đồng giảng viên".
- Trong trình soạn, đầu trang ghi "Bài giảng của {tên chủ}" khi người xem không phải chủ.

### AC4 — Bài giảng gắn bài học (nghe-giang-slide.md)
- Chủ khoá và đồng giảng viên của **khoá** cùng dùng nút "Slide" của bài: bài giảng gắn với bài học mà người bấm là chủ **hoặc đồng giảng viên** thì mở được "Xem slide để dạy" và "Mở trình soạn".
- ❓ **Tự thêm**: khi chủ bài giảng gắn nó vào một bài học, các đồng giảng viên của khoá có được tự động thành đồng giảng viên của bài giảng không? (Đề xuất: **không tự động**, vì thêm người là quyết định riêng; nút Slide gợi ý "Thêm đồng giảng viên của khoá".)
- Chọn bài giảng có sẵn để gắn: liệt kê bài giảng mình là chủ **hoặc** đồng giảng viên.

### AC5 — Quyền và riêng tư
- Mọi route và trang Limio-Live kiểm quyền qua một hàm chung (chủ hoặc đồng giảng viên); không còn kiểm `userId` rải rác.
- Đồng giảng viên **không** đọc được `sourceText` gốc nếu chủ không cho? ❓ (Đề xuất: đọc được, vì AI soạn lại cần nguồn.)
- Xoá bài giảng hoặc xoá tài khoản chủ: đồng giảng viên mất quyền, không để lại bản treo.

### AC6 — Kiểm thử
- Test quyền cho từng nhóm thao tác (chủ, đồng giảng viên, người ngoài), gồm API sửa slide, dàn ý, trình chiếu, chia sẻ, xoá.
- Test sự kiện thêm / gỡ; test "Được chia sẻ với tôi"; test gắn vào bài học với bài giảng của đồng giảng viên.

## Phạm vi code (ước lượng)
- Bảng mới `LiveDeckCollaborator` (deckId, userId, addedBy, createdAt; duy nhất theo cặp).
- Hàm kiểm quyền chung trong `core-lms/live` thay các kiểm `deck.userId === userId` ở ~10 route / trang và các hàm `decks.ts`, `present.ts`, `history.ts`, `share.ts`.
- Giao diện: hộp "Đồng giảng viên", mục "Được chia sẻ với tôi", nhãn.

## Điểm cần bạn chốt
1. Thêm bằng email, chỉ tài khoản đã có (đề xuất) — đồng ý?
2. Quyền của đồng giảng viên như AC2 (sửa, chiếu, xem kết quả; không xoá, không đổi chia sẻ) — đồng ý?
3. Không tự động thêm đồng giảng viên của khoá vào bài giảng khi gắn bài học (AC4) — đồng ý?
