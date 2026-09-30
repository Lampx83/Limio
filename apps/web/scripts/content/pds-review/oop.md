## Basic Object-Oriented Programming

**Bài ôn tập.** Bảng tóm tắt phần *lập trình hướng đối tượng* của Module 1, để tra cứu nhanh và tự kiểm tra sau các đơn vị **1.10 → 1.11**.

### Class và object

```python
class Student:
    university = "Tech Institute"        # thuộc tính lớp: dùng chung mọi object

    def __init__(self, name, gpa):       # constructor
        self.name = name                 # thuộc tính thể hiện: riêng từng object
        self.gpa = gpa

    def status(self):
        return "Honours" if self.gpa >= 3.5 else "Regular"
```

- **Class** là bản thiết kế; **object** (instance) là thực thể cụ thể: `anna = Student("Anna", 3.8)`.
- `self` là chính object đang gọi phương thức; `anna.status()` tương đương `Student.status(anna)`.
- Đổi `anna.name` không ảnh hưởng object khác; đổi `Student.university` ảnh hưởng mọi object.

### Ba trụ cột

| Khái niệm | Ý nghĩa | Ví dụ |
|---|---|---|
| **Kế thừa** | Lớp con dùng lại lớp cha (quan hệ "is-a"), dùng `super()` để mở rộng | `class Dog(Animal)` |
| **Đóng gói** | Bảo vệ dữ liệu bên trong, chỉ đổi qua phương thức có kiểm tra | `self.__balance` + `deposit()` |
| **Đa hình** | Cùng tên phương thức, hành vi khác nhau tuỳ đối tượng | `speak()` của Dog, Cat |

### Cần nhớ

- Phân biệt **thuộc tính riêng** (`self.x`) với **thuộc tính dùng chung** (gán ở cấp class).
- `isinstance(obj, LopCha)` là `True` cả với object của lớp con.
