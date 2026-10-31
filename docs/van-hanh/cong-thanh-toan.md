# Cổng thanh toán của Limio — hiện trạng và cách cài

> Cập nhật 31/10/2026, theo mã nguồn và kiểm tra trên dev. Phần "Chưa kiểm" ghi rõ chỗ chưa thử với hệ thống thật của nhà cung cấp.

## 1. Hiện trạng

| Kênh | Trạng thái | Ghi chú |
|---|---|---|
| **Mã kích hoạt** (thu tiền ngoài hệ thống: chuyển khoản, tiền mặt, mã in trong sách) | **Chạy được** | Không cần cổng nào. Xem `docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md` (AC2, AC3). |
| **Stripe** (thẻ quốc tế, trang thanh toán của Stripe) | **Có code, chưa cấu hình** | Cần khoá bí mật + webhook. **Xem cảnh báo về tài khoản ở mục 2.** |
| **VNPay** | **Có code (31/10/2026), chưa thử với sandbox thật** | Tạo thanh toán, nhận kết quả IPN, trang quay về, ô cấu hình ở Admin → Tích hợp, nút ở trang khoá. Cài ở mục 4. Chưa có hoàn tiền tự động. |
| **Momo** | **Chưa có code** | Chỉ có ô nhập khoá `momo.secret`. |
| **ZaloPay** | **Chưa có code** | Không có cả ô nhập khoá; enum `PaymentProvider` cũng chưa có `zalopay`. |
| Chuyển khoản QR tự đối soát | Chưa có | Hiện chỉ có mã kích hoạt cho việc này. |

Với nhà xuất bản: **sách có mã in sau bìa không cần cổng nào**; cổng chỉ cần khi người dùng **mua trực tiếp trên Limio**.

## 2. Quyết định trước khi cài: Stripe có dùng được cho pháp nhân Việt Nam không?

