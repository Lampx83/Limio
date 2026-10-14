# Limio — Kịch bản trình bày (lãnh đạo, nhà khoa học)

Bản web trình chiếu: `apps/web/public/gioi-thieu/index.html`, phục vụ tại `/gioi-thieu` (limio.vn và limio.hust.edu.vn; link demo và mã QR tự theo tên miền đang mở).

Nguồn để sửa nằm ở `docs/presentation/deck-src/` (mỗi slide một file `slides/sNN.html`); sau khi sửa chạy `bash docs/presentation/deck-src/build.sh`. Xem thử cục bộ: `python3 -m http.server 4173 --directory apps/web/public/gioi-thieu`. Video demo thật: xem `video-README.txt`.

## 1. Phím tắt

| Phím | Việc |
|---|---|
| ← → / Space / vuốt | Chuyển slide |
| N | Ghi chú người trình bày + đồng hồ |
| Q | Hỏi – đáp dự kiến |
| O | Tổng quan, nhảy tới slide bất kỳ |
| F | Toàn màn hình |
| A | Chọn đối tượng người nghe (Lãnh đạo, Giảng viên, Sinh viên, Nhà đầu tư, Nhà khoa học) |
| J | Nhảy tới trang demo thật + nút “Kiểm tra trước giờ G” |
| L / P / S / C | Laser / bút vẽ / tiêu điểm / xoá nét vẽ |
| Esc | Đóng bảng đang mở |

Mở trang ở **hai tab**: tab chiếu ra máy chiếu, tab còn lại để ở màn hình của bạn và bật ghi chú (N). Hai tab tự đồng bộ slide.

## 2. Phân bổ thời gian (≈ 25 phút + hỏi đáp)

| # | Slide | Thời lượng |
|---|---|---|
| 1 | Mở đầu | 1' |
| 2 | Vấn đề của một buổi lên lớp | 2' |
| 3 | Limio dành cho ai | 2' |
| 4 | Giảng viên: tour sản phẩm | 3' |
| 5 | Ba module, một nhật ký sự kiện | 2' |
| 6 | Mô hình người học (BKT) | 3' |
| 7 | Cơ sở khoa học | 2' |
| 8 | Thiết kế để đo được hiệu quả phản hồi | 2' |
| 9 | Điểm thưởng bám theo việc học thật | 1,5' |
| 10 | Người học: lộ trình | 1,5' |
| 11 | Triển khai độc lập, dữ liệu thuộc về đơn vị | 1,5' |
| 12 | Thử nghiệm và hướng nghiên cứu | 1,5' |
| 13 | Trình diễn trực tiếp | 6' |
| 14 | Kết luận và liên hệ | 1,5' |

Nếu chỉ có 15 phút: bỏ slide 7, 9, 11; rút demo còn 3 phút (bước 1, 2, 5).

## 3. Kịch bản demo trực tiếp (6')

1. **Bảng điều khiển giảng viên** (30"): “Việc cần xử lý gấp” xếp theo ưu tiên, học viên im lặng trên 14 ngày.
2. **Limio-Live** (90"): mở Word Cloud, cả phòng quét mã QR và trả lời một câu. Đây là khoảnh khắc khán giả tham gia.
3. **Ngân hàng → Đề thi → Ca thi, giám sát vấn đáp AI** (90"): chỉ màn hình theo dõi thời gian thực và cảnh báo rời tab.
4. **Chấm bài với gợi ý AI** (60"): bấm “Gợi ý bằng AI”, nhấn mạnh giảng viên sửa và quyết định.
5. **Tài khoản người học** (90"): lộ trình Cần ôn / Nên luyện / Vững, XP, e-Portfolio.

### Chuẩn bị trước giờ G (checklist)

- [ ] Đăng nhập sẵn 2 tài khoản (giảng viên, người học) trên 2 tab trình duyệt riêng.
- [ ] Có sẵn một bài Limio-Live với slide Word Cloud, thử quét QR từ điện thoại.
- [ ] Có sẵn một ca thi vấn đáp đang chạy hoặc dữ liệu mẫu để giám sát.
- [ ] Kiểm tra mạng phòng họp; chuẩn bị điện thoại phát wifi dự phòng.
- [ ] Ảnh chụp/video quay màn hình dự phòng cho từng bước (nếu mạng hỏng, quay lại tab “Giảng viên: tour sản phẩm”).
- [ ] Tắt thông báo hệ thống, bật chế độ Không làm phiền.
- [ ] Chạy thử toàn bộ bản trình chiếu ở độ phân giải máy chiếu (F để toàn màn hình).
- [ ] Không để lộ dữ liệu học viên thật trên màn hình demo (dùng lớp mẫu).

## 4. Điều cần nói thẳng (để giữ uy tín với nhà khoa học)

- Sản phẩm mới ra mắt, đang thử nghiệm ở một số học phần; **chưa có kết quả hiệu quả công bố**.
- Tham số BKT (P(L0)=0,10; P(T)=0,10; P(S)=0,10; P(G)=0,20) là giá trị khởi đầu thận trọng, **chưa hiệu chỉnh bằng dữ liệu thực**.
- Con số “5.000 thí sinh đồng thời” là **mục tiêu thiết kế/tối ưu**, không nói là đã đo đủ.
- Các ví dụ XP, nhật ký sự kiện trong slide là **minh hoạ**.
- Slide “Hướng nghiên cứu tiếp theo” là **đề xuất**, không phải cam kết.

## 5. Hỏi – đáp dự kiến

Có sẵn trong bản web (phím Q): AI có thay giảng viên chấm không; dữ liệu ở đâu; độ tin cậy BKT; bằng chứng hiệu quả; khác gì LMS thông thường; chống gian lận; điểm thưởng có lệch việc học; người học có thấy phần trăm không.

Câu hỏi nên chuẩn bị thêm số liệu: chi phí vận hành/triển khai, quy mô người dùng thực tế, chính sách lưu trữ và xoá dữ liệu cá nhân, tích hợp với hệ thống của trường (SSO, hệ thống quản lý đào tạo).
