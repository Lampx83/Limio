## Thực hành: Xử lý giá trị thiếu và Pipeline

**Sau bài này bạn sẽ:** dùng `SimpleImputer` để điền ô trống, ghép nó với scaler trong `Pipeline`, và tránh **rò rỉ dữ liệu (data leakage)** bằng nguyên tắc "chỉ fit trên train".

### 1. SimpleImputer với các chiến lược

```python
import numpy as np
from sklearn.impute import SimpleImputer

x_train = np.array([[1.0], [2.0], [np.nan], [9.0]])

for strategy in ["mean", "median"]:
    imp = SimpleImputer(strategy=strategy).fit(x_train)
    print(strategy, imp.statistics_, imp.transform(x_train).ravel())
# mean [4.] [1. 2. 4. 9.]
# median [2.] [1. 2. 2. 9.]
```

`statistics_` là giá trị imputer "học" được: mean = (1 + 2 + 9) / 3 = 4, median = 2 (giá trị 9 kéo mean lên, median thì không). Cột hạng mục dùng `most_frequent`:

```python
cats = np.array([["IT"], ["IT"], [np.nan], ["Econ"]], dtype=object)
imp = SimpleImputer(strategy="most_frequent").fit(cats)
print(imp.statistics_, imp.transform(cats).ravel())   # ['IT'] ['IT' 'IT' 'IT' 'Econ']
```

### 2. Rò rỉ dữ liệu: fit trên train, chỉ transform trên test

```python
x_test = np.array([[np.nan], [20.0]])

imp = SimpleImputer(strategy="mean").fit(x_train)          # học CHỈ từ train
print(imp.transform(x_test).ravel())                       # [ 4. 20.]

leaky = SimpleImputer(strategy="mean").fit(np.vstack([x_train, x_test]))
print(leaky.statistics_)                                   # [8.]  = (1+2+9+20)/4

wrong = SimpleImputer(strategy="mean").fit_transform(x_test)
print(wrong.ravel())                                       # [20. 20.]
```

Trung bình của train là 4, nhưng tính trên cả train lẫn test thì thành 8: mô hình đã "nhìn trộm" giá trị 20 của test. Gọi `fit_transform` trên test còn tệ hơn, vì ô trống bị điền theo test (20) — thứ bạn không có lúc triển khai. Quy tắc: `fit`/`fit_transform` chỉ trên **train**; test và dữ liệu mới chỉ `transform`.

### 3. Pipeline: imputer + scaler

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

pipe = Pipeline([
    ("imputer", SimpleImputer(strategy="mean")),
    ("scaler", StandardScaler()),
])
pipe.fit(x_train)
print(pipe["imputer"].statistics_, pipe["scaler"].mean_)   # [4.] [4.]
print(pipe["scaler"].scale_.round(3))                      # [3.082]
print(pipe.transform(x_test).ravel().round(3))             # [0.    5.191]
```

`pipe.fit` chạy imputer rồi scaler, đều trên train. Điền bằng trung bình không đổi trung bình nên hai số `4` trùng nhau. Trên test, ô trống được điền 4 rồi chuẩn hoá thành 0; giá trị 20 thành (20 − 4) / 3.082 = 5.191.

### 4. ColumnTransformer cho bảng có cả số và hạng mục

```python
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

train = pd.DataFrame({"age": [20, 22, np.nan, 26], "major": ["IT", "IT", np.nan, "Econ"]})
test = pd.DataFrame({"age": [24, np.nan], "major": ["Econ", "IT"]})

prep = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")),
                      ("sc", StandardScaler())]), ["age"]),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                      ("oh", OneHotEncoder())]), ["major"]),
])
print(prep.fit_transform(train).shape)   # (4, 3)
print(prep.transform(test).shape)        # (2, 3)
print(prep.get_feature_names_out())      # ['num__age' 'cat__major_Econ' 'cat__major_IT']
```

Mỗi nhóm cột có pipeline riêng: 1 cột số + 2 cột one-hot (Econ, IT) = 3 cột.

### Lỗi hay gặp

- Điền median cho cả bảng **rồi mới** chia train/test.
- Gọi `fit_transform` (hay `fit`) trên test.
- Ô thiếu ghi là `"?"` hoặc `"N/A"`: imputer chỉ nhận ra `NaN`, hãy đổi về `NaN` trước.

### Cần nhớ

- `statistics_` cho biết giá trị điền; mean nhạy với ngoại lai, median thì không.
- `fit` chỉ trên train; test chỉ `transform`.
- `Pipeline` và `ColumnTransformer` giữ đúng quy tắc trên một cách tự động.
