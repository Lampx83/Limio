# Growth attribution & luồng sự kiện cho SIM

Hệ thống giám sát SIM (ứng dụng ASP.NET riêng) kéo về các sự kiện phễu **ẩn danh** của Limio để quy
signup / kích hoạt / thanh toán về kênh marketing. Limio chỉ làm hai việc: **ghi nhận nguồn đến của
người dùng lúc đăng ký** (first touch) và **mở một endpoint chỉ-đọc, có ký** để SIM kéo sự kiện.

Mặc định **tắt hoàn toàn**: cùng một đoạn code chạy ở nhiều server (limio.vn, limio.hust.edu.vn…),
chỉ nơi đặt biến môi trường mới có hiệu lực.

## 1. Biến môi trường

| Biến | Tác dụng | Khi thiếu |
|---|---|---|
| `GROWTH_ATTRIBUTION_ENABLED` | `true` ⇒ middleware đặt cookie `limio_attr` và đăng ký lưu `AcquisitionTouch` | Tắt: không cookie, không ghi DB |
| `GROWTH_EVENTS_SECRET` | Khoá HMAC (>= 32 ký tự) dùng chung với SIM để ký request | Endpoint trả `404` |
| `GROWTH_ANON_SECRET` | Khoá HMAC (>= 32 ký tự) làm ẩn danh id; **không** chia sẻ với SIM | Endpoint trả `404` |

Khai ở `.env.prod.example` / `docker-compose.prod.yml` (compose chỉ truyền biến đã khai). Sinh khoá:
`openssl rand -hex 32`. **Không đổi `GROWTH_ANON_SECRET` sau khi SIM đã nhận sự kiện** — mọi `anonId`
sẽ đổi và SIM không còn nối được người cũ với sự kiện mới.

Cờ attribution và endpoint độc lập nhau: endpoint chỉ cần hai khoá; cờ chỉ điều khiển việc *thu thập*
nguồn. Bật endpoint mà tắt cờ ⇒ SIM vẫn nhận sự kiện, `source` toàn `null`.

## 2. Cookie first-touch `limio_attr`

Đặt bởi `apps/web/src/middleware.ts` (logic thuần ở `apps/web/src/lib/growth/attribution.ts`).

Đặt cookie khi **đồng thời**:

- request là `GET` điều hướng trang — bỏ `/api`, `/_next`, `/favicon*`, `/.well-known`, file có đuôi,
  prefetch của Next, và sub-resource (`Sec-Fetch-Dest` khác `document`);
- chưa có cookie `limio_attr` hợp lệ (first touch wins — không bao giờ ghi đè);
- URL có `utm_source|utm_medium|utm_campaign|utm_content|utm_term` (có giá trị) hoặc `fbclid|gclid|ttclid`
  (có giá trị), **hoặc** có `Referer` ngoài site (khác host của site; bỏ qua luồng đăng nhập Google/Microsoft
  và cổng thanh toán Stripe/VNPay/MoMo để không biến người dùng trực tiếp thành "referrer = accounts.google.com").

Giá trị = base64url(JSON): `{ s, m, c, ct, t, k, p, r, at }` = utm_source/medium/campaign/content/term,
loại click id (`fbclid|gclid|ttclid|null`), đường dẫn trang đích, host referrer, epoch giây.

Thuộc tính: `HttpOnly; SameSite=Lax; Path=/; Max-Age=7776000` (90 ngày), `Secure` khi https
(`X-Forwarded-Proto`).

Làm sạch: mọi chuỗi trim → lower-case → bỏ ký tự điều khiển → chỉ giữ `[a-z0-9 _.\-:/+%]` → cắt 100 ký
tự. **Không lưu giá trị click id** (chỉ loại). `landingPath` chỉ là pathname (không query/hash), tối đa
200 ký tự, và **chỉ giữ đoạn đầu** trừ `/catalog`, `/learn`, `/p` (giữ 2 đoạn); đoạn trông như
uuid/token/mã dài bị che thành `:id` — vì `/join/<mã mời>`, `/verify/<token>`, `/enroll/<mã>` là bí mật.

Cookie là dữ liệu client kiểm soát nên luôn bị **sanitise lại** khi đọc ở server.

## 3. Bảng `AcquisitionTouch`

Một dòng / user (`userId` PK, FK `User` ON DELETE CASCADE — xoá user là xoá dòng):
`utmSource, utmMedium, utmCampaign, utmContent, utmTerm, clickIdKind, landingPath, referrerHost`
(đều nullable), `firstSeenAt` (lúc cookie được tạo), `createdAt`.

