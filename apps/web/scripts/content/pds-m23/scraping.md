## Web Scraping with BeautifulSoup

**Sau bài này bạn sẽ:** đọc cấu trúc một trang HTML, dùng BeautifulSoup để rút dữ liệu ra, và biết khi nào nên (hoặc không nên) scrape.

### 1. Scraping là gì và khi nào dùng

**Web scraping** là tự động lấy dữ liệu từ trang web dành cho người đọc. Hãy ưu tiên **API** nếu dịch vụ có cung cấp, vì API ổn định và đúng quy tắc hơn. Scrape chỉ khi không có API và việc thu thập được phép.

### 2. HTML trong 1 phút

Trang web là các **thẻ** lồng nhau. Mỗi thẻ có thể có thuộc tính như `class`, `id`, `href`:

```html
<ul id="items">
  <li class="item"><a href="/p/1">Pen</a> <span class="price">3.5</span></li>
</ul>
```

### 3. Phân tích HTML bằng BeautifulSoup

Ví dụ dưới dùng một đoạn HTML viết sẵn nên bạn chạy được ngay, không cần mạng:

```python
from bs4 import BeautifulSoup

html = """<html><body><h1>Shop</h1><ul id="items"><li class="item"><a href="/p/1">Pen</a> <span class="price">3.5</span></li><li class="item"><a href="/p/2">Book</a> <span class="price">12</span></li><li class="item sale"><a href="/p/3">Bag</a> <span class="price">20</span></li></ul></body></html>"""

soup = BeautifulSoup(html, "html.parser")
print(soup.h1.text)                       # Shop
print(len(soup.find_all("li")))           # 3   (mọi thẻ li)
print(soup.find("a")["href"])             # /p/1  (thẻ a đầu tiên, lấy thuộc tính href)
print(soup.find_all("a")[1].get("href"))  # /p/2
print(soup.find("table"))                 # None  (find không thấy thì trả None)
```

- `find(...)` trả về phần tử **đầu tiên** khớp (hoặc `None`); `find_all(...)` trả về **list** mọi phần tử khớp.
- `.text` lấy chữ bên trong; `["href"]` hoặc `.get("href")` lấy giá trị thuộc tính. `.get` trả `None` thay vì báo lỗi khi thiếu thuộc tính.

### 4. Bộ chọn CSS: `select` và `select_one`

Cú pháp giống CSS: `tên_thẻ.class`, `#id`, và khoảng trắng để chọn thẻ con.

```python
print(len(soup.select("li.item")))          # 3
print(len(soup.select("li.sale")))          # 1   (chỉ mục có thêm class sale)
print(soup.select_one("li.sale a").text)    # Bag
prices = [float(p.text) for p in soup.select("span.price")]
print(prices)        # [3.5, 12.0, 20.0]
print(sum(prices))   # 35.5
```

Chú ý: `<li class="item sale">` có **hai** class nên khớp cả `li.item` lẫn `li.sale`. Text lấy ra luôn là chuỗi, cần `float()`/`int()` để tính toán.

### 5. Với trang thật

```python
import requests
resp = requests.get("https://books.toscrape.com/", timeout=10)
soup = BeautifulSoup(resp.text, "html.parser")
titles = [a["title"] for a in soup.select("article.product_pod h3 a")]
```

Trang `books.toscrape.com` được dựng riêng để luyện scraping. Hãy dùng nó, đừng luyện trên trang của người khác.

### 6. Scrape có trách nhiệm

- Kiểm tra `robots.txt` (ví dụ `https://tên-miền/robots.txt`) và **điều khoản sử dụng** của trang trước khi thu thập.
- Đừng gửi quá nhiều yêu cầu dồn dập: chờ giữa các lần gọi (`time.sleep`) để không làm quá tải máy chủ.
- Trang **tải dữ liệu bằng JavaScript** sau khi mở sẽ không có dữ liệu đó trong HTML mà `requests` nhận được. Khi đó hãy tìm API ẩn mà trang gọi, hoặc dùng công cụ điều khiển trình duyệt.
- Không thu thập dữ liệu cá nhân hoặc dữ liệu bị cấm thu thập.

### Cần nhớ

- `find` cho phần tử đầu, `find_all` cho list; `select`/`select_one` dùng bộ chọn CSS.
- Text và thuộc tính luôn là chuỗi; ép kiểu trước khi tính toán.
- Ưu tiên API; kiểm tra `robots.txt` và điều khoản; chờ giữa các lần gọi.

### Reference

Mitchell, R. (2018). *Web Scraping with Python: Collecting Data from the Modern Web* (2nd ed.). O'Reilly Media.
