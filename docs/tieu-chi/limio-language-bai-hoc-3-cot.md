# Giao diện bài học 3 cột cho MỌI khoá (bài trong module · nội dung · AI trợ giảng và Ghi chú) — Acceptance criteria

> Bản nháp 10/11/2026, **đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Theo thiết kế Figma thầy gửi 10/11/2026 (khung bài học "Reading Skill": menu trái là các bài trong module, "Bài tiếp theo / Bài trước", panel phải có tab "AI trợ giảng" và "Ghi chú"). Tiếp nối khung bài học đợt 3a (`docs/tieu-chi/limio-language-hoc-vien-dot-3.md`).

## Đánh giá phương án hiện tại

| Thành phần trong thiết kế | Hiện trạng trong mã | Đánh giá |
|---|---|---|
| Menu trái: các bài trong unit, tiến độ, trạng thái từng bài | **Đã có** (`LessonFrame`: `RailBody`, tên unit, "x / y bài hoàn thành", biểu tượng đã xong/đang học, thời lượng) nhưng **chỉ ở khoá ngoại ngữ** | Khớp thiết kế. Chỉ cần chỉnh nhỏ nếu thầy muốn (chữ gạch ngang cho bài đã xong). Chỉ bật cho khoá ngoại ngữ. |
| Tab "Bài học / Từ vựng · n" | **Đã có** (`LessonViewTabs`) | Khớp. |
| "Bài tiếp theo" và "Bài trước" | Chỉ có **"Bài tập tiếp theo →"** ở **cuối trang**, sau cả "Bài tập" và "Thảo luận"; **không có "Bài trước"** | Lệch: học viên phải cuộn hết trang mới thấy, và không quay lại bài trước được từ khung. |
| Panel phải gồm AI trợ giảng và Ghi chú | AI là **nút nổi** mở cửa sổ nổi (`AiTutorPanel`, 510 dòng), Ghi chú là **nút nổi** mở ngăn kéo có nền mờ (`LessonNotesDrawer`), Mục lục khoá là nút nổi thứ ba; lề annotation ở bên phải (rộng `w-44` từ `xl`) | Lệch nhiều nhất. Cửa sổ nổi và ngăn kéo có nền mờ **che nội dung**, nên học viên không vừa đọc đoạn văn vừa xem giải thích (đúng thứ thiết kế muốn giải quyết). Ba nút nổi cộng lề annotation làm bên phải rời rạc. |
| "Hỏi AI" từ vùng bôi đen | **Đã có**: menu chuột phải → sự kiện `limio:ask-ai` → `AiTutorPanel` | Giữ nguyên cơ chế, chỉ đổi nơi hiển thị. |
| Chip "Đang dùng: bài đọc · đoạn 2", câu trả lời "giải thích theo ngữ cảnh", "Hữu ích?", thẻ "Đã lưu vào sổ từ" | Chưa có (AI chỉ biết bài và trích đoạn bôi đen; chưa có sổ từ riêng của học viên ngoài thẻ ôn từ vựng của khối "Từ vựng") | Chức năng mới, **tách đợt sau** (xem "Không làm"). |
| Biểu tượng bút nổi bật, dấu trang, menu "…" trên đầu bài | Chưa có tương đương trọn vẹn | Tách đợt sau. |

**Kết luận:** làm được, và phần cốt lõi là (1) đưa AI và Ghi chú thành **một panel gắn cố định bên phải** thay cho ba nút nổi, và (2) đưa **"Bài trước / Bài tiếp theo"** lên một thanh luôn thấy được. Phần còn lại của thiết kế (menu trái, tab Từ vựng) đã có.

**Rủi ro chính là chiều ngang:** rail 16 rem + panel 24 rem chiếm 640 px; trên màn 1280 px nội dung chỉ còn ~600 px, hẹp cho đoạn văn song ngữ và Bài luyện chia đôi. Vì vậy panel **tự đóng trên màn hẹp** (AC1) và có nút mở lại.

## Phạm vi (đã chốt 10/11/2026)

