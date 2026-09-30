## Control Flow: Conditionals and Loops

**Bài ôn tập.** Bảng tóm tắt phần *rẽ nhánh và vòng lặp* của Module 1, để tra cứu nhanh và tự kiểm tra sau các đơn vị **1.7 → 1.8**.

### Rẽ nhánh

```python
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"
```

- Python kiểm tra từ trên xuống và chạy **nhánh đầu tiên có điều kiện đúng**, bỏ qua các nhánh còn lại.
- `else` thuộc về `if` gần nhất cùng mức thụt lề; `pass` giữ chỗ cho khối chưa viết.

### Vòng lặp

| Cần | Dùng |
|---|---|
| Lặp một số lần biết trước, hoặc qua từng phần tử | `for` |
| Lặp cho tới khi điều kiện sai | `while` |
| Thoát hẳn vòng lặp | `break` |
| Bỏ qua phần còn lại của lượt hiện tại | `continue` |

- `range(start, end, step)` **dừng ngay trước `end`**: `range(2, 6)` là 2, 3, 4, 5.
- `else` gắn với vòng lặp chỉ chạy khi vòng lặp **không** bị `break`.
- Trong `while`, nhớ cập nhật biến điều kiện, nếu không vòng lặp chạy vô hạn.

### Cần nhớ

- Thụt lề quyết định khối lệnh; sai một mức là sai logic.
- Đếm số lượt của vòng lặp bằng cách chạy tay vài vòng đầu trên giấy.
