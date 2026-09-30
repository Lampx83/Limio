## Thực hành: Bias-variance qua thực nghiệm

**Sau bài này bạn sẽ:** tự sinh dữ liệu, khớp đa thức bậc 1, 3 và 9, rồi nhìn thấy bias và variance bằng con số: underfitting sai cả trên train lẫn test, còn overfitting có sai số train gần 0 nhưng sai số test vọt lên.

### 1. Sinh dữ liệu có quy luật cong

```python
import numpy as np

rng = np.random.default_rng(2)          # hạt giống cố định → ai chạy cũng ra cùng kết quả

def f(x):                               # quy luật thật: một chu kỳ sóng sin
    return np.sin(2 * np.pi * x)

x_train = np.linspace(0, 1, 10)
y_train = f(x_train) + rng.normal(0, 0.3, 10)     # 10 mẫu huấn luyện, nhiễu σ = 0.3
x_test = rng.uniform(0, 1, 200)
y_test = f(x_test) + rng.normal(0, 0.3, 200)      # 200 mẫu chưa từng thấy

def mse(y, y_hat):
    return np.mean((y - y_hat) ** 2)
```

### 2. Khớp ba mô hình

```python
for degree in (1, 3, 9):
    coef = np.polyfit(x_train, y_train, degree)
    tr = mse(y_train, np.polyval(coef, x_train))
    te = mse(y_test, np.polyval(coef, x_test))
    print(f"bậc {degree}: train = {tr:.3f}   test = {te:.3f}")
# bậc 1: train = 0.220   test = 0.353
# bậc 3: train = 0.086   test = 0.146
# bậc 9: train = 0.000   test = 0.914
```

Với dữ liệu này:

| Bậc | Train | Test | Chẩn đoán |
|---|---|---|---|
| 1 | 0.220 | 0.353 | Underfitting (bias cao): đường thẳng không uốn theo sóng sin, sai cả hai tập |
| 3 | 0.086 | 0.146 | Vừa phải: test gần mức nhiễu σ² = 0.09, thứ không mô hình nào xoá được |
| 9 | 0.000 | 0.914 | Overfitting (variance cao): 10 hệ số cho đúng 10 điểm nên đường cong đi qua cả nhiễu |

### 3. Quét mọi bậc từ 1 đến 9

```python
train_err, test_err = [], []
for degree in range(1, 10):
    coef = np.polyfit(x_train, y_train, degree)
    train_err.append(round(float(mse(y_train, np.polyval(coef, x_train))), 3))
    test_err.append(round(float(mse(y_test, np.polyval(coef, x_test))), 3))
print(train_err)   # [0.22, 0.217, 0.086, 0.081, 0.077, 0.06, 0.06, 0.009, 0.0]
print(test_err)    # [0.353, 0.359, 0.146, 0.154, 0.143, 0.158, 0.158, 0.501, 0.914]
```

Sai số train không bao giờ tăng khi tăng bậc (mô hình bậc cao chứa mô hình bậc thấp nên khớp train tốt hơn hoặc bằng). Sai số test giảm rồi tăng lại. Trong lần chạy này, test thấp nhất ở bậc 5 nhưng gần như bằng bậc 3, nên chọn bậc 3 (đơn giản hơn). Đây là dữ liệu cụ thể, chạy hạt giống khác sẽ lệch chút.

### 4. Thêm dữ liệu làm giảm variance

```python
for n in (10, 30, 100):
    x = np.linspace(0, 1, n)
    y = f(x) + rng.normal(0, 0.3, n)
    coef = np.polyfit(x, y, 9)
    print(n, round(mse(y, np.polyval(coef, x)), 3), round(mse(y_test, np.polyval(coef, x_test)), 3))
# 10 0.0 0.872
# 30 0.087 0.146
# 100 0.061 0.109
```

Mô hình bậc 9 không đổi, nhưng mẫu huấn luyện càng nhiều thì sai số test càng giảm (dòng đầu khác 0.914 vì đây là một lần lấy nhiễu mới). Mô hình không còn "thuộc lòng nhiễu" dễ dàng như vậy.

### Lỗi hay gặp

- Chỉ nhìn sai số train rồi chọn mô hình phức tạp nhất.
- Chọn bậc bằng chính tập test rồi báo cáo tập test đó (dùng kiểm định chéo, bài 3.7).

### Cần nhớ

- Train và test đều cao: bias cao. Train thấp, test cao: variance cao.
- Khoảng cách train-test mới là dấu hiệu, không phải riêng sai số train.
- Thêm dữ liệu giúp giảm variance; thêm độ phức tạp giúp giảm bias.
