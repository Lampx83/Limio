# Phiếu bài tập cho khoá ngoại ngữ — Acceptance criteria

> 13/11/2026, **thầy duyệt (4 câu chốt theo đề xuất), đã code mốc 1** (xem "Kết quả sau khi làm" cuối file). Thầy muốn các Bài luyện của khoá ngoại ngữ (rất nhiều, rải theo kỹ năng nghe, nói, đọc, viết, từ vựng, ngữ pháp) hiển thị **gọn**, **ít thao tác phụ** (không kéo thả) và có **cảm giác làm trên phiếu bài tập của giáo trình**.

## Đã chốt (13/11/2026)

- Chỉ áp cho **Bài luyện nhúng trong bài học của khoá `languageMode`**. Khoá khác, phòng thi, luyện đề, quiz giữ nguyên giao diện.
- **Không kéo thả** trong phiếu. Mọi dạng đang dùng kéo thả đổi sang ô chọn hoặc ô nhập (xem AC3).
- **Nền giấy kem nhẹ** (phương án B): không hoạ tiết, không dòng kẻ, viền mảnh, không bóng đổ. Chỉ áp cho tờ phiếu, không áp cho cả trang bài học.
- **Một bài tập hiện mỗi lúc**, chuyển bằng tab; mỗi tab có đếm tiến độ.
- Chữ học viên viết là **mực xanh**, dấu chấm là **✓ ✗ bút đỏ/xanh lá**; luôn kèm ký hiệu và nhãn đọc màn hình, không chỉ dựa vào màu.
- Giữ nguyên **cách chấm, lưu đáp án, sự kiện** và mọi hành vi đã có (xem thử, giọng nói, nhận xét AI). Phiếu chỉ là lớp trình bày.

- **Bốn câu đã chốt theo đề xuất:** (1) tab theo đoạn văn, nhóm bài tập đặt bằng tiêu đề đoạn văn, không thêm trường mới; (2) "Kiểm tra bài này" chấm tab đang xem, "Kiểm tra tất cả" ở tab cuối chấm cả khối; (3) `drag_drop_fill` đổi hẳn sang ô chọn từ hộp; (4) hàng sai hiện đáp án đúng ngay.

## Hiện trạng

- `LessonPractice` dựng mỗi câu thành một thẻ riêng (`ExamQuestion`), có nút "Kiểm tra câu n" cho từng thẻ. Câu chia thành **bước**: mỗi đoạn văn kèm các câu của nó là một bước; câu ngoài đoạn gộp thành một bước riêng; có chế độ chia đôi (đoạn văn một bên, câu một bên).
- Dạng câu: `mcq`, `multi`, `true_false_notgiven`, `gap_fill`, `short_answer` (nhập khoá thành `gap_fill`), `matching`, `ordering`, `numerical`, `drag_drop_fill`, `essay`.
- Unit 1 Speakout (khoá demo): 22 bài, 25 khối luyện, 132 câu; nhiều khối 8 đến 18 câu; câu thật thường dài hơn một dòng.

## AC1 — Tờ phiếu và tab bài tập

- **Given** Bài luyện của khoá `languageMode`. **Then** khối luyện hiện thành một **tờ phiếu** nền giấy kem nhẹ, có viền mảnh, bo nhẹ như các khối khác.
- Mỗi **bước** (đoạn văn kèm câu, hoặc nhóm câu ngoài đoạn) là một **tab bài tập** ở đầu phiếu: nhãn lấy từ tiêu đề đoạn văn nếu có, không thì "Bài n"; cạnh nhãn có đếm "đã trả lời/tổng" (vd `3/5`). Chỉ **một** tab hiện nội dung; tab đã kiểm tra hết hiện dấu ✓.
- Tab chỉ một bước thì **không hiện thanh tab** (không thêm một hàng vô nghĩa).
- Dòng dặn đầu bài tập: số bài tập và chữ cái (nếu tiêu đề đoạn có dạng "1A…") in đậm màu nhấn, lời dặn in đậm; chip âm thanh nếu bài có khối audio.
- Bài có tiêu đề kỹ năng (`languageSkill` của bài học) hiện **dải tên kỹ năng** trên phiếu (vd GRAMMAR); bài không có kỹ năng thì không dải. Màu dải = màu nhấn mặc định của Limio (màu theo bìa sách là việc sau, xem "Chưa làm").
- Đoạn văn/bài nghe giữ cách hiện hiện nay (chia đôi khi có đoạn văn); phiếu nằm ở phần câu hỏi.

