## Functions

**Bài ôn tập.** Bảng tóm tắt phần *hàm* của Module 1, để tra cứu nhanh và tự kiểm tra sau đơn vị **1.9**.

### Cú pháp và tham số

```python
def area(width, height=1, *extras, **options):
    return width * height
```

| Khái niệm | Ý nghĩa |
|---|---|
| **Parameter** | Tên trong định nghĩa hàm (`width`, `height`) |
| **Argument** | Giá trị truyền lúc gọi (`area(3, 4)`) |
| Tham số mặc định | `height=1` — dùng khi không truyền |
| `*args` | Gom đối số vị trí thừa vào một **tuple** |
| `**kwargs` | Gom đối số có tên vào một **dict** |
| `return a, b` | Trả về nhiều giá trị (thực chất là một tuple) |
| `lambda x: x ** 2` | Hàm ẩn danh một dòng, hay dùng làm `key=` cho `sorted` |

### Phạm vi biến

- Gán trong hàm tạo biến **local** mới, không đổi biến cùng tên bên ngoài.
- Muốn đổi biến bên ngoài phải khai báo `global x` trong hàm (nên hạn chế; ưu tiên truyền vào và `return`).

### Cần nhớ

- Một hàm nên làm **một việc** và có tên nói lên việc đó.
- Đặt tham số có giá trị mặc định **sau** các tham số bắt buộc.
