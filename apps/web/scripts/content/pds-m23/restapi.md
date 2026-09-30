## Retrieving Data via RESTful APIs

**Sau bài này bạn sẽ:** hiểu một API trả dữ liệu thế nào, gọi API bằng thư viện `requests`, và đọc dữ liệu JSON thành cấu trúc Python.

### 1. API là gì

**API (Application Programming Interface)** là cửa để chương trình của bạn xin dữ liệu từ một dịch vụ khác. **REST API** dùng giao thức HTTP: bạn gửi một *yêu cầu* tới một địa chỉ (URL) và nhận về một *phản hồi*, thường ở định dạng **JSON**.

Hai phương thức HTTP quan trọng nhất:

| Phương thức | Dùng để | Ví dụ |
|---|---|---|
| `GET` | **Lấy** dữ liệu, không làm thay đổi gì trên máy chủ | Lấy danh sách người dùng |
| `POST` | **Gửi** dữ liệu lên để tạo mới | Tạo một bài viết |

### 2. Mã trạng thái (status code)

Phản hồi luôn kèm một mã cho biết kết quả:

| Mã | Ý nghĩa |
|---|---|
| `200` | OK — thành công |
| `401` | Unauthorized — thiếu hoặc sai khoá API/đăng nhập |
| `404` | Not Found — địa chỉ hoặc tài nguyên không tồn tại |
| `429` | Too Many Requests — bạn gọi quá nhanh, bị giới hạn tốc độ |
| `500` | Internal Server Error — lỗi phía máy chủ |

Nhóm `2xx` là thành công, `4xx` là lỗi do phía gọi, `5xx` là lỗi do máy chủ.

### 3. Gọi API bằng `requests`

```python
import requests

resp = requests.get(
    "https://jsonplaceholder.typicode.com/users",
    params={"_limit": 3},   # tham số truy vấn, sẽ nối vào URL thành ?_limit=3
    timeout=10,             # LUÔN đặt timeout
)
resp.raise_for_status()     # báo lỗi nếu mã 4xx/5xx
users = resp.json()         # chuyển JSON thành list/dict của Python
print(resp.status_code)     # 200
print(users[0]["name"])
```

Hai điều quan trọng:

- **`timeout`**: `requests` không tự đặt giới hạn thời gian, nên thiếu tham số này thì chương trình có thể treo vô hạn khi máy chủ không trả lời.
- **`params`**: để thư viện tự mã hoá và ghép tham số vào URL thay vì bạn tự nối chuỗi.

Bạn có thể xem URL cuối cùng mà không cần gọi mạng:

```python
req = requests.Request("GET", "https://api.example.com/search",
                       params={"q": "python", "page": 2}).prepare()
print(req.url)    # https://api.example.com/search?q=python&page=2
```

### 4. JSON và cấu trúc Python

JSON có hai cấu trúc chính: **object** `{...}` tương ứng `dict` và **array** `[...]` tương ứng `list`. Vì vậy có thể truy cập bằng chỉ số và khoá quen thuộc:

```python
import json

text = '{"user": {"id": 7, "name": "An", "tags": ["ml", "py"]}, "active": true}'
data = json.loads(text)                 # chuỗi JSON → dict
print(type(data).__name__)              # dict
print(data["user"]["tags"][1])          # py
print(data["active"])                   # True   (JSON true → Python True)
print(json.dumps({"a": 1}))             # {"a": 1}   (Python → chuỗi JSON)
```

Với `requests`, `resp.json()` làm đúng việc của `json.loads(resp.text)`.

### 5. Thói quen tốt khi dùng API

- Đọc tài liệu API: địa chỉ, tham số, giới hạn số lần gọi, có cần **khoá API** không. Không đưa khoá vào code chia sẻ công khai.
- Xử lý lỗi và đặt `timeout`; gọi chậm lại khi gặp `429`.
- Dữ liệu lớn thường được chia trang (*pagination*): gọi lần lượt từng trang bằng tham số như `page` hoặc `_limit`/`_start`.
- Biến kết quả thành bảng để phân tích: `pd.DataFrame(users)`.

### Cần nhớ

- `GET` để lấy, `POST` để gửi; mã `2xx` thành công, `4xx` lỗi phía gọi, `5xx` lỗi máy chủ.
- Luôn đặt `timeout`; dùng `params` thay vì tự nối chuỗi.
- `resp.json()` trả về `dict`/`list`; JSON object ↔ `dict`, JSON array ↔ `list`.