Theo tìm kiếm ngày 31/10/2026, **tài khoản Stripe cho doanh nghiệp đăng ký tại Việt Nam có vẻ chưa được hỗ trợ**: trang thuế của Stripe ghi vị trí kinh doanh ở Việt Nam là "không hỗ trợ" (chỉ thu VAT dịch vụ số cho khách ở Việt Nam), và Stripe yêu cầu pháp nhân đăng ký ở đúng quốc gia mở tài khoản. Danh sách quốc gia chính thức nằm ở [stripe.com/global](https://stripe.com/global) — **kiểm ở đó, hoặc hỏi Stripe support, trước khi làm các bước ở mục 3**, vì nếu pháp nhân bán sách là doanh nghiệp Việt Nam thì có thể không mở được tài khoản.

Nguồn: [trang thuế Stripe cho Việt Nam](https://docs.stripe.com/tax/supported-countries/asia-pacific/vietnam), [điều kiện mở tài khoản ở nước khác](https://support.stripe.com/questions/requirements-to-open-a-stripe-account-in-another-country).

Hệ quả thực tế:
- Nếu **không** mở được Stripe: kênh mua trực tiếp ở Việt Nam cần **VNPay và/hoặc Momo** (mục 4), hoặc dùng tạm mã kích hoạt.
- Dù mở được Stripe, `createCheckoutSession` chỉ bật thanh toán `card` (`payment_method_types: ["card"]`), người mua trong nước thường ít dùng thẻ quốc tế.

## 3. Cài Stripe (khi đã có tài khoản)

Mọi bước làm trong **chế độ Test** của Stripe trước, rồi lặp lại với khoá Live.

### 3.1. Lấy khoá bí mật
Stripe Dashboard → Developers → API keys → **Secret key** (`sk_test_...`, sau này `sk_live_...`).

### 3.2. Đưa khoá vào Limio (chọn một trong hai)
- **Qua giao diện:** Admin → Tích hợp (`/admin/integrations`) → "Stripe secret key". Khoá được mã hoá trong DB, cần `SECRETS_MASTER_KEY` đã đặt.
- **Qua biến môi trường:** `STRIPE_SECRET_KEY=sk_...` trong `/etc/feedbackme/.env.prod` (prod) hoặc `apps/web/.env.local` (dev).

Giao diện thắng biến môi trường nếu có cả hai.

### 3.3. Tạo webhook
Stripe Dashboard → Developers → Webhooks → **Add endpoint**:
- **URL:** `https://<tên miền>/api/webhooks/stripe` (thêm `NEXT_PUBLIC_BASE_PATH` vào giữa nếu có đặt). Ví dụ `https://limio.vn/api/webhooks/stripe`.
- **Events cần chọn — đủ ba cái:**
  1. `checkout.session.completed` — thanh toán xong, tự ghi danh.
  2. `checkout.session.expired` — người mua bỏ giữa chừng, đơn chuyển `failed`.
  3. `charge.refunded` — hoàn tiền, tự thu hồi quyền học (AC4). **Thiếu cái này thì hoàn tiền trên Stripe không làm mất quyền học, và không có lỗi nào báo.**
- Sau khi tạo, bấm vào endpoint → **Signing secret** (`whsec_...`).

### 3.4. Đưa khoá ký webhook vào Limio
`STRIPE_WEBHOOK_SECRET=whsec_...` trong `.env.prod`. **Chỉ có đường biến môi trường** (không có ô trong Admin). Thiếu biến này thì webhook trả `503 webhook_not_configured` và người đã trả tiền **không** được ghi danh.

Trên server 224, sau khi sửa `.env.prod`:

```bash
ENV=/etc/feedbackme/.env.prod
COMPOSE="docker compose --env-file $ENV -f docker-compose.prod.yml"
$COMPOSE up -d web
```

(`docker-compose.prod.yml` đã được thêm dòng truyền `STRIPE_WEBHOOK_SECRET` vào container cùng đợt AC4; trước đó biến này không tới được web.)

### 3.5. Bật công tắc thanh toán toàn hệ thống
Admin → Cài đặt → "Bật hệ thống thanh toán". **Tắt thì mọi khoá hiện là "Đăng ký miễn phí" và không có ô nhập mã** (đã thấy trên dev). Khoá bán qua mã kích hoạt cũng cần bật công tắc này.

### 3.6. Đặt giá cho khoá
- **Giá phẳng, vĩnh viễn:** sửa khoá → ô giá (`priceCents`; với VND là số đồng, ví dụ `199000`).
- **Gói theo thời hạn (1 năm, 2 năm, vĩnh viễn):** Admin → Khoá học → chọn khoá → Gói truy cập (`/admin/courses/<id>/access-plans`). Chỉ admin nền tảng tạo / sửa gói.
- Stripe tính VND là tiền không có phần lẻ; mức tối thiểu của Stripe cho một lần thanh toán khoảng tương đương 0,5 USD. Giá quá thấp sẽ bị Stripe từ chối.

### 3.7. Thử trong chế độ Test
Trên máy dev, dùng Stripe CLI để chuyển webhook về máy:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Lệnh in ra `whsec_...` — đặt vào `apps/web/.env.local` làm `STRIPE_WEBHOOK_SECRET`, khởi động lại `next dev`.

1. Vào trang khoá có giá, bấm mua, thanh toán bằng thẻ thử `4242 4242 4242 4242` (hạn và CVC tuỳ ý).
2. **Kỳ vọng:** về `/learn/<khoá>?paid=1` và đã vào được khoá; trong DB `Order.status = 'paid'` và `Order.paymentIntentRef` có giá trị `pi_...`.
3. Trong Stripe Dashboard (Test) → Payments → mở khoản vừa thanh toán → **Refund** toàn bộ.
4. **Kỳ vọng:** `Order.status = 'refunded'`, `Enrollment.status = 'refunded'`, học viên không còn vào được khoá; tiến độ cũ vẫn còn.
5. Thử hoàn **một phần**: đơn vẫn `paid`, quyền giữ nguyên, `Order.refundedCents` ghi số đã hoàn, log máy chủ có dòng `được hoàn MỘT PHẦN`.

Kiểm tra nhanh bằng SQL (dev: `docker exec feedbackme-postgres-1 psql -U feedbackme -d feedbackme -c "..."`):

```sql
SELECT status, "paymentIntentRef", "refundedCents", "refundedAt" FROM "Order" ORDER BY "createdAt" DESC LIMIT 5;
```

### 3.8. Chạy thật (Live)
Lặp lại 3.1–3.4 với khoá Live và endpoint Live (khoá ký webhook của Live khác của Test). Mua một khoá giá thấp bằng thẻ thật của mình rồi **hoàn tiền** để thử cả hai chiều trước khi mở cho khách.

### 3.9. Đơn cũ và hoàn tiền không khớp
Đơn tạo **trước AC4** không có `paymentIntentRef`, nên hoàn tiền của chúng không tự thu hồi quyền. Log máy chủ ghi `charge.refunded ... không khớp đơn nào`. Khi gặp, thu hồi quyền bằng tay: giảng viên mở tab Học viên của khoá và đổi trạng thái ghi danh sang "Đã hoàn tiền".

Xem log: `$COMPOSE logs web | grep "\[stripe\]"`.

## 4. Cài VNPay (đã có code, chưa thử với sandbox thật)

Đặc tả: `docs/tieu-chi/thanh-toan-vnpay.md`. Chỉ VND. **Mua trực tiếp chỉ hiện khi khoá có gói truy cập** (Admin → Khoá học → gói truy cập của khoá); khoá chỉ có giá phẳng vẫn chỉ nhập mã.

### 4.1. Lấy thông tin từ VNPay
Đăng ký môi trường thử (sandbox) của VNPay để nhận **mã website** (`vnp_TmnCode`) và **khoá bí mật** (`vnp_HashSecret`) qua email. Chạy thật thì đăng ký merchant bằng pháp nhân bán sách (giấy tờ doanh nghiệp, tài khoản ngân hàng nhận tiền); VNPay cấp bộ thông tin riêng và địa chỉ thanh toán production.

### 4.2. Nhập vào Limio
Admin → Tích hợp → khung **VNPay**: điền "Mã website", "Khoá bí mật", và "Địa chỉ thanh toán". **Để trống địa chỉ = sandbox** (`https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`); khi chạy thật phải đặt địa chỉ production VNPay cấp. Cần `SECRETS_MASTER_KEY` đã đặt (như Stripe). Có cả mã website và khoá bí mật thì nút VNPay mới hiện.

Không muốn dùng giao diện: biến môi trường `VNPAY_TMN_CODE`, `VNPAY_SECRET`, `VNPAY_PAYMENT_URL` (trong `.env.prod`, và nhớ truyền vào `docker-compose.prod.yml` nếu dùng cách này).

### 4.3. Khai địa chỉ nhận kết quả (IPN) ở cổng quản trị VNPay
`https://<tên miền>/api/webhooks/vnpay` — phải là địa chỉ công khai, có SSL, VNPay gọi bằng `GET`. Địa chỉ người mua quay về thì Limio tự gửi kèm mỗi giao dịch (`/api/payments/vnpay/return`), không cần khai.

Trên máy dev, VNPay không gọi được `localhost`: dùng đường hầm (ngrok, cloudflared) hoặc thử trên máy staging, rồi khai địa chỉ đó làm IPN trong sandbox.

### 4.4. Bật công tắc thanh toán và tạo gói
Như mục 3.5 và 3.6: Admin → Cài đặt → "Bật hệ thống thanh toán", rồi tạo gói truy cập cho khoá (giá VND).

### 4.5. Thử trong sandbox
1. Vào trang khoá có gói → chọn gói → "Thanh toán qua VNPay (ATM, QR, thẻ)".
2. Trên trang VNPay, chọn ngân hàng thử và dùng thẻ thử trong tài liệu sandbox của VNPay (thông tin thẻ, OTP thử do VNPay công bố; kiểm lại ở trang tài liệu của họ vì có thể đổi).
3. **Kỳ vọng:** người mua quay về `/learn/<khoá>?paid=1`; `Order.status = 'paid'`, `Order.gatewayTxnRef` có mã giao dịch VNPay, và đã vào được khoá.
4. Thử **huỷ** ở trang VNPay: về `/catalog/<khoá>?cancelled=1`, `Order.status = 'failed'`, không có quyền.
5. Trong cổng quản trị sandbox của VNPay, xem lịch sử gọi IPN: phải thấy phản hồi `{"RspCode":"00",...}`; nếu thấy `97` thì sai khoá bí mật hoặc cách ký (xem dưới).

```sql
SELECT status, provider, "providerRef", "gatewayTxnRef", "paidAt" FROM "Order" WHERE provider = 'vnpay' ORDER BY "createdAt" DESC LIMIT 5;
```

### 4.6. Khi có lỗi
| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| VNPay báo sai chữ ký ngay khi mở trang thanh toán | Mã website / khoá bí mật sai, hoặc đặc tả ký khác (xem điểm 1 ở "Điểm cần thử" trong `thanh-toan-vnpay.md`; đổi ở hàm `vnpEncode` / `vnpayCanonical` trong `apps/web/src/lib/vnpay.ts`) |
| Thanh toán xong nhưng không vào được khoá | IPN không tới (địa chỉ sai, không công khai, không SSL) hoặc phản hồi `97`/`99`. Xem log: `$COMPOSE logs web | grep "\[vnpay\]"` |
| IPN trả `04` | Số tiền VNPay báo khác `Order.amountCents` × 100. Đơn không đổi; kiểm xem giá gói có bị sửa giữa chừng |
| IPN trả `01` | Không có đơn mang mã giao dịch đó (sai môi trường: IPN của sandbox gọi vào prod hoặc ngược lại) |

### 4.7. Chưa làm với VNPay
- **Hoàn tiền tự động:** hoàn qua cổng quản trị VNPay **không** thu hồi quyền học. Thu hồi bằng tay (mục 3.9).
- **Đối soát chủ động** (`querydr`) khi IPN không tới: đơn kẹt `pending`; xử lý bằng cách đối chiếu cổng quản trị VNPay rồi đổi trạng thái ghi danh bằng tay.
- Đơn `pending` bị bỏ lại không tự dọn.

## 5. Momo, ZaloPay và phần còn thiếu của VNPay

> VNPay đã làm xong các việc 1–3 và 5–6 ở mục 5.2 (tạo giao dịch, IPN, trang quay về, giao diện, khoá cấu hình); mục 4 ở trên là hướng dẫn dùng. Còn lại cho VNPay: hoàn tiền tự động và đối soát chủ động. Momo và ZaloPay chưa có gì.

Phần này là kế hoạch, **chưa kiểm với tài liệu chính thức hiện hành** của hai bên; đối chiếu trước khi code.

### 5.1. Phía doanh nghiệp (không làm được bằng code)
- Đăng ký merchant với từng cổng bằng pháp nhân bán sách: giấy tờ doanh nghiệp, tài khoản ngân hàng nhận tiền, website bán hàng, chính sách hoàn tiền. Thời gian duyệt thường tính bằng tuần.
- Trong lúc chờ, cả hai đều có **môi trường thử (sandbox)** cấp thông tin test; Limio có thể được làm xong trên sandbox.
- **VNPay** cấp mã website `vnp_TmnCode`, khoá bí mật `vnp_HashSecret`, địa chỉ thanh toán; địa chỉ nhận kết quả (IPN) cấu hình ở cổng quản trị của VNPay. Tài liệu: `sandbox.vnpayment.vn/apis/docs/huong-dan-tich-hop/`.
- **Momo** cấp `partnerCode`, `accessKey`, `secretKey`; có `ipnUrl` và `redirectUrl` truyền khi tạo giao dịch.

### 5.2. Phía Limio (việc phải xây, mỗi cổng một cụm)
Dùng chung `Order` và `extendEnrollmentAccess` đã có (cấp quyền, gia hạn, thu hồi giống Stripe):

1. **Tạo giao dịch:** endpoint tạo `Order` (`provider: vnpay | momo`, `status: pending`, `providerRef` = mã giao dịch của mình) và trả URL chuyển hướng sang cổng, ký bằng khoá bí mật (VNPay: HMAC-SHA512 trên tham số đã sắp xếp; Momo: HMAC-SHA256).
2. **IPN (webhook):** endpoint công khai nhận kết quả, **kiểm chữ ký**, đối chiếu số tiền với `Order.amountCents`, rồi mới đánh dấu `paid` và gọi `extendEnrollmentAccess`. Phải **idempotent** (cổng có thể gửi lại cùng giao dịch) và trả đúng mã phản hồi cổng yêu cầu.
3. **Trang quay về (return URL):** chỉ để hiển thị kết quả cho người mua; **không** cấp quyền ở đây, chỉ cấp ở IPN.
4. **Hoàn tiền:** cả hai có API hoàn tiền riêng; muốn thu hồi quyền tự động cần gọi nó từ Limio rồi dùng lại logic của `processChargeRefund` (tách phần không phụ thuộc Stripe ra khỏi tên hàm khi đó).
5. **Giao diện:** `EnrollButton` hiện chỉ có nút thanh toán thẻ Stripe; cần chọn cổng ở bước mua.
6. Đưa `vnpay.secret` / `momo.secret` đã có trong Admin → Tích hợp vào dùng, thêm các giá trị còn thiếu (mã website, partnerCode...).

Đề xuất làm **VNPay trước** (phủ thẻ nội địa, QR ngân hàng, thẻ quốc tế), Momo sau nếu có nhu cầu ví.

### 5.3. So sánh VNPay và ZaloPay (ZaloPay chưa có code)

Cả hai cùng một kiến trúc nên làm chung một khung rồi cắm từng cổng vào:

| | VNPay | ZaloPay |
|---|---|---|
| Người mua trả bằng | thẻ ATM nội địa, QR ngân hàng, thẻ quốc tế, app ngân hàng | ví ZaloPay, thẻ / tài khoản liên kết ví |
| Thông tin Limio cần | `vnp_TmnCode`, `vnp_HashSecret`, địa chỉ thanh toán | `app_id`, `key1`, `key2`, địa chỉ tạo đơn |
| Ký yêu cầu tạo đơn | HMAC-SHA512 | HMAC-SHA256 bằng `key1` |
| Kiểm kết quả server-to-server | IPN, ký bằng khoá bí mật | callback, ký bằng **`key2`** (khác `key1`) |
| Môi trường thử | sandbox đăng ký công khai, nhận mã qua email | sandbox có khoá mẫu công khai |
| Tiền tệ | chỉ VND (số tiền gửi nhân 100) | chỉ VND |
| Hoàn tiền | qua cổng quản trị hoặc API riêng; **không tự động** | qua API riêng; **không tự động** |

Điều **không đổi** so với Stripe: cấp quyền chỉ ở bước nhận kết quả từ cổng (IPN / callback), không bao giờ ở trang người mua quay về; đối chiếu số tiền với `Order.amountCents`; xử lý idempotent.

Khác Stripe, người dùng của hai cổng này **không nhập thẻ trên trang của Limio hay Stripe** mà bị chuyển sang trang / app của cổng. Điều đó không cần thay đổi gì ở phía học viên ngoài nút "Mua".

**Cần làm trong code (một lần, dùng chung):**
1. Thêm giá trị `zalopay` vào enum `PaymentProvider` (migration), và đổi tên cột `Order.paymentIntentRef` thành khoá giao dịch trung tính hoặc thêm cột tương ứng cho từng cổng (hiện cột đó là của Stripe).
2. Tách khỏi `createCheckoutSession` phần chọn cổng: `/api/orders/checkout` nhận `provider`; `EnrollButton` hiện lựa chọn ở bước mua.
3. Mỗi cổng một route nhận kết quả (`/api/webhooks/vnpay`, `/api/webhooks/zalopay`), mỗi cổng có test chữ ký đúng / sai / số tiền lệch / gửi lại.
4. Hoàn tiền: tách phần "đóng quyền học" của `processChargeRefund` thành hàm không phụ thuộc Stripe; cho tới khi có API hoàn tiền của từng cổng, hoàn tiền xử lý bằng tay (mục 3.9) — **quyền học không tự mất**.

**Điều tôi cần từ thầy để bắt đầu**, vì không viết code thu tiền mà không chạy thử được với cổng:
- Thông tin sandbox của cổng chọn trước (VNPay: mã website + khoá bí mật; ZaloPay: `app_id`, `key1`, `key2`).
- Một địa chỉ công khai để cổng gọi về khi thử (dev dùng đường hầm kiểu ngrok / cloudflared, hoặc thử trên một máy chủ staging).
- Chốt **cổng nào trước**. Đề xuất VNPay trước: một cổng phủ nhiều cách trả nhất (thẻ nội địa, QR, thẻ quốc tế); ZaloPay làm sau nếu thấy người mua của nhà xuất bản dùng ví nhiều.

Nguồn đã tham khảo (chưa đối chiếu từng trường với tài liệu hiện hành): [tài liệu ZaloPay](https://docs.zalopay.vn/en/v2/general/overview.html), hướng dẫn tích hợp VNPay trên [viblo.asia](https://viblo.asia/p/nodejs-tich-hop-vnpay-thuc-chien-tu-khoi-tao-den-khi-ting-ting-tai-khoan-production-oKLnqKrgJQO). Trước khi code phải đọc lại tài liệu chính thức: tài liệu ZaloPay có nhiều phiên bản dùng địa chỉ và quy ước khoá khác nhau.

### 5.4. Phương án tạm không cần cổng
Đến khi có cổng: bán qua **mã kích hoạt** (người mua chuyển khoản, giảng viên / nhà xuất bản gửi mã) và **mã in trong sách**. Đã hoạt động, có thời hạn và theo lô.

## 6. Danh sách kiểm trước khi mở bán

- [ ] Đã xác nhận pháp nhân bán sách mở được tài khoản Stripe, hoặc đã chọn VNPay (mục 4).
- [ ] `STRIPE_WEBHOOK_SECRET` có trong `.env.prod` và web đã khởi động lại.
- [ ] Endpoint webhook có đủ ba sự kiện (mục 3.3); Stripe Dashboard → endpoint → "Recent deliveries" thấy 200.
- [ ] Công tắc thanh toán toàn hệ thống đã bật.
- [ ] Đã thử mua và hoàn tiền một khoá bằng thẻ thật ở chế độ Live.
- [ ] Biết cách thu hồi quyền bằng tay cho hoàn tiền không khớp (mục 3.9) và cho hoàn tiền VNPay (mục 4.7).
- [ ] Nếu dùng VNPay: đã thử một thanh toán thành công và một thanh toán huỷ trong sandbox, thấy IPN phản hồi `00`; địa chỉ production đã đặt.