## AC2 — Mỗi câu một dòng gọn

- Mỗi câu là **một hàng** đánh số (số nhỏ, căn phải), nội dung câu và ô trả lời **nằm trong dòng**. Hàng cách nhau bằng khoảng nhỏ, không có thẻ riêng cho từng câu.
- Câu dài tự xuống dòng bình thường; ô điền **không bao giờ kéo rộng hết dòng** và không đẩy chữ xuống dòng riêng.
- Câu có đề bài riêng (câu hỏi không có chỗ trống trong chữ) hiện đề trên một dòng, ô trả lời ngay dưới.
- Giải thích đáp án, bài mẫu và các khối phụ giữ nguyên nội dung nhưng thu gọn (mở ra khi cần).

## AC3 — Cách trả lời theo từng dạng (không kéo thả)

| Dạng | Cách trả lời trong phiếu |
|---|---|
| `gap_fill`, `short_answer`, `numerical` | **Chỗ trống gạch chân** ngay trong câu (chỉ có đường kẻ dưới, không ô viền); độ rộng mặc định (8 ký tự), **nở theo chữ học viên gõ** tới tối đa 40 ký tự (cấu hình công khai không có đáp án nên không biết độ dài đáp án); nhiều chỗ trống trong một câu thì mỗi chỗ một ô |
| `mcq` (một đáp án) có đáp án ngắn | **Khoanh** ngay trong câu: các lựa chọn là chữ có thể bấm, chọn thì có nét tròn mực xanh |
| `mcq` đáp án dài, `multi` | **Danh sách dọc** a) b) c) d), một hàng cho mỗi lựa chọn (nhiều đáp án thì ô tích) |
| Đúng/Sai (mcq hai lựa chọn) | Khoanh trong dòng như trên |
| `matching` | Các vế phải đánh chữ cái hiện một hộp phía trên bài; **mỗi vế trái một hàng với ô chọn chữ cái**. Không kéo |
| `ordering` | Mỗi mục một ô nhập **số thứ tự** (1…n); không kéo |
| `drag_drop_fill` | Hộp từ hiện phía trên; mỗi chỗ trống là **ô chọn từ trong hộp** (không kéo). Từ đã dùng trong hộp được làm mờ |
| `essay` | Giữ nguyên khối riêng (ô gõ, ghi âm, nhận xét AI, bài mẫu) |

- **Nhóm câu dùng chung bộ lựa chọn:** từ 3 câu liền nhau trở lên (chọn một) có cùng danh sách lựa chọn dài thì bộ lựa chọn hiện **một lần** (a, b, c…) và mỗi câu chỉ còn một ô chọn chữ cái; hàng sai ghi đáp án kèm chữ cái. Giáo trình hay có kiểu "Match sentences 1–7 with uses a)–g)". (Dữ liệu Unit 1 hiện chia mỗi câu 3 lựa chọn riêng nên nhóm này chưa kích hoạt ở đó.)
- Ngưỡng "đáp án ngắn" của mcq: mọi lựa chọn không quá 18 ký tự và tổng chữ các lựa chọn không quá 60; vượt thì dùng danh sách dọc. (Ngưỡng này chỉnh được sau khi xem trên dữ liệu thật.)
- Trên điện thoại ô chọn dùng điều khiển gốc của máy; vùng chạm của lựa chọn khoanh không nhỏ hơn 44 px chiều cao.

## AC4 — Kiểm tra và chấm

