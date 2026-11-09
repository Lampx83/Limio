# Limio Language — Thư viện giáo trình, đợt 2 — Acceptance criteria

> Bản nháp 09/11/2026, **đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Thiết kế: Figma "Limio Language", frame "Thư viện giáo trình". Tiếp nối `docs/tieu-chi/limio-language-hoc-vien-dot-1.md` (đã commit `aa9a7e63`). Gắn với A1 (khoá), A3 (ghi danh), A9 (thanh toán); ID chính thức đối chiếu spec khi commit.

## Vì sao làm

Figma có trang **Thư viện giáo trình**: học viên tìm giáo trình theo nhà xuất bản, trình độ, kỹ năng; thấy giáo trình đang học; **Lưu** để xem sau; **Preview** trước khi học. Limio chưa có: khoá chưa có thông tin nhà xuất bản, tác giả, ấn bản, trình độ, kỹ năng trọng tâm; chưa có "lưu khoá".

## Đối chiếu mã (09/11/2026)

- **Mua và ghi danh đã đủ:** gói truy cập, Stripe, VNPay, mã kích hoạt, trang `/catalog/[slug]`. Đợt 2 **không đụng thanh toán**: thẻ giáo trình chưa ghi danh dẫn sang `/catalog/[slug]`.
- **Preview không xung đột với học liệu bản quyền** (sửa nhận định trước): bài `previewable` đã được cố ý loại khỏi bảo vệ (`protectedMedia.ts`), nên người chưa ghi danh xem được bài đó và file của nó. **Nhưng** `publicAccess` mở cả file của cả khoá bản quyền, nên Preview **chỉ được dựa vào `previewable`**, không dùng `publicAccess`.
- `Course.language` là ngôn ngữ giao diện của khoá (`vi`/`en`), **không** phải ngôn ngữ đang dạy; `Course.level` chỉ có 3 mức thô. Cần trường riêng cho Figma ("B1–B2", "Ngữ pháp", "Từ vựng").
- `LanguageSkill` chỉ có 4 kỹ năng (không có ngữ pháp/từ vựng) và **không đổi enum** ở đợt này: dùng trường tag riêng của khoá.

## Phạm vi

- **Có:** trang `/language/thu-vien` (menu "Thư viện giáo trình" hiện từ đợt này), tìm kiếm + 3 bộ lọc + tab Tất cả/Đã lưu + sắp xếp, thẻ "Đang học", lưới "Khám phá thêm", Lưu/Bỏ lưu, Preview; phần giảng viên: đặt thông tin thư viện cho khoá.
- **Thay đổi schema (một migration, nullable/mặc định, khoá cũ không đổi hành vi):** `Course.inLibrary` (mặc định `false`), `publisher`, `authors`, `edition`, `levelBand`, `focusTags` (mảng, mặc định rỗng); bảng mới `CourseSave (userId, courseId, createdAt)`.
- **Không làm:** gợi ý bằng AI, đánh giá/bình luận, ánh xạ mục tiêu IELTS/HSK sang trình độ, thư viện theo tổ chức, gói nhiều giáo trình, lọc theo giá, khái niệm "ngôn ngữ đang học" (Figma ghi "Tiếng Anh · IELTS").
- **Không đổi:** thanh toán, ghi danh, quyền xem học liệu, `/catalog`.

## AC1 — Dữ liệu và migration

- **Given** khoá hiện có, **When** áp migration, **Then** `inLibrary=false`, các trường mới rỗng, `focusTags=[]`; không khoá nào tự xuất hiện trong thư viện.
- `levelBand`: rỗng hoặc một mức/khoảng CEFR dạng `A1`…`C2` hoặc `B1-B2` (mức đầu ≤ mức sau); giá trị khác bị từ chối (`validation_failed`).
- `focusTags` chỉ nhận `reading|listening|speaking|writing|grammar|vocabulary`, tối đa 6, không trùng; `publisher`/`authors`/`edition` ≤ 120 ký tự, cắt khoảng trắng, chuỗi rỗng coi như không có.
- `CourseSave`: khoá chính `(userId, courseId)` nên lưu hai lần không tạo hàng thứ hai; xoá người dùng hoặc xoá khoá thì xoá theo (cascade).
- Thêm vào xuất/xoá dữ liệu cá nhân của học viên (CLAUDE.md §5.4); nếu chưa tìm thấy chỗ khai báo thì dừng và báo, không bỏ qua.

## AC2 — Giảng viên đặt thông tin thư viện

- Ở trang sửa khoá có mục **"Thư viện giáo trình"**: công tắc "Đưa vào Thư viện giáo trình", ô Nhà xuất bản, Tác giả, Ấn bản, Trình độ, và chọn Kỹ năng trọng tâm.
- Chỉ **chủ khoá và admin** đổi được công tắc và các trường (cùng triết lý với giá và học liệu bản quyền); đồng giảng viên thấy nhưng không sửa. Mọi lần đổi công tắc ghi `AuditLog`.
- Công tắc chỉ có tác dụng khi khoá `published`; khoá nháp bật công tắc vẫn **không** hiện ở thư viện, và giao diện nói rõ điều đó.
- **Given** khoá `enrollMode` không mở tự do (chỉ vào bằng link mời), **Then** không được bật công tắc (khoá đó không tự ghi danh được, đưa vào thư viện là mục chết).
- Cập nhật **`GIAO-DIEN.md` trước**, rồi `teacherAssistantGuide.ts` (kèm `useCases`) cho Lily; `teacherAssistantFreshness.test.ts` vẫn xanh (CLAUDE.md §4.9).

