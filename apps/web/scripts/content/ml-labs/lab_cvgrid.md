## Thực hành: Kiểm định chéo và GridSearchCV

**Sau bài này bạn sẽ:** xem tận mắt `KFold` chia dữ liệu ra sao, đọc kết quả `cross_val_score`, và dùng `GridSearchCV` chọn siêu tham số (tính được số lần huấn luyện) mà không đụng vào tập test.

### 1. KFold chia dữ liệu thế nào

```python
import numpy as np
from sklearn.model_selection import KFold

X10 = np.arange(10).reshape(-1, 1)             # 10 mẫu, chỉ số 0..9
for i, (tr, va) in enumerate(KFold(n_splits=5).split(X10)):
    print(i, "train", tr, "val", va)
# 0 train [2 3 4 5 6 7 8 9] val [0 1]
# 1 train [0 1 4 5 6 7 8 9] val [2 3]
# ...  (fold cuối: train [0..7], val [8 9])

print([va.tolist() for _, va in KFold(n_splits=3).split(X10)])
# [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]]
```

Mỗi mẫu làm validation đúng một lần và làm train K − 1 lần. 10 mẫu không chia hết cho 3 nên các fold có cỡ 4, 3, 3. `KFold` **không xáo trộn**: nó cắt theo thứ tự có sẵn.

### 2. cross_val_score: trung bình ± độ lệch chuẩn

```python
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

X, y = load_iris(return_X_y=True)   # 150 mẫu, xếp theo loài: 50 loài 0, rồi 50 loài 1, rồi 50 loài 2
model = LogisticRegression(max_iter=1000)

scores = cross_val_score(model, X, y, cv=5)
print(len(scores))                                # 5  (mỗi fold một điểm số)
print(f"{scores.mean():.3f} ± {scores.std():.3f}")   # 0.973 ± 0.025
```

Trung bình là ước lượng hiệu năng mong đợi; độ lệch chuẩn cho biết kết quả dao động giữa các cách chia (số cụ thể có thể lệch nhẹ giữa các phiên bản). Cẩn thận với dữ liệu xếp theo nhãn:

```python
print(cross_val_score(model, X, y, cv=KFold(n_splits=3)))    # [0. 0. 0.]
shuffled = KFold(n_splits=3, shuffle=True, random_state=0)
print(cross_val_score(model, X, y, cv=shuffled).min() > 0.9)  # True
```

Không xáo, mỗi fold validation chứa trọn một loài mà hai fold train chưa từng thấy nên điểm là 0. Truyền `cv=5` cho bộ phân loại thì scikit-learn dùng `StratifiedKFold`, không bị lỗi này.

### 3. GridSearchCV và nguyên tắc không dùng test

```python
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.tree import DecisionTreeClassifier

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)     # 120 train / 30 test

grid = {"max_depth": [1, 2, 3, None], "min_samples_leaf": [1, 5]}
search = GridSearchCV(DecisionTreeClassifier(random_state=0), grid, cv=5, verbose=1)
search.fit(X_train, y_train)            # chỉ dùng train
# Fitting 5 folds for each of 8 candidates, totalling 40 fits

print(len(search.cv_results_["params"]))     # 8
print(search.best_params_)                   # {'max_depth': None, 'min_samples_leaf': 1}
print(round(search.best_score_, 3))          # 0.942
print(round(search.score(X_test, y_test), 3))  # 0.967  ← lần đầu và duy nhất dùng test
```

- **Số lần huấn luyện** = số tổ hợp × số fold = 4 × 2 × 5 = 40, cộng 1 lần `refit`.
- `best_params_` / `best_score_`: tổ hợp có điểm CV trung bình cao nhất và điểm đó (chỉ tính trên train); giá trị cụ thể có thể khác giữa các phiên bản.
- `refit=True` (mặc định): sau khi chọn, huấn luyện lại tổ hợp tốt nhất trên **toàn bộ train**, kết quả nằm ở `best_estimator_`; `search.score`/`search.predict` dùng mô hình này.

Quy trình đúng: chia train/test → `GridSearchCV` chỉ trên train → chốt mô hình → chấm test đúng một lần.

### Lỗi hay gặp

- Chọn siêu tham số theo điểm trên tập test rồi báo cáo chính điểm đó.
- Chuẩn hoá cả bảng trước khi CV: hãy đặt scaler trong `Pipeline` (tham số thành `tên_bước__max_depth`).

### Cần nhớ

- `cross_val_score` trả K điểm: hãy xem cả mean lẫn std.
- `GridSearchCV`: số lần huấn luyện = số tổ hợp × số fold (+1 refit).
- Tập test chỉ dùng một lần, ở bước cuối.
