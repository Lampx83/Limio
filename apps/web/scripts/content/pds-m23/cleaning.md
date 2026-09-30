## Data Cleaning and Transformation

**Sau bài này bạn sẽ:** phát hiện và xử lý giá trị thiếu, dòng trùng, kiểu dữ liệu sai và chuỗi bẩn — những việc chiếm phần lớn thời gian của một dự án dữ liệu thật.

### 1. Giá trị thiếu (missing values)

Pandas ghi ô trống là `NaN`. Trước hết hãy **đếm** chúng:

```python
import pandas as pd

s = pd.Series([8.0, None, 6.0, None, 10.0])
print(s.isna().sum())      # 2   (True được tính là 1)
print(s.isna().tolist())   # [False, True, False, True, False]
```

Có hai hướng xử lý chính:

```python
print(s.dropna().tolist())              # [8.0, 6.0, 10.0]      ← bỏ các giá trị thiếu
print(s.fillna(s.mean()).tolist())      # [8.0, 8.0, 6.0, 8.0, 10.0]  ← điền bằng trung bình
```

Chọn cách nào tuỳ bài toán: bỏ dòng thì mất dữ liệu; điền bằng trung bình giữ được số dòng nhưng làm phân phối "dẹt" hơn. Khi tính thống kê, `mean()` mặc định **bỏ qua NaN** chứ không coi NaN là 0:

```python
print(s.mean())            # 8.0   ← (8 + 6 + 10) / 3
print(s.fillna(0).mean())  # 4.8   ← nếu điền 0 thì trung bình bị kéo xuống
```

### 2. Dòng trùng lặp

```python
d = pd.DataFrame({"id": [1, 2, 2, 3], "v": ["a", "b", "b", "c"]})
print(d.duplicated().sum())        # 1   (dòng thứ hai của cặp trùng)
print(len(d.drop_duplicates()))    # 3   (giữ lại lần xuất hiện đầu tiên)
```

### 3. Kiểu dữ liệu sai

Cột số nhưng bị đọc thành chữ (vì có ký tự lạ) sẽ không tính toán được. Dùng `astype` khi chắc chắn dữ liệu sạch, hoặc `to_numeric` khi có thể lẫn giá trị hỏng:

```python
print(pd.Series(["1", "2", "3"]).astype(int).sum())    # 6

t = pd.to_numeric(pd.Series(["1", "2", "x"]), errors="coerce")
print(t.tolist())    # [1.0, 2.0, nan]  ← "x" không đổi được nên thành NaN
```

`errors="coerce"` biến giá trị hỏng thành NaN để bạn xử lý tiếp bằng `fillna`/`dropna`.

### 4. Làm sạch chuỗi

```python
names = pd.Series([" An ", "BINH"])
print(names.str.strip().str.lower().tolist())   # ['an', 'binh']
```

`.str.strip()` bỏ khoảng trắng hai đầu, `.str.lower()` đưa về chữ thường. Nhờ vậy `"IT"`, `"it"` và `" IT"` không còn bị coi là ba nhóm khác nhau khi thống kê. Có thể nối nhiều bước liên tiếp bằng dấu chấm.

Đổi giá trị cụ thể: `s.replace("N/A", None)` biến chuỗi `"N/A"` thành giá trị thiếu.

### Quy trình gợi ý

1. Nhìn tổng quan: `df.info()`, `df.isna().sum()`, `df.describe()`.
2. Sửa kiểu dữ liệu (`to_numeric`, `astype`).
3. Chuẩn hoá chuỗi (`.str.strip().str.lower()`).
4. Xử lý giá trị thiếu (`dropna` hoặc `fillna`).
5. Bỏ dòng trùng (`drop_duplicates`).
6. Kiểm tra lại từng bước bằng `shape` và `isna().sum()`.

### Cần nhớ

- Đếm giá trị thiếu bằng `isna().sum()`; `mean()` bỏ qua NaN.
- `dropna` bỏ dòng, `fillna` điền giá trị.
- `drop_duplicates` giữ lần đầu tiên.
- `to_numeric(..., errors="coerce")` biến giá trị hỏng thành NaN.
- Chuẩn hoá chuỗi trước khi nhóm hoặc đếm.

### Reference

McKinney, W. (2022). *Python for Data Analysis: Data Wrangling with Pandas, NumPy, and Jupyter* (3rd ed.). O'Reilly Media.
