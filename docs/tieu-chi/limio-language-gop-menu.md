# Limio Language — Gộp menu học viên và bỏ "vỏ" riêng — Acceptance criteria

> Bản nháp 10/11/2026, **đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Tiếp nối đợt 1–4 (`aa9a7e63` … `5451d0f8`). Thay một phần quyết định của đợt 1 (vỏ Language là một chế độ giao diện riêng, bật bằng cookie, có trang "Lộ trình của tôi").

## Vì sao làm

Hệ thống đang có ba tên: Limio thường, tính năng trung tâm, Limio Language. Đối chiếu mã (10/11/2026) cho thấy chúng là **ba trục độc lập** nhưng cách thể hiện thì chồng chéo:

- **Menu trái học viên chỉ có hai bản thật.** `StudentLeftMenu` (Limio) và `LanguageLeftMenu` (Language). "Menu trung tâm" không tồn tại riêng: nó chỉ là hai mục **Lịch học** và **Mục tiêu** nằm sẵn trong `StudentLeftMenu`, ẩn khi học viên chưa học ở lớp có lịch.
- Hai menu dùng chung bộ máy (`useSidebarNav`, ngăn kéo dưới `lg`, nhóm gập được); `LanguageLeftMenu` là **tập con** của menu Limio cộng ba mục ngoại ngữ.
- Hệ quả của việc tách: học viên ở vỏ Language **không có lối vào menu** tới Khoá học của tôi, Lịch học, Mục tiêu, Cài đặt, Token AI; học viên trung tâm không thấy Lịch học/Mục tiêu trong ngăn kéo menu ở trang bài học (`app/learn/[slug]/layout.tsx` không truyền `showSchedule`).
- Trang "Lộ trình của tôi" **trùng** với những gì học viên Limio thường đã có: bài tiếp theo (nút **Tiếp tục học**), các phần của khoá (trang khoá, **Khoá học của tôi**), mục tiêu (**Mục tiêu**, cùng dữ liệu), luyện đề (mục Luyện đề trong trang khoá), ôn lại (trang **Lịch ôn tập** của đợt 4).

**Quyết định (thầy chốt 10/11/2026):**
1. Gộp thành **một menu học viên có điều kiện**; bỏ thẻ "Limio Language" xanh chanh và nút "Về Limio"; nhận diện Language chỉ còn ở **khung bài học** và các trang `/language/*`.
2. **"Thư viện giáo trình" nằm cạnh "Danh mục khoá học"** trong nhóm "Khám phá", hiện cho mọi học viên.
3. **Bỏ trang "Lộ trình của tôi"** (kể cả khối "Tiến độ theo kỹ năng" theo %, vì chỉ là tỷ lệ bài đã hoàn thành).
4. **Tạm bỏ "Lịch ôn tập" khỏi menu.** Nhóm "Ngoại ngữ" vì thế không còn mục nào và bị bỏ.

## Phạm vi

- **Có:** (A) một menu học viên duy nhất, thêm "Thư viện giáo trình" vào nhóm "Khám phá"; (B) một hàm dựng dữ liệu menu dùng chung cho ba chỗ gắn menu (sửa luôn lỗi ngăn kéo trang bài học); (C) bỏ chế độ "vỏ" (cookie, route đổi chế độ, dấu hiệu ở header); (D) khung bài học Language bật theo **khoá**, không theo chế độ; (E) bỏ trang Lộ trình và xử lý `/language`; (F) dọn mã thừa, cập nhật test và tài liệu.
- **Không đổi schema, không migration, không thêm sự kiện.**
- **Giữ nguyên, chỉ không gắn vào menu ("tạm bỏ"):** trang `/language/lich-on-tap`, component `ReviewSchedule`, `getFlashcardSchedule`, `getPracticeReviewSummary`, bộ lọc `?filter=wrong` của trang luyện đề, và cầu nối Bài luyện → nhãn kỹ năng của đợt 4 (sự kiện `exam.practice.observed`, BKT). Đây là chức năng nền và dữ liệu đang chạy, không phải menu; muốn bật lại chỉ cần thêm một mục menu.
- **Không làm:** làm lại `/me/lich-hoc` và `/me/muc-tieu` theo tông Language; vỏ giảng viên Language; thương hiệu theo tên miền riêng (chỉ giữ phép viết lại `/` → `/language` của `LANGUAGE_HOST`, xem AC5); đổi cách trung tâm bật tính năng (`centerEnabled`, cờ `center.access`, lớp có lịch).

