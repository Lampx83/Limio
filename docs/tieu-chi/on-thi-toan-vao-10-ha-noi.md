# Khoá "Ôn thi Toán vào 10" theo đề Hà Nội — tiêu chí chấp nhận

> Bản 02/11/2026, **đã duyệt**, mốc 1 và 2 đã làm trên máy dev. Khoá bán do Limio soạn, chỉ theo đề Hà Nội; các tỉnh khác để sau.
> Nguồn học liệu: `docs/hoc-lieu/on-thi-toan-vao-10/`.

## Vì sao làm

Học sinh ôn thi cần ba việc: biết mình yếu dạng nào, luyện đúng dạng đó, rồi tập làm trọn đề trong 120 phút. Khoá hiện chỉ có việc giải một đề, và bài luyện 9 câu của nó không cho biết học sinh yếu dạng nào.

## Đã chốt

1. Khoá chỉ theo đề Hà Nội, tự luận 120 phút, thang điểm 10, 5 câu.
2. Khoá gồm ba phần: **Luyện theo dạng** và **Giải đề mẫu** nằm trong danh sách bài; **Đề mô phỏng** nằm ở mục "Luyện thi" trên trang khoá.
3. Mỗi dạng là một bài riêng, vì Limio theo dõi mức nắm vững theo từng bài. Đặt quiz theo dạng mới cho gợi ý ôn đúng chỗ.
4. Mỗi đề mẫu chỉ là **một bài**: khung slide ở đầu, lời giải đọc lại ở dưới. Lời giảng chỉ theo slide.

## Đã duyệt thêm

5. Tên khoá "Ôn thi Toán vào 10", địa chỉ `on-thi-toan-vao-10`, tách khỏi khoá mẫu cho nhà xuất bản `on-thi-vao-10-toan-mau`.
6. Đề mô phỏng do Limio soạn mới theo ma trận, không chép đề của đơn vị khác.
7. Làm đề mô phỏng trên giấy và **tự chấm toàn bộ** theo thang điểm từng ý. Tôi bỏ ý nhập đáp số để máy chấm đã nêu trước đó: học sinh thi trên giấy thì việc gõ đáp số làm mất nhịp thi, mà phần lớn điểm là lập luận nên máy cũng không chấm được.
8. Điểm tự chấm chỉ để học sinh tự đánh giá: **không cấp XP và không cập nhật mức nắm vững**, vì tự chấm dễ cho điểm cao. Mức nắm vững vẫn đến từ quiz của các bài dạng.

## Ma trận tạm thời

Đây là ma trận Limio tổng hợp, **không phải văn bản của Sở GDĐT Hà Nội**. Điểm từng câu lấy từ đề 2026. Điểm từng ý lấy từ một đáp án tham khảo trên báo, riêng ý IV.2c là suy ra. Mức độ là ước lượng, cần giáo viên Toán duyệt.

| Câu | Điểm | Mạch | Ý (điểm tham khảo) | Mức độ ước lượng |
|---|---:|---|---|---|
| I | 1,5 | Thống kê và xác suất | Thống kê 1,0; xác suất 0,5 | Nhận biết, thông hiểu |
| II | 1,5 | Biểu thức chứa căn | Tính giá trị 0,25; rút gọn 0,75; ý 3 0,5 | Ý 3 là vận dụng |
| III | 2,5 | Phương trình, hệ, thực tế | Bài thực tế 1,0 và 1,0; ý 3 0,5 | Ý 3 là vận dụng |
| IV | 4,0 | Hình khối và đường tròn | Hình khối 0,5 và 0,5; 2a 1,0; 2b 1,5; 2c khoảng 0,5 | 2c là vận dụng cao |
| V | 0,5 | Câu phân loại | 0,5 | Vận dụng cao |

Trang VietJack ghi cùng điểm năm câu này cho đề 2025 nhưng mô tả câu V là bất đẳng thức, còn đề 2026 là tối ưu thực tế. **Ma trận chỉ được chốt sau khi đối chiếu đề thật năm 2025**, và cả đề minh hoạ của Sở nếu có. Đề theo cấu trúc trước 2025 chỉ dùng làm bài luyện dạng, không dùng để lập ma trận.

## Danh sách dạng

**Đợt đầu: đã xuất hiện trong đề 2026.**