## AC3 — Trang thư viện (học viên)

- **Chỉ hiện** khoá `published`, `inLibrary`, `enrollMode` mở tự do. Chưa đăng nhập → chuyển đăng nhập; giảng viên/admin → về trang chủ của họ như `/language`.
- **Tìm kiếm** theo tên, tác giả, nhà xuất bản (không phân biệt hoa thường, bỏ dấu không bắt buộc). **Bộ lọc** Nhà xuất bản, Trình độ, Kỹ năng lấy giá trị từ chính các khoá trong thư viện; Trình độ lọc theo giao nhau với khoảng (`B1-B2` khớp lọc `B1` và `B2`). Mọi bộ lọc nằm trong URL (form GET); trang đầu dựng ở máy chủ.
- **Tab** "Tất cả · n" và "Đã lưu · m" (m chỉ đếm khoá còn hiển thị trong thư viện). Tab Đã lưu rỗng → `<EmptyState>` hướng dẫn bấm "Lưu".
- **Sắp xếp** "Phù hợp nhất" (mặc định), "Mới nhất", "Tên A–Z". "Phù hợp nhất" = đã lưu trước → cùng trình độ với khoá đang học → xuất bản gần nhất; **không** dùng mục tiêu hay dữ liệu cá nhân nhạy cảm.
- **Phân trang:** 12 khoá một trang, có điều khiển trang; không tải hết thư viện.
- **Thẻ "Đang học":** khoá ghi danh còn hiệu lực, chưa hoàn thành, có `lastLessonId` gần nhất. Hiện bìa, tên, nhà xuất bản/tác giả/ấn bản, vị trí (Unit và bài hiện tại), thanh tiến độ "x / y bài", nút **Tiếp tục học** (tới đúng bài) và **Mở lộ trình giáo trình** (`/language?course=<slug>`). Không có khoá nào đang học thì không hiện khối này. Khoá đó không lặp lại ở lưới bên dưới.
- **Lưới "Khám phá thêm":** 1 cột mặc định → `sm:` 2 cột → `lg:` 3 cột (§4.6). Mỗi thẻ: bìa (khoá không có `coverUrl` thì ô thay thế, không ảnh vỡ), dải trình độ, tên, nhà xuất bản, mô tả rút gọn dạng **chữ thuần** (không HTML, không Markdown thô), chip kỹ năng, và hành động theo AC4.
- **Giá (nghiêng khỏi Figma, cần duyệt):** thẻ có một dòng nhỏ "Miễn phí" hoặc "từ X" lấy đúng quy tắc của `/catalog`, vì Preview/Học mà không biết giá là bất ngờ khi vào trang mua.
- **Responsive:** dưới `md` bộ lọc thu thành một khối mở/đóng; không cuộn ngang ở 375px.
- Trang `noindex`; không có tên hay email người khác trong dữ liệu trả về.

## AC4 — Hành động trên thẻ

- **Đã ghi danh (còn hiệu lực)** → nút **Học** tới `/learn/<slug>`. Cùng định nghĩa "còn hiệu lực" với trang khoá (không tự suy ra); ghi danh hết hạn/hoàn tiền xem như chưa ghi danh.
- **Chưa ghi danh** → tên thẻ và nút phụ tới `/catalog/[slug]` (mua, nhập mã, ghi danh miễn phí đều ở đó). **Thẻ không bao giờ cấp quyền học.**
- **Preview:** chỉ hiện khi khoá có ít nhất một bài `previewable` và hiển thị; bấm vào bài đó theo thứ tự đầu tiên (`/learn/<slug>/lessons/<id>`). **Given** khoá bật học liệu bản quyền, **When** người chưa ghi danh mở Preview, **Then** thấy bài và file của bài `previewable`, và **không** thấy file của bài khác (test hồi quy với `canAccessProtectedMedia`). Không dùng `publicAccess` để làm Preview.
- **Lưu / Đã lưu:** nút bật/tắt, cập nhật ngay (lạc quan), hỏng thì hoàn lại và báo; ghi sự kiện **không chặn** thao tác.
- `POST` và `DELETE /api/library/saves` `{ courseId }`: chưa đăng nhập → 401; khoá không nằm trong thư viện (nháp, ngoài thư viện, không mở tự do) → 404 và **không tạo hàng**; lưu lại cùng khoá → thành công, không nhân đôi (idempotent); bỏ lưu khoá chưa lưu → thành công.
- Sự kiện `library.course.saved` và `library.course.unsaved`: subject là học viên, payload chỉ `courseId`. Namespace `library.*` **không** tính là hoạt động học (thêm vào `NON_LEARNER_ACTIVITY_PREFIXES`, kèm test), vì lưu một giáo trình không phải là học.