## AC1 — Một menu học viên

- `StudentLeftMenu` là **menu trái học viên duy nhất**, ở cả ba chỗ gắn: `app/me/layout.tsx`, `app/learn/[slug]/layout.tsx` (ngăn kéo), `app/language/layout.tsx`.
- Thẻ đầu menu luôn là "Khu vực / **Học viên**" màu xanh lục. Không còn màu xanh chanh và thẻ "Limio Language" trong menu.
- **Xoá:** `components/LanguageLeftMenu.tsx`, `LanguageLeftMenu.test.tsx`, nút "Về Limio", `languageMenuGroups()` và `isLanguageMenuActive()` trong `lib/languageMenu.ts` (chỉ giữ hàm kiểm vai học viên nếu còn nơi dùng, đổi tên cho đúng nghĩa).
- Trang `/language/*` của **khách** (chưa đăng nhập) vẫn **không có menu**. Giảng viên/admin vẫn bị chuyển về trang chủ của họ khi vào `/language`.

## AC2 — Nội dung menu

```
Tiếp tục học (như cũ)
Học tập      Khoá học của tôi · Lịch học* · Mục tiêu* · Ghi chú · Kỹ năng · Huy hiệu · e-Portfolio của tôi
Phản hồi     Chấm bài bạn học
Khám phá     Danh mục khoá học · Thư viện giáo trình · Đấu trường · Bảng xếp hạng
Tài khoản    Token AI* · Cài đặt
```

Dấu `*` là mục có điều kiện.

- **"Thư viện giáo trình"** (`/language/thu-vien`, biểu tượng thư viện như Figma) nằm ngay sau "Danh mục khoá học", hiện cho **mọi học viên đã đăng nhập**, không cần có khoá ngoại ngữ.
- **Không còn** nhóm "Ngoại ngữ", mục "Lộ trình của tôi" và mục "Đã lưu & ghi chú" (chỉ còn "Ghi chú", `/me/notes`).
- **Lịch học** hiện khi học viên đang học ở lớp có lịch (`getLearnerCenterAccess`, như cũ).
- **Mục tiêu** hiện khi học viên học ở lớp có lịch **hoặc đang có một mục tiêu đang theo đuổi** (thầy chốt 10/11/2026), xem AC2b. Token AI theo điều kiện mở khoá như cũ.
- Điều kiện chỉ ẩn/hiện ở giao diện, **không** đổi quyền truy cập các trang dữ liệu riêng.
- Nhóm gập được và nhớ trạng thái gập như các nhóm khác; không dùng lại khoá `fbm-language-menu-collapsed`.
- Mục "Thư viện giáo trình" sáng ở `/language/thu-vien` và trang con của nó.

## AC2b — Mục "Mục tiêu" hiện theo mục tiêu, không chỉ theo lớp có lịch

Lý do: thẻ "Mục tiêu của bạn" của trang Lộ trình (bị bỏ) và trang Mục tiêu đọc **cùng** dữ liệu `LearnerGoal`. Nếu chỉ giữ điều kiện "lớp có lịch", học viên có mục tiêu mà không học ở lớp có lịch (ví dụ tài khoản demo `sv.demo.01`) sẽ không còn thấy mục tiêu của mình ở đâu.

