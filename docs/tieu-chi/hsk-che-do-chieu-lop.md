# Chế độ "Chiếu lớp" cho bài học HSK — tiêu chí chấp nhận

> Bản nháp 26/11/2026, **đã duyệt cách làm (26/11) và đã code mốc đầu (chưa commit).** Mục đích: trung tâm mua giáo trình HSK 4 cần slide để dạy từng bài mà người
> soạn không phải soạn PowerPoint. Slide được **dựng tự động từ chính nội dung bài học**, không lưu bản sao.

## Vì sao không dùng Limio-Live

Khảo sát 26/11/2026 trên mã nguồn:

- Slide Limio-Live (`LiveSlide`) chỉ có chữ, ảnh, câu hỏi; **không hiện pinyin thẳng hàng dưới chữ Hán (ruby) và không phát giọng đọc**. Bài HSK cần cả hai ở mọi hội thoại và từ mới.
- Các thành phần hiện pinyin và phát giọng đã có sẵn ở trang bài học của học viên (`DialogueView`, `HskVocabView`, `RubyText`, khung Bài luyện).
- Dựng slide Limio-Live thì phải thêm ruby và âm thanh vào bộ vẽ slide, rồi sinh và lưu slide cho 25 chủ đề × 5 bài; sửa nội dung bài thì slide lệch theo.

Chế độ chiếu lớp **đọc nội dung bài tại lúc mở**, nên bài sửa là slide đổi theo, không có gì để đồng bộ.

## Phạm vi

- **Có:** một trang toàn màn hình cho mỗi bài học, chia thành các màn theo khuôn cố định; bấm phím hoặc nút để chuyển; bật/tắt pinyin và bản dịch; nghe giọng đọc; hiện đáp án từng câu luyện.
- **Chưa làm (ghi rõ):** sửa từng slide; xuất PDF hoặc PowerPoint; cả lớp cùng bấm trả lời trên điện thoại (Limio-Live làm được, chế độ này thì không); chế độ hai màn hình (màn giáo viên có ghi chú, màn chiếu cho lớp); bài không phải HSK (khuôn bố cục viết cho khoá `languageMode`).

## A. Khuôn màn

Mỗi bài khoá sinh các màn theo thứ tự sau. Phần nào bài không có thì bỏ màn đó, không để màn trống.

