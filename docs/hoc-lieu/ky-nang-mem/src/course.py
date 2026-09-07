# -*- coding: utf-8 -*-
"""Phần khung của khoá Kỹ năng mềm: mô tả, danh sách lỗi tư duy, lời phản hồi.

Khoá gồm 10 module, mỗi module một kỹ năng — chín kỹ năng khớp 1-1 với Kho KNM
(282 câu MCQ, docs/Kho KNM (1).xlsx) để ngân hàng câu hỏi và đề thi dùng lại
được nguyên vẹn, cộng thêm Tư duy phản biện.

Danh sách lỗi tư duy dưới đây lớn dần theo từng module được soạn: mỗi lần nhập
thêm module, `misconception` được upsert theo `code` nên khai báo lại không sinh
bản trùng. Mã đặt tiền tố `knm.` để không đụng mã của khoá khác trong cùng DB.
"""

COURSE = {
    "title": "Kỹ năng mềm",
    "slug": "ky-nang-mem",
    "description": (
        "Khoá kỹ năng mềm dành cho sinh viên đại học và người mới đi làm. Mười module, mỗi module "
        "một kỹ năng, đi từ trong ra ngoài: bắt đầu ở nền tảng cá nhân — giá trị sống, tư duy tích "
        "cực, tư duy phản biện, quản lý thời gian — rồi mới tới các kỹ năng cần người khác mới "
        "luyện được: giao tiếp, lắng nghe, thuyết trình, thuyết phục, làm việc nhóm, và cuối cùng "
        "là viết CV cùng phỏng vấn xin việc. Thứ tự ấy có lý do: một người chưa biết mình coi trọng "
        "điều gì thì thuyết phục người khác bằng gì, và một người không quản được thời gian của "
        "mình thì không giữ được cam kết với nhóm. "
        "Khoá học không dạy mẹo ứng xử. Mỗi bài đặt một khung khái niệm có nguồn gốc rõ ràng, cho "
        "thấy khung ấy được dùng thế nào trong một tình huống học tập hoặc công sở cụ thể, rồi "
        "buộc người học tự chạy nó trên chính đời sống của mình qua ba lớp luyện tập: cá nhân, "
        "nhóm và bài tập về nhà. Mỗi bài kết bằng một bài kiểm tra ngắn, phương án sai được gắn mã "
        "lỗi tư duy để phản hồi chỉ đúng chỗ hiểu nhầm thay vì báo sai chung chung."
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Kỹ năng mềm",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Chung cả khoá ───────────────────────────────────────────────────────
    {
        "code": "knm.skill-is-innate",
        "name": "Coi kỹ năng mềm là tính cách bẩm sinh",
        "description": (
            "Tin rằng người ta sinh ra đã hoạt ngôn hoặc đã kỷ luật, nên việc luyện tập chỉ dành cho "
            "người có sẵn tố chất. Cách nghĩ này biến mọi thất bại thành bằng chứng về bản chất mình "
            "và chấm dứt việc luyện tập ngay tại đó, trong khi phần lớn kỹ năng mềm là chuỗi hành vi "
            "quan sát được và tập được."
        ),
    },
    {
        "code": "knm.knowing-equals-doing",
        "name": "Biết khung lý thuyết là đã có kỹ năng",
        "description": (
            "Đọc hiểu một mô hình rồi coi như đã sở hữu kỹ năng tương ứng. Cảm giác hiểu bài đo độ "
            "quen thuộc với khái niệm, không đo khả năng thực hiện dưới áp lực; khoảng cách giữa hai "
            "thứ chỉ đóng lại bằng luyện tập có phản hồi."
        ),
    },
    # ── Module 1 · Giá trị sống ─────────────────────────────────────────────
    {
        "code": "knm.value-as-goal",
        "name": "Lẫn giá trị với mục tiêu",
        "description": (
            "Coi giá trị sống và mục tiêu là một, nên trả lời câu hỏi về giá trị bằng những thứ đạt "
            "được rồi gạch đi: có bằng thạc sĩ, mua được nhà, lên trưởng nhóm. Mục tiêu có điểm kết "
            "thúc và có thể đo xong; giá trị là phương hướng đi suốt đời, không bao giờ tích xong ô."
        ),
    },
    {
        "code": "knm.value-as-preference",
        "name": "Lẫn giá trị với sở thích hay cảm xúc nhất thời",
        "description": (
            "Xếp những thứ mình thích — cà phê sáng, du lịch, một môn thể thao — ngang hàng với giá "
            "trị sống. Sở thích thay đổi theo tâm trạng và hoàn cảnh, không đòi hỏi trả giá; giá trị "
            "chỉ lộ ra đúng lúc phải trả giá để giữ nó."
        ),
    },
    {
        "code": "knm.espoused-values",
        "name": "Lấy giá trị tuyên bố thay cho giá trị thật",
        "description": (
            "Nhận diện giá trị của mình bằng danh sách mình muốn tin, thay vì bằng dấu vết hành vi "
            "thực tế trong lịch, trong chi tiêu và trong những lần từ chối. Argyris và Schön gọi đây "
            "là khoảng cách giữa lý thuyết tuyên bố và lý thuyết đang dùng; ai cũng có, người tự "
            "nhận thức được là người biết đo nó."
        ),
    },
    {
        "code": "knm.value-no-priority",
        "name": "Giữ mọi giá trị ngang nhau, không xếp thứ tự",
        "description": (
            "Cho rằng tất cả những gì mình coi trọng đều quan trọng như nhau nên không cần ưu tiên. "
            "Danh sách không xếp hạng chỉ hữu ích khi mọi thứ cùng đạt được; đúng lúc phải chọn — "
            "và mọi quyết định lớn đều là lúc ấy — nó không giúp được gì."
        ),
    },
    {
        "code": "knm.self-center-is-maturity",
        "name": "Coi trọng tâm bản thân là dấu hiệu trưởng thành",
        "description": (
            "Đồng nhất việc lấy bản thân làm trung tâm mọi quyết định với sự độc lập và tự tin. "
            "Trọng tâm bản thân khiến tầm nhìn co lại quanh cái được mất trước mắt của mình và làm "
            "hỏng các mối quan hệ vốn cần có đi có lại; nó khác hẳn việc tự trọng và biết giới hạn."
        ),
    },
    {
        "code": "knm.external-center",
        "name": "Đặt trọng tâm vào thứ có thể mất",
        "description": (
            "Neo sự vững vàng của mình vào công việc, tiền bạc, một người cụ thể hay sự công nhận từ "
            "đám đông. Những trọng tâm ấy đều nằm ngoài tầm kiểm soát và đều có thể mất, nên khi "
            "chúng lung lay thì cả hệ giá trị lung lay theo."
        ),
    },
    {
        "code": "knm.circle-of-concern",
        "name": "Dồn sức vào vòng tròn quan tâm",
        "description": (
            "Đổ phần lớn năng lượng vào việc bình luận, than phiền, phân tích những chuyện mình "
            "không tác động được, rồi nhầm mức độ bức xúc với mức độ trách nhiệm. Theo Covey, năng "
            "lượng đặt ở vòng tròn quan tâm làm vòng tròn ảnh hưởng co lại."
        ),
    },
    {
        "code": "knm.proactive-is-enthusiasm",
        "name": "Hiểu chủ động là xông xáo, nhiệt tình",
        "description": (
            "Đo tính chủ động bằng độ hăng hái, số việc nhận thêm hay tốc độ phản ứng. Chủ động theo "
            "nghĩa gốc là khoảng dừng giữa kích thích và phản ứng — khả năng chọn cách đáp lại thay "
            "vì bị hoàn cảnh bấm nút; một người im lặng cân nhắc vẫn có thể chủ động hơn người phản "
            "ứng tức thì."
        ),
    },
    {
        "code": "knm.mission-as-slogan",
        "name": "Viết tuyên ngôn sứ mệnh như một khẩu hiệu",
        "description": (
            "Soạn một câu nghe hay, chung chung, đúng với mọi người — sống tử tế, không ngừng vươn "
            "lên — nên không dùng để quyết định được việc gì. Tuyên ngôn có ích là tuyên ngôn nói rõ "
            "vai trò, đóng góp cụ thể và những gì mình sẵn sàng từ chối."
        ),
    },
    {
        "code": "knm.mission-write-once",
        "name": "Viết tuyên ngôn một lần rồi thôi",
        "description": (
            "Coi bản tuyên ngôn sứ mệnh cá nhân là văn bản viết xong là xong, không cần xem lại. Vai "
            "trò, năng lực và hoàn cảnh sống thay đổi theo năm; một bản không được rà soát định kỳ "
            "sẽ lặng lẽ mô tả một người không còn tồn tại."
        ),
    },
    {
        "code": "knm.conflict-binary",
        "name": "Xung đột giá trị chỉ có hai lối: chịu đựng hoặc nghỉ việc",
        "description": (
            "Khi yêu cầu của tổ chức va vào nguyên tắc cá nhân thì chỉ thấy hai lựa chọn cực đoan, "
            "bỏ qua các bước ở giữa: làm rõ sự việc, nêu quan ngại đúng kênh, thương lượng phạm vi "
            "công việc, ghi nhận bằng văn bản. Hirschman gọi lối ở giữa ấy là lên tiếng, và nó "
            "thường được thử trước khi tính tới rời đi."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "knm.skill-is-innate",
        "body": (
            "Hãy tách tính cách khỏi hành vi. Bạn không cần trở thành người hướng ngoại để hỏi lại "
            "một câu cho rõ ý, hay để viết ba dòng tóm tắt cuộc họp. Kỹ năng mềm được đo bằng những "
            "hành vi cụ thể như thế, và hành vi thì tập được."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.knowing-equals-doing",
        "body": (
            "Đọc hiểu mô hình mới là bước đầu. Hãy chọn một tình huống thật trong tuần này, chạy "
            "khung vừa học vào đó, rồi ghi lại chỗ nó vướng — chính chỗ vướng ấy là phần bạn chưa có "
            "kỹ năng, chứ không phải phần bạn chưa hiểu."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.value-as-goal",
        "body": (
            "Thử phép kiểm tra này: thứ bạn vừa nêu có thể tích ô hoàn thành được không? Nếu có, đó "
            "là mục tiêu. Giá trị là hướng đi đằng sau mục tiêu ấy — thứ vẫn còn nguyên sau khi bạn "
            "đã đạt được nó, và vẫn còn nguyên nếu bạn trượt."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.value-as-preference",
        "body": (
            "Sở thích là thứ bạn chọn khi mọi việc thuận lợi; giá trị là thứ bạn giữ khi phải trả "
            "giá. Hãy hỏi lại: giữ điều này, bạn mất gì? Không mất gì thì nhiều khả năng đó mới là "
            "một sở thích."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.espoused-values",
        "body": (
            "Đừng hỏi mình coi trọng điều gì — hãy đọc dấu vết. Ba tuần gần nhất trong lịch, trong "
            "chi tiêu và trong những lời bạn đã từ chối cho biết giá trị thật của bạn chính xác hơn "
            "bất kỳ danh sách nào bạn tự khai."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.value-no-priority",
        "body": (
            "Một danh sách không xếp hạng chỉ dùng được khi không phải chọn. Hãy ép mình so từng cặp "
            "và giữ lại tối đa năm giá trị; thứ tự ấy chính là công cụ ra quyết định khi hai điều "
            "tốt loại trừ nhau."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.self-center-is-maturity",
        "body": (
            "Tự trọng khác với lấy mình làm trung tâm. Người có trọng tâm bản thân đo mọi việc bằng "
            "được mất trước mắt của riêng mình, nên tầm nhìn ngắn lại và quan hệ mòn dần — đó là một "
            "trọng tâm mong manh, không phải dấu hiệu độc lập."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.external-center",
        "body": (
            "Hãy hỏi: trọng tâm này có thể mất không? Công việc, thu nhập, một người, sự tán thưởng "
            "— tất cả đều có thể mất, và mất tới đâu thì bạn chông chênh tới đó. Nguyên tắc thì "
            "không ai lấy đi được."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.circle-of-concern",
        "body": (
            "Hãy chia đôi tờ giấy: bên trái những gì bạn tác động được, bên phải những gì chỉ có thể "
            "lo lắng. Mỗi giờ dồn vào cột phải là một giờ không tiêu ở cột trái — và cột trái chính "
            "là phần duy nhất nở ra được khi bạn làm việc trong đó."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.proactive-is-enthusiasm",
        "body": (
            "Chủ động không đo bằng độ hăng hái mà bằng khoảng dừng: giữa việc xảy ra và việc bạn "
            "đáp lại, bạn có kịp chọn không? Nhận thêm việc trong lúc bực bội vẫn là phản ứng; im "
            "lặng ba mươi giây rồi hỏi một câu đúng chỗ mới là chủ động."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.mission-as-slogan",
        "body": (
            "Phép thử cho một tuyên ngôn: nó có giúp bạn từ chối được điều gì không? Câu nào cũng "
            "đúng với mọi người thì không hướng dẫn được ai. Hãy viết lại kèm vai trò cụ thể, đóng "
            "góp cụ thể và ít nhất một thứ bạn sẽ nói không."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.mission-write-once",
        "body": (
            "Đặt lịch xem lại tuyên ngôn mỗi sáu tháng, và xem lại ngay khi đổi vai trò lớn. Không "
            "phải vì giá trị đổi xoành xoạch, mà vì cách bạn sống theo giá trị ấy phải đổi khi hoàn "
            "cảnh đổi."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.conflict-binary",
        "body": (
            "Giữa chịu đựng và nghỉ việc còn ba bước: làm rõ yêu cầu thật sự là gì, nêu quan ngại "
            "đúng kênh và đúng người, thương lượng lại phạm vi phần việc. Hãy đi hết các bước ấy — "
            "và ghi lại — trước khi tính tới lựa chọn cuối cùng."
        ),
        "priority": 10,
    },
]