## AC5 — Menu, riêng tư, kiểm thử

- Menu vỏ Language có **Thư viện giáo trình** (`/language/thu-vien`), sáng ở trang con; test `languageMenu` đổi cho khớp.
- Mọi dữ liệu "Đã lưu" và "Đang học" chỉ của chính người xem; không tham số nào cho xem người khác.
- Hàm truy vấn nằm ở `core-lms/language` (không import `core-feedback`); số truy vấn của một lần tải trang cố định, không N+1 theo thẻ; có index cho `(inLibrary, status)` hợp lý và `CourseSave(userId, createdAt)`.
- Test: lọc/tìm/sắp xếp/phân trang; chỉ khoá đủ điều kiện hiện; lưu idempotent và 404 với khoá ngoài thư viện; Preview với học liệu bản quyền; ghi danh hết hạn không hiện nút Học; test render thẻ ở các trạng thái; `tsc` sạch; web và core-lms xanh.
- Xem bằng mắt trên dev ở 375px và desktop, so với frame Figma, ghi rõ chỗ khác.
- Không commit, không push khi chưa được thầy bảo.

## Cần thầy chốt (mặc định đề xuất in đậm)

1. Dòng giá trên thẻ: **hiện** (như trên) hay đúng Figma, không hiện giá?
2. Ai bật được "Đưa vào Thư viện giáo trình": **chủ khoá và admin**, hay chỉ admin (thư viện được tuyển chọn)?
3. Khoá không có bài xem thử: **ẩn nút Preview**, hay vẫn hiện và dẫn tới trang chi tiết khoá?
4. Sự kiện `library.*` **không** tính là hoạt động học, đồng ý?
5. Thư viện hiện cho **mọi học viên đăng nhập**, hay chỉ người đang ở vỏ Language / có khoá ngoại ngữ?

## Đã làm (09/11/2026, chưa commit)

- **Schema + migration `20261109100000_language_library`:** `Course.inLibrary/publisher/authors/edition/levelBand/focusTags`, bảng `CourseSave`. Áp lên DB dev bằng `migrate deploy`; DB test (`feedbackme_test`) đang lệch từ 16/10 và có một migration đánh dấu hỏng nên đồng bộ bằng `db push`.
- **Lõi** `core-lms/language/library.ts`: kiểm đầu vào, `updateCourseLibraryMeta` (chủ khoá/admin, nhật ký + sự kiện), `saveLibraryCourse`/`unsaveLibraryCourse` (idempotent), `listLibrary` (lọc, tìm, sắp xếp, phân trang, "Đang học", ghi danh còn hiệu lực, bài xem thử). Hằng số CEFR/kỹ năng ở `shared-types/library.ts`; sự kiện `library.*` không tính là hoạt động học.
- **API:** `POST/DELETE /api/library/saves`, `PUT /api/courses/[id]/library`.
- **Giao diện học viên:** `/language/thu-vien` + `LibraryView`, `LibraryCard`, `LibrarySaveButton`, `LibraryFilters`; menu "Thư viện giáo trình".
- **Giao diện giảng viên:** mục "Thư viện giáo trình" ở trang khoá (`LibraryMetaPanel`), cập nhật `GIAO-DIEN.md` và `teacherAssistantGuide.ts`.
- **Kiểm thử:** web 211 file / 2489 test xanh, `core-lms` test `language`, `protectedMedia`, `learning` xanh, `tsc` sạch ở cả hai gói, `teacherAssistantFreshness` xanh. Xem trên dev ở desktop và 375px: lưới, lưu/bỏ lưu, tab Đã lưu, bộ lọc thu gọn, không tràn ngang; mục giảng viên lưu được.
- **Lệch so với AC ở trên, theo thực tế khi làm:**
  - Mục "Thư viện giáo trình" của giảng viên **chỉ hiện ở khoá bật "Chế độ ngoại ngữ"** (thư viện nằm trong vỏ Language), không hiện ở mọi khoá.
  - Lưới thẻ chia **3 cột từ `xl:`**, không phải `lg:` như §4.6, vì từ `lg:` đã có menu trái chiếm 256px nên thẻ 3 cột quá chật.
  - Thẻ không có bài xem thử hiện "Xem chi tiết" (không hiện Preview), đúng mặc định đã chọn.
- **Chưa xem bằng mắt:** thẻ có Preview (dev chưa có bài `previewable` trong khoá thư viện), tab Đã lưu rỗng, trạng thái hai trang trở lên, thẻ có bìa ảnh thật.
- **Dữ liệu dev đã dùng để xem:** tạm bật thư viện cho 3 khoá ngoại ngữ demo rồi **trả về nguyên trạng** (kèm xoá hàng `CourseSave` thử). Sự kiện `library.*` đã ghi vẫn còn vì `LearningEvent` là append-only.
- **Lưu ý khi commit:** `schema.prisma`, `shared-types/src/events.ts`, `core-lms/src/index.ts` và `learning/activity.ts` có thay đổi của việc khác (B12/B16, vấn đáp) cùng file; chỉ staging các hunk của đợt 2.