- **A1. Mở bài:** tên bài, mục tiêu. **Cấp độ "Limio HSK N"** (thầy yêu cầu 26/11) hiện ở đầu thanh trên (viên lime, rê chuột thấy tên khoá) và trên bìa. N lấy từ tên khoá (`limioHskLabel`): "… HSK 3.0 — Cấp 4 …" → 4 (3.0 là phiên bản chuẩn, không phải cấp), "Limio HSK4 …" → 4. Không nhận ra thì không hiện viên và bìa hiện tên khoá như trước. **Số chủ đề** (thầy yêu cầu 26/11) đi kèm: viên và dòng trên bìa ghi "Limio HSK 4 · Chủ đề 1"; dòng nhỏ dưới tên bài và dòng phụ của thanh trên ghi tên đầy đủ của chủ đề ("Chủ đề 1 · 搬进新家 — Dọn về nhà mới"). Số lấy từ tên module (`unitNumberLabel`: "Chủ đề N", "Unit N"); không có số thì chỉ hiện cấp độ.
- **A2. Tình huống:** đoạn tình huống và câu tóm tắt tiếng Trung, kèm ảnh nếu có.
- **A3. Hội thoại** (mỗi hội thoại A, B…): một màn nghe cả đoạn, rồi mỗi lượt một màn. Mỗi lượt hiện chữ Hán lớn có pinyin dưới chữ, bản dịch tiếng Việt, nút nghe lượt đó.
- **A4. Từ mới:** mỗi từ một **thẻ lật** giống tab Từ vựng của bài học (thầy yêu cầu 26/11): mặt trước chữ Hán lớn có pinyin dưới chữ; bấm vào thẻ (hoặc Enter, mũi tên lên/xuống) để lật sang mặt sau gồm pinyin, loại từ và nghĩa, câu ví dụ có pinyin và dịch, ghi chú dễ nhầm. Phía trên thẻ có nút "Nghe từ", "Nghe câu" (nếu có âm thanh) và **"Cách viết"** mở hộp thứ tự nét của bài học ("Xem nét", "Tập viết"), kèm pinyin, nghĩa và ví dụ của từ. Esc đóng hộp, chưa thoát bài. Sang từ khác thì thẻ về mặt trước.
- **A5. Ngữ pháp:** mỗi điểm ngữ pháp một màn với công thức, ví dụ và lưu ý (nếu bài có). **Bảng ví dụ "Câu | Pinyin | Nghĩa" gộp cột Pinyin vào cột chữ Hán** (thầy yêu cầu 26/11): pinyin nằm dưới từng chữ Hán, bảng chỉ còn hai cột (Câu, Nghĩa). Hàng nào pinyin không khớp số chữ Hán thì giữ pinyin thành dòng nhỏ dưới câu, không mất chữ.
- **A6. Luyện tập:** mỗi câu hỏi một màn; đáp án và lời giải **ẩn** cho tới khi giáo viên bấm "Hiện đáp án" (phím A hoặc Enter).
  - **Mọi thứ đi kèm câu phải hiện cùng câu (thầy yêu cầu 26/11):** bài đọc, hình, **âm thanh** (nút nghe), **bảng** của đoạn dẫn nằm ở một bên, câu hỏi ở bên kia; câu nói hội thoại đóng vai hiện đủ kịch bản các lượt (chữ Hán, pinyin, tên vai) kèm nút nghe từng lượt và "Nghe cả đoạn"; câu nói tự do hiện tình huống, lời mở đầu và cụm gợi ý. Không có màn riêng chỉ chứa bài đọc hay hình.
  - **Câu mở (đóng vai, nói tự do, viết) không có nút "Hiện đáp án"** (thầy chốt 26/11): không có đáp án cố định, chỉ hiện đề, kịch bản và gợi ý.
  - Đáp án lấy qua API riêng chỉ cho người dạy của khoá, trả chữ đã rút gọn (không trả cấu hình thô); đáp án đúng của câu trắc nghiệm được tô xanh.
- **A7. Tóm tắt:** các ý tóm tắt cuối bài.
- **A8.** Thứ tự và nội dung màn lấy từ bài học; **không** có chữ nào do hệ thống tự bịa ngoài tên màn ("Từ mới", "Hội thoại"…).

## G. Thiết kế (thầy yêu cầu 26/11: đẹp, bắt mắt, hài hoà)

