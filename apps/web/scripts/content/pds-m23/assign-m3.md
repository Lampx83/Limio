Thu thập dữ liệu từ hai nguồn công khai dành cho luyện tập, rồi biến chúng thành bảng để phân tích.

**Phần A — Lấy dữ liệu từ API**

Dùng `https://jsonplaceholder.typicode.com` (API mẫu, không cần khoá).

1. Gọi `GET /users` bằng `requests`, có `timeout` và `raise_for_status()`. In `status_code`.
2. Chuyển kết quả JSON thành DataFrame, chỉ giữ các cột `id`, `name`, `username`, `email` (và tên thành phố lấy từ `address.city`).
3. Gọi `GET /posts` với `params={"userId": 1}` và đếm số bài viết của người dùng số 1.
4. Thử gọi một địa chỉ không tồn tại (ví dụ `/khong-co`) và ghi lại `status_code` nhận được cùng ý nghĩa của nó.

**Phần B — Scrape một trang thật**

Dùng `https://books.toscrape.com/` (trang được dựng riêng để luyện scraping).

1. Tải trang đầu bằng `requests` (có `timeout`) và phân tích bằng BeautifulSoup.
2. Lấy **tên sách** và **giá** của 20 cuốn trên trang. Lưu ý: nếu giá hiện ký tự lạ như `Â£`, hãy đặt `resp.encoding = "utf-8"` trước khi lấy `resp.text`. Chuyển giá thành số (`float`).
3. Tạo DataFrame `books` gồm hai cột `title`, `price`; tính giá trung bình và in ra cuốn đắt nhất.
4. Lấy thêm trang thứ hai (`https://books.toscrape.com/catalogue/page-2.html`), **chờ ít nhất 1 giây giữa hai lần gọi** (`time.sleep(1)`), rồi gộp hai trang bằng `pd.concat`.

**Phần C — Trả lời ngắn (3–5 câu)**

- Khi nào bạn chọn API thay vì scrape, và ngược lại?
- Trước khi scrape một trang bất kỳ, bạn phải kiểm tra những gì?
- Điều gì xảy ra nếu bạn quên `timeout`?

**Nộp** notebook `.ipynb` (đã chạy) hoặc file `.py` kèm ảnh chụp kết quả. Không nộp khoá API hay thông tin đăng nhập.

Chấm điểm dựa trên: gọi API/scrape đúng cách (có `timeout`, xử lý lỗi, chờ giữa các lần gọi), dữ liệu ra bảng đúng, và câu trả lời phần C có lập luận.