Ghi ở:

- `POST /api/auth/register` — ngay sau `registerUser` (đăng ký bằng mật khẩu);
- NextAuth `signIn` callback (đăng ký qua Google/Microsoft) — `loginOrLinkSso` không báo user mới hay
  cũ nên chỉ ghi khi tài khoản được tạo trong vòng 120 giây.

Cả hai đường **best-effort**: không bao giờ throw, không làm gì khi cờ tắt / không có cookie / cookie
hỏng, và `upsert` với `update: {}` (first touch wins).

Migration `20261011000000_acquisition_touch` còn thêm 4 index để phân trang luồng sự kiện không quét
bảng: `User(emailVerifiedAt)`, `Enrollment(enrolledAt)`, `Order(paidAt)`, `Order(refundedAt)`.

## 4. Endpoint `GET /api/internal/growth/events`

Chỉ đọc (không write nào trên route), `Cache-Control: no-store`, tắt (404) khi thiếu hai khoá.

### Xác thực

Header bắt buộc:

- `X-Growth-Timestamp`: unix giây, lệch tối đa ±300 giây so với giờ server.
- `X-Growth-Signature`: hex **chữ thường** của
  `HMAC-SHA256(key = GROWTH_EVENTS_SECRET, message = "${timestamp}\n${METHOD}\n${pathname}\n${rawQuery}")`
  với `METHOD` chữ hoa, `pathname` đúng như gửi (`/api/internal/growth/events`), `rawQuery` là query
  string thô **không có `?`** (rỗng nếu không có). So sánh bằng `timingSafeEqual`.