- **G1.** **Màu thương hiệu Limio cho toàn bộ slide (thầy chốt 26/11):** nền trắng ngà, thẻ trắng viền mảnh như trang bài học; màu mục là **lime của Limio** (vạch dày mép trái, viên tên mục lime đặc chữ trắng, tiêu đề màn, nút nghe, chữ cái lựa chọn, đáp án đúng, thanh tiến độ); màu tô từ quan trọng là **hồng của Limio** (cùng hồng với tiêu đề ngữ pháp trong bài học). Mọi mục dùng chung một bộ màu, không còn đổi màu theo mục. Không dùng nền chuyển sắc đậm.
- **G2.** Thẻ có vạch màu của mục ở mép trái (như hộp "Mục tiêu"/"Ghi nhớ" trong bài); tên mục là viên thuốc màu; nút nghe tròn; lựa chọn là thẻ có chữ cái; bản dịch trong khung có vạch màu. Bìa là thẻ trắng lớn có vạch lime và chữ Hán của tên bài làm hình mờ.
- **G4.** **Thẻ nội dung tràn viền** (thầy chốt 26/11): phủ kín vùng giữa thanh trên và thanh dưới, vạch màu của mục ở mép trái, nội dung căn giữa dọc.
- **G5.** **Giao diện màu** (thầy yêu cầu 26/11), nút bảng màu ở thanh trên, nhớ theo trình duyệt: "Giấy nhám" (**mặc định**, thầy chọn 26/11: nền kem ấm có vân giấy thô nổi khối và vệt loang, giữ nguyên bộ màu lime + hồng Limio), "Sáng (Limio)" (nền trắng ngà phẳng), "Xanh dịu", "Bảng xanh" (nền xanh đậm có vân phấn, bút trắng thay bút đen). Mỗi giao diện đặt lại các biến màu của trang nên cả phần chữ lấy từ bài học đổi theo.
- **G6.** Màn chữ lấy từ bài viết (tình huống, ngữ pháp, văn hoá, tổng kết…) giữ **đúng kiểu chữ nội tuyến của bài học** (tiêu đề mục màu hồng có chip số, hộp "Ghi nhớ", bảng đầu hồng…), chỉ đổi cỡ chữ từ rem sang em để co giãn theo cỡ người dạy chọn. Không dựng lại bằng giao diện thẻ HSK (bản đó làm màn Ngữ pháp xấu, có số "1" lẻ loi).
- **G7.** **Mỗi trang tối đa ba màu chữ:** mực (màu chữ chính; pinyin và bản dịch dùng cùng màu mực nhạt hơn), lime Limio (viên tên mục, tên người nói, nút, chữ cái lựa chọn, đáp án đúng) và hồng Limio (chỉ từ quan trọng). Màn chữ lấy từ bài viết: mọi màu nội tuyến (hồng, xanh dương…) gom về lime.
- **G8.** **Từ quan trọng nổi bật:** từ mới của bài (từ 2 chữ Hán trở lên) được tô màu và gạch nền khi gặp trong lời thoại, kịch bản đóng vai, bài đọc đi kèm câu hỏi; từ mới trong câu ví dụ; cụm in đậm trong phần ngữ pháp. Từ một chữ không tô (trùng quá nhiều chỗ).
- **G9.** Đỡ đơn điệu: nền thẻ có vệt màu của mục ở góc và một vòng tròn mờ; bìa dùng màu lime của Limio.
- **G10.** **Nguyên tắc thiết kế trình chiếu áp dụng (thầy yêu cầu 26/11):** (1) một ý chính mỗi màn (chữ từ bài viết tách tối đa ~380 chữ mỗi màn; mỗi lượt thoại, mỗi từ, mỗi câu hỏi một màn); (2) phân cấp rõ: tên mục nhỏ → tiêu đề lớn → nội dung, khoảng cách theo thang 0,5/1/2 rem; (3) tương phản: chữ và nền đặc dùng bản đậm của màu mục (`--ac-ink`, `--hl-ink`) để đạt ≥ 4,5:1, vạch và nền nhạt dùng bản gốc; (4) quy tắc 60-30-10: nền trung tính, mực, một màu mục, màu tô chỉ cho từ quan trọng; (5) một lề trái chung, nút nghe cùng lề với tiêu đề; (6) màn đọc dài xếp từ trên xuống, màn ngắn căn giữa dọc; (7) màn chữ dài không tô cả câu (cụm in đậm dài hơn 14 chữ không được tô).
- **G3.** Chuyển màn có hiệu ứng trượt nhẹ; tắt khi người dùng bật "giảm chuyển động" của hệ điều hành.

## B. Điều khiển

