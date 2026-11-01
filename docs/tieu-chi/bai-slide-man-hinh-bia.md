# Bài slide tương tác có một lối vào — tiêu chí chấp nhận

> Bản 01/11/2026, đã duyệt và đã làm. Áp dụng cho các bài dùng khung slide tương tác `/decks/<id>` và có lời giảng
> (xem AC6 của `trinh-chieu-giang-vien.md`). Bài thường có Nghe giảng không đổi.

## Vì sao làm

Hiện cùng một bài giảng có bốn cách mở: lời mời «Học với giảng viên ảo» (toàn màn hình, có giọng), khung slide trong trang (im lặng,
có thanh công cụ riêng), nút «Nghe giảng» (có giọng nhưng ở trong trang, panel che nội dung) và nút «Trình chiếu» trên panel.
Học viên không biết nên dùng cách nào và kéo xuống thì thấy một bản slide im lặng.

Ngoài ra, bài chỉ có khung nhúng đang được tính hoàn thành khi cuộn hết trang: đã có trường hợp báo 100% khi giọng mới chạy 1:14 / 9:10.
Với khoá bán, con số này không có giá trị.

## Đã chốt

1. Mỗi bài slide tương tác chỉ có **một lối vào**: màn hình bìa, bấm vào là học toàn màn hình.
2. Bìa chính là khung slide thật nằm dưới một lớp phủ, không bấm được. Vì vậy bìa luôn hiện đúng slide, không cần ảnh riêng.
3. Thoát thì giọng tạm dừng, thanh phát đóng và trang về màn hình bìa. Riêng loại bài này khác AC1 của `trinh-chieu-giang-vien.md`.
4. Bài được tính xong khi học viên **đã nghe ít nhất 80% lời giảng**. Tua qua không được tính.
5. Phần đứng trước khung slide là lời giới thiệu nên không hiện nữa: bìa đã thay chỗ. Nhờ vậy bài đã nhập không cần sửa dữ liệu mới hết câu hướng dẫn sai và nhãn thời lượng trên đầu bài.
6. Slide không có dải tiêu đề phía trên (tên bài, chấm tròn). Số trang «n / N» nằm ngay trên slide, ở góc trên phải vì góc dưới phải là chỗ của giảng viên; bìa không có số. Thanh điều khiển của trình chiếu không lặp lại số này.
7. Ngưỡng nghe dùng `completionThresholdPct` của bài, mặc định 80, cùng cột với ngưỡng xem video. Học viên không nghe được giọng có thể cho giọng chạy ở chế độ tắt tiếng và đọc phụ đề; không có đường hoàn thành khác.

## Chưa làm trong đợt này

- Chặn truy cập `/decks/<id>` theo ghi danh (bắt buộc trước khi mở bán, làm thành việc riêng).
- Thu gọn panel Nghe giảng của bài thường.
- Đưa ghi chú, bút, laser của khung vào thanh của trình chiếu.
- Ghi kết quả thao tác trong slide vào lịch sử học và XP.

## AC1 — Màn hình bìa thay các lối vào cũ

- **Given** bài có khung slide tương tác, có lời giảng và khoá không đặt «Không hiện», **when** học viên mở bài, **then** chỗ khung slide là
  màn hình bìa gồm slide nền được làm mờ, ảnh và tên giảng viên, thời lượng thật của lời giảng, số slide và một nút «Bắt đầu học».
- **Then** không còn lời mời «Học với giảng viên ảo», nút «Nghe giảng», và không ai bấm được vào khung slide nằm dưới lớp phủ
  (kể cả bằng phím Tab).
- **Given** học viên đã nghe dở, **then** nút thành «Học tiếp từ slide n». **Given** đã nghe hết, **then** nút thành «Học lại».
- Bìa chiếm đủ chiều ngang của phần nội dung; điện thoại không cuộn ngang, nút cao ít nhất 44 px.

## AC2 — Vào và thoát

- **Given** đang ở bìa, **when** bấm nút, **then** vào toàn màn hình và giọng phát, không cần bấm thêm lần nữa.
- **Given** đang trình chiếu, **when** bấm X hoặc Esc, **then** giọng tạm dừng, thanh phát đóng, trang về bìa và nhớ vị trí đang nghe.
- **Given** khoá đặt «Bắt buộc», **when** mở bài, **then** vẫn vào thẳng trình chiếu như hiện nay; thoát thì về bìa.
- **Given** đang trình chiếu mà giọng đang dừng, **when** học viên tự chuyển slide, **then** slide chuyển và giọng vẫn dừng.

## AC3 — Những bài không đổi

