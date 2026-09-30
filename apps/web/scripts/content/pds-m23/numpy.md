## NumPy Arrays

**Sau bài này bạn sẽ:** tạo và truy cập mảng NumPy, tính toán trên cả mảng mà không cần vòng lặp, và hiểu vì sao mảng gọn và nhanh hơn list.

### 1. Vì sao cần NumPy

List Python rất linh hoạt nhưng chậm với số liệu lớn, vì mỗi phần tử là một đối tượng riêng. Mảng NumPy (`ndarray`) lưu các số **cùng kiểu** liền nhau trong bộ nhớ, nên phép tính nhanh và cú pháp gọn. Pandas được xây trên NumPy: hiểu mảng trước thì DataFrame dễ hơn nhiều.

### 2. Tạo mảng

```python
import numpy as np

a = np.array([1, 2, 3])
print(np.arange(0, 10, 2))    # [0 2 4 6 8]  (như range: dừng trước 10)
print(np.linspace(0, 1, 5))   # [0.   0.25 0.5  0.75 1.  ]  (5 điểm cách đều, gồm cả hai đầu)
print(np.zeros((2, 3)))       # mảng toàn 0 kích thước 2 hàng x 3 cột
print(np.ones(3))             # [1. 1. 1.]
```

Mỗi mảng có ba thuộc tính hay dùng: `shape` (kích thước từng chiều), `ndim` (số chiều) và `dtype` (kiểu dữ liệu chung).

```python
m = np.array([[1, 2, 3],
              [4, 5, 6]])
print(m.shape)   # (2, 3)
print(m.ndim)    # 2
print(np.array([1, 2.5]).dtype)   # float64  (một số thực làm cả mảng thành float)
print(np.arange(12).reshape(3, 4).shape)   # (3, 4)
```

### 3. Chỉ số và cắt lát

Chỉ số bắt đầu từ 0. Với mảng 2 chiều, viết `m[hàng, cột]`; dấu `:` nghĩa là "tất cả".

```python
print(m[1, 2])    # 6   (hàng 1, cột 2)
print(m[:, 1])    # [2 5]   (cả cột 1)
print(m[0])       # [1 2 3] (cả hàng 0)
```

Cắt lát `a[i:j]` dừng ngay **trước** `j`, giống list.

### 4. Tính toán theo cả mảng (vectorization)

Phép toán áp lên **từng phần tử** mà không cần `for`:

```python
a = np.array([1, 2, 3])
print(a * 2)      # [2 4 6]
print(a + 10)     # [11 12 13]  ← broadcasting: số 10 được "kéo giãn" cho khớp với mảng
print([1, 2, 3] * 2)   # [1, 2, 3, 1, 2, 3]  ← với list, * là lặp danh sách, KHÔNG phải nhân từng phần tử
```

**Broadcasting** cho phép cộng/nhân một mảng với một số (hoặc mảng nhỏ hơn có kích thước tương thích) mà không cần viết vòng lặp.

### 5. Lọc bằng điều kiện (boolean mask)

```python
b = np.array([5, 1, 4, 2, 3])
print(b > 2)      # [ True False  True False  True]
print(b[b > 2])   # [5 4 3]   (giữ lại các phần tử thoả điều kiện)
```

### 6. Hàm tổng hợp và tham số `axis`

```python
print(m.sum())           # 21
print(m.mean())          # 3.5
print(m.sum(axis=0))     # [5 7 9]   (cộng dọc theo hàng → mỗi cột một tổng)
print(m.sum(axis=1))     # [ 6 15]   (cộng dọc theo cột → mỗi hàng một tổng)
```

Mẹo nhớ: `axis=0` là "gộp các hàng lại" (kết quả còn một giá trị cho mỗi cột); `axis=1` là "gộp các cột lại".

### Lỗi hay gặp

- Nhầm `*` trên list với `*` trên mảng NumPy (xem mục 4).
- Nhầm `axis=0` với `axis=1`.
- Tưởng slice gồm cả chỉ số cuối.

### Cần nhớ

- Mảng NumPy: cùng kiểu, nhanh, tính toán theo từng phần tử.
- `shape`, `ndim`, `dtype` mô tả một mảng.
- Lọc bằng điều kiện: `a[a > 2]`.
- `axis=0` cho kết quả theo cột, `axis=1` cho kết quả theo hàng.

### Reference

McKinney, W. (2022). *Python for Data Analysis: Data Wrangling with Pandas, NumPy, and Jupyter* (3rd ed.). O'Reilly Media.