| Câu | Dạng |
|---|---|
| I | Bảng tần số ghép nhóm |
| I | Xác suất của biến cố |
| II | Rút gọn và tính giá trị biểu thức |
| II | Tìm x để biểu thức nguyên |
| III | Bài toán thực tế lập phương trình, hệ phương trình |
| III | Hệ thức Viète |
| IV | Hình khối trong thực tế |
| IV | Chứng minh trong đường tròn |
| V | Tối ưu trong thực tế |

**Đợt sau: mới thấy ở nguồn thứ cấp, chờ đề thật xác nhận.** Biểu đồ thống kê; đồ thị hàm bậc nhất và bậc hai; hình cầu, hình nón, lăng trụ, hình chóp; bất đẳng thức ở câu V.

## AC1 — Cấu trúc khoá

- **Given** học viên mở trang khoá, **then** thấy thứ tự: mục "Luyện thi", module "Bắt đầu", module "Luyện theo dạng" chia theo năm câu của đề, module "Giải đề mẫu" chia theo năm.
- **Given** thêm một đề mẫu hoặc một dạng mới khi khoá đã có học viên, **then** nhập được mà không xoá hay nhập lại khoá, và tiến độ của học viên không đổi.
- **Given** bài "Bắt đầu", **then** bài giới thiệu cấu trúc đề và cách chia thời gian. Phần dẫn tới đề mô phỏng đầu vào được thêm ở mốc 4, khi đã có đề.

## AC2 — Bài dạng

- Mỗi bài có khung slide cùng giảng viên ảo: dấu hiệu nhận ra dạng, cách làm, ví dụ từng bước, rồi bài tự làm có chấm ngay.
- **Given** câu hỏi hoặc lời giao việc trong lời giảng, **then** nó nằm ở cuối một slide chờ, và giọng dừng tới khi học sinh bấm Tiếp tục. Bản dựng dừng nếu sai.
- **Given** bài hình, **then** hình được vẽ dần theo lời giảng, và slide tự làm không lộ đáp án.
- Mỗi bài có quiz 8–10 câu, số liệu không trùng với slide; phương án sai ứng với một lỗi cụ thể thì có mã lỗi và phản hồi riêng; câu cần tính toán được đánh dấu nháp ra giấy. Mọi đáp số được chương trình tính lại.
- **Given** học viên làm quiz, **then** lộ trình gợi ý ôn theo đúng tên dạng, với nhãn Cần ôn, Nên luyện, Vững như các khoá khác.

## AC3 — Bài đề mẫu

- **Given** học viên mở bài có giọng, **then** thấy màn hình bìa, và phần lời giải đọc lại nằm dưới bìa, hiện đủ cho tới cuối bài. Công cụ nhập bài cho đặt khung slide ở đầu bài.
- **Given** học viên đã nghe từ 80% lời giảng, **then** bài được tính hoàn thành, kể cả khi chưa bấm hết các bước của lời giải đọc lại.
- Đề bài được diễn đạt lại và giữ nguyên số liệu; lời giải do Limio soạn; bài dẫn liên kết tới nguồn đề gốc.
- Đề Hà Nội 2026 hiện có được chuyển sang khuôn này. Quiz 9 câu của nó chuyển vào các bài dạng tương ứng.

## AC4 — Đề mô phỏng

- **Given** khoá có đề mô phỏng đã xuất bản, **then** mục "Luyện thi" hiện tên đề, 120 phút và lần làm gần nhất.
- **Given** học sinh bắt đầu, **then** có màn hình chuẩn bị giấy bút, đề hiện đủ cả 5 câu, đi lại tự do giữa các câu, không có ô gõ bài và đồng hồ đếm 120 phút. Đề có một phần duy nhất, vì đề nhiều phần sẽ làm lần lượt và không quay lại được.
- **Given** học sinh chưa nộp, **then** trình duyệt không nhận được lời giải hay thang điểm.
- **Given** hết giờ, **then** bài tự nộp và chuyển sang bước tự chấm. Học sinh nộp sớm cũng vào đúng bước này.
- **Given** tự chấm, **then** mỗi ý hiện lời giải, thang điểm và ô chọn điểm theo bước 0,25, không vượt điểm tối đa của ý. Thoát ra rồi vào lại vẫn giữ các điểm đã chọn.
- **Given** đã chấm đủ các ý, **then** trang kết quả ghi rõ "Điểm tự chấm", hiện tổng trên thang 10, điểm từng câu, và **liệt kê các dạng mất nhiều điểm kèm liên kết tới bài dạng**.
- **Given** làm lại, **then** tạo lượt mới và thấy được điểm các lượt trước.
- **Given** đề thật khác của khoá hoặc đề của khoá ngoại ngữ, **then** chấm tay, chấm máy và kết quả theo phần không đổi. Đề tự chấm được bật bằng một cờ riêng.
- Mỗi ý trong đề mô phỏng gắn với đúng một dạng và một thang điểm, tổng đúng 10. Việc nhập đề bị từ chối nếu sai.

