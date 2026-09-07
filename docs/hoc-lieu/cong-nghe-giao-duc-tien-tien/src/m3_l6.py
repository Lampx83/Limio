# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.6 · Xưởng mốc 3: phần luyện tập thích ứng cho sách AR",
    "durationMin": 60,
    "description": "Hướng dẫn thực hiện mốc 3 của đồ án: bộ câu hỏi phân hoá ba mức gắn thành phần tri thức, bảng quyết định thích ứng, cơ chế ôn tập, và tiêu chí chấm.",
    "objectives": [
        "Soạn được bộ câu hỏi phân hoá ba mức gắn đúng thành phần tri thức của sách",
        "Viết được bảng quyết định thích ứng kiểm được bằng ca thử",
        "Ghép được cơ chế ôn tập giãn cách vào phần luyện tập mà không đòi hạ tầng phức tạp",
    ],
    "summary": [
        "Mốc 3 nộp bốn thứ: bản đồ tri thức của sách, bộ câu hỏi ba mức, bảng quyết định thích ứng, và cơ chế ôn tập.",
        "Phân hoá ba mức không phải là dễ – vừa – khó theo cảm tính, mà là ba loại nhiệm vụ khác nhau về mức hỗ trợ và mức chuyển giao.",
        "Bảng quyết định phải phủ hết trạng thái và không mâu thuẫn; mỗi dòng đi kèm một ca kiểm thử.",
        "Phần luyện tập chạy được trên giấy trước khi chạy được trên phần mềm — nếu quy tắc không diễn được bằng tay trong lớp thì đừng lập trình.",
    ],
    "body": r"""
## Mốc 3 nộp gì

| Sản phẩm | Nội dung | Dựa trên bài |
|---|---|---|
| Bản đồ tri thức của sách | 5–8 thành phần tri thức của bốn trang, kèm quan hệ tiên quyết nếu có | Bài 3.1 |
| Bộ câu hỏi phân hoá | 18–24 câu chia ba mức, mỗi câu gắn thành phần tri thức và mã lỗi tư duy cho phương án sai | Bài 3.1, Bài 2.4 |
| Bảng quyết định thích ứng | 5–7 dòng trạng thái – hành động – lý do, kèm ca kiểm thử cho từng dòng | Bài 3.5 |
| Cơ chế ôn tập | 12–20 thẻ ôn kèm quy tắc lập lịch và trần mỗi phiên | Bài 3.4 |

> [!ghi-nho] Ràng buộc quan trọng nhất của mốc này: **phần luyện tập phải diễn được bằng tay trong lớp trước khi được lập trình.** Nếu bạn không thể cầm bộ thẻ giấy và đóng vai hệ thống trong mười phút với một người học thật, thì quy tắc của bạn chưa đủ rõ — và lập trình sẽ chỉ giấu chỗ chưa rõ ấy đi.

## Phân hoá ba mức cho đúng

Sai lầm thường gặp là chia ba mức theo cảm tính dễ – vừa – khó, kết quả là ba nhóm câu cùng loại chỉ khác độ dài. Ba mức nên khác nhau ở **mức hỗ trợ** và **khoảng cách chuyển giao**:

| Mức | Đặc trưng nhiệm vụ | Vai trò trong đường học | Ví dụ với nội dung ba chiều |
|---|---|---|---|
| 1 · Nhận diện có hỗ trợ | Người học có mô hình AR trước mắt, câu hỏi hướng sự chú ý vào chi tiết | Xây nền, kiểm người học nhìn đúng chỗ | Chỉ ra bộ phận nào đảm nhiệm chức năng vừa mô tả |
| 2 · Vận dụng không có mô hình | Cất mô hình đi, hỏi lại cùng nội dung bằng ngôn ngữ | Kiểm tri thức đã rời khỏi hình ảnh trước mắt | Mô tả trình tự chuyển động bằng lời, không nhìn mô hình |
| 3 · Chuyển giao sang tình huống mới | Bối cảnh khác, cần dùng cùng nguyên lý | Kiểm hiểu thật, không phải nhớ hình | Áp nguyên lý ấy để giải thích một hiện tượng chưa gặp trong sách |

Bộ câu hỏi phải có **câu neo** ở mỗi mức — câu gắn đúng một thành phần tri thức — nếu không, hệ thống không định vị được chỗ hổng như đã phân tích ở Bài 3.1.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Đường đi của một người học qua ba mức</div>
  <div style="min-width:34rem;display:flex;align-items:stretch;gap:.4rem">
    <div style="flex:1;padding:.7rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.45rem;font-size:1.02rem;line-height:1.5"><strong>Mức 1</strong><br>có mô hình trước mắt<br><span style="opacity:.85">đạt ngưỡng → lên mức 2</span></div>
    <div style="flex:0 0 auto;display:flex;align-items:center;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.45rem;font-size:1.02rem;line-height:1.5"><strong>Mức 2</strong><br>không còn mô hình<br><span style="opacity:.85">sai 3 lượt → tăng hỗ trợ, chưa lùi mức</span></div>
    <div style="flex:0 0 auto;display:flex;align-items:center;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.45rem;font-size:1.02rem;line-height:1.5"><strong>Mức 3</strong><br>tình huống mới<br><span style="opacity:.85">đạt ngưỡng → vào hàng đợi ôn tập</span></div>
  </div>
  <div style="min-width:34rem;margin:.5rem 0 0;padding:.55rem .8rem;background:rgba(217,150,40,.14);border-left:4px solid rgba(217,150,40,.6);border-radius:0 .35rem .35rem 0;font-size:1.02rem;line-height:1.6">Lùi mức chỉ xảy ra khi có dấu hiệu hổng thành phần tri thức của mức dưới — không lùi chỉ vì sai vài câu, nếu không hệ thống sẽ đẩy người học xuống và giữ họ ở đó.</div>
</div>
```

## Quy tắc vận hành: bảng quyết định và cơ chế ôn tập

### Bảng quyết định viết sao cho kiểm được

Mỗi dòng gồm ba phần: trạng thái quan sát được (viết bằng số, không viết bằng cảm nhận), hành động, và lý do sư phạm. Ba lỗi hay gặp khi viết bảng:

1. **Trạng thái không đo được.** *Khi người học có vẻ nản* — hệ thống không quan sát được điều này. Viết lại thành *khi ba lượt sai liên tiếp và thời gian giữa hai lượt tăng gấp đôi*.
2. **Hai dòng cùng khớp một trạng thái.** Người học vừa đạt ngưỡng vừa trả lời rất nhanh: dòng nào thắng? Phải có thứ tự ưu tiên tường minh.
3. **Trạng thái không dòng nào phủ.** Bộ ca kiểm thử tìm ra ngay nếu bạn dựng ca theo tổ hợp, không theo trực giác.

> [!meo] Cách kiểm nhanh: liệt kê 8–10 trạng thái điển hình dưới dạng bộ ba số *(xác suất nắm, số lượt liên tiếp sai, thời gian trả lời)* rồi chạy tay qua bảng. Bảng tốt cho đúng một hành động cho mỗi trạng thái, và bạn giải thích được lý do cho một giáo viên trong một câu.

### Ghép ôn tập vào mà không cần hạ tầng phức tạp

Mốc 3 không đòi bạn viết phần mềm. Cơ chế ôn tập ở quy mô một lớp chạy được bằng ba thứ rất thô:

- **Bộ thẻ giấy có đánh dấu hộp** theo nguyên tắc Leitner, giáo viên phát vào đầu giờ.
- **Bảng tính chung** ghi ngày ôn gần nhất và hộp hiện tại của từng người học, dùng công thức tính thẻ đến hạn.
- **Mã QR trên trang sách** dẫn tới bộ thẻ trực tuyến, nếu bạn đã dựng phần web AR ở tuyến B.

Chọn thứ nào là quyết định về **điều kiện lớp học của bạn**, không phải về mức độ hiện đại. Điều bắt buộc là quy tắc phải rõ tới mức người khác cầm lên dùng được: khi nào thẻ lên hộp, khi nào rơi về hộp đầu, mỗi phiên tối đa bao nhiêu thẻ.

## Bảng kiểm và tiêu chí chấm mốc 3

| # | Hạng mục | Đạt khi |
|---|---|---|
| 1 | Bản đồ tri thức | 5–8 thành phần, tên bằng cụm động từ, có ít nhất một quan hệ tiên quyết được nêu |
| 2 | Câu neo | Mỗi mức có ít nhất hai câu gắn đúng một thành phần |
| 3 | Phân hoá ba mức | Ba mức khác nhau về mức hỗ trợ và khoảng cách chuyển giao, không chỉ khác độ dài |
| 4 | Mã lỗi tư duy | Mỗi phương án sai quan trọng gắn một lỗi tư duy có tên, kèm câu phản hồi tương ứng |
| 5 | Bảng quyết định | Phủ hết, không mâu thuẫn, mỗi dòng có ca kiểm thử |
| 6 | Cơ chế ôn tập | Quy tắc rõ, có trần mỗi phiên, xử lý được trường hợp nghỉ dài |
| 7 | Diễn thử | Có biên bản diễn thử bằng tay với ít nhất một người học thật |

| Tiêu chí chấm mốc 3 | Điểm |
|---|---|
| Chất lượng bộ câu hỏi: bám thành phần tri thức, phân hoá đúng, có câu neo | 30 |
| Bảng quyết định: kiểm được, không mâu thuẫn, lý do sư phạm vững | 25 |
| Cơ chế ôn tập: khả thi trong điều kiện lớp học thật | 20 |
| Biên bản diễn thử và những gì đã sửa sau đó | 15 |
| Gắn kết với nội dung sách AR ở mốc 2 | 10 |

> [!canh-bao] Hai lỗi bị trừ nặng: **bộ câu hỏi không có câu neo** (hệ thống không định vị được chỗ hổng, nên mọi thứ phía sau chỉ là hình thức), và **bảng quyết định chỉ có đường đi xuống** — chỉ hạ độ khó khi sai, không có đường nâng trở lại. Cả hai đều đã được cảnh báo ở Bài 3.1 và 3.5.

## Luyện tập và tài liệu tham khảo

### Cá nhân (25 phút)

Lấy bản đồ tri thức từ bài tập Bài 3.1 và soạn sáu câu: hai câu mỗi mức, trong đó mỗi mức có một câu neo. Tự kiểm bằng hai câu hỏi: câu mức 2 có thật sự làm được khi không nhìn mô hình không, và câu mức 3 có dùng bối cảnh chưa xuất hiện trong sách không.

### Nhóm 3–4 người (30 phút)

Diễn thử bảng quyết định: một người đóng vai hệ thống cầm bảng quyết định và bộ thẻ, một người đóng vai học sinh cố tình mắc lỗi theo kịch bản, hai người còn lại ghi lại mọi lúc người đóng vai hệ thống phải ngập ngừng. Mỗi lần ngập ngừng là một chỗ bảng quyết định chưa rõ — sửa ngay tại chỗ.

### Bài tập về nhà — mốc 3 của đồ án (150 phút)

Nộp đủ bốn sản phẩm theo bảng ở mục 1, cộng biên bản diễn thử.

1. Bản đồ tri thức 5–8 thành phần cho bốn trang sách của bạn.
2. Bộ 18–24 câu hỏi ba mức, gắn thành phần tri thức và mã lỗi tư duy, có câu neo ở mỗi mức.
3. Bảng quyết định 5–7 dòng kèm bộ ca kiểm thử tương ứng.
4. Cơ chế ôn tập: bộ thẻ và quy tắc lập lịch, chọn hình thức phù hợp điều kiện lớp.
5. Biên bản diễn thử bằng tay với ít nhất một người học thật, ghi rõ chỗ bạn phải ngập ngừng và những gì đã sửa.

**Cách làm (gợi ý từng bước):** viết câu mức 3 trước rồi mới viết ngược xuống mức 1 — làm ngược lại thì mức 3 thường chỉ là mức 2 dài hơn; gán mã lỗi tư duy bằng chính danh sách lỗi sai đã lập ở Bài 3.1, đừng bịa lỗi mới; bảng quyết định viết trạng thái bằng số ngay từ đầu, đừng viết bằng lời rồi mới quy đổi; khi diễn thử, đừng giải thích hộ hệ thống — nếu người học không hiểu thì đó là phát hiện, không phải sự cố.

**Chấm theo:** áp bảng tiêu chí chấm mốc 3 ở mục 5. Nhớ hai lỗi bị trừ nặng: thiếu câu neo, và bảng quyết định chỉ có đường đi xuống.

### Nguồn tham khảo

- Koedinger, K. R., Corbett, A. T., & Perfetti, C. (2012). The Knowledge-Learning-Instruction framework. *Cognitive Science*, 36(5), 757–798.
- Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). The eighty five percent rule for optimal learning. *Nature Communications*, 10, 4646.
- Cepeda, N. J., và cộng sự (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3), 354–380.
- Haladyna, T. M., & Rodriguez, M. C. (2013). *Developing and Validating Test Items.* Routledge.
""",
    "quiz": {
        "title": "Kiểm tra Bài 3.6",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.6-dien-tay-truoc",
                "type": "mcq",
                "prompt": "Vì sao mốc 3 bắt buộc phần luyện tập phải diễn được bằng tay trước khi lập trình?",
                "explanation": "Nếu không cầm bộ thẻ giấy đóng vai hệ thống được trong mười phút thì quy tắc chưa đủ rõ, và lập trình chỉ giấu chỗ chưa rõ ấy đi.",
                "points": 2,
                "options": [
                    {"label": "Vì không diễn được bằng tay nghĩa là quy tắc chưa đủ rõ, và mã nguồn sẽ che chỗ chưa rõ đó", "isCorrect": True},
                    {"label": "Vì sinh viên chưa được học lập trình", "isCorrect": False},
                    {"label": "Vì hệ thống phần mềm luôn kém hơn giấy", "isCorrect": False},
                    {"label": "Vì quy chế đồ án cấm dùng phần mềm", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-ba-muc-khac-nhau",
                "type": "mcq",
                "prompt": "Ba mức của bộ câu hỏi nên khác nhau ở điều gì?",
                "explanation": "Ở mức hỗ trợ và khoảng cách chuyển giao — có mô hình trước mắt, không còn mô hình, và tình huống hoàn toàn mới — chứ không phải ở độ dài hay số chữ.",
                "points": 2,
                "options": [
                    {"label": "Mức hỗ trợ đi kèm và khoảng cách chuyển giao sang tình huống mới", "isCorrect": True},
                    {"label": "Độ dài đề bài và số phương án", "isCorrect": False},
                    {"label": "Số điểm cho mỗi câu", "isCorrect": False},
                    {"label": "Thời gian làm bài cho phép", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-muc-2",
                "type": "mcq",
                "prompt": "Câu hỏi mức 2 trong bộ luyện tập của sách AR nên có đặc điểm gì?",
                "explanation": "Cất mô hình đi và hỏi lại cùng nội dung bằng ngôn ngữ — để kiểm tri thức đã rời khỏi hình ảnh trước mắt hay chưa.",
                "points": 2,
                "options": [
                    {"label": "Không cho nhìn mô hình, hỏi lại cùng nội dung bằng ngôn ngữ", "isCorrect": True},
                    {"label": "Cho nhìn mô hình nhưng thêm nhiều chi tiết hơn", "isCorrect": False},
                    {"label": "Giữ nguyên câu mức 1 nhưng viết dài hơn", "isCorrect": False},
                    {"label": "Yêu cầu người học tự dựng mô hình ba chiều", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-trang-thai-do-duoc",
                "type": "mcq",
                "prompt": "Dòng bảng quyết định viết *khi người học có vẻ nản thì giảm độ khó*. Vấn đề và cách sửa là gì?",
                "explanation": "Trạng thái không đo được. Viết lại bằng số: ba lượt sai liên tiếp và thời gian giữa hai lượt tăng gấp đôi.",
                "points": 2,
                "options": [
                    {"label": "Trạng thái không quan sát được; phải viết lại bằng chỉ số đo được như số lượt sai và thời gian giữa hai lượt", "isCorrect": True},
                    {"label": "Hành động sai; phải tăng độ khó thay vì giảm", "isCorrect": False},
                    {"label": "Không có vấn đề gì nếu giáo viên hiểu ý", "isCorrect": False},
                    {"label": "Vấn đề chỉ là cách diễn đạt, không ảnh hưởng khi lập trình", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-hai-dong-khop",
                "type": "mcq",
                "prompt": "Một trạng thái khớp đồng thời hai dòng trong bảng quyết định. Cách xử lý đúng là gì?",
                "explanation": "Phải có thứ tự ưu tiên tường minh giữa các dòng; nếu không, hành vi hệ thống phụ thuộc vào thứ tự tình cờ trong mã nguồn.",
                "points": 2,
                "options": [
                    {"label": "Quy định thứ tự ưu tiên tường minh giữa các dòng", "isCorrect": True},
                    {"label": "Thực hiện cả hai hành động cùng lúc", "isCorrect": False},
                    {"label": "Chọn ngẫu nhiên một trong hai", "isCorrect": False},
                    {"label": "Bỏ cả hai dòng và không làm gì", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-lui-muc",
                "type": "mcq",
                "prompt": "Khi nào hệ thống nên cho người học lùi từ mức 2 xuống mức 1?",
                "explanation": "Chỉ khi có dấu hiệu hổng thành phần tri thức của mức dưới — không lùi chỉ vì sai vài câu, nếu không hệ thống sẽ đẩy người học xuống và giữ họ ở đó.",
                "points": 2,
                "options": [
                    {"label": "Chỉ khi có dấu hiệu hổng thành phần tri thức của mức dưới", "isCorrect": True},
                    {"label": "Ngay khi sai hai câu liên tiếp", "isCorrect": False, "misconception": "cngdtt.adaptive-means-easier"},
                    {"label": "Khi người học yêu cầu bài dễ hơn", "isCorrect": False},
                    {"label": "Khi tỉ lệ đúng xuống dưới 85%", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-cau-neo-bat-buoc",
                "type": "mcq",
                "prompt": "Vì sao thiếu câu neo là lỗi bị trừ điểm nặng ở mốc 3?",
                "explanation": "Không có câu gắn đúng một thành phần thì hệ thống không định vị được chỗ hổng, nên bảng quyết định và phản hồi phía sau chỉ còn là hình thức.",
                "points": 2,
                "options": [
                    {"label": "Vì không định vị được chỗ hổng thì mọi cơ chế thích ứng phía sau mất căn cứ", "isCorrect": True},
                    {"label": "Vì câu neo giúp bài dễ hơn cho học sinh yếu", "isCorrect": False},
                    {"label": "Vì quy chế đề thi yêu cầu có câu dễ", "isCorrect": False},
                    {"label": "Vì câu neo làm bộ đề dài hơn", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-hinh-thuc-on-tap",
                "type": "mcq",
                "prompt": "Chọn hình thức cơ chế ôn tập (thẻ giấy, bảng tính, hay bộ thẻ trực tuyến qua QR) nên dựa trên tiêu chí nào?",
                "explanation": "Điều kiện lớp học thật, không phải mức độ hiện đại. Điều bắt buộc là quy tắc rõ tới mức người khác cầm lên dùng được.",
                "points": 2,
                "options": [
                    {"label": "Điều kiện lớp học thật của bạn, kèm yêu cầu quy tắc phải rõ để người khác dùng được", "isCorrect": True},
                    {"label": "Hình thức nào hiện đại nhất thì chọn", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Hình thức nào rẻ nhất", "isCorrect": False},
                    {"label": "Hình thức nào giáo viên hướng dẫn quen dùng", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-dien-thu-ngap-ngung",
                "type": "mcq",
                "prompt": "Trong buổi diễn thử, người đóng vai hệ thống ngập ngừng ba lần. Ý nghĩa của điều đó là gì?",
                "explanation": "Mỗi lần ngập ngừng là một chỗ bảng quyết định chưa rõ hoặc chưa phủ. Đó là phát hiện quý nhất của buổi diễn thử.",
                "points": 2,
                "options": [
                    {"label": "Ba chỗ bảng quyết định chưa rõ hoặc chưa phủ trạng thái, cần sửa ngay", "isCorrect": True},
                    {"label": "Người đóng vai chưa thuộc bài, không liên quan tới thiết kế", "isCorrect": False},
                    {"label": "Bảng quyết định quá dài, cần rút gọn", "isCorrect": False},
                    {"label": "Diễn thử không phù hợp với hệ thống thích ứng", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-viet-nguoc",
                "type": "mcq",
                "prompt": "Vì sao nên viết câu mức 3 trước rồi mới viết ngược xuống mức 1?",
                "explanation": "Viết xuôi từ mức 1 thì mức 3 thường chỉ thành mức 2 dài hơn. Bắt đầu từ đích chuyển giao buộc bạn xác định rõ hiểu thật nghĩa là làm được gì.",
                "points": 2,
                "options": [
                    {"label": "Vì bắt đầu từ đích chuyển giao thì các mức dưới mới thật sự dẫn tới đó", "isCorrect": True},
                    {"label": "Vì câu khó dễ viết hơn câu dễ", "isCorrect": False},
                    {"label": "Vì hệ thống chấm ưu tiên câu mức 3", "isCorrect": False},
                    {"label": "Không quan trọng thứ tự viết", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-loi-tru-nang",
                "type": "mcq",
                "prompt": "Hai lỗi bị trừ điểm nặng nhất ở mốc 3 là gì?",
                "explanation": "Bộ câu hỏi không có câu neo, và bảng quyết định chỉ có đường đi xuống — chỉ hạ độ khó khi sai, không có đường nâng trở lại.",
                "points": 2,
                "options": [
                    {"label": "Thiếu câu neo, và bảng quyết định chỉ có đường hạ độ khó mà không có đường nâng", "isCorrect": True},
                    {"label": "Bộ câu hỏi quá dài, và thẻ ôn quá ít", "isCorrect": False},
                    {"label": "Dùng thẻ giấy thay vì phần mềm, và không có biểu đồ", "isCorrect": False},
                    {"label": "Không dùng mô hình học sâu, và không có dữ liệu lớn", "isCorrect": False},
                ],
            },
            {
                "key": "3.6-thu-tu-lam",
                "type": "ordering",
                "prompt": "Sắp xếp trình tự làm mốc 3.",
                "explanation": "Bản đồ tri thức trước, rồi câu hỏi từ mức 3 ngược xuống, rồi quy tắc, rồi ôn tập, và diễn thử để sửa trước khi nộp.",
                "points": 3,
                "sequence": [
                    "Chốt bản đồ tri thức của bốn trang sách",
                    "Viết câu mức 3, rồi ngược xuống mức 2 và mức 1, bảo đảm có câu neo",
                    "Gắn mã lỗi tư duy cho các phương án sai quan trọng",
                    "Viết bảng quyết định và bộ ca kiểm thử tương ứng",
                    "Dựng cơ chế ôn tập và chọn hình thức phù hợp điều kiện lớp",
                    "Diễn thử bằng tay với người học thật rồi sửa theo chỗ ngập ngừng",
                ],
            },
            {
                "key": "3.6-viet-luan-moc3",
                "type": "essay",
                "prompt": "Viết 250–350 từ trình bày kế hoạch mốc 3 của bạn: 5–8 thành phần tri thức của sách, ba mức câu hỏi khác nhau thế nào với nội dung cụ thể của bạn, ba dòng quan trọng nhất trong bảng quyết định, và bạn sẽ diễn thử với ai.",
                "points": 5,
            },
        ],
    },
}