- **Có:** (A) khung 3 cột cho bài học của **mọi khoá** (không chỉ khoá ngoại ngữ); (B) panel phải có hai tab AI trợ giảng và Ghi chú; (C) "Bài trước / Bài tiếp theo"; (D) bỏ các nút nổi AI, Ghi chú, Mục lục khoá trong khung này.
- **Ai thấy khung:** học viên **đã ghi danh** (vai học viên) khi xem bài. **Giữ giao diện cũ** cho: người đọc chưa ghi danh (khoá công khai), xem thử, chiếu lớp, giảng viên đứng lớp (`?gv=1`) và bài có **bài giảng slide** (`deckCover`, bố cục riêng toàn màn hình; ngoại lệ ở đợt này).
- **Tách điều kiện "khung" khỏi "ngoại ngữ":** khung 3 cột bật theo **học viên đã ghi danh**, còn tính năng riêng của ngoại ngữ (đánh số đoạn lời thoại, tab Từ vựng) vẫn theo khoá `languageMode`. Khối **Bài luyện** nhúng làm tại chỗ trong khung cho **mọi khoá** (trước đây chỉ khoá ngoại ngữ; ở khoá thường chỉ là liên kết).
- **Công tắc tắt:** cài đặt hệ thống `lesson_frame.all_courses` (mặc định bật); đặt `false` thì khung chỉ còn cho khoá ngoại ngữ như trước đây, **không cần deploy** (đổi ở `SiteSetting`). Vì thay đổi này đổi giao diện bài học của **mọi học viên đang học**.
- **Không đổi schema, không migration, không API mới.** Dùng lại: `/api/ai/tutor`, `/api/ai/conversations/by-lesson/...`, `/api/ai/budget`, `LessonNotes`, sự kiện `limio:ask-ai`.
- **Không làm (đợt sau, theo thứ tự thầy chốt):** (1) **sổ từ** ("Đã lưu vào sổ từ": lưu từ vựng từ câu trả lời AI hoặc vùng bôi đen vào sổ riêng của học viên); (2) AI biết "đang đọc đoạn nào" và chip "Đang dùng: …"; (3) nút "Hữu ích?"; biểu tượng bút/dấu trang/"…" trên đầu bài; kiểu thẻ câu hỏi của Bài luyện theo ảnh; thẻ lời nhắc "D" trên khối chú ý.

## AC1 — Bố cục 3 cột và đáp ứng theo chiều ngang

- Từ **1536 px (`2xl`)**: rail trái 16 rem · nội dung · panel phải 24 rem, **panel mở sẵn**.
- Từ **1280 px (`xl`) tới dưới 1536 px**: ba cột như trên nhưng panel **đóng sẵn**; nút mở panel nằm cạnh mép phải; mở ra thì nội dung co lại.
- Dưới **1280 px**: không gắn cố định; panel mở bằng nút, **che lên trang** như ngăn kéo (nền mờ, đóng bằng Esc hoặc bấm ngoài), rail như hiện nay (thu thành khối "Bài trong unit" dưới `lg`).
- Mở/đóng và tab đang chọn được **nhớ theo người dùng** (trình duyệt); lưu trữ bị chặn thì vẫn chạy, chỉ không nhớ.
- Cuộn: rail và panel **dính** (sticky) và cuộn riêng; nội dung bài cuộn như thường. Không có thanh cuộn ngang ở 375, 768, 1024, 1280, 1536 px.

## AC2 — Panel phải: hai tab

- Hai tab **"AI trợ giảng"** và **"Ghi chú · n"** (n = số ghi chú của bài; không hiện số khi 0), nút đóng "×".
- Đúng ngữ nghĩa trợ năng: `role="tablist"`, mũi tên chuyển tab, tab đang chọn có `aria-selected`, nút đóng có nhãn "Đóng panel".
- Mở panel không làm mất hội thoại hay ghi chú đang soạn dở khi chuyển tab.

## AC3 — Tab "AI trợ giảng"

- Dùng lại nguyên hội thoại **theo bài** của AI tutor (`by-lesson`): lịch sử, gợi ý câu hỏi, gửi/streaming, ngân sách token và lời nhắc hết hạn mức, nút sao chép, trích đoạn bôi đen đính kèm câu hỏi kế tiếp.
- **"Hỏi AI" từ vùng bôi đen** (menu chuột phải): panel **tự mở** (kể cả đang đóng hoặc đang ở tab Ghi chú), chuyển sang tab AI và đính kèm đoạn trích, như hiện nay.
- Hành vi dữ liệu, quyền riêng tư và tính token **không đổi**.

## AC4 — Tab "Ghi chú"

- Hiện `LessonNotes` (ghi chú của chính học viên cho bài này), không còn ngăn kéo có nền mờ ở khung này. Thêm/sửa/xoá ghi chú như hiện nay; số "n" trên tab cập nhật ngay khi thêm hoặc xoá.

## AC5 — Nút nổi

