# -*- coding: utf-8 -*-
"""Phần khung của khoá Nhập môn Nghiên cứu khoa học: mô tả, danh sách lỗi tư
duy, lời phản hồi.

Khoá gồm 1 module, 5 bài, dành cho sinh viên đại học làm NCKH sinh viên / khoá
luận lần đầu — không phải khoá phương pháp nghiên cứu học thuật sâu (đó là
khoá riêng cho học viên cao học). Đi theo đúng trình tự làm một đề tài thật:
đặt câu hỏi → đọc tài liệu → trích dẫn đúng → chọn cách trả lời câu hỏi →
viết và trình bày.

Danh sách lỗi tư duy dưới đây lớn dần theo từng module được soạn: mỗi lần nhập
thêm module, `misconception` được upsert theo `code` nên khai báo lại không
sinh bản trùng. Mã đặt tiền tố `nckh.` để không đụng mã của khoá khác trong
cùng DB (khoá Kỹ năng mềm dùng `knm.`).
"""

COURSE = {
    "title": "NCKH 101 · Nhập môn Nghiên cứu khoa học",
    "slug": "nhap-mon-nckh",
    "description": (
        "Khoá dành cho sinh viên đại học chuẩn bị hoặc đang làm đề tài NCKH sinh viên, khoá luận "
        "hoặc bài tập lớn có tính nghiên cứu — lần đầu phải tự đặt câu hỏi, tự đọc tài liệu, tự "
        "chọn cách trả lời, không còn đề bài có sẵn. Năm bài đi đúng trình tự làm một đề tài "
        "thật: đặt được một câu hỏi nghiên cứu khả thi (không phải một chủ đề rộng); đọc và tổng "
        "hợp tài liệu có hệ thống thay vì đọc rời rạc; trích dẫn đúng và giữ liêm chính học thuật; "
        "chọn một thiết kế nghiên cứu cơ bản phù hợp với câu hỏi đã đặt; và viết, trình bày được "
        "kết quả trước hội đồng. "
        "Khoá không dạy lý thuyết phương pháp luận trừu tượng. Mỗi bài đặt một khung khái niệm có "
        "nguồn gốc rõ ràng, cho thấy khung ấy áp vào một tình huống cụ thể ra sao, rồi buộc người "
        "học chạy nó trên chính đề tài họ đang định làm — dùng một đề tài xuyên suốt cả khoá, có "
        "sản phẩm dùng lại được ngay cho đề tài thật, không phải bài tập rời rạc bỏ đi. Mỗi bài "
        "kết bằng một bài kiểm tra ngắn, phương án sai được gắn mã lỗi tư duy để phản hồi chỉ đúng "
        "chỗ hiểu nhầm thay vì báo sai chung chung."
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Nghiên cứu khoa học",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Module 1 · Tư duy nghiên cứu ────────────────────────────────────────
    {
        "code": "nckh.research-is-summary",
        "name": "Coi nghiên cứu khoa học là tổng hợp lại thông tin có sẵn",
        "description": (
            "Hiểu làm NCKH là gom nhiều nguồn, viết lại cho gọn và trình bày mạch lạc — giống một "
            "bài thu hoạch. NCKH phải tạo ra một câu trả lời chưa có sẵn ở bất kỳ nguồn đơn lẻ nào, "
            "bằng một phương pháp người khác kiểm lại được; tổng hợp tài liệu chỉ là một bước "
            "chuẩn bị, không phải sản phẩm cuối."
        ),
    },
    {
        "code": "nckh.question-too-broad",
        "name": "Đặt câu hỏi nghiên cứu quá rộng, không giới hạn phạm vi",
        "description": (
            "Nêu câu hỏi kiểu 'ảnh hưởng của mạng xã hội tới sinh viên' — đúng hướng nhưng không "
            "trả lời được trong khuôn khổ một đề tài NCKH sinh viên vì thiếu đối tượng cụ thể, "
            "khung thời gian, và khía cạnh muốn đo. Câu hỏi tốt phải đủ hẹp để một người, trong "
            "vài tháng, với nguồn lực sinh viên, trả lời được."
        ),
    },
    {
        "code": "nckh.yesno-question",
        "name": "Đặt câu hỏi nghiên cứu ở dạng có/không",
        "description": (
            "Hỏi kiểu 'mạng xã hội có ảnh hưởng tới kết quả học tập không' — trả lời được bằng một "
            "chữ 'có' mà không cần phân tích gì thêm, nên không mở ra được dữ liệu. Câu hỏi mở bằng "
            "'ở mức nào', 'khác nhau ra sao giữa các nhóm', 'qua cơ chế nào' mới buộc phải đo lường "
            "và so sánh."
        ),
    },
    {
        "code": "nckh.topic-is-question",
        "name": "Nhầm đề tài (chủ đề rộng) với câu hỏi nghiên cứu",
        "description": (
            "Coi cái tên đề tài — 'động lực học tập của sinh viên năm nhất' — đã là câu hỏi nghiên "
            "cứu, trong khi đó chỉ là vùng đất để đi tìm câu hỏi. Câu hỏi nghiên cứu phải là một "
            "câu có thể trả lời bằng dữ liệu cụ thể, không phải tên một lĩnh vực quan tâm."
        ),
    },
    {
        "code": "nckh.interest-is-enough",
        "name": "Thấy đề tài thú vị là đủ, không kiểm khả thi",
        "description": (
            "Chọn câu hỏi chỉ vì thấy hay, mà không kiểm xem có tiếp cận được đối tượng khảo sát, "
            "có đủ thời gian, có đủ công cụ và có được phép làm không. Một câu hỏi hay mà không khả "
            "thi thì tốn hết một học kỳ vẫn không ra được dữ liệu để trả lời."
        ),
    },
    {
        "code": "nckh.novelty-means-new-topic",
        "name": "Hiểu 'mới' là phải chọn chủ đề chưa ai từng nghe tới",
        "description": (
            "Nghĩ rằng tính mới (novelty) đòi hỏi một chủ đề hoàn toàn chưa xuất hiện trong tài liệu "
            "nào, nên loại bỏ mọi đề tài đã có người làm. Tính mới ở cấp NCKH sinh viên thường đến "
            "từ bối cảnh mới (nhóm đối tượng, thời điểm, địa bàn khác), góc nhìn mới hoặc phương "
            "pháp mới trên một vấn đề đã được nghiên cứu, không nhất thiết phải là chủ đề chưa ai "
            "chạm tới."
        ),
    },
    # ── Module 2 · Tổng quan tài liệu ───────────────────────────────────────
    {
        "code": "nckh.read-cover-to-cover",
        "name": "Đọc bài báo tuần tự từ đầu đến cuối",
        "description": (
            "Mở một bài báo và đọc từ chữ đầu tiên, kể cả phần cơ sở lý thuyết và tổng quan của "
            "chính bài báo đó — thứ người đọc sẽ tự viết lại theo cách của mình, không cần đọc kỹ "
            "của người khác. Cách đọc này tốn rất nhiều thời gian mà không giúp quyết định nhanh "
            "bài có liên quan hay không."
        ),
    },
    {
        "code": "nckh.google-is-enough",
        "name": "Chỉ tìm tài liệu bằng Google thường",
        "description": (
            "Gõ từ khoá vào công cụ tìm kiếm phổ thông và coi kết quả trả về là đủ, bỏ qua Google "
            "Scholar, thư viện số của trường và các cơ sở dữ liệu chuyên ngành. Google thường xếp "
            "hạng theo độ phổ biến, không lọc theo việc nội dung đã qua bình duyệt học thuật hay "
            "chưa, nên dễ trộn lẫn bài báo khoa học với blog và tin tức."
        ),
    },
    {
        "code": "nckh.no-notes-system",
        "name": "Đọc xong không ghi chú có cấu trúc",
        "description": (
            "Đọc nhiều bài báo nhưng chỉ nhớ đại khái, không ghi lại theo một khung cố định. Khi "
            "ngồi viết phần tổng quan, người đọc phải mở lại gần hết số bài đã đọc vì đã quên chi "
            "tiết phương pháp và kết quả — ma trận tổng quan tồn tại chính là để tránh việc này."
        ),
    },
    {
        "code": "nckh.gap-claim-without-basis",
        "name": "Tuyên bố khoảng trống nghiên cứu không có căn cứ",
        "description": (
            "Viết 'chưa có nghiên cứu nào về vấn đề này' chỉ vì đọc lướt vài bài mà không thấy, "
            "không nói rõ đã tìm ở đâu và bao nhiêu nguồn. Khoảng trống chỉ đứng được khi có căn cứ "
            "cụ thể từ ma trận tổng quan — bao nhiêu nguồn đã đọc, và chính xác điều gì trong số đó "
            "chưa từng được làm."
        ),
    },
    {
        "code": "nckh.summary-not-synthesis",
        "name": "Viết tổng quan bằng cách liệt kê tuần tự từng tác giả",
        "description": (
            "Viết tổng quan tài liệu theo kiểu 'tác giả A nói X, tác giả B nói Y, tác giả C nói Z' — "
            "đúng thông tin nhưng không kết nối thành luận điểm nào. Tổng quan cần nhóm các nguồn "
            "theo luận điểm chung hoặc mâu thuẫn, để từ đó chỉ ra được khoảng trống, không phải chỉ "
            "chứng minh đã đọc nhiều."
        ),
    },
    # ── Module 3 · Trích dẫn và liêm chính học thuật ────────────────────────
    {
        "code": "nckh.paraphrase-is-enough",
        "name": "Đổi vài từ đồng nghĩa là đã paraphrase đúng",
        "description": (
            "Thay một vài từ trong câu gốc bằng từ đồng nghĩa, giữ nguyên cấu trúc câu, rồi coi đó "
            "là đã viết lại bằng lời của mình. Đây là paraphrase không đủ (word-switching) — vẫn "
            "tính là đạo văn dù có trích dẫn nguồn ở cuối câu, vì cách diễn đạt chưa thật sự khác "
            "với bản gốc."
        ),
    },
    {
        "code": "nckh.no-citation-if-my-words",
        "name": "Viết bằng lời của mình thì không cần trích dẫn nữa",
        "description": (
            "Tin rằng chỉ cần không sao chép nguyên văn — viết lại hoàn toàn bằng cách diễn đạt của "
            "riêng mình — là đủ, không cần trích dẫn nguồn nữa. Trích dẫn bảo vệ nguồn của ý tưởng "
            "hoặc kết luận, không chỉ của câu chữ; đạo văn ý tưởng vẫn xảy ra dù không câu nào "
            "trùng chữ với bản gốc."
        ),
    },
    {
        "code": "nckh.plagiarism-is-copy-only",
        "name": "Chỉ tính là đạo văn khi sao chép nguyên văn",
        "description": (
            "Hiểu đạo văn hẹp thành việc chép đúng câu chữ không trích dẫn, bỏ qua ba dạng khác: "
            "paraphrase không đủ, đạo văn ý tưởng, và tự đạo văn — cả ba đều bị coi là vi phạm liêm "
            "chính học thuật dù không có câu nào trùng chữ với nguồn."
        ),
    },
    {
        "code": "nckh.self-plagiarism-not-an-issue",
        "name": "Dùng lại bài của chính mình không phải đạo văn",
        "description": (
            "Nộp lại nguyên hoặc gần nguyên một bài đã nộp cho môn khác, không khai báo, vì nghĩ "
            "'đây là bài của mình, không phải chép của ai'. Người chấm bài mới kỳ vọng đây là sản "
            "phẩm mới; dùng lại không khai báo là tự đạo văn, kể cả khi tác giả gốc chính là người "
            "nộp."
        ),
    },
    {
        "code": "nckh.similarity-score-is-the-goal",
        "name": "Độ trùng lặp thấp nghĩa là bài đã liêm chính học thuật",
        "description": (
            "Coi chỉ số similarity index thấp từ công cụ chống đạo văn là bằng chứng đầy đủ rằng "
            "bài không có vấn đề gì về liêm chính học thuật. Công cụ này chỉ đo độ trùng câu chữ, "
            "không bắt được đạo văn ý tưởng hay paraphrase kỹ mà quên trích dẫn nguồn."
        ),
    },
    # ── Module 4 · Thiết kế nghiên cứu cơ bản ───────────────────────────────
    {
        "code": "nckh.qual-quant-by-preference",
        "name": "Chọn định lượng/định tính theo cái mình thấy dễ hơn",
        "description": (
            "Chọn thiết kế nghiên cứu vì thấy số liệu 'khoa học hơn' hoặc vì thấy phỏng vấn 'dễ làm "
            "hơn thống kê', thay vì chọn theo loại câu hỏi nghiên cứu. Câu hỏi hỏi về mức độ hay mối "
            "quan hệ giữa các biến cần định lượng; câu hỏi hỏi về trải nghiệm hay cơ chế cần định "
            "tính — sở thích cá nhân không phải căn cứ để chọn."
        ),
    },
    {
        "code": "nckh.iv-dv-confusion",
        "name": "Nhầm biến độc lập với biến phụ thuộc",
        "description": (
            "Xác định sai chiều tác động khi tách một câu hỏi nghiên cứu thành biến: gọi biến kết "
            "quả là biến độc lập, hoặc coi cả hai biến đều là nguyên nhân. Biến phụ thuộc là thứ "
            "được đo như kết quả; biến độc lập là thứ được coi là yếu tố tác động tới kết quả đó."
        ),
    },
    {
        "code": "nckh.convenience-sample-generalizes",
        "name": "Coi mẫu thuận tiện đại diện được cho dân số rộng hơn",
        "description": (
            "Khảo sát bạn cùng lớp hoặc một nhóm Facebook dễ tiếp cận, rồi kết luận cho cả 'sinh "
            "viên nói chung' hoặc một dân số rộng hơn nhiều so với mẫu đã khảo sát. Mẫu thuận tiện "
            "chỉ đại diện cho đúng nhóm đã khảo sát, không đại diện cho dân số rộng hơn, bất kể cỡ "
            "mẫu lớn tới đâu."
        ),
    },
    {
        "code": "nckh.sample-size-bigger-always-better",
        "name": "Mẫu lớn luôn đại diện tốt hơn mẫu nhỏ",
        "description": (
            "Tin rằng cỡ mẫu lớn tự động đồng nghĩa với đại diện tốt, bỏ qua cách chọn mẫu. Một mẫu "
            "lớn nhưng chọn theo cách thiên lệch (ví dụ chỉ từ một nhóm Facebook) vẫn không đại diện "
            "tốt hơn một mẫu nhỏ được chọn ngẫu nhiên đúng cách từ toàn bộ dân số."
        ),
    },
    {
        "code": "nckh.leading-question-blind",
        "name": "Không nhận ra câu hỏi khảo sát mang tính dẫn dắt",
        "description": (
            "Viết câu hỏi đã gợi sẵn câu trả lời mong muốn (ví dụ 'Bạn có đồng ý rằng X luôn tốt "
            "không?'), khiến người trả lời khó nói khác với hướng câu hỏi gợi ý. Câu hỏi khảo sát "
            "cần trung lập, không giả định sẵn kết luận nào là đúng."
        ),
    },
    {
        "code": "nckh.double-barreled-blind",
        "name": "Không nhận ra câu hỏi hỏi hai điều trong một câu",
        "description": (
            "Gộp hai nội dung khác nhau vào một câu hỏi (ví dụ hỏi cùng lúc về phân vai trò và về "
            "tần suất họp), khiến người trả lời không biết đang trả lời phần nào khi hai câu trả lời "
            "khác nhau. Mỗi câu hỏi khảo sát chỉ nên hỏi đúng một nội dung."
        ),
    },
    # ── Module 5 · Viết và trình bày ─────────────────────────────────────────
    {
        "code": "nckh.abstract-written-first",
        "name": "Viết Tóm tắt trước khi có kết quả",
        "description": (
            "Viết phần Tóm tắt (Abstract) ngay sau khi chốt câu hỏi nghiên cứu, khi chưa có kết quả "
            "thật. Tóm tắt phải tóm lại những gì báo cáo đã có — câu hỏi, phương pháp, kết quả, ý "
            "nghĩa — nên chỉ viết được sau cùng, khi các phần khác đã hoàn thành."
        ),
    },
    {
        "code": "nckh.absolute-claims",
        "name": "Dùng ngôn ngữ tuyệt đối thay vì đúng mức độ chắc chắn",
        "description": (
            "Viết kết luận bằng từ ngữ tuyệt đối như 'chứng minh', 'chắc chắn', 'luôn luôn' cho một "
            "nghiên cứu trên mẫu thuận tiện, cỡ mẫu trung bình. Kết luận cần dùng ngôn ngữ hedged "
            "('kết quả cho thấy', 'có thể do', 'dữ liệu gợi ý') đúng với mức độ bằng chứng thật có."
        ),
    },
    {
        "code": "nckh.claim-beyond-data",
        "name": "Kết luận vượt quá phạm vi dữ liệu đã thu thập",
        "description": (
            "Suy rộng kết luận từ một mẫu thuận tiện (một lớp, một khoa, một trường) ra một dân số "
            "rộng hơn nhiều như 'sinh viên Việt Nam' hay 'sinh viên nói chung'. Kết luận chỉ nên nói "
            "trong đúng phạm vi mẫu đã khảo sát, như đã học ở Bài 4.1 về giới hạn của mẫu thuận tiện."
        ),
    },
    {
        "code": "nckh.slide-is-report",
        "name": "Nhồi nguyên văn báo cáo vào slide",
        "description": (
            "Đưa cả đoạn văn dài từ báo cáo lên slide thuyết trình, rồi đứng đọc lại. Khán giả đọc "
            "nhanh hơn người nói nên đọc xong slide trước khi người nói xong câu, sau đó ngừng nghe. "
            "Slide chỉ nên có từ khóa, số liệu chính hoặc một hình/bảng; phần diễn giải nằm ở lời nói."
        ),
    },
    {
        "code": "nckh.must-answer-everything",
        "name": "Bịa câu trả lời khi bị hội đồng hỏi điều không biết",
        "description": (
            "Đưa ra một câu trả lời nghe hợp lý dù không chắc đúng, vì sợ bị coi là thiếu chuẩn bị "
            "khi không trả lời được. Hội đồng có chuyên môn thường nhận ra ngay khi câu trả lời sai; "
            "nói thẳng chưa nắm rõ và cam kết tìm hiểu thêm giữ được uy tín tốt hơn."
        ),
    },
    {
        "code": "nckh.defensive-to-criticism",
        "name": "Phản ứng phòng thủ khi hội đồng góp ý hoặc hỏi khó",
        "description": (
            "Giải thích dài dòng, đổ lỗi cho hoàn cảnh, hoặc cãi lại ngay khi bị chỉ ra một điểm yếu "
            "trong nghiên cứu. Góp ý là để bài tốt hơn, không phải một cuộc tấn công cá nhân; cách "
            "phản hồi tốt hơn là ghi nhận điểm đó rồi nói cách đã hoặc sẽ xử lý nó."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "nckh.research-is-summary",
        "body": (
            "Tự hỏi: nếu ai đó đọc hết mọi nguồn bạn đang đọc, họ đã có câu trả lời chưa, hay vẫn "
            "còn thiếu một mảnh mà chỉ có dữ liệu của riêng bạn mới lấp được? Nếu câu trả lời đã "
            "nằm sẵn trong tài liệu, đó là việc tổng hợp; NCKH bắt đầu từ chỗ tài liệu dừng lại."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.question-too-broad",
        "body": (
            "Thêm vào câu hỏi của bạn: đối tượng cụ thể là ai, ở đâu, trong khung thời gian nào, và "
            "khía cạnh nào bạn đo. Một câu hỏi trả lời được trong một đề tài NCKH sinh viên thường "
            "đọc lên nghe 'hẹp' hơn bạn tưởng."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.yesno-question",
        "body": (
            "Đổi câu hỏi có/không thành câu hỏi mở: thay 'có ảnh hưởng không' bằng 'ảnh hưởng ở mức "
            "nào', 'khác nhau ra sao giữa nhóm A và nhóm B', hoặc 'qua cơ chế nào'. Câu hỏi mở mới "
            "cho biết bạn sẽ đo cái gì."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.topic-is-question",
        "body": (
            "Đề tài là vùng đất, câu hỏi nghiên cứu là một điểm cụ thể trên vùng đất đó. Thử viết "
            "lại điều bạn quan tâm dưới dạng một câu có dấu hỏi chấm, có thể trả lời bằng số liệu "
            "hoặc bằng chứng cứ thu thập được — nếu chưa viết được câu như vậy, bạn vẫn đang ở đề "
            "tài, chưa tới câu hỏi."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.interest-is-enough",
        "body": (
            "Trước khi đi tiếp, tự trả lời bốn câu của khung khả thi: bạn tiếp cận được đúng đối "
            "tượng cần khảo sát chứ? Có đủ thời gian trong một học kỳ? Có công cụ hoặc kỹ năng cần "
            "thiết? Có được phép thu thập dữ liệu đó không? Thiếu một câu trả lời 'có' là dấu hiệu "
            "cần thu hẹp thêm hoặc đổi hướng."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.novelty-means-new-topic",
        "body": (
            "Tính mới không đòi hỏi chủ đề chưa ai nghe tới. Hãy tìm cách làm nó mới theo một trong "
            "ba hướng: đối tượng hoặc bối cảnh khác với các nghiên cứu đã có, góc nhìn khác, hoặc "
            "phương pháp khác để trả lời cùng một câu hỏi."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.read-cover-to-cover",
        "body": (
            "Thử đọc theo thứ tự tóm tắt → kết luận/thảo luận → hình và bảng số liệu trước, chỉ đọc "
            "kỹ phần phương pháp nếu bài vẫn còn liên quan sau ba bước đó. Cách này lọc nhanh hơn "
            "nhiều mà không bỏ sót thông tin quan trọng."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.google-is-enough",
        "body": (
            "Chuyển sang Google Scholar và thư viện số của trường cho vòng tìm kiếm chính — chúng "
            "lọc theo bình duyệt học thuật và cho truy cập toàn văn, thứ Google thường không làm "
            "được. Dùng Google thường chỉ để tìm ngữ cảnh nhanh, không phải để tìm nguồn trích dẫn."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.no-notes-system",
        "body": (
            "Lập một ma trận tổng quan — mỗi dòng một nguồn, mỗi cột một tiêu chí cố định — và điền "
            "ngay sau khi đọc xong từng bài, không dồn lại. Đây là cách duy nhất tránh phải đọc lại "
            "toàn bộ nguồn khi ngồi viết."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.gap-claim-without-basis",
        "body": (
            "Trước khi viết 'chưa ai nghiên cứu điều này', hãy tự hỏi: mình đã tìm ở nguồn nào, và "
            "trong bao nhiêu bài đã đọc? Viết rõ số liệu đó ra ('trong 8 bài đã đọc về X, không bài "
            "nào làm ở Y') để khoảng trống có căn cứ kiểm được, không phải một cảm giác."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.summary-not-synthesis",
        "body": (
            "Thử nhóm lại các dòng trong ma trận theo luận điểm chung hoặc mâu thuẫn, rồi viết một "
            "câu cho mỗi nhóm, trích dẫn tất cả nguồn thuộc nhóm đó trong cùng câu. Nếu đoạn văn của "
            "bạn đọc lên nghe như danh sách 'tác giả này nói, tác giả kia nói', đó vẫn là liệt kê."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.paraphrase-is-enough",
        "body": (
            "Thử kỹ thuật 4 bước: đọc đoạn gốc, che lại, viết lại từ trí nhớ, rồi so sánh với bản "
            "gốc. Nếu câu của bạn vẫn đi theo đúng thứ tự từ và cấu trúc câu gốc, đó là dấu hiệu cần "
            "viết lại lần nữa — dù đã trích dẫn."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.no-citation-if-my-words",
        "body": (
            "Tự hỏi: kết luận hoặc ý tưởng trong câu này đến từ đâu — từ chính dữ liệu bạn thu thập, "
            "hay từ một nguồn bạn đã đọc? Nếu là từ một nguồn, vẫn cần trích dẫn dù câu chữ đã hoàn "
            "toàn khác với bản gốc. Trích dẫn bảo vệ nguồn của ý tưởng, không chỉ của câu chữ."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.plagiarism-is-copy-only",
        "body": (
            "Đạo văn còn ba dạng khác ngoài sao chép nguyên văn: paraphrase không đủ, đạo văn ý "
            "tưởng, và tự đạo văn. Xem lại bảng bốn dạng đạo văn ở bài học và tự kiểm đoạn văn của "
            "bạn với cả bốn dạng, không chỉ dạng đầu tiên."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.self-plagiarism-not-an-issue",
        "body": (
            "Dùng lại nội dung bạn đã viết cho một bài khác vẫn cần khai báo rõ, hoặc viết lại hoàn "
            "toàn cho bài mới. Người chấm bài kỳ vọng đây là sản phẩm mới; im lặng dùng lại đánh lừa "
            "kỳ vọng đó, kể cả khi tác giả gốc chính là bạn."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.similarity-score-is-the-goal",
        "body": (
            "Độ trùng lặp thấp chỉ cho biết không có đoạn nào trùng câu chữ với cơ sở dữ liệu của "
            "công cụ — nó không kiểm được đạo văn ý tưởng hay paraphrase kỹ mà quên trích dẫn. Kiểm "
            "lại từng claim quan trọng bằng tay: claim này có nguồn không, nguồn đó đã được trích "
            "dẫn chưa."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.qual-quant-by-preference",
        "body": (
            "Quay lại câu hỏi nghiên cứu của bạn và hỏi: câu hỏi này đang hỏi về mức độ/mối quan hệ "
            "giữa các biến (định lượng), hay về trải nghiệm/cơ chế (định tính)? Chọn thiết kế theo "
            "câu trả lời đó, không theo việc bạn thấy số hay lời dễ xử lý hơn."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.iv-dv-confusion",
        "body": (
            "Biến phụ thuộc luôn là thứ bạn đo như một KẾT QUẢ; biến độc lập là thứ bạn coi là yếu "
            "tố TÁC ĐỘNG tới kết quả đó. Thử hỏi: 'Nếu biến này thay đổi, biến kia có khả năng thay "
            "đổi theo không, hay ngược lại?' — chiều trả lời cho biết đâu là biến nào."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.convenience-sample-generalizes",
        "body": (
            "Mẫu thuận tiện (bạn cùng lớp, một nhóm Facebook) chỉ nói được về đúng nhóm đã khảo sát. "
            "Viết kết luận trong phạm vi đó, và ghi rõ hạn chế này trong bài, thay vì suy rộng ra "
            "'sinh viên nói chung' hay một dân số bạn chưa thật sự tiếp cận được."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.sample-size-bigger-always-better",
        "body": (
            "Cỡ mẫu lớn không cứu được một cách chọn mẫu thiên lệch. Trước khi tin vào cỡ mẫu, hỏi: "
            "mẫu này được chọn từ đâu, và mọi người trong dân số mục tiêu có cơ hội xuất hiện trong "
            "mẫu như nhau không?"
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.leading-question-blind",
        "body": (
            "Đọc lại câu hỏi và tự hỏi: câu này có đang gợi sẵn một câu trả lời được coi là 'đúng' "
            "hay 'nên' không? Nếu có, viết lại thành câu trung lập, không giả định trước kết luận "
            "nào."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.double-barreled-blind",
        "body": (
            "Đọc lại câu hỏi và đếm xem nó đang hỏi bao nhiêu nội dung khác nhau. Nếu người trả lời "
            "có thể đồng ý với phần này mà không đồng ý với phần kia, tách câu đó thành hai câu "
            "riêng."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.abstract-written-first",
        "body": (
            "Để phần Tóm tắt lại sau cùng. Viết trước các phần Đặt vấn đề, Tổng quan, Phương pháp, "
            "Kết quả, Thảo luận — rồi tóm lại đúng những gì các phần đó đã có, không phải những gì "
            "bạn dự định làm."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.absolute-claims",
        "body": (
            "Đọc lại câu kết luận và tự hỏi: mức độ chắc chắn trong câu này có khớp với cỡ mẫu và "
            "cách chọn mẫu thật của bạn không? Đổi 'chứng minh', 'chắc chắn', 'luôn luôn' thành "
            "'kết quả cho thấy', 'có thể do', 'dữ liệu gợi ý rằng'."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.claim-beyond-data",
        "body": (
            "Kết luận chỉ nên nói trong đúng phạm vi mẫu đã khảo sát ở Bài 4.1. Nếu mẫu là một lớp "
            "hoặc một khoa, viết 'kết quả này cho thấy xu hướng ở [đúng nhóm đã khảo sát]', không "
            "suy rộng ra một dân số bạn chưa thật sự tiếp cận."
        ),
        "priority": 10,
    },
    {
        "misconception": "nckh.slide-is-report",
        "body": (
            "Rút slide xuống còn từ khóa, số liệu chính hoặc một hình/bảng duy nhất. Nếu một slide "
            "có một đoạn văn dài, chuyển phần đó sang lời nói khi thuyết trình, không để nguyên trên "
            "màn hình."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.must-answer-everything",
        "body": (
            "Khi không nắm rõ một câu hỏi, nói thẳng 'em chưa nắm rõ phần đó, em sẽ tìm hiểu thêm' "
            "thay vì bịa câu trả lời. Hội đồng có chuyên môn nhận ra ngay khi câu trả lời sai, và "
            "điều đó tổn hại uy tín nhiều hơn việc thẳng thắn."
        ),
        "priority": 9,
    },
    {
        "misconception": "nckh.defensive-to-criticism",
        "body": (
            "Khi bị chỉ ra một điểm yếu, ghi nhận nó trước ('Đúng là đây là một hạn chế'), rồi nói "
            "cách bạn đã hoặc sẽ xử lý. Góp ý là để bài tốt hơn, không phải một cuộc tấn công cá "
            "nhân cần phòng thủ lại."
        ),
        "priority": 9,
    },
]