- **B1.** Phím ← → (và Space) chuyển màn; nút trên màn cho điện thoại và máy tính bảng; vuốt trái phải trên cảm ứng.
- **B2.** Phím F vào/ra toàn màn hình; Esc thoát về trang bài học.
- **B3.** Phím P bật/tắt pinyin, phím T bật/tắt bản dịch; trạng thái giữ khi sang màn khác. Mặc định: pinyin bật, bản dịch tắt (giáo viên bấm để cho cả lớp thấy nghĩa).
- **B4.** Có thanh mục lục: nhảy tới phần Hội thoại, Từ mới, Luyện tập… Mở trang với `#<số màn>` thì vào đúng màn đó.
- **B4b.** Ba nút cỡ chữ "A A A" ở thanh trên (nhỏ 85% / vừa 100% / lớn 130%); cỡ chọn được nhớ theo trình duyệt. Cỡ co để vừa màn (B5) tính trên cỡ đã chọn.
- **B6.** Hội thoại: bấm "Nghe cả đoạn" thì **dòng đang được đọc sáng lên** và tự cuộn vào tầm nhìn. Có âm thanh từng lượt thì sáng theo từng lượt; chỉ có tệp cả đoạn thì sáng theo mốc `startSec` của lượt. Áp cho màn tổng hợp hội thoại và kịch bản đóng vai trong câu luyện tập; dừng hoặc sang màn khác thì tắt sáng.
- **B7.** Hai bút trên thanh trên (thầy yêu cầu 26/11). **Bút laser** (phím L): chấm đỏ có quầng sáng đi theo con trỏ hoặc ngón tay, kèm vệt mờ dần. **Bút vẽ** (phím D): vẽ lên màn đang chiếu bằng chuột, bút cảm ứng hoặc ngón tay; 4 màu (đỏ, xanh dương, xanh lá, đen), "Hoàn tác" nét cuối (U), "Xoá nét vẽ của màn này" (C). Nét vẽ nhớ theo từng màn và đổi cỡ cửa sổ vẫn đúng chỗ. Khi bút đang bật, lớp phủ nhận chuột (bấm nút nghe, hiện đáp án phải tắt bút bằng L/D hoặc Esc); phím mũi tên vẫn chuyển màn, con lăn vẫn cuộn màn. Esc khi đang bật bút thì tắt bút, chưa thoát bài. Nét vẽ chỉ ở trình duyệt của người dạy, không lưu lên máy chủ.
- **B5.** Chữ đủ lớn đọc được từ cuối lớp: cỡ gốc chữ Hán lớn nhất 55 px ở màn ngang 1280 px (~83 px ở 1920), chữ thân bài ~31 px. Màn dài hơn khung thì co chữ **nhưng không nhỏ hơn 80% cỡ gốc** (thầy chốt 26/11); dài hơn nữa thì giữ cỡ chữ và **cho cuộn** (cột bài đọc/kịch bản bên cạnh câu hỏi cuộn riêng). Danh sách dài tự tách thành nhiều màn.

## C. Âm thanh

- **C1.** Giọng đọc là bản đã tạo sẵn cho bài (cùng tệp học viên nghe). Màn không có âm thanh thì không hiện nút nghe, không báo lỗi.
- **C2.** Một lúc chỉ một nguồn âm thanh chạy; sang màn khác thì dừng tiếng.

## D. Quyền truy cập

- **D1.** Người chưa đăng nhập: chuyển tới đăng nhập. Người không có quyền xem bài: 404 (cùng luật với trang bài học).
- **D2.** **Đã chốt 26/11:** người dạy của khoá = bốn vai `CourseInstructor` (chủ, đồng giảng viên, giảng viên không sửa, trợ giảng) và admin nền tảng, qua `canGradeCourse`; chỉ khoá `languageMode`. Học viên không có nút và vào thẳng địa chỉ thì 404, vì màn Luyện tập cho xem đáp án. Ở khoá ngoại ngữ, **"Slide" của người dạy chính là Chiếu lớp** (thầy chốt 26/11): nút **"Slide"** ở đầu trang bài học (cạnh Nghe giảng, Podcast) mở thẳng Chiếu lớp và **thay** nút Slide Limio-Live, để không có hai nút cùng tên gọi dễ nhầm. Không hiện khi đang chọn vai học viên.
- **D3.** Bài thuộc khoá bật học liệu có bản quyền (`protected_media`): chế độ này **không** cho tải âm thanh hay ảnh, đi qua cùng cổng `guardedLessonMedia` như trang bài học, và bị chặn in như `PrintBlock`.

## E. Dữ liệu và sự kiện

