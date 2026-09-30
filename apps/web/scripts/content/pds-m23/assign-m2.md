Bạn nhận được bảng điểm thô của một lớp học, nhập tay nên có nhiều lỗi. Hãy làm sạch rồi khám phá nó trong một Jupyter Notebook.

**Dữ liệu** (dán vào notebook và nạp bằng `pd.read_csv(io.StringIO(csv))`):

```python
import io
import pandas as pd

csv = """id,name,major,score
1, An ,IT,8.5
2,Binh,IT,
3,Chi,Econ,9
3,Chi,Econ,9
4,Dung,econ,6.5
5,Em,IT,7.5
6,Giang,IT,x
7,Hoa,Econ,8
8,Khanh,it,9.5
9,Lan,Econ,
"""
df = pd.read_csv(io.StringIO(csv))
```

**Yêu cầu**

1. **Khám phá ban đầu** — in `shape`, `info()`, số giá trị thiếu mỗi cột. Nêu ít nhất **4 vấn đề chất lượng** bạn thấy (ví dụ: khoảng trắng thừa, dòng trùng, cách viết hoa thường không thống nhất, giá trị không phải số).
2. **Làm sạch** — xử lý từng vấn đề bằng code: chuẩn hoá chuỗi (`.str.strip()`, `.str.lower()`/`.str.upper()`), chuyển `score` về số bằng `pd.to_numeric(..., errors="coerce")`, bỏ dòng trùng, và quyết định cách xử lý điểm thiếu. **Giải thích lựa chọn** của bạn (bỏ dòng hay điền giá trị, và điền bằng gì) — không chỉ nói "vì phổ biến".
3. **Kiểm tra sau khi làm sạch** — in lại `shape` và số giá trị thiếu để chứng minh dữ liệu đã sạch.
4. **Tổng hợp** — dùng `groupby` để tính điểm trung bình và số học viên theo `major`; dùng `sort_values` để tìm học viên điểm cao nhất.
5. **Nhận xét** — viết 3–5 câu: hai ngành khác nhau thế nào, và kết luận của bạn chắc chắn tới đâu với chỉ 10 dòng dữ liệu (đã có dòng bị bỏ đi).

**Nộp** notebook `.ipynb` (đã chạy, còn hiển thị kết quả) hoặc file `.py` kèm ảnh chụp kết quả, cộng vài dòng: bước nào khó nhất và bạn xử lý thế nào.

Chấm điểm dựa trên việc làm sạch đúng, có kiểm tra lại từng bước, và lập luận hợp lý — không dựa vào độ dài code.
