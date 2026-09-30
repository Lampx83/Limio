## Variables, Data Types, and Operators

**Bài ôn tập.** Bảng tóm tắt phần *biến, kiểu dữ liệu và toán tử* của Module 1, để tra cứu nhanh và tự kiểm tra sau khi học các đơn vị **1.2 → 1.6**. Nếu còn lúng túng chỗ nào, quay lại đơn vị tương ứng để xem video.

### Các kiểu dữ liệu

| Kiểu | Ví dụ | Có thứ tự | Sửa được | Lưu ý |
|---|---|---|---|---|
| `int`, `float` | `42`, `3.14` | — | — | `/` luôn ra `float`, `//` chia lấy phần nguyên |
| `str` | `'Python'` | Có | **Không** | Chỉ số từ 0, slice `s[a:b]` dừng trước `b` |
| `bool` | `True`, `False` | — | — | `True + True` bằng 2 |
| `list` | `[1, 2, 3]` | Có | Có | `b = a` **không** sao chép; dùng `a.copy()` |
| `tuple` | `(1, 2)` | Có | **Không** | Một phần tử cần dấu phẩy: `(50,)` |
| `set` | `{1, 2, 3}` | Không | Có | Không cho phép phần tử trùng |
| `dict` | `{"a": 1}` | Có | Có | Khoá là duy nhất; `d.get(k, mặc_định)` không báo lỗi khi thiếu khoá |

### Toán tử và độ ưu tiên

Từ cao xuống thấp: `**` → `* / % //` → `+ -` → so sánh → `is`, `in` → `not and or`.

### Bốn điều dễ nhầm

- `input()` luôn trả về **chuỗi**; muốn tính toán phải ép kiểu: `int(input(...))`.
- `==` so sánh **giá trị**, `is` kiểm tra **cùng một đối tượng** (thường dùng cho `None`).
- Giá trị *falsy*: `False None 0 0.0 '' [] () {} set()`; chuỗi `"False"` vẫn là truthy.
- `int(3.99)` là 3 — `int()` cắt bỏ phần thập phân, không làm tròn.

### Cần nhớ

- Biến/hàm dùng `snake_case`, hằng số `UPPER_SNAKE_CASE`, class `PascalCase`.
- Kiểu **sửa được** (list, set, dict) và **không sửa được** (str, tuple) quyết định cách chúng hành xử khi gán và truyền vào hàm.
