## Aggregation and Exploratory Data Analysis in Jupyter

**Sau bài này bạn sẽ:** tổng hợp dữ liệu theo nhóm, đọc các thống kê nhanh, và làm việc trong Jupyter Notebook để khám phá một bộ dữ liệu mới.

### 1. Jupyter Notebook trong 1 phút

Notebook gồm các **ô (cell)**: ô code chạy Python, ô markdown chứa ghi chú. Kết quả của dòng cuối trong ô được hiển thị ngay bên dưới, nên rất hợp để thử và quan sát dữ liệu.

- `Shift + Enter`: chạy ô hiện tại rồi xuống ô kế tiếp.
- Biến tạo ở ô này dùng được ở các ô sau; nếu chạy sai thứ tự có thể ra kết quả khó hiểu. Khi nghi ngờ, chọn *Restart Kernel and Run All Cells*.

### 2. Nhóm và tổng hợp: `groupby`

Bộ dữ liệu ví dụ:

```python
import pandas as pd

sales = pd.DataFrame({
    "region":  ["N", "S", "N", "S", "N", "C"],
    "product": ["A", "A", "B", "B", "A", "B"],
    "revenue": [100, 150, 200, 50, 300, 120],
})
```

`groupby` chia bảng thành các nhóm rồi áp một phép tổng hợp lên từng nhóm:

```python
print(sales.groupby("region")["revenue"].sum())
# region
# C    120
# N    600
# S    200

print(sales.groupby("product")["revenue"].mean())
# A    183.333333
# B    123.333333

print(sales.groupby("region").size()["S"])     # 2   (số dòng của nhóm S)
```

Nhiều phép tổng hợp cùng lúc:

```python
r = sales.groupby("region")["revenue"].agg(["count", "max"])
print(r.loc["N", "count"])   # 3
print(r.loc["N", "max"])     # 300
```

### 3. Đếm nhanh và thống kê mô tả

```python
print(sales["region"].value_counts())            # đếm số lần mỗi giá trị xuất hiện, N nhiều nhất (3)
print(sales["region"].value_counts().idxmax())   # N
print(sales["revenue"].describe())               # count 6, mean 153.33, min, max, các phân vị
```

### 4. Bảng tổng hợp chéo: `pivot_table`

```python
pv = sales.pivot_table(index="region", columns="product",
                       values="revenue", aggfunc="sum")
print(pv)
# product      A      B
# region
# C          NaN  120.0
# N        400.0  200.0
# S        150.0   50.0
```

Ô nào không có dữ liệu ở tổ hợp đó (ví dụ vùng C chưa bán sản phẩm A) sẽ là `NaN`.

### 5. Tương quan

```python
xy = pd.DataFrame({"x": [1, 2, 3, 4], "y": [2, 4, 6, 8], "z": [8, 6, 4, 2]})
print(xy["x"].corr(xy["y"]))   # 1.0   (cùng tăng)
print(xy["x"].corr(xy["z"]))   # -1.0  (x tăng thì z giảm)
```

Hệ số tương quan nằm trong khoảng −1 đến 1: gần 1 là cùng chiều, gần −1 là ngược chiều, gần 0 là ít liên hệ tuyến tính. **Tương quan không chứng minh nhân quả.**

### 6. Vẽ nhanh

`sales.groupby("region")["revenue"].sum().plot(kind="bar")` vẽ biểu đồ cột ngay trong notebook (cần cài `matplotlib`).

### Quy trình khám phá một bộ dữ liệu mới

1. `df.shape`, `df.head()`, `df.info()`: dữ liệu có gì?
2. `df.isna().sum()`: thiếu ở đâu?
3. `df.describe()` và `value_counts()`: phân bố ra sao, có giá trị lạ không?
4. `groupby` / `pivot_table`: so sánh giữa các nhóm.
5. `corr()` và biểu đồ: các biến liên quan thế nào?

### Cần nhớ

- `groupby(cột)[cột_số].phép_tổng_hợp()` là mẫu dùng nhiều nhất.
- `value_counts()` để đếm, `describe()` để tóm tắt.
- `pivot_table` cho bảng chéo; ô không có dữ liệu là `NaN`.
- Tương quan đo mức cùng chiều, không nói lên nguyên nhân.

### Reference

McKinney, W. (2022). *Python for Data Analysis: Data Wrangling with Pandas, NumPy, and Jupyter* (3rd ed.). O'Reilly Media.