## AC5 — Sự kiện và dữ liệu

- Lưu điểm tự chấm phát sự kiện `exam.answer.self_graded` trong cùng giao dịch; chấm xong cả bài phát `exam.self_grading.completed`. Dữ liệu chỉ mang id và số điểm, không mang chữ bài làm.
- Hai sự kiện này không cấp XP và không làm thay đổi mức nắm vững.
- Mọi thay đổi cấu trúc dữ liệu đi qua migration.
- Giao diện đổi cho giảng viên thì cập nhật `GIAO-DIEN.md` và kho hướng dẫn của Lily.

## Tiến độ

- **Mốc 1 xong:** khoá `on-thi-toan-vao-10` có ba module; đề 2026 gộp thành một bài với khung slide ở đầu; công cụ nhập bài có `atStart`.
- **Mốc 2 xong:** bài "Câu II: Tìm x để biểu thức nguyên", 11 slide, 24 đoạn giảng, 5 slide chờ, quiz 10 câu 12 điểm.
- **Đã kiểm trên máy dev với giọng giả:** màn hình bìa; giọng dừng ở slide chờ tới khi bấm Tiếp tục, rồi sang slide sau và đi tiếp; ô nhập chấm đúng cả đáp án đúng và đáp án nhiễu; một lượt quiz đủ 10 câu chấm đúng (11/12 khi cố ý sai một câu); phần lời giải hiện dưới bìa.
- **Chưa kiểm:** giọng thật; học viên thật đã ghi danh (mới kiểm bằng tài khoản quản trị); ngưỡng nghe 80% trên hai bài này; lộ trình gợi ý theo dạng, vì mới có một bài dạng. Phản hồi sau quiz hiện tên lỗi và lời giải, chưa thấy nội dung mẫu phản hồi riêng.

## Thứ tự làm

Sau mỗi mốc tôi dừng lại để bạn xem. Công việc dừng ở máy dev; lên server là bước riêng cần bạn đồng ý.

1. **Khung khoá:** đổi tên, dựng ba phần, gộp đề 2026 thành một bài, thêm tuỳ chọn đặt khung slide ở đầu bài.
2. **Một bài dạng mẫu:** dạng "Tìm x để biểu thức nguyên". Bạn duyệt khuôn rồi mới soạn tám dạng còn lại.
3. **Tám dạng còn lại.**
4. **Tự chấm và một đề mô phỏng.** Làm sau khi có ma trận đã chốt.
5. **Thêm đề mẫu** từ các đề bạn thu thập.

## Chưa làm trong đợt này

- Đề các tỉnh khác.
- Chấm bài bằng ảnh chụp hoặc AI.
- Giáo viên xem hoặc chấm lại bài của học sinh.
- Đề thi trực tuyến gõ bài.

## Điều kiện trước khi bán

- Chặn truy cập `/decks/<id>` theo ghi danh. Hiện ai có địa chỉ cũng mở được.
- Giáo viên Toán duyệt nội dung, đặc biệt lời giải câu IV.2c và ma trận.
- Kiểm tra quyền sử dụng đề thi trong các bài đề mẫu.
- Tạo giọng Tiến Đạt và nghe kiểm tra các điểm dừng.

## Rủi ro

| Rủi ro | Cách giữ |
|---|---|
| Học sinh tự chấm quá tay | Ghi rõ "Điểm tự chấm"; thang điểm chi tiết từng ý; không gắn với XP hay mức nắm vững |
| Ma trận sai do mới có một đề | Chốt sau khi có đề 2025; danh sách dạng bổ sung được mà không ảnh hưởng tiến độ học viên |
| Khối lượng soạn lớn | Duyệt khuôn trên một dạng trước khi soạn hàng loạt |
| Lời giảng chạm mức 60 đoạn mỗi bài | Bài dạng ngắn hơn bài đề; đề mẫu gộp bước khi cần |
