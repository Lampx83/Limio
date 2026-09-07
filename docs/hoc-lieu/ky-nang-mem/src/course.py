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
    # ── Module 2 · Tư duy tích cực ──────────────────────────────────────────
    {
        "code": "knm.toxic-positivity",
        "name": "Tích cực nghĩa là không được buồn",
        "description": (
            "Hiểu tư duy tích cực thành nghĩa vụ phải vui vẻ, nên dập mọi cảm xúc khó chịu của mình "
            "và của người khác bằng những câu an ủi rỗng. Cảm xúc bị chặn không biến mất mà chỉ mất "
            "kênh xử lý; và người đang gặp chuyện thật sẽ thấy mình không được phép nói ra."
        ),
    },
    {
        "code": "knm.positive-thinking-magic",
        "name": "Chỉ cần nghĩ tích cực là chuyện sẽ tốt lên",
        "description": (
            "Coi suy nghĩ tích cực như một loại lực tác động thẳng vào thực tại, nên bỏ qua khâu hành "
            "động cụ thể. Tư duy tích cực có ích vì nó giữ cho người ta còn thử tiếp và còn nhìn thấy "
            "phương án, chứ không phải vì nó tự sinh ra kết quả."
        ),
    },
    {
        "code": "knm.emotion-from-event",
        "name": "Sự kiện gây ra cảm xúc, không có gì ở giữa",
        "description": (
            "Tin rằng chuyện xảy ra quyết định thẳng cảm xúc, nên không có chỗ nào để can thiệp. Mô "
            "hình ABC chỉ ra khâu ở giữa: cách ta diễn giải sự việc. Cùng một điểm số, hai cách diễn "
            "giải khác nhau cho hai trạng thái cảm xúc khác nhau."
        ),
    },
    {
        "code": "knm.self-label",
        "name": "Dán nhãn cố định cho bản thân",
        "description": (
            "Chuyển một kết quả cụ thể thành một phán quyết về con người mình: trượt một bài thành "
            "mình kém cỏi. Nhãn ấy vừa không mô tả được điều gì sửa được, vừa chiếm chỗ trong trí nhớ "
            "làm việc đáng lẽ dành cho việc đang làm."
        ),
    },
    {
        "code": "knm.catastrophizing",
        "name": "Thổi phồng hậu quả",
        "description": (
            "Kéo một sự việc trước mắt thành chuỗi hậu quả tồi tệ dài hạn mà không có bước trung gian "
            "nào được kiểm chứng: trượt một môn thành mất bằng, mất việc, hỏng cả đời. Đây là lỗi về "
            "phạm vi và độ bền, hai trong ba trục giải thích của Seligman."
        ),
    },
    {
        "code": "knm.criticism-as-attack",
        "name": "Coi mọi góp ý là công kích cá nhân",
        "description": (
            "Nghe nhận xét về sản phẩm thành nhận xét về giá trị con người mình, nên phản ứng bằng "
            "phòng thủ và mất luôn phần thông tin dùng được. Tách câu hỏi ai nói ra khỏi câu hỏi điều "
            "được nói có đúng phần nào không là kỹ năng học được."
        ),
    },
    {
        "code": "knm.fixed-mindset",
        "name": "Năng lực là thứ cố định",
        "description": (
            "Tin rằng thông minh và năng khiếu là lượng trời cho, nên nỗ lực bị coi là bằng chứng của "
            "sự kém cỏi và thất bại bị coi là phán quyết cuối cùng. Cách tin này khiến người ta né "
            "nhiệm vụ khó — đúng loại nhiệm vụ tạo ra tiến bộ."
        ),
    },
    {
        "code": "knm.compare-upward",
        "name": "Lấy người khác làm thước đo tiến bộ của mình",
        "description": (
            "Đo mình bằng thành tích của người xung quanh hoặc bản dựng của họ trên mạng xã hội, thay "
            "vì bằng chính mình của ba tháng trước. Thước đo ấy đổi liên tục theo người mình gặp và "
            "không nói được bước tiếp theo cần làm gì."
        ),
    },
    {
        "code": "knm.self-compassion-is-weak",
        "name": "Tự trắc ẩn là nuông chiều bản thân",
        "description": (
            "Sợ rằng đối xử tử tế với chính mình sẽ làm mất động lực, nên chọn tự đay nghiến như một "
            "cách thúc ép. Nghiên cứu của Neff cho thấy ngược lại: người tự trắc ẩn nhận lỗi dễ hơn và "
            "quay lại làm tiếp nhanh hơn, vì họ không phải tốn sức bảo vệ hình ảnh bản thân."
        ),
    },
    {
        "code": "knm.mental-health-willpower",
        "name": "Trầm cảm và lo âu là chuyện của ý chí",
        "description": (
            "Coi các rối loạn tâm lý là trạng thái tinh thần yếu, chỉ cần nghĩ tích cực hơn là hết. "
            "Đây là chỗ tư duy tích cực bị dùng sai nguy hiểm nhất: nó làm chậm việc tìm trợ giúp "
            "chuyên môn, trong khi các dấu hiệu kéo dài trên hai tuần cần được đánh giá bởi người có "
            "chuyên môn."
        ),
    },
    # ── Module 3 · Tư duy phản biện ─────────────────────────────────────────
    {
        "code": "knm.critical-is-negative",
        "name": "Phản biện là bắt bẻ",
        "description": (
            "Hiểu tư duy phản biện thành thái độ hoài nghi mọi thứ và tìm lỗi của người khác. Phản "
            "biện là quy trình kiểm tra chất lượng của một lập luận — kể cả lập luận của chính mình — "
            "và nó kết thúc bằng một kết luận có cơ sở, không phải bằng việc hạ bệ ai."
        ),
    },
    {
        "code": "knm.opinion-as-evidence",
        "name": "Lấy ý kiến hoặc cảm nhận làm bằng chứng",
        "description": (
            "Đưa niềm tin cá nhân, cảm giác hoặc mức độ chắc chắn của mình vào chỗ đáng lẽ phải là dữ "
            "liệu quan sát được. Mức độ tự tin không phải thước đo mức độ đúng; một khẳng định chỉ "
            "đứng được khi có bằng chứng người khác kiểm lại được."
        ),
    },
    {
        "code": "knm.confirmation-bias",
        "name": "Chỉ tìm thứ ủng hộ điều mình đã tin",
        "description": (
            "Tìm, nhớ và tin những thông tin khớp với kết luận sẵn có, đồng thời đòi hỏi tiêu chuẩn "
            "khắt khe hơn hẳn với thông tin trái chiều. Kết quả là càng đọc nhiều càng chắc chắn hơn "
            "mà không hề chính xác hơn."
        ),
    },
    {
        "code": "knm.correlation-causation",
        "name": "Thấy đi cùng nhau là kết luận cái này gây ra cái kia",
        "description": (
            "Suy ra quan hệ nhân quả từ việc hai hiện tượng cùng tăng hoặc cùng giảm, bỏ qua ba khả "
            "năng khác: chiều ngược lại, một yếu tố thứ ba tác động lên cả hai, hoặc trùng hợp ngẫu "
            "nhiên."
        ),
    },
    {
        "code": "knm.authority-or-crowd",
        "name": "Đúng vì người nổi tiếng nói hoặc vì nhiều người tin",
        "description": (
            "Thay việc xem bằng chứng bằng việc xem ai nói và bao nhiêu người đồng ý. Uy tín của "
            "người nói chỉ là lý do để nghe kỹ hơn, không phải lý do để tin; số lượt chia sẻ đo mức "
            "lan truyền chứ không đo mức đúng."
        ),
    },
    {
        "code": "knm.anecdote-as-proof",
        "name": "Lấy một trường hợp làm bằng chứng chung",
        "description": (
            "Khái quát từ một câu chuyện sinh động — người quen, bản thân, một bài đăng — thành quy "
            "luật cho số đông. Trường hợp cá biệt nêu ra được giả thuyết, nhưng không nói được nó "
            "đúng với bao nhiêu phần trăm và trong điều kiện nào."
        ),
    },
    {
        "code": "knm.straw-man",
        "name": "Bẻ lại phiên bản méo của lập luận đối phương",
        "description": (
            "Đơn giản hoá hoặc phóng đại ý người khác thành một phiên bản dễ đánh đổ rồi công kích "
            "phiên bản ấy. Thắng được bản méo không nói lên điều gì về bản gốc, và người đối thoại thì "
            "mất lý do tiếp tục nói chuyện."
        ),
    },
    {
        "code": "knm.false-dilemma",
        "name": "Chỉ thấy hai lựa chọn",
        "description": (
            "Trình bày một vấn đề như thể chỉ có hai đường đi loại trừ nhau, trong khi còn các phương "
            "án trung gian hoặc phương án thứ ba chưa được nêu. Cách đóng khung này ép người nghe "
            "chọn nhanh và chọn hẹp."
        ),
    },
    {
        "code": "knm.vertical-reading",
        "name": "Đánh giá một nguồn bằng cách đọc kỹ chính nguồn đó",
        "description": (
            "Tin hay không tin một trang dựa vào giao diện, giọng văn và phần giới thiệu của chính "
            "trang ấy. Nghiên cứu về đọc ngang cho thấy người kiểm chứng chuyên nghiệp làm ngược lại: "
            "rời trang ra, xem nơi khác nói gì về nó, rồi mới quay lại."
        ),
    },
    {
        "code": "knm.ai-fluency-truth",
        "name": "Văn trôi chảy của AI nghĩa là thông tin đúng",
        "description": (
            "Lấy độ mạch lạc, sự tự tin và cách trình bày có trích dẫn của một câu trả lời do AI sinh "
            "làm dấu hiệu chính xác. Mô hình ngôn ngữ tối ưu cho tính hợp lý bề mặt, nên nó bịa được "
            "cả tên tác giả, năm và số trang trong khi vẫn đọc rất xuôi."
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
    # ── Module 2 ────────────────────────────────────────────────────────────
    {"misconception": "knm.toxic-positivity", "body": "Tích cực không phải là cấm buồn. Hãy gọi đúng tên cảm xúc trước — thất vọng, lo, tức — rồi mới hỏi bước tiếp theo làm gì. Bỏ qua bước gọi tên thì cảm xúc không mất đi, nó chỉ chuyển sang chỗ khác và thường đắt hơn.", "priority": 10},
    {"misconception": "knm.positive-thinking-magic", "body": "Suy nghĩ tích cực không tự làm ra kết quả; nó giữ cho bạn còn thử tiếp và còn nhìn ra phương án. Hãy kiểm bằng câu hỏi này: sau suy nghĩ ấy, việc cụ thể nào trong 24 giờ tới thay đổi? Không có việc nào thì mới chỉ có tâm trạng, chưa có tư duy.", "priority": 10},
    {"misconception": "knm.emotion-from-event", "body": "Giữa sự việc và cảm xúc luôn có một khâu: cách bạn diễn giải. Hãy viết ra ba dòng — chuyện gì xảy ra, tôi đang tự nói gì với mình, tôi thấy thế nào. Khâu giữa là chỗ duy nhất sửa được, và nó chỉ hiện ra khi được viết ra.", "priority": 10},
    {"misconception": "knm.self-label", "body": "Đổi nhãn thành mô tả: thay vì mình kém, hãy viết mình chưa làm được phần nào, thiếu cái gì. Nhãn không sửa được; mô tả thì chỉ thẳng vào việc cần làm tiếp.", "priority": 10},
    {"misconception": "knm.catastrophizing", "body": "Hãy kiểm ba trục: chuyện này kéo dài bao lâu, lan tới bao nhiêu phần đời bạn, và bao nhiêu phần thật sự do bạn. Thổi phồng gần như luôn sai ở trục thứ nhất và thứ hai — hãy viết ra hậu quả thật sự trong ba tháng tới, cụ thể và có thể kiểm.", "priority": 10},
    {"misconception": "knm.criticism-as-attack", "body": "Tách hai câu hỏi: người ta nói với thái độ thế nào, và trong đó phần nào đúng. Phần đúng dùng được kể cả khi thái độ khó nghe. Hãy hỏi lại một câu cụ thể — chỗ nào chưa đạt, sửa theo hướng nào — thay vì phản ứng với giọng nói.", "priority": 10},
    {"misconception": "knm.fixed-mindset", "body": "Thêm một chữ vào câu tự nói: tôi chưa làm được. Nỗ lực không phải bằng chứng của kém cỏi, nó là cách duy nhất năng lực tăng lên; và một bài trượt là dữ liệu về cách học hiện tại, không phải phán quyết về trí tuệ của bạn.", "priority": 10},
    {"misconception": "knm.compare-upward", "body": "Đổi mốc so sánh về chính bạn của ba tháng trước: làm được gì bây giờ mà lúc đó chưa làm được. Thước đo đó ổn định, kiểm được, và nói thẳng ra bước tiếp theo — thứ mà bảng xếp hạng với người khác không bao giờ nói.", "priority": 10},
    {"misconception": "knm.self-compassion-is-weak", "body": "Thử phép kiểm này: nếu bạn thân gặp đúng chuyện của bạn, bạn sẽ nói gì với họ? Câu đó thường vừa tử tế vừa thẳng thắn. Tự trắc ẩn là nói câu ấy với chính mình — nó khác với bào chữa, vì nó vẫn gọi đúng tên phần mình làm chưa được.", "priority": 10},
    {"misconception": "knm.mental-health-willpower", "body": "Có một ranh giới cần biết: khi mất ngủ, mất hứng thú, mệt mỏi kéo dài trên hai tuần và ảnh hưởng tới việc học việc làm, đó không còn là chuyện luyện tư duy. Hãy tìm phòng tham vấn tâm lý của trường hoặc bác sĩ chuyên khoa — cũng bình thường như đi khám khi gãy tay.", "priority": 20},
    # ── Module 3 ────────────────────────────────────────────────────────────
    {"misconception": "knm.critical-is-negative", "body": "Phản biện không phải tìm lỗi người khác mà là kiểm chất lượng của một lập luận, kể cả của mình. Phép thử: sau khi phản biện, bạn có nói được kết luận nào đáng tin hơn không? Nếu chỉ còn lại sự nghi ngờ thì việc chưa xong.", "priority": 10},
    {"misconception": "knm.opinion-as-evidence", "body": "Hãy tách ba mảnh: khẳng định là gì, bằng chứng nào đỡ nó, và suy luận nào nối hai thứ đó. Cảm giác chắc chắn không nằm ở mảnh nào trong ba mảnh ấy.", "priority": 10},
    {"misconception": "knm.confirmation-bias", "body": "Trước khi tra cứu, hãy viết ra điều gì sẽ khiến bạn đổi ý. Rồi chủ động tìm đúng thứ đó. Đọc thêm mười nguồn cùng chiều chỉ làm bạn chắc chắn hơn, không làm bạn đúng hơn.", "priority": 10},
    {"misconception": "knm.correlation-causation", "body": "Hai thứ đi cùng nhau còn ba cách giải thích khác trước khi tới nhân quả: chiều ngược lại, một yếu tố thứ ba, hoặc trùng hợp. Hãy nêu tên yếu tố thứ ba khả dĩ trước khi kết luận.", "priority": 10},
    {"misconception": "knm.authority-or-crowd", "body": "Uy tín người nói là lý do để nghe kỹ, không phải lý do để tin; lượt chia sẻ đo độ lan truyền, không đo độ đúng. Câu hỏi giữ nguyên: bằng chứng ở đâu, ai kiểm được nó.", "priority": 10},
    {"misconception": "knm.anecdote-as-proof", "body": "Một trường hợp cho bạn giả thuyết, không cho bạn tỉ lệ. Hãy hỏi: điều này đúng với bao nhiêu người, trong điều kiện nào, và có ai đã đo chưa.", "priority": 10},
    {"misconception": "knm.straw-man", "body": "Trước khi phản bác, hãy diễn đạt lại ý đối phương bằng lời của bạn và hỏi họ: mình hiểu đúng chưa? Nếu họ gật đầu thì bạn mới đang tranh luận với bản gốc.", "priority": 10},
    {"misconception": "knm.false-dilemma", "body": "Hỏi thêm một câu: còn phương án thứ ba nào không, và có cách nào lấy phần tốt của cả hai không? Phần lớn tình huống bị đóng khung thành hai lựa chọn là do người trình bày, không phải do bản chất vấn đề.", "priority": 10},
    {"misconception": "knm.vertical-reading", "body": "Đừng đánh giá một trang bằng chính trang đó. Mở tab mới, tìm tên nguồn ấy kèm từ khoá đánh giá hoặc kiểm chứng, xem nơi khác nói gì — rồi mới quay lại đọc nội dung.", "priority": 10},
    {"misconception": "knm.ai-fluency-truth", "body": "Câu trả lời của AI trôi chảy vì mô hình tối ưu cho sự hợp lý bề mặt, không phải cho tính đúng. Mọi con số, tên riêng và trích dẫn đều phải kiểm lại ở nguồn gốc trước khi dùng.", "priority": 10},
]