- Trong khung **không còn** nút nổi "Ghi chú" và "AI tutor" (đã nằm ở panel). Nút nổi **Mục lục khoá** cũng bỏ vì rail đã thay (đúng là mục lục của unit; xem danh sách cả khoá vẫn ở trang khoá qua "← Về khoá học").
- Nút "Về trang chủ học viên" nổi và các nút của giảng viên đứng lớp (`TeacherBar`) giữ nguyên.

## AC6 — "Bài trước" và "Bài tiếp theo"

- Một **thanh cố định ở đáy cột nội dung** (luôn thấy khi cuộn, không che nội dung cuối trang) có: **"← Bài trước"** và **"Bài tiếp theo →"**, kèm tên bài kề bên (cắt ngắn), thay cho chân trang "Bài tập tiếp theo →" ở cuối trang.
- Thứ tự theo **thứ tự bài trong khoá**, bỏ qua bài đang bị khoá (`locked`) và bài ẩn, giống cách tính `next` hiện nay; đi qua ranh giới unit bình thường (bài đầu unit kế là "Bài tiếp theo" của bài cuối unit trước).
- **Bài đầu tiên:** không có "Bài trước". **Bài cuối cùng:** thay "Bài tiếp theo" bằng **"Về khoá học"**.
- Bấm "Bài tiếp theo" không đánh dấu hoàn thành bài hiện tại (hoàn thành vẫn theo cách tính hiện có).
- Trên điện thoại thanh gọn: hai nút, tên bài ẩn đi.

## AC7 — Lề annotation

- Khi panel đang gắn cố định, vùng lề annotation bên phải nội dung **thu về sát** (không chồng lên panel); chức năng bôi đen → annotation / "Hỏi AI" và dấu ở lề **vẫn hoạt động** ở mọi chiều ngang. Khi panel đóng, lề như hiện nay.

## AC8 — Kiểm thử và tài liệu

- Nhãn cấp trên bài (thầy chốt 10/11/2026): **"Unit" ở khoá ngoại ngữ** (`languageMode`, như đợt 3a, giữ nguyên) và **"Module" ở mọi khoá khác**. Dùng ở: chữ trên rail ("UNIT"/"MODULE"), đường dẫn "Học / Khoá / Unit|Module / Bài", khối thu gọn "Bài trong unit|module · x / y" ở màn hẹp và `aria-label`. Một hàm duy nhất chọn nhãn theo khoá; test kiểm cả hai.
- Hàm thuần: quyết định mở/đóng mặc định theo chiều ngang; điều kiện bật khung (ghi danh, ngoại lệ, công tắc); tính `prev`/`next` (bỏ khoá/ẩn, bài đầu, bài cuối, qua unit).
- Thành phần: tab chuyển được bằng bàn phím; "Hỏi AI" mở panel đúng tab với đoạn trích; số ghi chú cập nhật; thanh "Bài trước / Bài tiếp theo" đúng liên kết và đúng nhãn ở đầu/cuối khoá.
- Hồi quy: ngoại lệ giữ giao diện cũ (chưa ghi danh, xem thử, chiếu lớp, giảng viên đứng lớp, bài có slide) **không đổi**; mọi loại khối (video, tài liệu, SCORM/H5P/LTI, richtext, bài giảng) hiển thị đúng trong cột nội dung hẹp hơn; Bài luyện, đánh số lời thoại ngoại ngữ, tab "Từ vựng" giữ nguyên.
- Công tắc `lesson_frame.all_courses = false`: khoá thường quay về giao diện cũ, khoá ngoại ngữ vẫn có khung (test).
- Xem bằng trình duyệt ở 1536, 1280, 1024, 768 và 375 px; `tsc` sạch; web/core-lms qua.
- Tài liệu: đánh dấu ở AC đợt 3 rằng chân trang "Bài tập tiếp theo" và các nút nổi trong khung đã được thay.

## Đã chốt (thầy, 10/11/2026)

1. **Phạm vi:** áp cho **mọi khoá** (không chỉ ngoại ngữ), có công tắc tắt và các ngoại lệ ở mục Phạm vi.
2. **Panel ở 1280–1535 px:** **đóng sẵn**; từ 1536 px mở sẵn; dưới 1280 px mở như ngăn kéo.
3. **"Bài trước / Bài tiếp theo":** thanh **cố định ở đáy** cột nội dung.
4. **Đợt sau:** làm **sổ từ** trước, rồi AI theo ngữ cảnh.

## Rủi ro đã biết