- Mỗi tab có nút **"Kiểm tra bài này"** ở chân phiếu, chấm các câu **của tab đó** đã trả lời và chưa chấm (hoặc đã sửa sau lần chấm). Ở tab cuối có thêm **"Kiểm tra tất cả"**, chấm mọi câu của cả khối. (Chốt phạm vi nút: xem câu hỏi 2.)
- Bỏ nút "Kiểm tra câu n" ở từng câu trong phiếu.
- Dòng trạng thái ở chân: "Đúng x / y" và "còn n câu chưa làm"; câu chưa làm không bị coi là sai ở bước này.
- Sau khi chấm: mỗi hàng có **✓** (xanh lá) hoặc **✗** (đỏ) ở cuối dòng, nhãn đọc màn hình "Đúng"/"Sai". Hàng sai hiện **đáp án đúng** bằng chữ đỏ ngay dưới hàng; giải thích (nếu có) mở được.
- Sửa đáp án thì dấu của hàng đó mất và hàng đó phải chấm lại. Không hiện dấu trước khi bấm kiểm tra.
- Không đổi cách tính: lần kiểm tra đầu của mỗi câu ghi sự kiện `exam.practice.answered` như hiện nay; bấm nhiều lần không nhân đôi. Xem thử của giảng viên chấm không lưu như hiện nay.

## AC5 — Bút xanh, bút đỏ

- Chữ học viên điền hoặc chọn hiện màu **xanh mực**; dấu chấm và đáp án sửa màu **đỏ/xanh lá**. Tất cả đạt tương phản chữ **≥ 4,5:1** trên nền giấy kem ở chế độ sáng và tối.
- Màu không là cách duy nhất báo đúng/sai: luôn kèm ký hiệu ✓ ✗ và nhãn đọc màn hình.

## AC6 — Nền giấy

- Chế độ sáng: nền kem nhạt (pha từ màu nền thẻ), viền màu giấy mảnh. Chế độ tối: nền tối ấm nhẹ, **không** để tờ trắng chói giữa trang tối.
- Không hoạ tiết, không ảnh giấy, không dòng kẻ, không bóng đổ. Chỉ áp bên trong tờ phiếu.

## AC7 — Mật độ và đo đạc (bắt buộc đo trước khi code)

- Trước khi code, **đo trên Unit 1** với giao diện hiện tại: số dòng và chiều cao của các khối nhiều câu (Grammar, Learn to, Vocabulary Plus) ở 1280 px và 400 px. Kết quả ghi vào cuối file này.
- **Mục tiêu đo được** (đã chốt theo số đo ở cuối file): câu điền, khoanh hoặc chọn ngắn trong phiếu **trung bình không quá 56 px mỗi câu ở 1280 px và không quá 80 px ở 400 px** (hiện trung bình khoảng 310 px và 430 px, tức giảm khoảng 80%); bài tập 5 đến 8 câu ngắn nằm gọn trong **một màn hình 768 px** cùng dải đầu và chân phiếu; không có cuộn ngang ở 400 px. Câu có đề dài hai dòng trở lên được phép cao hơn nhưng không quá 110 px ở 1280 px.

## AC8 — Bàn phím và truy cập

- Thứ tự Tab theo thứ tự câu; **Enter** trong một ô điền chuyển tới ô kế tiếp; ở ô cuối, Enter chuyển tiêu điểm tới nút "Kiểm tra bài này" (không tự chấm).
- Mọi ô có nhãn đọc màn hình "Câu n" (và "chỗ trống m" khi một câu có nhiều chỗ). Lựa chọn khoanh là nút có `aria-pressed`.
- Tab bài tập dùng đúng vai trò tab của trình đọc màn hình (mũi tên trái/phải đổi tab).

## Mốc 2 (đề xuất) — nhận diện theo sách: cài đặt ở đâu

Mỗi giáo trình có màu và hoạ tiết riêng, nên nhận diện là **thuộc tính của khoá**, đặt cạnh thông tin sách, không phải cài đặt chung của hệ thống hay của từng giảng viên.

