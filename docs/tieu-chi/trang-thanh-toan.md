# Trang thanh toán riêng — Acceptance criteria

> Bản nháp 25/11/2026. Lý do: khối thanh toán (gói, cổng, mã kích hoạt, hướng dẫn chuyển khoản) nhồi vào thanh dưới cùng / thẻ bên của trang khoá nên chật, dễ thao tác nhầm trên điện thoại, và không có địa chỉ riêng để quay lại sau khi cổng thanh toán đưa người mua về. Trang riêng giải quyết cả ba.

## Phạm vi

- **Có:** `/checkout/<slug khoá>` và `/checkout/combo/<slug combo>`; các nút mua ở trang khoá, trang combo, banner "chưa đăng ký" chuyển thành "Mua ngay" dẫn sang trang này.
- **Không đổi:** cách tạo đơn (`/api/orders/checkout`), cổng thanh toán, IPN, cấp quyền, đổi mã (`/api/redeem-code`). Quyền học vẫn chỉ do IPN / đổi mã cấp, trang thanh toán không bao giờ cấp quyền.
- **Chưa làm:** giỏ nhiều mục; mã giảm giá; hoá đơn.

## AC1 — Trang thanh toán khoá

- **Given** khoá đã xuất bản, có phí (có gói truy cập đang bán hoặc giá phẳng), thanh toán bật, **When** mở `/checkout/<slug>`, **Then** thấy hai khối: **Tóm tắt đơn** (bìa, tên khoá, số module/bài, giá gốc gạch ngang + `-%` + giá bán của gói đang chọn, thời hạn truy cập) và **Thanh toán** (chọn gói nếu có nhiều gói; mỗi cổng đã cấu hình một nút; ô "Đã có mã kích hoạt?"; hướng dẫn chuyển khoản khi chưa có cổng nào).
- **Given** chưa đăng nhập, **Then** chuyển tới `/signin?callbackUrl=/checkout/<slug>` rồi quay lại đúng trang.
- **Given** đã có quyền học **vô thời hạn**, **Then** chuyển thẳng tới `/learn/<slug>` (không bán lại). **Given** quyền học **có hạn** còn hiệu lực, **Then** vẫn vào trang để **gia hạn**: khung tóm tắt ghi "Bạn đang gia hạn khoá này", hạn hiện tại, và thời hạn gói mua thêm được cộng dồn vào hạn đó (đường cấp quyền cũ `extendEnrollmentAccess`).
- **Given** khoá miễn phí, thanh toán tắt, khoá chưa xuất bản / không có, hoặc chỉ mời (`invite_only`), **Then** về `/catalog/<slug>` (khoá không có → 404).
- Trang không đánh chỉ mục (`noindex`).
- Mở `/checkout/<slug>#ma-kich-hoat` đưa tới ô nhập mã.

## AC2 — Trang thanh toán combo

- **Given** combo đã xuất bản và mua được (mọi khoá xuất bản), **When** mở `/checkout/combo/<slug>`, **Then** thấy **Tóm tắt** (bìa các khoá, tên combo, "Gồm n khoá", giá gốc/`-%`/giá combo, "Tiết kiệm … so với mua lẻ", thời hạn, ghi chú "đã có k/n khoá, mua sẽ gia hạn") và **Thanh toán** (nút theo cổng; ô mã kích hoạt combo; hướng dẫn chuyển khoản khi chưa có cổng).
- Chưa đăng nhập → `/signin?callbackUrl=/checkout/combo/<slug>`. Combo nháp hoặc không có → 404 (admin xem được bản nháp, không mua được); combo chưa mua được → về `/combo/<slug>`.

## AC3 — Nút mua ở nơi khác

- **Trang khoá** (thanh dưới cùng trên điện thoại, thẻ bên, banner "chưa đăng ký"): khoá có phí chỉ còn nút **Mua ngay** → `/checkout/<slug>` và liên kết "Đã có mã kích hoạt?" → `/checkout/<slug>#ma-kich-hoat`; không còn danh sách gói, nút cổng, ô mã ở các chỗ này. Khoá miễn phí và nút "Vào học" giữ nguyên.
- **Trang combo**: khối giá giữ nguyên, nút **Mua trọn bộ** → `/checkout/combo/<slug>`; ô mã và nút cổng chuyển sang trang thanh toán.
- Mọi chỗ đăng nhập lại (401) quay về trang thanh toán đang dùng, không về trang khoá.

## AC4 — Sau thanh toán

- Cổng VNPay / SePay đưa người mua về như cũ (`/api/payments/*/return`, chỉ chuyển hướng); khung QR chuyển khoản hiện ngay trên trang thanh toán và tự chuyển tới khoá khi tiền về.

## AC5 — Học viên xem được hạn truy cập

- **Khoá học của tôi** (`/me/enrollments`): mỗi thẻ khoá **có đặt hạn sử dụng** có nhãn rõ **"Hạn sử dụng: dd/mm/yyyy"** kèm "Còn n ngày"; khoá **không giới hạn thời gian thì không hiện gì** (không có gì để nhắc). Còn **30 ngày trở xuống** (cùng ngưỡng nhắc qua email) thì đổi màu cảnh báo; hạn trong ngày ghi "hết hạn hôm nay".
- **Trang khoá của người học** (`/learn/<slug>`): cùng khối đó trong banner, chỉ khi quyền có hạn; khi quyền **có hạn**, thanh toán bật và khoá **có gói đang bán** thì có nút **Gia hạn** → `/checkout/<slug>`. Quyền vô thời hạn không có khối hạn và không có nút.
- Chỉ đọc dữ liệu ghi danh đã có; không đổi cách tính hạn hay cấp quyền. Hạn tính theo giờ Việt Nam.
- Test: `lib/accessExpiry.test.ts` (ngưỡng, làm tròn, hạn đã qua), `lib/checkoutGate.test.ts` (quyền có hạn được gia hạn, vô thời hạn thì không).

## Cách kiểm

- Test web: nhánh "Mua ngay" của `EnrollButton` (dẫn đúng địa chỉ, không có ô mã/nút cổng ở chế độ gọn; chế độ thanh toán vẫn đủ); hàm quyết định chuyển hướng của trang thanh toán (`checkoutRedirect`).
- Xem bằng mắt trên máy xem trước: khoá có gói, khoá giá phẳng, combo, điện thoại.
