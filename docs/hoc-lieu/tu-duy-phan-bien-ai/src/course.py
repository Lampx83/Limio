# -*- coding: utf-8 -*-
"""Phần khung của khoá "Tư duy phản biện thời AI": mô tả, lỗi tư duy, lời phản hồi.

Khoá mẫu cho học viên (thẻ "Thử học ngay" trên trang Bắt đầu). Viết cho mọi học viên, không cần nền chuyên
môn; điểm chung duy nhất được giả định là ai cũng đã hoặc sắp dùng công cụ AI trò chuyện.

Mã lỗi tư duy đặt tiền tố `aipb.` để không đụng mã của khoá khác trong cùng DB; nhập lại thì upsert theo
`code`, không sinh bản trùng.
"""

COURSE = {
    "title": "Tư duy phản biện thời AI",
    "slug": "tu-duy-phan-bien-thoi-ai",
    "description": (
        "AI trả lời mọi câu hỏi trong vài giây, viết trôi chảy và rất tự tin, kể cả khi câu trả lời sai. Khoá học ngắn này "
        "giúp bạn dùng AI và đọc thông tin trên mạng mà không bị dắt mũi: kiểm một câu trả lời trước khi dùng, "
        "tách một lập luận ra để thấy chỗ yếu, kiểm một bức ảnh hay tin lan truyền trong vài phút, đặt câu hỏi "
        "cho AI để nhận về thứ kiểm chứng được, nhận ra thiên kiến của AI và của chính mình, và dùng AI để học "
        "nhanh hơn mà không giao luôn phần suy nghĩ cho nó. "
        "Sáu bài, mỗi bài khoảng hai mươi phút, mỗi bài kết bằng một việc làm ngay trên công cụ AI bạn đang dùng "
        "và một bài kiểm tra ngắn có phản hồi chỉ đúng chỗ bạn hiểu nhầm."
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Kỹ năng mềm",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Bài 1 · Trôi chảy không có nghĩa là đúng ────────────────────────────
    {
        "code": "aipb.fluency-as-accuracy",
        "name": "Coi câu trả lời trôi chảy, tự tin là câu trả lời đúng",
        "description": (
            "Tin một câu trả lời vì nó viết mạch lạc, dùng từ chuyên môn và không ngập ngừng. Với công cụ AI, độ "
            "trôi chảy là thứ chúng làm tốt nhất và gần như không đổi dù nội dung đúng hay sai, nên nó không cho "
            "biết gì về độ chính xác."
        ),
    },
    {
        "code": "aipb.ai-looks-up-facts",
        "name": "Nghĩ rằng AI tra cứu sự thật như một cơ sở dữ liệu",
        "description": (
            "Hình dung công cụ AI trò chuyện giống một thư viện hay công cụ tìm kiếm: hỏi gì thì nó lấy dữ kiện "
            "đã lưu ra. Thực tế mô hình ngôn ngữ sinh câu chữ dựa trên các mẫu đã học, nên nó có thể tạo ra một "
            "dữ kiện, một tên sách hay một vụ án chưa từng tồn tại mà vẫn nghe rất thật."
        ),
    },
    {
        "code": "aipb.citation-as-proof",
        "name": "Thấy có nguồn kèm theo là đủ tin",
        "description": (
            "Coi việc câu trả lời có trích dẫn, đường link hay tên tác giả là bằng chứng nó đúng, mà không mở "
            "nguồn ra xem. AI có thể bịa cả nguồn, hoặc dẫn một nguồn có thật nhưng nguồn ấy không nói điều được "
            "gán cho nó."
        ),
    },
    {
        "code": "aipb.ask-ai-to-check-itself",
        "name": "Hỏi lại chính AI để kiểm câu trả lời của nó",
        "description": (
            "Hỏi \"bạn có chắc không?\" rồi coi câu trả lời là xác nhận. Công cụ AI có thể khẳng định lại điều sai "
            "một cách tự tin, hoặc đổi ý chỉ vì bị hỏi vặn; cả hai đều không phải là kiểm chứng. Kiểm chứng cần "
            "một nguồn nằm ngoài cuộc trò chuyện."
        ),
    },
    {
        "code": "aipb.ai-knows-latest",
        "name": "Nghĩ rằng AI luôn biết chuyện mới nhất",
        "description": (
            "Tin rằng AI cập nhật theo thời gian thực. Mỗi mô hình học từ dữ liệu tới một mốc thời gian; chuyện "
            "xảy ra sau mốc ấy nó không biết, trừ khi công cụ được nối với chức năng tìm kiếm; ngay cả khi đó, nó vẫn "
            "có thể tóm tắt sai điều đã đọc."
        ),
    },
    {
        "code": "aipb.distrust-everything",
        "name": "Vì AI có thể sai nên bỏ hẳn, hoặc nghi ngờ mọi thứ như nhau",
        "description": (
            "Đi từ \"AI có thể bịa\" tới \"không dùng AI\" hoặc \"không tin gì cả\". Phản biện không phải là nghi ngờ "
            "mọi thứ ở cùng một mức: phần lớn câu trả lời dùng được làm bản nháp, việc của người dùng là biết "
            "chỗ nào phải kiểm và kiểm bằng cách nào."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "aipb.fluency-as-accuracy",
        "body": (
            "Bạn đang dựa vào cách câu trả lời được viết, không phải vào bằng chứng. Hãy thử viết lại câu trả lời "
            "ấy bằng giọng ngập ngừng, bỏ hết từ chuyên môn. Nếu khi đó bạn bớt tin, thì điều thuyết phục bạn là "
            "giọng văn. Với AI, giọng văn luôn tự tin như nhau, dù đúng hay sai."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.ai-looks-up-facts",
        "body": (
            "Công cụ AI trò chuyện không lấy dữ kiện ra từ một kho lưu sẵn; nó sinh từng chữ tiếp theo sao cho "
            "nghe hợp lý. Vì vậy nó có thể tạo ra một con số hay một tên sách chưa từng tồn tại. Hãy coi câu "
            "trả lời là bản nháp cần kiểm, nhất là khi có số liệu, trích dẫn hoặc chuyện mới xảy ra."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.citation-as-proof",
        "body": (
            "Một trích dẫn chỉ có giá trị khi bạn mở nó ra và thấy đúng câu được gán cho nó. AI có thể bịa cả "
            "nguồn lẫn đường link, hoặc dẫn đúng một bài báo có thật nhưng bài ấy không nói điều đó. Bước bạn "
            "bỏ qua chính là bước quan trọng nhất: tự mở nguồn."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.ask-ai-to-check-itself",
        "body": (
            "Hỏi lại AI chỉ cho bạn thêm một câu trả lời từ cùng một nguồn. Nó có thể khẳng định lại điều sai, "
            "hoặc đổi ý vì bạn hỏi vặn, và cả hai trường hợp đều không chứng minh được gì. Kiểm chứng phải đi qua một nguồn nằm "
            "ngoài cuộc trò chuyện: trang chính thức, văn bản gốc, một nguồn uy tín khác."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.ai-knows-latest",
        "body": (
            "Mỗi mô hình AI học tới một mốc thời gian, nên với chuyện vừa xảy ra nó có thể không biết, hoặc đoán. "
            "Gặp câu hỏi về tin tức, giá cả, quy định mới hay kết quả gần đây, hãy tìm trang chính thức hoặc "
            "nguồn tin có ghi ngày tháng."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.distrust-everything",
        "body": (
            "Phản biện không có nghĩa là bỏ AI hay nghi ngờ mọi thứ như nhau. Câu trả lời của AI rất hữu ích làm "
            "bản nháp, dàn ý, lời giải thích ban đầu. Việc của bạn là nhận ra phần nào cần kiểm chứng, gồm số "
            "liệu, trích dẫn và sự việc mới xảy ra, rồi kiểm chứng phần đó bằng nguồn bên ngoài."
        ),
        "priority": 10,
    },
]