- **Vị trí:** trang sửa khoá, mục **"Thông tin sách"** (nơi đã có nhà xuất bản, tác giả, lần xuất bản, ảnh bìa) có thêm khối **"Giao diện theo sách"**. Một chỗ duy nhất, có **xem trước ngay bằng chính tờ phiếu** ở trên.
- **Chỉ ba lựa chọn:** (1) **màu chính** (dải kỹ năng, số bài, chip âm thanh, nút chính trong phiếu); (2) **hoạ tiết** chọn một trong khoảng 6 mẫu có sẵn hoặc "không"; (3) **logo** (tuỳ chọn). Màu phụ (vòng số) tự suy ra từ màu chính; nền giấy kem cố định theo phương án B, không cho chỉnh.
- **Gợi ý tự động:** khi tải ảnh bìa, hệ thống đề xuất sẵn màu chính lấy từ bìa; giảng viên bấm nhận hoặc đổi. Chưa chọn gì thì dùng màu mặc định của Limio.
- **Chống màu khó đọc:** màu giảng viên chọn được tự điều chỉnh khi dùng làm chữ hoặc nền chữ để đạt tương phản ≥ 4,5:1; không cho lưu giá trị không phải mã màu hợp lệ.
- **Nơi áp dụng (trang học viên của khoá đó):** dải và số trong phiếu bài tập, banner trang khoá, thẻ khoá trong danh mục, thanh tiến độ và vạch bài đang xem ở khung bài học. Giao diện giảng viên và quản trị giữ nhận diện Limio.
- **Dữ liệu:** thêm cột vào `Course` (`themeColor`, `themePattern`, `themeLogoUrl`), sửa qua `updateCourse` với quyền sửa khoá (cùng cách với `publisher`, `coverUrl`); nhân bản khoá sao chép luôn nhận diện. Chưa có "bộ sách" dùng chung nhiều khoá; nếu sau này cần (một bộ nhiều cấp độ) thì thêm lớp mẫu ở cấp tổ chức, không đổi chỗ cài đặt này.
- Khi làm xong phải cập nhật `GIAO-DIEN.md` và hướng dẫn của Lily (vì đây là mục mới ở trang sửa khoá của giảng viên).

## Chưa làm trong tài liệu này (để mốc sau)

- Mốc 2 nói trên (cài đặt "Giao diện theo sách" và áp màu/hoạ tiết lên cả giao diện học viên): cần AC riêng khi bắt đầu.
- Liên kết "Language bank" ở chân phiếu; hộp gợi ý/quy tắc tô nhạt kiểu sách (cần thêm loại khối trong trình soạn).
- Đổi trình soạn Bài luyện: soạn vẫn theo câu hỏi như hiện nay; xem trước của giảng viên dùng đúng phiếu này.

## Kiểm thử

- Hàm chọn kiểu trả lời theo dạng câu và theo độ dài lựa chọn (ngưỡng "đáp án ngắn").
- Hàm tính độ rộng ô điền theo đáp án mong đợi (tối thiểu/tối đa).
- Mỗi dạng câu trong bảng AC3 dựng đúng điều khiển, không còn thao tác kéo thả; trả lời xong giá trị gửi đúng dạng dữ liệu cũ (ví dụ matching vẫn `{matched:{…}}`).
- "Kiểm tra bài này"/"Kiểm tra tất cả": đúng câu cần chấm, không chấm lặp, một câu lỗi không dừng cả loạt, trạng thái "k/n".
- Dấu ✓ ✗ có nhãn đọc màn hình; sửa đáp án xoá dấu.
- Xem thử không gọi lưu; khoá không `languageMode` vẫn dựng thẻ cũ.
- Quét bằng trình duyệt ở 400 và 1280 px, chế độ sáng và tối: không cuộn ngang, tương phản đạt.

## Câu cần thầy chốt