- **Given** học viên học ở lớp có lịch **When** xem menu **Then** thấy cả Lịch học và Mục tiêu (như cũ).
- **Given** học viên **không** học ở lớp có lịch nhưng có **một mục tiêu đang theo đuổi** (`status = active`, gắn khoá hay mục tiêu chung đều tính) **When** xem menu **Then** thấy **Mục tiêu** nhưng **không** thấy Lịch học.
- **Given** học viên không học ở lớp có lịch và **không** có mục tiêu đang theo đuổi (kể cả chỉ còn mục tiêu đã đóng) **When** xem menu **Then** không thấy cả hai mục.
- **Trang `/me/muc-tieu`:** điều kiện vào trang đổi theo đúng quy tắc trên (lớp có lịch **hoặc** có mục tiêu đang theo đuổi); ngoài ra thì chuyển về `/me/dashboard` như cũ. Trang vẫn chỉ liệt kê khoá thuộc lớp có lịch hoặc đã có mục tiêu, và mục tiêu chung.
- Điều kiện "có mục tiêu đang theo đuổi" là một truy vấn nhẹ, **cache ngắn theo người dùng** như `getLearnerCenterAccess` (30 giây, cùng thẻ), nên mục có thể chậm hiện tối đa cỡ đó sau khi giáo viên đặt mục tiêu.
- Tách hằng `CENTER_LEARNER_HREFS`: "Lịch học" theo điều kiện lớp có lịch, "Mục tiêu" theo điều kiện mới; `StudentLeftMenu` nhận cờ riêng cho mỗi mục (`showSchedule`, `showGoals`).
- Không đổi quy tắc ai được xem/sửa mục tiêu (riêng tư như `learnerGoals.ts`: học viên, người quản khoá, giáo viên của lớp).

## AC3 — Một hàm dựng dữ liệu menu cho ba chỗ gắn

- Một hàm máy chủ (ví dụ `getStudentMenuContext(userId)`) trả `{ badges, continueTo, showSchedule, showGoals }`; ba layout đều gọi nó, không tự ghép.
- **Sửa lỗi:** ngăn kéo menu ở trang bài học (`/learn/[slug]`) giờ **có** Lịch học/Mục tiêu đúng theo điều kiện ở AC2/AC2b.
- Lỗi khi đọc một điều kiện phụ **không** làm hỏng menu: coi điều kiện đó là tắt, menu vẫn vẽ.
- Menu giảng viên và admin **không đổi**.

## AC4 — Bỏ chế độ "vỏ"

- **Xoá:** cookie `limio_app` và mọi chỗ đọc/ghi nó (`lib/appMode.ts`, `appMode.server.ts`, nhánh `setMode` trong `middleware.ts`), route `GET /api/app-mode` và test của nó.
- **Header (`AppHeader`, `HeaderTagline`):** bỏ nhãn "Language" xanh chanh cạnh logo, bỏ tagline "Speak in Flow" (mọi học viên thấy "Learn in Flow"), bỏ nút "Limio Language" lối vào vỏ (và truy vấn `getHasLanguageCoursesCached` chỉ dùng cho nút đó); nút Đấu trường (`TournamentCta`) **luôn** hiện như Limio thường.
- `StudentMenuTrigger`: nút mở ngăn kéo hiện ở `/language*` cho học viên đã đăng nhập (không còn tham số `languageMode`).
- **`LANGUAGE_HOST`:** nếu đặt, `/` của tên miền đó vẫn được viết lại thành `/language`, **không** đặt cookie. Không đặt thì không có gì thay đổi.
- Cookie `limio_app` còn sót ở trình duyệt người dùng cũ **không gây lỗi** (không ai đọc nữa). Liên kết cũ `/api/app-mode?...` trả 404 là chấp nhận được (chưa ra production).

## AC5 — Trang `/language` sau khi bỏ Lộ trình

- **Khách:** vẫn thấy trang giới thiệu Limio Language (index được), không menu.
- **Học viên đã đăng nhập vào `/language`:** chuyển về trang chủ học viên `/me/dashboard`.
- **Giảng viên/admin:** chuyển về trang chủ của họ như hiện nay.
- Xoá `components/language/LearnerPath.tsx`, `lib/learnerPathView*` (nếu có) và test của chúng, cùng nhánh "Lộ trình" trong `app/language/page.tsx`. Hàm core-lms nào hết nơi dùng (ví dụ `learnerHasLanguageCourses`, `buildLanguagePath`) thì xoá, hàm còn được `lich-on-tap` dùng thì giữ.
- Không còn nơi nào trong giao diện liên kết tới `/language` dành cho học viên đã đăng nhập (kiểm bằng tìm kiếm mã): liên kết "Xem lịch ôn tập →" nằm trong `LearnerPath` nên đi theo nó.
- Trang `/language/lich-on-tap` còn truy cập được bằng địa chỉ trực tiếp nhưng **không** có liên kết nào dẫn tới (tạm bỏ); vẫn `noindex`.