Test vector (có trong `signature.test.ts`; bản C# của SIM phải khớp):

```
secret    = 0123456789abcdef0123456789abcdef
timestamp = 1760000000
message   = "1760000000\nGET\n/api/internal/growth/events\nlimit=2"
signature = 33a0b1d85ebfbf001f1df0a199546c805e2c82e3bf9ec6f7eb1e311c8061eb57
```

Thiếu/sai/hết hạn ⇒ `401`. Giới hạn 60 request/phút (Redis; fail-open khi Redis lỗi) ⇒ `429` + `Retry-After`.

### Query

| Tham số | Ý nghĩa |
|---|---|
| `cursor` | Mờ đục, dạng `<ISO-8601 ms Z>\|<eventId>`; vắng = từ đầu. Sai định dạng ⇒ `400` |
| `limit` | Nguyên 1..500, mặc định 200. Ngoài khoảng ⇒ `400` |
| `types` | Danh sách phẩy; mặc định tất cả; loại lạ ⇒ `400` |

### Sự kiện (allow-list)

| `type` | Thời điểm | `eventId` |
|---|---|---|
| `user.registered` | `User.createdAt` | `user.registered:<anonId>` |
| `user.email_verified` | `User.emailVerifiedAt` (khác null) | `user.email_verified:<anonId>` |
| `enrollment.created` | `Enrollment.enrolledAt` của lần ghi danh **đầu tiên** của user | `enrollment.created:<anonId>` |
| `activity.first_recorded` | `LearningEvent` sớm nhất có type `lesson.*` hoặc `quiz.*` của user | `activity.first_recorded:<anonId>` |
| `order.paid` | `Order.paidAt` (khác null); `amountMinor = Order.amountCents` nguyên văn, `currency = Order.currency` | `order.paid:<16 hex>` |
| `order.refunded` | `Order.refundedAt` (khác null); cùng amount/currency | `order.refunded:<16 hex>` |

`anonId` = 32 ký tự hex đầu của `HMAC-SHA256(GROWTH_ANON_SECRET, userId)`; 16 hex của order =
`HMAC-SHA256(GROWTH_ANON_SECRET, orderId)`. Mọi sự kiện của một user mang `source` lấy từ
`AcquisitionTouch` của user đó (toàn `null` nếu không có).

### Phản hồi 200

```json
{
  "events": [{
    "eventId": "user.registered:<anonId>", "type": "user.registered",
    "occurredAt": "2026-10-11T03:12:44.000Z", "anonId": "<32 hex>",
    "source": { "utmSource": null, "utmMedium": null, "utmCampaign": null, "utmContent": null,
                "utmTerm": null, "clickIdKind": null, "landingPath": null, "referrerHost": null },
    "amountMinor": null, "currency": null
  }],
  "nextCursor": "<cursor kế tiếp, hoặc chính cursor đã gửi nếu không có sự kiện (null nếu cũng không gửi)>",
  "hasMore": false,
  "coverage": { "registered": 0, "registeredWithSource": 0 }
}
```

`coverage` chỉ đếm trong trang trả về: số `user.registered` và số trong đó có ít nhất một trường
`source` khác null.

### Thứ tự và phân trang

Luồng gộp sắp theo `(occurredAt ASC, eventId ASC)`; `eventId` so sánh **ordinal** (theo mã ký tự,
không locale — SIM dùng `string.CompareOrdinal`). Cursor nghĩa là "ngay sau" cặp đó. Sự kiện trùng
đúng mili-giây (import hàng loạt) được xử lý tất định: mỗi nguồn lấy `n+1` dòng rồi lấy nốt mọi dòng
cùng mili-giây với dòng cuối, nên duyệt theo trang không trùng và không sót.

Chỉ phát sự kiện đã "lắng" ≥ 30 giây (transaction chưa commit có `now()` cũ) — SIM thấy sự kiện
trễ nửa phút so với thời điểm xảy ra, đổi lại cursor không bao giờ bỏ lỡ dòng commit muộn.

### Phạm vi và giới hạn

- **Tài khoản thật**: `User` không có cờ test/disabled/soft-delete, nên loại theo email của tài khoản
  seed/demo/tên miền dành riêng (`@feedbackme.dev`, `@demo-english.limio.vn`, `@example.*`, `.test`,
  `.invalid`, `.local`, `.localhost`). Danh sách ở `eventSources.ts` (`EXCLUDED_EMAIL_PATTERNS`).
- **`activity.first_recorded` không quét `LearningEvent`.** Ứng viên là user đăng ký *hoặc* ghi danh
  trong 120 ngày qua (tối đa 5000 user mới nhất); mỗi ứng viên một lần tra index
  `(userId, occurredAt)` với `LIMIT 1`. Hệ quả: người có hoạt động đầu tiên muộn hơn 120 ngày sau khi
  đăng ký/ghi danh thì **không được báo**.
- Đăng ký SSO: `AcquisitionTouch` chỉ ghi khi tài khoản mới tạo trong 120 giây trước đó (heuristic);
  người đăng nhập SSO vào tài khoản mật khẩu có sẵn không được gán nguồn.
- Đăng ký ở trình duyệt khác / cookie bị chặn / đăng ký qua lời mời tổ chức ⇒ `source` toàn `null` —
  SIM phải coi là "không rõ", không gán vào kênh nào (xem `coverage`).
- `amountMinor` là `Order.amountCents` nguyên văn; với `VND` đó là số đồng nguyên.

## 5. Quyền riêng tư

- Ra khỏi Limio chỉ có: id ẩn danh (HMAC, không đảo ngược nếu thiếu khoá), loại sự kiện, thời điểm,
  các trường nguồn đã làm sạch, số tiền + tiền tệ. **Không** có userId, email, tên, tên tổ chức, IP,
  user agent, hay văn bản tự do.
- Không lưu giá trị click id, query string, IP, user agent; landingPath che đoạn giống mã/token.
- Cookie first-party, HttpOnly (JS trang không đọc được), không gửi cho bên thứ ba.
- Xoá user ⇒ `AcquisitionTouch` bị xoá theo (cascade); sự kiện biến mất khỏi luồng vì dẫn xuất từ bảng gốc.
- Endpoint chỉ SELECT, có ký, giới hạn tốc độ, `no-store`.
- Trước khi bật `GROWTH_ATTRIBUTION_ENABLED` ở production: rà văn bản cookie/quyền riêng tư của site
  có bao gồm cookie attribution first-party.

## 6. Kiểm tra sau khi triển khai

1. `migrate` đã chạy (bảng `AcquisitionTouch` + 4 index tồn tại).
2. Đặt 3 biến, recreate container `web`.
3. `curl -sI 'https://limio.vn/catalog?utm_source=test&utm_medium=test'` ⇒ có `Set-Cookie: limio_attr=…`.
   (Middleware đọc env lúc chạy; nếu không thấy cookie, kiểm tra biến đã vào container.)
4. Gọi endpoint có ký (xem test vector) với `types=user.registered&limit=5`.
5. Đăng ký thử từ URL có `utm_source=test` ⇒ sự kiện `user.registered` mang `source.utmSource = "test"`.

Test: `pnpm --filter @feedbackme/web exec vitest run src/lib/growth src/middleware.growth.test.ts src/app/api/internal src/app/api/auth`
(không cần DB; phần SQL chỉ chạy được với Postgres thật — xem `eventSources.ts`).
