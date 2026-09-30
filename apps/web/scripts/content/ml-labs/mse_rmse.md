## MSE và RMSE

**Sau bài này bạn sẽ:** tính MSE và RMSE bằng tay lẫn bằng scikit-learn, hiểu vì sao RMSE cùng đơn vị với biến mục tiêu, và thấy MSE/RMSE nhạy với ngoại lai hơn MAE ra sao.

### 1. Định nghĩa

Với n mẫu, gọi sai số của mẫu thứ i là `e = y_dự_đoán − y_thật`:

| Độ đo | Công thức | Đơn vị |
|---|---|---|
| MAE | trung bình của trị tuyệt đối abs(e) | cùng đơn vị với y |
| MSE | trung bình của e² | **bình phương** đơn vị của y |
| RMSE | căn bậc hai của MSE | cùng đơn vị với y |

### 2. Tính tay với 5 căn nhà (đơn vị: tỷ đồng)

| Giá thật | Giá đoán | e | abs(e) | e² |
|---|---|---|---|---|
| 2.0 | 2.5 | +0.5 | 0.5 | 0.25 |
| 3.0 | 2.5 | −0.5 | 0.5 | 0.25 |
| 4.0 | 4.0 | 0 | 0 | 0 |
| 5.0 | 4.0 | −1.0 | 1.0 | 1.0 |
| 6.0 | 7.0 | +1.0 | 1.0 | 1.0 |

Tổng abs(e) = 3 nên MAE = 3 / 5 = 0.6. Tổng e² = 2.5 nên MSE = 2.5 / 5 = 0.5 và RMSE = √0.5 ≈ 0.707. Kiểm tra bằng NumPy:

```python
import numpy as np

y_true = np.array([2.0, 3.0, 4.0, 5.0, 6.0])   # giá thật (tỷ đồng)
y_pred = np.array([2.5, 2.5, 4.0, 4.0, 7.0])   # giá mô hình đoán

err = y_pred - y_true
mae = np.mean(np.abs(err))
mse = np.mean(err ** 2)
print(mae, mse, round(np.sqrt(mse), 4))   # 0.6 0.5 0.7071
```

### 3. Gọi bằng scikit-learn

```python
from sklearn.metrics import (mean_absolute_error, mean_squared_error,
                             root_mean_squared_error, r2_score)

print(mean_absolute_error(y_true, y_pred))          # 0.6
print(mean_squared_error(y_true, y_pred))           # 0.5
print(root_mean_squared_error(y_true, y_pred))      # 0.7071067811865476
print(np.sqrt(mean_squared_error(y_true, y_pred)))  # 0.7071067811865476
print(r2_score(y_true, y_pred))                     # 0.75
```

`root_mean_squared_error` có từ scikit-learn 1.4; trước đó người ta viết `np.sqrt(mean_squared_error(...))`. Đừng dùng tham số `squared=False` trong tài liệu cũ: bản mới đã bỏ nó và báo `TypeError`. Luôn đặt `y_true` trước `y_pred`.

**Đơn vị:** RMSE = 0.707 tỷ đồng, nghĩa là sai số "điển hình" khoảng 0.7 tỷ. MSE = 0.5 nhưng đơn vị là tỷ², khó diễn giải trực tiếp. Muốn biết 0.707 tốt hay xấu, hãy so với mô hình luôn đoán trung bình: khi đó MSE chính là phương sai của y (`np.var(y_true)` = 2.0) và RMSE = √2 ≈ 1.414. Mô hình của ta giảm một nửa, khớp với R² = 1 − 0.5 / 2.0 = 0.75.

### 4. Ngoại lai: MSE/RMSE phạt nặng hơn MAE

```python
y_bad = y_pred.copy()
y_bad[-1] = 11.0                                     # căn cuối bị đoán lệch 5 tỷ
print(mean_absolute_error(y_true, y_bad))            # 1.4
print(mean_squared_error(y_true, y_bad))             # 5.3
print(root_mean_squared_error(y_true, y_bad))        # 2.3021728866442674
```

Chỉ một lỗi lớn: MAE tăng từ 0.6 lên 1.4 (gấp 2.3 lần), nhưng RMSE tăng từ 0.707 lên 2.30 (gấp 3.3 lần), vì lỗi 5 bị bình phương thành 25. RMSE luôn ≥ MAE; nếu RMSE lớn hơn MAE nhiều, mô hình đang có vài sai số rất lớn.

### Lỗi hay gặp

- Đọc MSE như thể nó cùng đơn vị với y (thực ra là đơn vị bình phương).
- Cho rằng MSE nhỏ hơn thì luôn tốt hơn mà không so với baseline hay thang đo của y.
- Dùng RMSE mà không nghĩ tới ngoại lai: vài điểm nhiễu cũng đủ làm nó tăng vọt, trong khi MAE ổn định hơn.

### Cần nhớ

- MSE = trung bình e²; RMSE = √MSE, **cùng đơn vị với y**.
- Bình phương làm lỗi lớn bị phạt nặng: RMSE nhạy với ngoại lai hơn MAE.
- `root_mean_squared_error` (scikit-learn ≥ 1.4) hoặc `np.sqrt(mean_squared_error(...))`.
