## Pandas DataFrames

**Sau bài này bạn sẽ:** tạo DataFrame, xem cấu trúc của nó, chọn hàng/cột đúng cách với `loc` và `iloc`, và lọc dữ liệu theo điều kiện.

### 1. DataFrame và Series

**DataFrame** là bảng dữ liệu có hàng và cột (như một sheet Excel); mỗi cột là một **Series** (một dãy giá trị có nhãn). Dữ liệu thật thường được nạp từ file: `pd.read_csv("diem.csv")`.

```python
import pandas as pd

df = pd.DataFrame({
    "name":  ["An", "Binh", "Chi", "Dung", "Em"],
    "major": ["IT", "IT", "Econ", "Econ", "IT"],
    "score": [8.5, 7.0, 9.0, 6.5, 7.5],
})
print(df.shape)     # (5, 3)  → 5 hàng, 3 cột
print(df.head(2))   # 2 hàng đầu
df.info()           # tên cột, kiểu dữ liệu, số giá trị không rỗng
print(df.describe())   # thống kê mô tả các cột số
```

Đọc từ file CSV (ví dụ dưới dùng chuỗi thay cho file để bạn chạy được ngay):

```python
import io
csv = "name,score\nAn,8.5\nBinh,7\n"
small = pd.read_csv(io.StringIO(csv))
print(small.shape)   # (2, 2)
```

### 2. Chọn cột

```python
df["score"]          # một cột → kiểu Series
df[["name", "score"]]  # nhiều cột (hai cặp ngoặc) → kiểu DataFrame
df[["score"]]        # một cột nhưng trong list → vẫn là DataFrame
```

Hai cặp ngoặc `[[...]]` nghĩa là "đưa vào một list các tên cột" nên kết quả luôn là DataFrame.

### 3. Chọn hàng: `loc` và `iloc`

- `loc` chọn theo **nhãn** (tên hàng/cột), và cắt lát **gồm cả** đầu mút cuối.
- `iloc` chọn theo **vị trí** (số thứ tự từ 0), và cắt lát dừng **trước** vị trí cuối, như list.

```python
print(df.loc[0:2, "name"].tolist())    # ['An', 'Binh', 'Chi']   ← gồm cả nhãn 2
print(df.iloc[0:2]["name"].tolist())   # ['An', 'Binh']          ← dừng trước vị trí 2

by_name = df.set_index("name")         # dùng cột name làm nhãn hàng
print(by_name.loc["Chi", "score"])     # 9.0   (theo nhãn "Chi")
print(by_name.iloc[0]["score"])        # 8.5   (theo vị trí 0, tức hàng "An")
```

### 4. Lọc hàng theo điều kiện

```python
pass_list = df[df["score"] >= 7.5]
print(len(pass_list))                 # 3
print(pass_list["name"].tolist())     # ['An', 'Chi', 'Em']

# nhiều điều kiện: dùng & (và), | (hoặc), mỗi điều kiện đặt trong ngoặc tròn
print(df[(df["major"] == "IT") & (df["score"] > 7)]["name"].tolist())   # ['An', 'Em']
```

### 5. Thêm cột, sắp xếp, thống kê

```python
df["bonus"] = df["score"] + 0.5       # cột mới, tính theo từng hàng
print(df["score"].mean())             # 7.7
top = df.sort_values("score", ascending=False)
print(top.iloc[0]["name"])            # Chi  (điểm cao nhất)
```

### Lỗi hay gặp

- Nhầm `loc` (nhãn) với `iloc` (vị trí), nhất là khi nhãn hàng cũng là số.
- Dùng `and`/`or` thay vì `&`/`|` khi lọc nhiều điều kiện.
- Quên rằng `df["a"]` là Series còn `df[["a"]]` là DataFrame.

### Cần nhớ

- DataFrame = bảng; mỗi cột là một Series.
- `df.shape`, `df.info()`, `df.describe()` để làm quen với dữ liệu mới.
- `loc` theo nhãn (gồm cuối), `iloc` theo vị trí (không gồm cuối).
- Lọc: `df[điều_kiện]`; nhiều điều kiện dùng `&`, `|` và ngoặc tròn.

### Reference

McKinney, W. (2022). *Python for Data Analysis: Data Wrangling with Pandas, NumPy, and Jupyter* (3rd ed.). O'Reilly Media.