## AC6 — Khung bài học Language theo khoá

- Điều kiện bật khung bài học (`languageSkin` ở `app/learn/[slug]/lessons/[lessonId]/page.tsx`) bỏ `getAppMode() === "language"`; còn: khoá bật `languageMode`, học viên **đã ghi danh**, vai học viên, và không phải xem thử / chiếu lớp / chế độ giảng viên (như đợt 3a).
- Đánh số đoạn lời thoại (`numberTranscripts`) và Bài luyện đi theo cùng điều kiện đó, nên một học viên **chưa từng vào `/language`** vẫn thấy khung Language ở khoá ngoại ngữ của mình.
- **Given** học viên có cả khoá thường và khoá ngoại ngữ **When** mở bài của khoá thường **Then** giao diện bài học là bản Limio thường; **When** mở bài của khoá ngoại ngữ **Then** là khung Language.
- Khoá vừa ngoại ngữ vừa thuộc lớp có lịch: có khung Language trong bài học, và vẫn xuất hiện ở Lịch học (điểm danh, nhận xét sau buổi).

## AC7 — Kiểm thử và tài liệu

- **Test bảng cho menu** (hàm thuần): học viên thường; học viên lớp có lịch (Lịch học + Mục tiêu); học viên không có lớp lịch nhưng có mục tiêu đang theo đuổi (chỉ Mục tiêu); học viên chỉ còn mục tiêu đã đóng (không có cả hai); có/không mở khoá Token AI; mỗi trường hợp khẳng định đúng tập `href` hiện ra và đúng thứ tự (kiểm "Thư viện giáo trình" luôn có, ngay sau "Danh mục khoá học").
- Test điều kiện `languageSkin` không còn phụ thuộc cookie (đặt cookie `limio_app=language` hay không đều cho cùng kết quả).
- Test trang `/language`: khách thấy giới thiệu; học viên chuyển về `/me/dashboard`; giảng viên chuyển về trang của họ.
- Test cổng vào `/me/muc-tieu`: vào được khi lớp có lịch hoặc có mục tiêu đang theo đuổi; chuyển về `/me/dashboard` khi không có cả hai.
- Cập nhật hoặc xoá test cũ: `LanguageLeftMenu.test.tsx`, `languageMenu.test.ts`, `appMode.test.ts`, `app-mode/route.test.ts`, test `LearnerPath`, test liên quan `middleware`.
- Hồi quy: `tsc` sạch; `StudentLeftMenu` giữ nguyên `data-tour` cho `HelpTour`; trang Lịch ôn tập vẫn hoạt động khi vào bằng địa chỉ; cầu nối Bài luyện → nhãn kỹ năng (đợt 4) vẫn ghi sự kiện đúng.
- Tài liệu: đánh dấu ở AC đợt 1 rằng quyết định "vỏ riêng bằng cookie" và trang "Lộ trình của tôi" đã được thay bởi tài liệu này, đồng thời đánh dấu "Lịch ôn tập" ở AC đợt 4 là "tạm bỏ khỏi menu"; thêm vào `CLAUDE.md` một câu ngắn: tính năng trung tâm là điều kiện dữ liệu trên **một** menu học viên, không có chế độ giao diện theo cookie; thêm mục menu học viên mới ⇒ khai báo điều kiện hiện ngay trong `StudentLeftMenu`.

## Đã chốt