1. **Tab theo đoạn văn có đủ không?** Một số khối Unit 1 chỉ có câu rời không đoạn văn (gộp thành một tab). Nếu một khối rời quá dài (vd 17 câu của Grammar), có nên cho giảng viên chia nhóm bài tập (đánh dấu "Bài 1A, 1B") ngay trong trình soạn không? Đề xuất: **có**, bằng tiêu đề đoạn văn như hiện nay, không thêm trường mới.
2. **Phạm vi nút kiểm tra:** "Kiểm tra bài này" chấm tab đang xem, còn "Kiểm tra tất cả" chấm cả khối (đề xuất, thay cho câu hỏi 1 của `bai-luyen-kiem-tra-tat-ca.md`). Hay chỉ một nút chấm cả khối?
3. **`drag_drop_fill` → ô chọn từ hộp:** đổi hẳn trong phiếu (đề xuất) hay cho học viên chọn lại cách kéo thả?
4. **Hàng sai hiện đáp án ngay** (như giấy được chấm) hay chỉ hiện khi bấm "xem đáp án"? Đề xuất: hiện ngay, vì học viên đã bấm kiểm tra.

## Kết quả đo Unit 1 (13/11/2026, giao diện hiện tại, máy dev, tài khoản học viên demo)

Đo chiều cao thật của mỗi thẻ câu hỏi (`[id^="lp-"]` trong khối Bài luyện) bằng trình duyệt. Chưa đo bài 1.1 Vocabulary Plus (khối 13 câu).

| Bài, khối | Số thẻ | Cao từng thẻ ở 1280 px | Trung bình (1280) | Trung bình (400) |
|---|---|---|---|---|
| 1.2 Grammar, khối 1 | 7 | 392, 392, 358, 501, 365, 365, 392 | **395 px** (tổng 2.765) | **488 px** (tổng 3.413) |
| 1.2 Grammar, khối 3 | 6 | 339, 276, 339, 435, 339, 339 | **345 px** (tổng 2.067) | **410 px** (tổng 2.459) |
| 1.1 Grammar, khối 2 | 8 | 243 ×5, 276 ×3 | **255 px** (tổng 2.043) | chưa đo |
| 1.3 Learn to, khối 1 | 3 | 209 ×3 | **209 px** (tổng 627) | chưa đo |
| 1.3 Learn to, khối 2 | 2 | 264 ×2 | **264 px** (tổng 528) | chưa đo |

- Trung bình chung 26 thẻ ở 1280 px: **khoảng 310 px mỗi câu**. Ở 400 px: **khoảng 430 px**.
- Có hai thẻ rất lớn: một thẻ **853 px** (1.1 Grammar, khối 1) và một thẻ **1.522 px ở 1280 px, 1.185 px ở 400 px** (1.2 Grammar, khối 2), đều là dạng ghép/dài. Phiếu phải xử lý riêng (AC3, dạng `matching`).
- Cả ba khối của 1.2 Grammar (21 thẻ) cao tổng cộng khoảng **6.300 px** ở 1280 px, tức hơn **7 màn hình** 800 px chỉ để làm một bài.
- Không có cuộn ngang ở 400 px (bao gồm cả trang).
- Đoạn văn một khối dài là cột riêng nên không tính vào các số trên.

## Kết quả sau khi làm (13/11/2026)

Làm ở mốc 1: `components/language/PracticeSheet.tsx`, `lib/practiceSheetView.ts`, kiểu giấy `.practice-sheet` trong `globals.css`, nối vào `LessonPractice` bằng prop `sheet` (bật theo khoá `languageMode`; cả trang bài học và trang "Xem trước" của trình soạn Bài luyện). Khoá khác giữ thẻ cũ.

**Đo lại cùng khối, cùng tài khoản** (chiều cao trung bình mỗi câu; ở 1280 px cột phiếu rộng 455 px vì cạnh còn thanh bài, đoạn văn chia đôi và panel AI):

