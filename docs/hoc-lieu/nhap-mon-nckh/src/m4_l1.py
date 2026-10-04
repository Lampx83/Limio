# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.1 · Chọn cách trả lời câu hỏi nghiên cứu — thiết kế cơ bản",
    "durationMin": 75,
    "description": "Chọn thiết kế định lượng/định tính/hỗn hợp theo loại câu hỏi; xác định biến và thang đo; chọn mẫu và hiểu giới hạn của mẫu thuận tiện; thiết kế bảng hỏi/hướng dẫn phỏng vấn không mắc lỗi cơ bản.",
    "objectives": [
        "Chọn được thiết kế định lượng, định tính hoặc hỗn hợp phù hợp với loại câu hỏi nghiên cứu đã chốt ở Bài 1.1",
        "Xác định được biến độc lập, biến phụ thuộc và loại thang đo phù hợp cho một câu hỏi định lượng",
        "Giải thích được vì sao mẫu thuận tiện không đại diện cho một dân số rộng hơn, và nêu được cách hạn chế đó ảnh hưởng tới kết luận",
        "Nhận diện và sửa được lỗi câu hỏi dẫn dắt (leading) và câu hỏi hai-trong-một (double-barreled) trong một bảng hỏi hoặc hướng dẫn phỏng vấn",
    ],
    "summary": [
        "Loại thiết kế chọn theo loại câu hỏi, không theo việc mình thấy con số hay lời nói dễ làm hơn: câu hỏi về mức độ hoặc mối quan hệ cần định lượng, câu hỏi về trải nghiệm hoặc cơ chế cần định tính.",
        "Một câu hỏi định lượng phải tách được thành biến độc lập và biến phụ thuộc, và mỗi biến phải gắn với một loại thang đo cụ thể trước khi thiết kế công cụ đo.",
        "Mẫu thuận tiện (khảo sát bạn cùng lớp) chỉ nói được về đúng nhóm đã khảo sát — cỡ mẫu lớn không cứu được một mẫu chọn theo cách thiên lệch.",
        "Câu hỏi dẫn dắt và câu hỏi hai-trong-một là hai lỗi phổ biến nhất trong bảng hỏi tự soạn, và cả hai đều làm dữ liệu thu về không đo đúng thứ cần đo.",
    ],
    "splitSections": True,
    "body": r"""
Bạn đã có câu hỏi nghiên cứu (Bài 1.1), đã biết người khác làm gì rồi (Bài 2.1), và biết cách trích dẫn đúng (Bài 3.1). Bài này trả lời câu hỏi tiếp theo: bạn sẽ **thu thập dữ liệu gì, từ ai, và bằng công cụ nào** để thật sự trả lời được câu hỏi đó. Bài đi qua bốn phần: trước hết là chọn thiết kế định lượng, định tính hay hỗn hợp theo đúng loại câu hỏi; sau đó với hướng định lượng là xác định biến và thang đo; tiếp theo là chọn mẫu và hiểu giới hạn của mẫu thuận tiện; và kết bằng cách thiết kế bảng hỏi hoặc hướng dẫn phỏng vấn không mắc hai lỗi cơ bản.

## Ba cách trả lời một câu hỏi nghiên cứu

Không phải mọi câu hỏi nghiên cứu đều trả lời bằng cùng một cách. Loại câu hỏi quyết định loại thiết kế, không phải việc bạn thấy làm khảo sát hay phỏng vấn dễ hơn.

> [!ghi-nho] **Định lượng** đo hiện tượng bằng số và kiểm định mối quan hệ giữa các biến — phù hợp với câu hỏi hỏi "ở mức nào", "khác nhau ra sao giữa các nhóm", "có liên hệ gì với nhau". **Định tính** tìm hiểu trải nghiệm, cơ chế hoặc ý nghĩa qua lời của người tham gia — phù hợp với câu hỏi hỏi "trải nghiệm ra sao", "qua cơ chế nào", "vì sao lại như vậy". **Hỗn hợp** kết hợp cả hai khi một câu hỏi cần cả đo lường và cả hiểu sâu.

| Câu hỏi nghiên cứu (dạng) | Thiết kế phù hợp |
|---|---|
| "X liên hệ thế nào với Y?", "X khác nhau ra sao giữa nhóm A và nhóm B?" | Định lượng |
| "Người tham gia trải nghiệm X ra sao?", "X xảy ra qua cơ chế nào?" | Định tính |
| Cần vừa đo mức độ, vừa hiểu vì sao mức độ đó xảy ra | Hỗn hợp |

> [!canh-bao] Chọn định lượng vì "thấy số liệu dễ chấm hơn văn bản", hoặc chọn định tính vì "ghét thống kê", đều là chọn sai lý do. Việc chọn phải xuất phát từ chính câu hỏi bạn đã đặt ra ở Bài 1.1, không phải từ điều bạn thấy thuận tiện.

> [!vi-du] Câu hỏi "Cách phân vai trò trong nhóm ảnh hưởng thế nào tới mức độ hài lòng của thành viên?" hỏi về **mối quan hệ giữa hai biến đo được** (cách phân vai trò, mức độ hài lòng) — đây là câu hỏi định lượng, trả lời bằng khảo sát. Nhưng nếu bạn muốn hiểu thêm **vì sao** một cách phân vai trò lại làm tăng hoặc giảm hài lòng — cơ chế tâm lý hay tình huống cụ thể nào tạo ra điều đó — bạn có thể bổ sung một vòng phỏng vấn ngắn với vài người có điểm hài lòng cao và thấp nhất trong khảo sát. Khi đó thiết kế trở thành hỗn hợp: định lượng đo mối quan hệ, định tính giải thích cơ chế.

## Định lượng: từ câu hỏi tới biến và thang đo

Với thiết kế định lượng, bước đầu tiên là tách câu hỏi thành các biến cụ thể.

> [!ghi-nho] **Biến độc lập** là thứ bạn cho là nguyên nhân hoặc yếu tố tác động (trong ví dụ trên: cách phân vai trò). **Biến phụ thuộc** là thứ bạn đo kết quả (mức độ hài lòng). Mỗi biến cần một **thang đo** cụ thể trước khi có thể thiết kế câu hỏi khảo sát.

| Loại thang đo | Đặc điểm | Ví dụ |
|---|---|---|
| Định danh (nominal) | Phân loại, không có thứ tự | Ngành học, giới tính, có/không tham gia hoạt động ngoại khóa |
| Thứ bậc (ordinal) | Có thứ tự, khoảng cách giữa các mức không đều nhau | Likert 5 điểm (hoàn toàn không đồng ý → hoàn toàn đồng ý) |
| Khoảng/tỉ lệ (interval/ratio) | Có thứ tự, khoảng cách đều, có thể tính trung bình cộng hợp lý | Điểm trung bình học kỳ, số giờ học mỗi tuần |

> [!vi-du] Với câu hỏi ví dụ ở trên: biến độc lập "cách phân vai trò" có thể đo bằng thang định danh (có phân vai trò rõ ràng / không có phân vai trò rõ ràng) hoặc thứ bậc (mức độ rõ ràng của phân vai trò, thang Likert 5 điểm). Biến phụ thuộc "mức độ hài lòng" đo bằng thang Likert 5 điểm trên 4-5 câu hỏi cụ thể, ví dụ: "Tôi hài lòng với cách công việc được chia trong nhóm" (hoàn toàn không đồng ý — hoàn toàn đồng ý), rồi lấy trung bình các câu để ra một điểm hài lòng chung.

## Chọn mẫu — ai sẽ trả lời, và mẫu đó nói được điều gì

Xác định xong biến và thang đo, câu hỏi tiếp theo là: khảo sát ai, và mẫu đó có nói được điều bạn muốn kết luận không.

> [!ghi-nho] **Dân số nghiên cứu** (population) là toàn bộ nhóm bạn muốn nói tới trong kết luận (ví dụ: sinh viên năm 3 khoa Kinh tế trên cả nước). **Mẫu** (sample) là nhóm nhỏ bạn thật sự thu thập dữ liệu. Kết luận chỉ đáng tin trong phạm vi mẫu đại diện được cho dân số nào — không phải phạm vi bạn muốn nói tới.

| Cách chọn mẫu | Cách làm | Đại diện tốt cho dân số rộng không |
|---|---|---|
| Ngẫu nhiên đơn giản | Mỗi người trong dân số có cơ hội được chọn bằng nhau (ví dụ: bốc số ngẫu nhiên từ danh sách toàn khoa) | Có, nếu danh sách đầy đủ và cỡ mẫu đủ lớn |
| Phân tầng | Chia dân số theo nhóm (ví dụ: theo năm học), chọn ngẫu nhiên trong mỗi nhóm theo đúng tỉ lệ | Có, và đảm bảo mọi nhóm nhỏ đều có mặt |
| Thuận tiện (convenience) | Khảo sát người dễ tiếp cận nhất — bạn cùng lớp, nhóm Facebook | Không — chỉ đại diện cho đúng nhóm đã khảo sát |

> [!canh-bao] Mẫu thuận tiện là cách phổ biến nhất ở NCKH sinh viên vì dễ làm, và **không sai khi dùng nó** — nhưng kết luận chỉ được nói trong phạm vi "sinh viên lớp/khoa đã khảo sát", không được suy rộng ra "sinh viên nói chung" hay "sinh viên Việt Nam". Ghi rõ hạn chế này trong bài thay vì im lặng bỏ qua.

> [!vi-du] Một nhóm khảo sát 500 sinh viên bằng cách đăng link trong nhóm Facebook của khoa mình — cỡ mẫu lớn, nhưng vẫn là mẫu thuận tiện: chỉ những ai đang theo dõi nhóm Facebook đó và có xu hướng trả lời khảo sát online mới xuất hiện trong mẫu. Một mẫu khác chỉ 120 người nhưng được chọn ngẫu nhiên từ danh sách sinh viên toàn khoá do phòng đào tạo cung cấp lại đại diện tốt hơn nhiều, dù cỡ mẫu nhỏ hơn. Cỡ mẫu lớn không cứu được một cách chọn mẫu thiên lệch.

## Thiết kế bảng hỏi và hướng dẫn phỏng vấn không mắc lỗi cơ bản

Có biến, thang đo và mẫu rõ ràng, bước cuối là viết đúng câu hỏi. Hai lỗi dưới đây phổ biến nhất ở bảng hỏi tự soạn.

| Lỗi | Ví dụ sai | Vì sao hỏng | Cách sửa |
|---|---|---|---|
| Câu hỏi dẫn dắt (leading) | "Bạn có đồng ý rằng phân vai trò rõ ràng luôn giúp nhóm làm việc tốt hơn không?" | Gợi sẵn câu trả lời "có", người trả lời khó nói khác | "Cách phân vai trò trong nhóm của bạn ảnh hưởng thế nào tới hiệu quả làm việc?" — trung lập, không gợi hướng trả lời |
| Câu hỏi hai-trong-một (double-barreled) | "Bạn có hài lòng với cách phân vai trò và tiến độ hoàn thành công việc của nhóm không?" | Hỏi hai điều trong một câu — người trả lời không rõ đang trả lời phần nào nếu hai câu trả lời khác nhau | Tách thành hai câu riêng: một câu về phân vai trò, một câu về tiến độ |

> [!vi-du] Bảng hỏi ban đầu có câu: "Bạn có nghĩ rằng nhóm nên phân vai trò rõ ràng và họp thường xuyên hơn không?" — vừa dẫn dắt (giả định "nên" là đúng) vừa hai-trong-một (phân vai trò và họp thường xuyên là hai việc khác nhau). Sửa lại thành hai câu trung lập: "Nhóm của bạn hiện phân vai trò rõ ràng ở mức nào?" (thang Likert 5 điểm) và "Nhóm của bạn họp với tần suất nào?" (định danh: hằng ngày / vài lần một tuần / một lần một tuần / ít hơn).

> [!meo] Trước khi phát chính thức, luôn **thử nghiệm bảng hỏi (pilot test)** với 5-10 người không tham gia vào việc soạn câu hỏi. Hỏi họ có câu nào khó hiểu, câu nào họ không chắc nên chọn đáp án nào — đây là cách rẻ nhất để bắt lỗi trước khi gửi cho hàng trăm người và không sửa được nữa.

## Luyện tập và tài liệu tham khảo

### Cá nhân (30 phút)

Với câu hỏi nghiên cứu đã chốt ở Bài 1.1: (1) xác định thiết kế phù hợp (định lượng/định tính/hỗn hợp) và giải thích vì sao dựa trên loại câu hỏi; (2) nếu định lượng, xác định biến độc lập, biến phụ thuộc và thang đo cho mỗi biến — nếu định tính, viết 3 câu hỏi phỏng vấn chính; (3) soạn **5-8 câu hỏi khảo sát hoặc câu hỏi phỏng vấn** dựa trên các biến/câu hỏi chính đó.

### Nhóm 3-4 người (25 phút)

Đổi bảng hỏi/hướng dẫn phỏng vấn cho nhau. Mỗi người tìm trong bài của bạn cùng nhóm: có câu nào dẫn dắt không, có câu nào hai-trong-một không, thang đo của mỗi câu có rõ ràng không. Ghi lại ít nhất một lỗi tìm được (nếu có) và cách sửa đề xuất.

### Bài tập về nhà (60 phút)

Hoàn thiện bảng hỏi hoặc hướng dẫn phỏng vấn thành **8-10 câu**, đã sửa theo góp ý của nhóm. Thử nghiệm (pilot test) với **3 người** không tham gia soạn câu hỏi, ghi lại phản hồi và bản chỉnh sửa cuối.

:::mau Mẫu nộp bài tập về nhà
**Câu hỏi nghiên cứu:** …

**Thiết kế đã chọn (định lượng/định tính/hỗn hợp) và lý do:** …

**Biến và thang đo (nếu định lượng) hoặc câu hỏi phỏng vấn chính (nếu định tính):** …

**Bảng hỏi/hướng dẫn phỏng vấn hoàn thiện (8-10 câu):** …

**Kết quả pilot test với 3 người**

| Người pilot | Câu họ thấy khó hiểu | Chỉnh sửa đã áp dụng |
|---|---|---|
| … | … | … |
:::

### Nguồn tham khảo

- Fowler, F. J. (2014). *Survey Research Methods* (5th ed.). SAGE Publications. — chương về thiết kế câu hỏi khảo sát.
- Creswell, J. W., & Creswell, J. D. (2018). *Research Design: Qualitative, Quantitative, and Mixed Methods Approaches* (5th ed.). SAGE Publications.
- Babbie, E. (2016). *The Practice of Social Research* (14th ed.). Cengage Learning. — chương về chọn mẫu.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.1-chon-thiet-ke",
                "type": "mcq",
                "prompt": "Câu hỏi nghiên cứu 'Sinh viên trải nghiệm áp lực thi cử ra sao trong kỳ thi cuối kỳ?' phù hợp với thiết kế nào nhất, và vì sao?",
                "explanation": "Câu hỏi hỏi về trải nghiệm, không phải mức độ hay mối quan hệ giữa các biến đo được — phù hợp với thiết kế định tính. Việc chọn thiết kế phải dựa vào loại câu hỏi, không phải cảm giác cá nhân về việc số hay lời dễ xử lý hơn.",
                "points": 2,
                "options": [
                    {"label": "Định tính, vì câu hỏi tìm hiểu trải nghiệm và ý nghĩa, không đo mức độ hay mối quan hệ giữa các biến", "isCorrect": True},
                    {"label": "Định lượng, vì cứ nghiên cứu khoa học thì nên có số liệu cho có tính khoa học", "isCorrect": False, "misconception": "nckh.qual-quant-by-preference"},
                    {"label": "Định tính, vì định tính dễ làm hơn định lượng nên chọn cho nhanh", "isCorrect": False, "misconception": "nckh.qual-quant-by-preference"},
                    {"label": "Không thiết kế nào phù hợp, cần đổi câu hỏi trước", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-bien-doc-lap-phu-thuoc",
                "type": "mcq",
                "prompt": "Với câu hỏi 'Số giờ tự học mỗi tuần liên hệ thế nào với điểm trung bình học kỳ của sinh viên?', biến nào là biến phụ thuộc?",
                "explanation": "Biến phụ thuộc là thứ được đo như kết quả — ở đây là điểm trung bình học kỳ. Số giờ tự học là biến độc lập, thứ được coi là yếu tố tác động.",
                "points": 2,
                "options": [
                    {"label": "Điểm trung bình học kỳ", "isCorrect": True},
                    {"label": "Số giờ tự học mỗi tuần", "isCorrect": False, "misconception": "nckh.iv-dv-confusion"},
                    {"label": "Cả hai đều là biến độc lập", "isCorrect": False, "misconception": "nckh.iv-dv-confusion"},
                    {"label": "Không biến nào là biến phụ thuộc trong câu hỏi này", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-mau-thuan-tien",
                "type": "mcq",
                "prompt": "Một nhóm khảo sát 500 sinh viên bằng cách đăng link trong nhóm Facebook của khoa mình, rồi kết luận 'sinh viên Việt Nam nói chung có mức hài lòng X'. Vấn đề lớn nhất ở đây là gì?",
                "explanation": "Đây là mẫu thuận tiện, chỉ đại diện cho đúng nhóm đã khảo sát (sinh viên theo dõi nhóm Facebook đó và có xu hướng trả lời khảo sát online). Kết luận suy rộng ra 'sinh viên Việt Nam nói chung' vượt quá phạm vi mẫu có thể đại diện, bất kể cỡ mẫu lớn.",
                "points": 3,
                "options": [
                    {"label": "Mẫu thuận tiện chỉ đại diện cho nhóm đã khảo sát; kết luận suy rộng ra 'sinh viên Việt Nam nói chung' vượt quá phạm vi mẫu cho phép", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì 500 là một cỡ mẫu đủ lớn để đại diện cho sinh viên Việt Nam", "isCorrect": False, "misconception": "nckh.convenience-sample-generalizes"},
                    {"label": "Vấn đề duy nhất là bảng hỏi có thể có câu hỏi dẫn dắt", "isCorrect": False},
                    {"label": "Không có vấn đề gì, vì khảo sát online luôn đại diện tốt hơn khảo sát giấy", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-co-mau-lon-hon-tot-hon",
                "type": "mcq",
                "prompt": "Mẫu A: 500 người, chọn bằng cách đăng link trong một nhóm Facebook. Mẫu B: 120 người, chọn ngẫu nhiên từ danh sách sinh viên toàn khoá do phòng đào tạo cung cấp. Mẫu nào đại diện tốt hơn cho sinh viên toàn khoá?",
                "explanation": "Cỡ mẫu lớn không cứu được một cách chọn mẫu thiên lệch. Mẫu B, dù nhỏ hơn, được chọn ngẫu nhiên từ toàn bộ dân số nên đại diện tốt hơn mẫu A — mẫu A chỉ đại diện cho nhóm đang theo dõi trang Facebook đó.",
                "points": 2,
                "options": [
                    {"label": "Mẫu B — chọn ngẫu nhiên từ toàn bộ dân số, dù cỡ mẫu nhỏ hơn, đại diện tốt hơn một mẫu thuận tiện thiên lệch", "isCorrect": True},
                    {"label": "Mẫu A — cỡ mẫu lớn hơn nên luôn đại diện tốt hơn, bất kể cách chọn", "isCorrect": False, "misconception": "nckh.sample-size-bigger-always-better"},
                    {"label": "Cả hai đại diện tốt như nhau vì đều là sinh viên", "isCorrect": False, "misconception": "nckh.sample-size-bigger-always-better"},
                    {"label": "Không thể so sánh vì thiếu thông tin về nội dung khảo sát", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-loi-cau-hoi",
                "type": "mcq",
                "prompt": "Câu khảo sát: 'Bạn có đồng ý rằng phân vai trò rõ ràng và họp nhóm thường xuyên luôn giúp nhóm làm việc tốt hơn không?' mắc lỗi gì?",
                "explanation": "Câu này vừa dẫn dắt (giả định sẵn 'luôn giúp tốt hơn' là đúng, gợi câu trả lời 'có') vừa hai-trong-một (phân vai trò và họp thường xuyên là hai việc khác nhau, gộp vào một câu hỏi).",
                "points": 3,
                "options": [
                    {"label": "Vừa là câu hỏi dẫn dắt (giả định sẵn kết luận là đúng) vừa là câu hỏi hai-trong-một (hỏi hai điều khác nhau trong một câu)", "isCorrect": True},
                    {"label": "Chỉ là câu hỏi dẫn dắt, không liên quan tới việc hỏi hai điều một lúc", "isCorrect": False, "misconception": "nckh.double-barreled-blind"},
                    {"label": "Chỉ là câu hỏi hai-trong-một, không có yếu tố dẫn dắt nào", "isCorrect": False, "misconception": "nckh.leading-question-blind"},
                    {"label": "Câu này không có lỗi gì, có thể dùng ngay trong bảng hỏi", "isCorrect": False, "misconception": "nckh.leading-question-blind"},
                ],
            },
            {
                "key": "4.1-thu-tu-thiet-ke",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước thiết kế công cụ thu thập dữ liệu định lượng, từ câu hỏi nghiên cứu tới bảng hỏi hoàn thiện.",
                "explanation": "Từ câu hỏi nghiên cứu, xác định biến độc lập/phụ thuộc, chọn thang đo cho mỗi biến, viết câu hỏi khảo sát, rồi pilot test trước khi phát chính thức.",
                "points": 3,
                "sequence": [
                    "Xác định biến độc lập và biến phụ thuộc từ câu hỏi nghiên cứu",
                    "Chọn loại thang đo phù hợp cho mỗi biến (định danh, thứ bậc, khoảng/tỉ lệ)",
                    "Viết câu hỏi khảo sát tương ứng với từng biến, tránh dẫn dắt và hai-trong-một",
                    "Thử nghiệm bảng hỏi (pilot test) với một nhóm nhỏ không tham gia soạn câu hỏi",
                    "Sửa theo phản hồi pilot test rồi mới phát chính thức cho toàn bộ mẫu",
                ],
            },
            {
                "key": "4.1-noi-thang-do",
                "type": "matching",
                "prompt": "Nối mỗi biến với đúng loại thang đo phù hợp nhất để đo nó.",
                "explanation": "Ngành học là thang định danh (chỉ phân loại, không có thứ tự). Mức độ đồng ý là thang thứ bậc (có thứ tự nhưng khoảng cách giữa các mức không đều). Điểm trung bình học kỳ là thang khoảng/tỉ lệ (có thể tính trung bình cộng hợp lý).",
                "points": 3,
                "pairs": [
                    {"left": "Ngành học của sinh viên", "right": "Thang định danh (nominal)"},
                    {"left": "Mức độ đồng ý với một phát biểu (Likert 5 điểm)", "right": "Thang thứ bậc (ordinal)"},
                    {"left": "Điểm trung bình học kỳ", "right": "Thang khoảng/tỉ lệ (interval/ratio)"},
                    {"left": "Có tham gia hoạt động ngoại khóa hay không", "right": "Thang định danh (nominal)"},
                ],
            },
            {
                "key": "4.1-soan-bang-hoi",
                "type": "essay",
                "prompt": "Từ câu hỏi nghiên cứu của bạn (Bài 1.1), viết 5 câu hỏi khảo sát hoặc câu hỏi phỏng vấn cho đúng biến/nội dung cần thu thập. Với mỗi câu, ghi rõ: (a) biến hoặc nội dung câu hỏi đó đo/khai thác; (b) loại thang đo (nếu khảo sát) hoặc loại câu hỏi dò dự kiến (nếu phỏng vấn); (c) một lý do vì sao câu hỏi này không mắc lỗi dẫn dắt hoặc hai-trong-một.",
                "points": 5,
            },
        ],
    },
}