- **E1.** Không thêm bảng, không ghi bản sao slide. Không đổi nội dung bài.
- **E2.** Mở chế độ này không phải hoạt động học của ai: không phát `LearningEvent` và không đụng `learnerActivityWhere()`. **Mốc đầu không đo mức dùng** (chưa có ý kiến của thầy); nếu cần thì thêm sự kiện riêng `lesson.teach_mode.opened` (payload chỉ id, đưa vào `NON_LEARNER_ACTIVITY_PREFIXES`).

## F. Cách kiểm

- **F1.** Test thuần: hàm `buildTeachingFrames(lesson)` nhận nội dung bài và trả danh sách màn. Kiểm: đủ thứ tự A1→A7; bài thiếu phần nào thì không có màn phần đó; mỗi lượt hội thoại một màn; mỗi từ mới một màn; đáp án không nằm trong dữ liệu màn Luyện tập khi chưa bấm.
- **F2.** Thử bằng mắt trên máy dev với **Chủ đề 1 · Bài khoá 1** (hội thoại A, B; 10+ từ mới; luyện tập): đủ pinyin, nghe được, phím chạy, ngang 1280 px và điện thoại.
- **F3.** Chạy `buildTeachingFrames` trên cả 25 chủ đề của khoá `hsk-4-goc` và báo số màn mỗi bài; bài nào ra 0 màn hoặc quá 120 màn thì liệt kê.

## H. Màn giảng viên (dạy trên máy chiếu; thầy chốt 26/11/2026)

Thầy/cô chiếu Slide lên máy chiếu thì **mọi thứ trên cửa sổ Slide học viên đều thấy**. Vì vậy đồng hồ và màn kế tiếp nằm ở một cửa sổ riêng. **Ghi chú giảng viên (`teacher_note`) không đưa vào Chiếu lớp** (thầy chốt bỏ 26/11/2026): khối này vẫn ở trang bài học và trang soạn, nhưng không vào màn nào.

- H1. Nút "Màn giảng viên" (phím N) trên thanh Slide mở `/day?presenter=1` ở cửa sổ phụ.
- H2. Màn giảng viên có: tên màn đang chiếu và số thứ tự, tên màn kế tiếp, nút Trước/Sau (phím mũi tên, Space, PageUp/PageDown), danh sách nhảy tới màn bất kỳ, đồng hồ buổi dạy (bấm tạm dừng, bấm đúp đặt lại).
- H3. Hai cửa sổ đồng bộ hai chiều qua BroadcastChannel cùng trình duyệt (không qua máy chủ, không lưu gì): đổi màn ở bên nào, bên kia theo; mở màn giảng viên sau vẫn nhận đúng màn đang chiếu.
- H4. Cách dùng: mở Slide ở một cửa sổ và kéo sang máy chiếu; mở Màn giảng viên ở màn hình của mình.
- Giới hạn: hai cửa sổ phải cùng một trình duyệt và cùng hồ sơ; chưa dùng Window Management API để tự đặt cửa sổ lên màn hình thứ hai.

## Kết quả đo F3 (dev, 26/11/2026)

Khoá `hsk-4-goc`, Chủ đề 1–9 (các chủ đề 10–25 trên máy dev mới là bản giữ chỗ nên chưa có nội dung để dựng): bài khoá 88–100 màn, Khởi động 24–28, Bài tập tổng hợp 53–64, Ôn tập 62–71. Không bài nào quá 120 màn. Chạy lại bằng `packages/core-lms/scripts/teaching-frames-report.ts`.

## Còn treo

1. Đo mức dùng (E2).
2. Màn hình hai ô (màn giáo viên có ghi chú, màn chiếu cho lớp) và xuất PDF/PowerPoint: chưa làm.
3. Thử trên máy chiếu thật và với micro/âm thanh thật của đề (dữ liệu dev có ít âm thanh).
4. Hướng dẫn của Lily (`teacherAssistantGuide.ts`) chưa nói về nút "Chiếu lớp".