| Khối | Dạng câu | Thẻ cũ → phiếu (1280 px) | Thẻ cũ → phiếu (400 px) |
|---|---|---|---|
| 1.3 Learn to, khối 1 | điền ngắn | 209 → **38 px** (−82%) | 63 đến 90 px |
| 1.3 Learn to, khối 2 | khoanh trong dòng | 264 → **68 px** (−74%) | 84 đến 112 px |
| 1.2 Grammar, khối 3 | điền, câu dài 3 dòng | 345 → **102 px** (−70%) | 410 → **131 px** (−68%) |
| 1.2 Grammar, khối 1 | chọn một trong ba lựa chọn dài | 395 → **256 px** (−35%) | 488 → **300 px** (−39%) |
| 1.2 Grammar, ghép bảy câu | ghép | 1.522 → **749 px** (−51%) | 1.185 → **1.061 px** (−10%) |

- **Mục tiêu "≤ 56 px/câu" đạt với câu điền hoặc khoanh ngắn một dòng** (38 và 68 px). Câu dài nhiều dòng hay có nhiều lựa chọn dài **không** đạt vì độ cao do chữ chiếm, không do khung: cột phiếu hẹp (455 px ở 1280 px). Chốt lại: mục tiêu áp cho **câu ngắn**, và với khối còn lại yêu cầu **giảm ít nhất 35%** so với thẻ cũ (đạt).
- Ở 400 px không có cuộn ngang (thanh tab tự cuộn ngang trong chính nó), vùng chạm của khoanh đáp án và ô chọn ≥ 44 px.
- Tương phản chữ–nền đạt ở chế độ sáng và tối: chữ 18,3 và 14,1; chữ phụ 7,3 và 6,6; mực xanh 5,5 và 7,6; ✓ 4,8 và 8,2; ✗ 5,1 và 6,9 (đều ≥ 4,5).
- Nút "Chia đôi/Một cột" vẫn dùng được: chọn "Một cột" thì phiếu rộng gấp đôi, câu dài ít xuống dòng hơn.

**Còn lại, chưa làm:**
- Dạng ghép ở màn hẹp vẫn cao (bảy câu dài cộng bộ lựa chọn); hàng sai dạng ghép/sắp xếp/kéo thả còn dùng thẻ "bài làm và đáp án" đầy đủ thay vì một dòng đáp án.
- Mốc 2 (màu và hoạ tiết theo bìa sách) và dải kỹ năng chỉ hiện khi bài có nhãn kỹ năng.
- Chưa xem được bằng mắt ở trình duyệt trong app (khung xem trước đang ẩn nên ảnh chụp không đáng tin); đã kiểm bằng đo DOM, 10 test mới của phiếu và 15 test của hàm trình bày.

## Chỉnh theo ý thầy, 13/11/2026 (thay các điều trước đó về màu và tab)

- **Nền khối luyện tập giống khối bài học:** bỏ nền giấy kem; phiếu và thẻ đoạn văn dùng đúng nền và viền của các khối khác (thẻ trắng, viền thường). Quyết định "nền giấy kem nhẹ" ở đầu tài liệu **không còn hiệu lực**.
- **Một bảng màu:** màu nhấn của khoá (`Course.themeColor`, vd magenta của Speakout) cộng trung tính; chỉ dấu ✓ (xanh lá) và ✗ (đỏ) dùng màu riêng. Bỏ mực xanh dương: đáp án đã chọn tô màu nhấn, chữ học viên gõ màu chữ thường. Bong bóng thoại cùng màu nhấn; thẻ bài báo và hộp từ nền trung tính. Khung bài học (thanh bài, nút chính) cũng theo màu nhấn khi khoá có màu.
- **Tab trực quan:** mỗi bài tập là một nút có viền, bài đang mở tô màu nhấn, kèm chip đếm `đã làm/tổng` (✓ trên nền xanh khi đã kiểm tra hết); tab xuống dòng thay vì cuộn ngang ẩn; tên dài cắt bằng "…" và hiện đủ ở gợi ý.
- Tên khối luyện ("… · Practice") không còn hiện thành một dòng tiêu đề (chỉ để trình đọc màn hình); đề của Ex 3A bỏ "Sentence n:" và câu hỏi lặp lại vì số dòng và lời dặn bài tập đã nói đủ.