1. "Thư viện giáo trình" hiện cùng "Danh mục khoá học" trong nhóm "Khám phá", cho mọi học viên.
2. Bỏ trang "Lộ trình của tôi" (và khối 4 kỹ năng theo %).
3. Tạm bỏ "Lịch ôn tập" khỏi menu (giữ mã và dữ liệu).
4. Mục "Mục tiêu" hiện khi học viên học ở lớp có lịch **hoặc đang có một mục tiêu** (AC2b); "Lịch học" vẫn chỉ theo lớp có lịch.

## Rủi ro đã biết

- Mất màu nhận diện riêng ở menu và header; thương hiệu Language chỉ còn ở khung bài học và trang Thư viện. Nếu sau này có khách cần Limio Language là sản phẩm riêng, điểm tách là tên miền cộng cờ trường, không phải khôi phục cookie.
- Đợt 1 và đợt 4 mất phần giao diện chính của chúng (Lộ trình, lối vào Lịch ôn tập); phần nền (khung bài học, Bài luyện, cầu nối kỹ năng, Thư viện) vẫn nguyên.
- Học viên vào Thư viện rồi sang `/me/lich-hoc` thấy đổi tông giao diện một lần (không có dữ liệu nào bị lệch).

## Đã làm (10/11/2026)

- **Menu:** `StudentLeftMenu` là menu duy nhất; `visibleStudentMenuGroups` (hàm thuần, có test) áp điều kiện: Lịch học theo lớp có lịch, **Mục tiêu theo lớp có lịch hoặc có mục tiêu đang theo đuổi**, "Thư viện giáo trình" trong nhóm Khám phá. Đã xoá `LanguageLeftMenu` (+ test), `lib/languageMenu.ts` (+ test), nút "Về Limio", trang "Lộ trình của tôi" (`LearnerPath` + test). `lib/learnerRole.ts` (`isLearnerRole`) thay `languageShellIsLearner`.
- **Dữ liệu menu dùng chung:** `lib/studentMenuContext.ts` (`getStudentMenuContext`), gọi từ `app/me/layout.tsx`, `app/learn/[slug]/layout.tsx`, `app/language/layout.tsx`. Sửa lỗi ngăn kéo trang bài học trước đây không có Lịch học/Mục tiêu. `core-lms`: `learnerHasActiveGoal` (+ test); `lib/centerAccess.ts`: `getLearnerGoalsAccess` (cache 30 giây); `/me/muc-tieu` dùng cùng điều kiện.
- **Bỏ vỏ:** xoá `lib/appMode*`, `GET /api/app-mode` (trả 404), cookie `limio_app`; header không còn nhãn "Language", tagline "Speak in Flow", nút lối vào; Đấu trường luôn hiện. `LANGUAGE_HOST` chỉ còn viết lại `/` → `/language` (`lib/languageHost.ts`, có test). `learnerHasLanguageCourses` đã xoá.
- **Khung bài học theo khoá:** `languageSkin` không còn đọc cookie. Liên kết "Về lộ trình" của khung bài học, "Học" ở đường dẫn và "Mở lộ trình giáo trình" ở thẻ Đang học đổi sang trang khoá / `/me/dashboard`.
- **`/language`:** khách thấy trang giới thiệu; học viên chuyển về `/me/dashboard`; giảng viên/admin về trang của họ. `/language/lich-on-tap` còn truy cập được bằng địa chỉ trực tiếp, không có liên kết dẫn tới.
- **Kiểm tra:** web 218 file / 2518 test, core-lms (goals, overview) 34 test, `tsc` sạch ở web và core-lms. Xem trên bản dev bằng tài khoản Học viên Language: `/language` → `/me/dashboard`; menu có Mục tiêu (không có Lịch học), "Thư viện giáo trình" sáng ở Thư viện; bài học ngoại ngữ vẫn có khung Language khi không có cookie; khách thấy giới thiệu, `/api/app-mode` 404, không đặt cookie.
- **Chưa kiểm bằng mắt / chưa có test tự động:** cổng vào `/me/muc-tieu` (chỉ phủ gián tiếp qua test `learnerHasActiveGoal` và test menu); học viên lớp có lịch thật (cần dữ liệu lớp); giảng viên vào `/language` (đường chuyển hướng giữ nguyên mã cũ).