- **Given** bài chưa có giọng, hoặc khoá đặt «Không hiện», **then** khung slide trong trang vẫn dùng được như hiện nay.
- **Given** bài thường không có khung slide tương tác, **then** lời mời, nút «Nghe giảng» và panel giữ nguyên.
- **Given** người sửa được khoá xem ở chế độ xem trước hoặc chế độ giảng viên, **then** các nút dành cho họ giữ nguyên.

## AC4 — Hoàn thành bài

- **Given** học viên mới cuộn hết trang, **then** bài **chưa** được tính hoàn thành.
- **Given** học viên đã nghe từ 80% lời giảng, **then** bài được tính hoàn thành. Đổi tốc độ nghe không ảnh hưởng; nghe lại một đoạn không được cộng hai lần.
- **Given** học viên tua hoặc tự lật qua một đoạn, **then** đoạn đó không được tính là đã nghe.
- **Given** bài còn quiz hoặc bài tập, **then** phải xong cả phần đó và lời giảng mới được tính hoàn thành.
- Thanh tiến độ đầu bài hiện đúng phần trăm lời giảng đã nghe, và chữ hướng dẫn nói rõ cần nghe tiếp bao nhiêu.
- Học viên đã được tính hoàn thành trước đây vẫn giữ nguyên, không bị đổi lại.
- Lần hoàn thành được ghi bằng sự kiện hoàn thành bài sẵn có, với lý do mới là đã nghe đủ.

## AC5 — Sửa chữ và thời lượng

- Bài không còn câu «Bấm «Nghe giảng»…». Script dựng khoá không sinh câu đó nữa và các bài đã nhập được sửa theo.
- Thời lượng trên bìa lấy từ tệp giọng thật. Script dựng khoá không ghi cứng số phút nữa; nhãn «85 phút» của bài đã nhập được kiểm tra và sửa cho khớp.

## AC6 — Kiểm thử

- Test hàm thuần: điều kiện nào thì hiện bìa, nhãn nút theo vị trí nghe, cách tính phần đã nghe (tua, nghe lại, đổi tốc độ, nhiều lần mở bài).
- Duyệt tay trên desktop và 375 px, giao diện sáng và tối, với bài «Hàm số bậc hai và đồ thị»: vào, thoát, học tiếp, đủ 80% thì hoàn thành; khoá đặt «Bắt buộc» và «Không hiện».

## Đã kiểm (01/11/2026, máy dev, giọng giả, bài «Hàm số bậc hai và đồ thị»)

- [x] AC1: bìa hiện đúng tên giảng viên, thời lượng giọng và số slide; không còn lời mời, nút «Nghe giảng»; khung không bấm được. Nút đổi thành «Học tiếp từ slide n». Nút «Học lại» mới kiểm bằng test, chưa xem trên trình duyệt.
- [x] AC2: bấm là vào toàn màn hình và phát, không hỏi lại; Esc về bìa, giọng dừng, nhớ vị trí, trả tiêu điểm về nút; dừng giọng rồi lật slide thì giọng vẫn dừng; khoá «Bắt buộc» vào thẳng trình chiếu, thoát về bìa.
- [x] AC3: khi giảng viên ảo tắt, khung trong trang và nút «Nghe giảng» giữ nguyên. Bài thường và các nút của người sửa khoá không đổi mã nhưng chưa xem lại trên trình duyệt.
- [x] AC4: tua không được cộng; đủ 80% thì ghi `lesson.completed` với lý do `listened_threshold`, không cắt ngang lúc đang học, làm mới trang sau khi thoát.
- [x] AC5: script không còn sinh câu hướng dẫn và không ghi cứng số phút; bìa dùng thời lượng thật.
- [x] AC6: `deckCover.test.ts`, `learner.test.ts`. 375 px: không cuộn ngang, nút cao 44 px.
- [ ] Chưa kiểm: giọng NEU TTS thật, điện thoại thật, giao diện tối, bài có quiz đi kèm, và nhấn Esc khi tiêu điểm ở trong khung.
- [ ] Nhãn thời lượng lưu trong dữ liệu của các bài đã nhập trên server vẫn là số cũ (ví dụ 85 phút) và có thể còn hiện ở nơi khác ngoài trang bài; cần sửa riêng.

## Giới hạn đã biết

- Vị trí đang nghe và phần đã nghe được lưu trong trình duyệt, nên nghe nửa bài trên máy này và nửa bài trên máy khác thì chưa được cộng lại.
- Việc báo đã nghe đủ do trình duyệt gửi lên, cùng mức tin cậy như theo dõi xem video hiện nay.