- **Đổi giao diện bài học của mọi học viên đang học** (không chỉ học viên ngoại ngữ). Giảm nhẹ: công tắc tắt không cần deploy, ngoại lệ giữ giao diện cũ, chỉ áp cho người đã ghi danh.
- Cột nội dung hẹp hơn (rail 16 rem + panel 24 rem khi mở) với các khối rộng như SCORM/H5P/LTI, bảng, video; cần xem bằng mắt ở từng loại khối trước khi bật.
- Thanh cố định ở đáy và các nút nổi còn lại (về trang chủ, thanh giảng viên) không được chồng nhau hay che nút "hoàn thành" của bài.

## Đã làm (10/11/2026)

- **Khung cho mọi khoá:** `lib/lessonFramePolicy.ts` (`lessonFrameApplies`: học viên đã ghi danh; giữ giao diện cũ cho chưa ghi danh, xem thử, chiếu lớp, giảng viên đứng lớp, bài có bài giảng slide; `isLessonFrameAllCoursesEnabled`: công tắc `SiteSetting lesson_frame.all_courses`, mặc định bật, đặt `false` thì chỉ còn khoá ngoại ngữ; `lessonLevelLabel`: "Unit" ngoại ngữ / "Module" khoá khác). Trang bài học tách `languageSkin` (đánh số lời thoại, tab Từ vựng, vẫn theo `languageMode`) khỏi `lessonFrame` (khung 3 cột). Bài luyện nhúng làm tại chỗ trong khung cho mọi khoá; ngoài khung vẫn là liên kết.
- **Panel phải:** `LessonFrameShell` (máy khách) với hai tab "AI trợ giảng" / "Ghi chú · n" (trợ năng: `tablist`, mũi tên, `aria-selected`), nút đóng, nút mở ở mép phải. Từ 1536 px gắn cố định và mở sẵn; 1280–1535 px gắn cố định, đóng sẵn; dưới 1280 px là ngăn kéo có nền mờ (Esc hoặc bấm nền đóng, tiêu điểm vào nút đóng). Mở/đóng nhớ RIÊNG theo lớp chiều ngang, tab nhớ chung; lưu trữ bị chặn vẫn chạy. Chỉ dựng AI/ghi chú sau lần mở đầu (không gọi API khi chưa cần) rồi giữ nguyên khi chuyển tab hay đóng panel.
- **AI trợ giảng:** `AiTutorPanel` có chế độ `docked` (không nút nổi, không cửa sổ nổi) dùng lại nguyên hội thoại theo bài, gợi ý, ngân sách token, đính đoạn trích. "Hỏi AI" từ vùng bôi đen (`limio:ask-ai`) do panel nghe: mở panel, sang tab AI, chuyển đoạn trích xuống (tín hiệu `nonce` nên cùng đoạn vẫn kích hoạt lại). Chế độ nổi cũ giữ nguyên cho bài ngoài khung. **Ghi chú:** `LessonNotes` thêm `onCount` để số trên tab cập nhật ngay.
- **Bài trước / Bài tiếp theo:** `buildLessonFrame` thêm `prev`; thanh `LessonNavBar` dính ở đáy cột nội dung (bài đầu không có "Bài trước", bài cuối "Về khoá học", bỏ bài khoá, đi qua ranh giới unit/module); thay chân trang "Bài tập tiếp theo →".
- **Bỏ nút nổi** Ghi chú, AI, Mục lục khoá trong khung (còn ở bài ngoài khung). Lề annotation thu về sát trong khung. Rail/tab/nút đổi màu `lime` → `brand` cho thống nhất với toàn ứng dụng.
- **Kiểm tra:** `tsc` sạch; web 219 file / 2510+ test (gồm `lessonFramePolicy.test.ts` 8 ca, `LessonFrameShell.test.tsx` 10 ca jsdom, `LessonFrame.test.tsx` viết lại); core-lms `lessonFrame.test.ts` (thêm `prev`). Xem trên trình duyệt (dev): khoá thường ở 1600 px (panel mở sẵn), 1400 px (đóng sẵn, mở ra 3 cột, tab Ghi chú), 375 px (khối thu gọn "Bài trong module", ngăn kéo, thanh đáy), khoá ngoại ngữ ("Unit", Bài luyện trong khung), công tắc `false` (quay về nút nổi cũ).
- **Lỗi bắt được khi xem trình duyệt:** lớp `flex` của Tailwind đè thuộc tính `hidden` làm panel đóng vẫn hiện; đã sửa bằng lớp `hidden` theo trạng thái và có test.
- **Chưa kiểm bằng mắt:** bài có bài giảng slide (ngoại lệ, đã có test điều kiện), chiếu lớp/giảng viên đứng lớp, và từng loại khối rộng (SCORM/H5P/LTI) trong cột hẹp; "Hỏi AI" bằng chuột phải thật (đã kiểm bằng test sự kiện).
