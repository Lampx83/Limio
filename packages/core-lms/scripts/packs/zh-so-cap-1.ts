/**
 * Giáo trình MẪU "Tiếng Trung sơ cấp 1 (HSK 1)" — dữ liệu cho scripts/build-pack-zh-so-cap-1.ts.
 *
 * Mỗi buổi gồm: bài "Từ vựng" (bảng từ có ví dụ), bài "Hội thoại" (kèm quiz cuối buổi, bài tập về nhà và ghi chú
 * dành cho giáo viên). Hiện mới có 6 buổi đầu làm MẪU để chạy thông cả luồng; nội dung 18 buổi còn lại cần chủ dự án
 * soạn hoặc duyệt (tránh sai chữ Hán/phiên âm), rồi thêm vào mảng SESSIONS theo đúng khuôn này. Chưa có audio.
 * Từ vựng bám giáo trình HSK 1 phổ biến; câu ví dụ do Limio viết ngắn gọn, KHÔNG trích từ sách thương mại nào.
 */

export interface PackVocab {
  term: string;
  reading: string;
  meaning: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
}

export interface PackTurn {
  speaker: string;
  text: string;
  reading: string;
  translation: string;
}

export interface PackQuestion {
  prompt: string;
  /** Đáp án đúng luôn là phần tử đầu; server xáo khi học viên làm. */
  correct: string;
  wrong: string[];
  explanation: string;
}

export interface PackSession {
  title: string;
  vocab: PackVocab[];
  dialogue: { title: string; turns: PackTurn[] };
  quiz: PackQuestion[];
  homework: { title: string; description: string; rubric: string };
  teacherNoteHtml: string;
}

const note = (goal: string, plan: string[], answers: string[]) =>
  `<h3>Mục tiêu buổi học</h3><p>${goal}</p>` +
  `<h3>Gợi ý trình tự 90 phút</h3><ol>${plan.map((p) => `<li>${p}</li>`).join("")}</ol>` +
  `<h3>Đáp án quiz cuối buổi</h3><ol>${answers.map((a) => `<li>${a}</li>`).join("")}</ol>`;

const PLAN = (...extra: string[]) => [
  "10 phút: khởi động, nhắc lại buổi trước bằng 2–3 câu hỏi nhanh.",
  "25 phút: giới thiệu từ mới theo bài Từ vựng, đọc theo cả lớp rồi từng cặp.",
  "25 phút: luyện hội thoại theo bài Hội thoại, đổi vai sau mỗi lượt.",
  ...extra,
  "10 phút: làm quiz cuối buổi, chữa nhanh những câu nhiều bạn sai.",
  "5 phút: giao bài tập về nhà và nhắc buổi sau.",
];

export const PACK = {
  slug: "tieng-trung-so-cap-1",
  title: "Tiếng Trung sơ cấp 1 (HSK 1)",
  summary:
    "Giáo trình cho người mới bắt đầu, mỗi buổi 90 phút: từ vựng có ví dụ, hội thoại ngắn, quiz cuối buổi, bài tập về nhà và ghi chú dành cho giáo viên. Bản mẫu hiện có 6 buổi đầu.",
  language: "zh",
  outcomeLevel: "HSK 1",
  courseSlug: "pack-src-tieng-trung-so-cap-1",
};

export const SESSIONS: PackSession[] = [
  {
    title: "Buổi 1: Xin chào",
    vocab: [
      { term: "你", reading: "nǐ", meaning: "bạn", example: "你好！", exampleReading: "Nǐ hǎo!", exampleMeaning: "Xin chào!" },
      { term: "好", reading: "hǎo", meaning: "tốt, khoẻ", example: "你好吗？", exampleReading: "Nǐ hǎo ma?", exampleMeaning: "Bạn khoẻ không?" },
      { term: "你好", reading: "nǐ hǎo", meaning: "xin chào" },
      { term: "谢谢", reading: "xièxie", meaning: "cảm ơn", example: "谢谢你。", exampleReading: "Xièxie nǐ.", exampleMeaning: "Cảm ơn bạn." },
      { term: "不客气", reading: "bú kèqi", meaning: "đừng khách sáo, không có gì" },
      { term: "再见", reading: "zàijiàn", meaning: "tạm biệt", example: "老师，再见！", exampleReading: "Lǎoshī, zàijiàn!", exampleMeaning: "Chào thầy/cô ạ!" },
      { term: "对不起", reading: "duìbuqǐ", meaning: "xin lỗi" },
      { term: "没关系", reading: "méi guānxi", meaning: "không sao" },
    ],
    dialogue: {
      title: "Chào hỏi và cảm ơn",
      turns: [
        { speaker: "A", text: "你好！", reading: "Nǐ hǎo!", translation: "Xin chào!" },
        { speaker: "B", text: "你好！", reading: "Nǐ hǎo!", translation: "Xin chào!" },
        { speaker: "A", text: "谢谢你。", reading: "Xièxie nǐ.", translation: "Cảm ơn bạn." },
        { speaker: "B", text: "不客气。", reading: "Bú kèqi.", translation: "Đừng khách sáo." },
        { speaker: "A", text: "再见！", reading: "Zàijiàn!", translation: "Tạm biệt!" },
        { speaker: "B", text: "再见！", reading: "Zàijiàn!", translation: "Tạm biệt!" },
      ],
    },
    quiz: [
      { prompt: "“谢谢” nghĩa là gì?", correct: "Cảm ơn", wrong: ["Xin lỗi", "Tạm biệt", "Xin chào"], explanation: "谢谢 (xièxie) là cảm ơn." },
      { prompt: "Khi ai đó nói “谢谢你”, đáp lại thế nào?", correct: "不客气", wrong: ["对不起", "再见", "你好"], explanation: "不客气 (bú kèqi) là đừng khách sáo." },
      { prompt: "Phiên âm của “再见” là gì?", correct: "zàijiàn", wrong: ["nǐ hǎo", "xièxie", "duìbuqǐ"], explanation: "再见 đọc là zàijiàn, nghĩa là tạm biệt." },
      { prompt: "Khi làm phiền người khác, ta nói câu nào?", correct: "对不起", wrong: ["不客气", "再见", "没关系"], explanation: "对不起 (duìbuqǐ) là xin lỗi; 没关系 là lời đáp lại." },
    ],
    homework: {
      title: "Bài tập buổi 1: Em chào cô",
      description:
        "Viết 4 câu chào hỏi bằng chữ Hán kèm phiên âm: chào một người bạn, cảm ơn một người, xin lỗi một người và tạm biệt. Có thể ghi âm đọc lại và gửi kèm nếu muốn.",
      rubric: "Đủ 4 câu (40 điểm); chữ Hán đúng (30 điểm); phiên âm đúng (30 điểm).",
    },
    teacherNoteHtml: note(
      "Học viên chào hỏi, cảm ơn, xin lỗi và tạm biệt được bằng tiếng Trung; đọc đúng 8 từ mới.",
      PLAN("15 phút: tập thanh điệu cơ bản với “nǐ hǎo”, “xièxie”; chú ý thanh 3 đi liền thanh 3 (nǐ hǎo đọc nhẹ thành ní hǎo)."),
      ["Cảm ơn", "不客气", "zàijiàn", "对不起"],
    ),
  },
  {
    title: "Buổi 2: Tôi là học sinh",
    vocab: [
      { term: "我", reading: "wǒ", meaning: "tôi", example: "我是学生。", exampleReading: "Wǒ shì xuésheng.", exampleMeaning: "Tôi là học sinh." },
      { term: "是", reading: "shì", meaning: "là" },
      { term: "不", reading: "bù", meaning: "không", example: "我不是老师。", exampleReading: "Wǒ bú shì lǎoshī.", exampleMeaning: "Tôi không phải giáo viên." },
      { term: "吗", reading: "ma", meaning: "(trợ từ nghi vấn cuối câu)", example: "你是学生吗？", exampleReading: "Nǐ shì xuésheng ma?", exampleMeaning: "Bạn là học sinh phải không?" },
      { term: "学生", reading: "xuésheng", meaning: "học sinh, sinh viên" },
      { term: "老师", reading: "lǎoshī", meaning: "giáo viên" },
      { term: "叫", reading: "jiào", meaning: "tên là, gọi là", example: "我叫李明。", exampleReading: "Wǒ jiào Lǐ Míng.", exampleMeaning: "Tôi tên là Lý Minh." },
      { term: "什么", reading: "shénme", meaning: "cái gì" },
      { term: "名字", reading: "míngzi", meaning: "tên" },
      { term: "人", reading: "rén", meaning: "người" },
      { term: "越南", reading: "Yuènán", meaning: "Việt Nam" },
      { term: "中国", reading: "Zhōngguó", meaning: "Trung Quốc" },
    ],
    dialogue: {
      title: "Làm quen",
      turns: [
        { speaker: "A", text: "你好，我叫李明。你叫什么名字？", reading: "Nǐ hǎo, wǒ jiào Lǐ Míng. Nǐ jiào shénme míngzi?", translation: "Xin chào, tôi tên Lý Minh. Bạn tên là gì?" },
        { speaker: "B", text: "我叫阮安。", reading: "Wǒ jiào Ruǎn Ān.", translation: "Tôi tên Nguyễn An." },
        { speaker: "A", text: "你是中国人吗？", reading: "Nǐ shì Zhōngguó rén ma?", translation: "Bạn là người Trung Quốc phải không?" },
        { speaker: "B", text: "不是，我是越南人。你是老师吗？", reading: "Bú shì, wǒ shì Yuènán rén. Nǐ shì lǎoshī ma?", translation: "Không phải, tôi là người Việt Nam. Bạn là giáo viên phải không?" },
        { speaker: "A", text: "不是，我是学生。", reading: "Bú shì, wǒ shì xuésheng.", translation: "Không phải, tôi là học sinh." },
      ],
    },
    quiz: [
      { prompt: "Câu hỏi “你叫什么名字？” nghĩa là gì?", correct: "Bạn tên là gì?", wrong: ["Bạn là ai?", "Bạn bao nhiêu tuổi?", "Bạn là người nước nào?"], explanation: "叫什么名字 hỏi tên." },
      { prompt: "Chọn câu nghĩa “Tôi là người Việt Nam”.", correct: "我是越南人。", wrong: ["我是中国人。", "我不是越南人。", "你是越南人。"], explanation: "越南人 là người Việt Nam, 我是 là tôi là." },
      { prompt: "Trợ từ nào đặt cuối câu để tạo câu hỏi có/không?", correct: "吗", wrong: ["是", "不", "叫"], explanation: "吗 (ma) đặt cuối câu để hỏi có phải hay không." },
      { prompt: "“我不是老师” nghĩa là gì?", correct: "Tôi không phải giáo viên", wrong: ["Tôi là giáo viên", "Tôi không phải học sinh", "Bạn không phải giáo viên"], explanation: "不是 là không phải; 老师 là giáo viên." },
    ],
    homework: {
      title: "Bài tập buổi 2: Giới thiệu bản thân",
      description: "Viết 3 câu giới thiệu bản thân bằng chữ Hán kèm phiên âm: tên em, em là người nước nào, em là học sinh hay đang đi làm.",
      rubric: "Đủ 3 câu (30 điểm); ngữ pháp 我叫…/我是… đúng (40 điểm); chữ Hán và phiên âm đúng (30 điểm).",
    },
    teacherNoteHtml: note(
      "Học viên giới thiệu tên, quốc tịch và nghề nghiệp bằng mẫu 我叫… / 我是…; biết đặt câu hỏi với 吗.",
      PLAN("10 phút: trò chơi làm quen, mỗi bạn hỏi ba bạn khác “你叫什么名字？”."),
      ["Bạn tên là gì?", "我是越南人。", "吗", "Tôi không phải giáo viên"],
    ),
  },
  {
    title: "Buổi 3: Các con số",
    vocab: [
      { term: "一", reading: "yī", meaning: "một" },
      { term: "二", reading: "èr", meaning: "hai" },
      { term: "三", reading: "sān", meaning: "ba" },
      { term: "四", reading: "sì", meaning: "bốn" },
      { term: "五", reading: "wǔ", meaning: "năm" },
      { term: "六", reading: "liù", meaning: "sáu" },
      { term: "七", reading: "qī", meaning: "bảy" },
      { term: "八", reading: "bā", meaning: "tám" },
      { term: "九", reading: "jiǔ", meaning: "chín" },
      { term: "十", reading: "shí", meaning: "mười", example: "二十", exampleReading: "èrshí", exampleMeaning: "hai mươi" },
      { term: "几", reading: "jǐ", meaning: "mấy (hỏi số lượng nhỏ)", example: "你几岁？", exampleReading: "Nǐ jǐ suì?", exampleMeaning: "Bạn mấy tuổi?" },
      { term: "岁", reading: "suì", meaning: "tuổi", example: "我二十岁。", exampleReading: "Wǒ èrshí suì.", exampleMeaning: "Tôi hai mươi tuổi." },
      { term: "呢", reading: "ne", meaning: "(trợ từ hỏi lại) còn … thì sao", example: "我十九岁，你呢？", exampleReading: "Wǒ shíjiǔ suì, nǐ ne?", exampleMeaning: "Tôi mười chín tuổi, còn bạn?" },
    ],
    dialogue: {
      title: "Hỏi tuổi",
      turns: [
        { speaker: "A", text: "你几岁？", reading: "Nǐ jǐ suì?", translation: "Bạn mấy tuổi?" },
        { speaker: "B", text: "我十九岁，你呢？", reading: "Wǒ shíjiǔ suì, nǐ ne?", translation: "Tôi mười chín tuổi, còn bạn?" },
        { speaker: "A", text: "我二十岁。", reading: "Wǒ èrshí suì.", translation: "Tôi hai mươi tuổi." },
        { speaker: "B", text: "你是学生吗？", reading: "Nǐ shì xuésheng ma?", translation: "Bạn là sinh viên phải không?" },
        { speaker: "A", text: "是，我是学生。", reading: "Shì, wǒ shì xuésheng.", translation: "Phải, tôi là sinh viên." },
      ],
    },
    quiz: [
      { prompt: "“八” đọc là gì?", correct: "bā", wrong: ["liù", "qī", "jiǔ"], explanation: "八 (bā) là số tám." },
      { prompt: "“二十” nghĩa là số mấy?", correct: "20", wrong: ["12", "2", "10"], explanation: "二十 = hai mươi." },
      { prompt: "Chọn câu hỏi tuổi.", correct: "你几岁？", wrong: ["你是谁？", "你叫什么？", "你好吗？"], explanation: "几岁 hỏi tuổi." },
      { prompt: "“我十九岁，你呢？” — “你呢” nghĩa là gì?", correct: "Còn bạn thì sao?", wrong: ["Bạn là ai?", "Bạn mấy tuổi?", "Bạn có khoẻ không?"], explanation: "呢 dùng để hỏi lại cùng nội dung." },
    ],
    homework: {
      title: "Bài tập buổi 3: Số điện thoại và tuổi",
      description: "Viết bằng chữ Hán: tuổi của em, tuổi của hai người trong gia đình, và một dãy 5 số bất kỳ (ví dụ 一三五七九). Đọc to rồi ghi âm gửi cô nếu có thể.",
      rubric: "Viết đúng chữ số Hán (50 điểm); đúng cấu trúc ……岁 (30 điểm); đọc đúng (20 điểm).",
    },
    teacherNoteHtml: note(
      "Học viên đếm 1–99 (ở buổi này tới 20) và hỏi, trả lời tuổi.",
      PLAN("15 phút: trò chơi đếm số theo vòng tròn, ai sai thanh điệu thì chuyển lượt."),
      ["bā", "20", "你几岁？", "Còn bạn thì sao?"],
    ),
  },
  {
    title: "Buổi 4: Gia đình",
    vocab: [
      { term: "家", reading: "jiā", meaning: "nhà, gia đình" },
      { term: "爸爸", reading: "bàba", meaning: "bố" },
      { term: "妈妈", reading: "māma", meaning: "mẹ" },
      { term: "哥哥", reading: "gēge", meaning: "anh trai" },
      { term: "姐姐", reading: "jiějie", meaning: "chị gái" },
      { term: "弟弟", reading: "dìdi", meaning: "em trai" },
      { term: "妹妹", reading: "mèimei", meaning: "em gái" },
      { term: "有", reading: "yǒu", meaning: "có", example: "我有一个姐姐。", exampleReading: "Wǒ yǒu yí ge jiějie.", exampleMeaning: "Tôi có một chị gái." },
      { term: "没有", reading: "méiyǒu", meaning: "không có" },
      { term: "口", reading: "kǒu", meaning: "(lượng từ chỉ số người trong gia đình)", example: "我家有五口人。", exampleReading: "Wǒ jiā yǒu wǔ kǒu rén.", exampleMeaning: "Nhà tôi có năm người." },
      { term: "和", reading: "hé", meaning: "và" },
    ],
    dialogue: {
      title: "Nói về gia đình",
      turns: [
        { speaker: "A", text: "你家有几口人？", reading: "Nǐ jiā yǒu jǐ kǒu rén?", translation: "Nhà bạn có mấy người?" },
        { speaker: "B", text: "我家有五口人：爸爸、妈妈、哥哥、妹妹和我。", reading: "Wǒ jiā yǒu wǔ kǒu rén: bàba, māma, gēge, mèimei hé wǒ.", translation: "Nhà tôi có năm người: bố, mẹ, anh trai, em gái và tôi." },
        { speaker: "A", text: "你有姐姐吗？", reading: "Nǐ yǒu jiějie ma?", translation: "Bạn có chị gái không?" },
        { speaker: "B", text: "我没有姐姐。", reading: "Wǒ méiyǒu jiějie.", translation: "Tôi không có chị gái." },
      ],
    },
    quiz: [
      { prompt: "“妈妈” nghĩa là gì?", correct: "Mẹ", wrong: ["Bố", "Chị gái", "Em gái"], explanation: "妈妈 (māma) là mẹ." },
      { prompt: "Muốn nói “Tôi không có em trai”, chọn câu đúng.", correct: "我没有弟弟。", wrong: ["我不有弟弟。", "我有没弟弟。", "我没是弟弟。"], explanation: "Phủ định của 有 là 没有, không dùng 不有." },
      { prompt: "“我家有三口人” nghĩa là gì?", correct: "Nhà tôi có ba người", wrong: ["Tôi có ba người anh", "Nhà tôi có ba tầng", "Tôi ba tuổi"], explanation: "口 là lượng từ chỉ số người trong nhà." },
      { prompt: "“和” nghĩa là gì?", correct: "Và", wrong: ["Nhưng", "Không", "Có"], explanation: "和 (hé) là và." },
    ],
    homework: {
      title: "Bài tập buổi 4: Gia đình em",
      description: "Viết 4 câu về gia đình em bằng chữ Hán kèm phiên âm: nhà em có mấy người, đó là những ai, em có anh chị em không.",
      rubric: "Đủ 4 câu (30 điểm); dùng đúng 有/没有 và 口 (40 điểm); chữ Hán và phiên âm đúng (30 điểm).",
    },
    teacherNoteHtml: note(
      "Học viên gọi tên các thành viên gia đình và nói nhà mình có mấy người, có hay không có anh chị em.",
      PLAN("15 phút: mỗi học viên vẽ sơ đồ gia đình rồi giới thiệu cho bạn bên cạnh."),
      ["Mẹ", "我没有弟弟。", "Nhà tôi có ba người", "Và"],
    ),
  },
  {
    title: "Buổi 5: Ăn uống",
    vocab: [
      { term: "吃", reading: "chī", meaning: "ăn" },
      { term: "喝", reading: "hē", meaning: "uống" },
      { term: "水", reading: "shuǐ", meaning: "nước" },
      { term: "茶", reading: "chá", meaning: "trà" },
      { term: "米饭", reading: "mǐfàn", meaning: "cơm" },
      { term: "苹果", reading: "píngguǒ", meaning: "quả táo" },
      { term: "想", reading: "xiǎng", meaning: "muốn, nghĩ", example: "我想吃米饭。", exampleReading: "Wǒ xiǎng chī mǐfàn.", exampleMeaning: "Tôi muốn ăn cơm." },
      { term: "要", reading: "yào", meaning: "cần, muốn lấy", example: "我要茶。", exampleReading: "Wǒ yào chá.", exampleMeaning: "Tôi lấy trà." },
      { term: "很", reading: "hěn", meaning: "rất" },
      { term: "好吃", reading: "hǎochī", meaning: "ngon", example: "很好吃！", exampleReading: "Hěn hǎochī!", exampleMeaning: "Rất ngon!" },
    ],
    dialogue: {
      title: "Gọi món",
      turns: [
        { speaker: "A", text: "你想吃什么？", reading: "Nǐ xiǎng chī shénme?", translation: "Bạn muốn ăn gì?" },
        { speaker: "B", text: "我想吃米饭。", reading: "Wǒ xiǎng chī mǐfàn.", translation: "Tôi muốn ăn cơm." },
        { speaker: "A", text: "你要喝水吗？", reading: "Nǐ yào hē shuǐ ma?", translation: "Bạn có lấy nước không?" },
        { speaker: "B", text: "不要，我要茶。", reading: "Bú yào, wǒ yào chá.", translation: "Không, tôi lấy trà." },
        { speaker: "A", text: "米饭好吃吗？", reading: "Mǐfàn hǎochī ma?", translation: "Cơm có ngon không?" },
        { speaker: "B", text: "很好吃！", reading: "Hěn hǎochī!", translation: "Rất ngon!" },
      ],
    },
    quiz: [
      { prompt: "“喝茶” nghĩa là gì?", correct: "Uống trà", wrong: ["Ăn cơm", "Uống nước", "Ăn táo"], explanation: "喝 là uống, 茶 là trà." },
      { prompt: "Chọn câu nghĩa “Tôi muốn ăn táo”.", correct: "我想吃苹果。", wrong: ["我想喝苹果。", "我吃想苹果。", "我想苹果吃。"], explanation: "Trật tự: 我 + 想 + 吃 + 苹果." },
      { prompt: "“很好吃” nghĩa là gì?", correct: "Rất ngon", wrong: ["Không ngon", "Hơi đắt", "Rất đói"], explanation: "很 là rất, 好吃 là ngon." },
      { prompt: "“不要” trong hội thoại nghĩa là gì?", correct: "Không cần, không lấy", wrong: ["Rất cần", "Không có", "Không phải"], explanation: "不要 từ chối một món được mời." },
    ],
    homework: {
      title: "Bài tập buổi 5: Món em thích",
      description: "Viết 3 câu bằng chữ Hán kèm phiên âm: em muốn ăn gì, em muốn uống gì, và một món em thấy rất ngon. Có thể ghi âm đọc lại.",
      rubric: "Đủ 3 câu (30 điểm); dùng đúng 想/要/很 (40 điểm); chữ Hán và phiên âm đúng (30 điểm).",
    },
    teacherNoteHtml: note(
      "Học viên gọi món đơn giản, nói muốn ăn hay uống gì và khen món ăn.",
      PLAN("15 phút: đóng vai nhà hàng, một bạn phục vụ và một bạn gọi món bằng tranh món ăn."),
      ["Uống trà", "我想吃苹果。", "Rất ngon", "Không cần, không lấy"],
    ),
  },
  {
    title: "Buổi 6: Mua sắm",
    vocab: [
      { term: "买", reading: "mǎi", meaning: "mua" },
      { term: "钱", reading: "qián", meaning: "tiền" },
      { term: "块", reading: "kuài", meaning: "đồng (đơn vị tiền Trung Quốc, văn nói)", example: "五块钱", exampleReading: "wǔ kuài qián", exampleMeaning: "năm đồng" },
      { term: "多少钱", reading: "duōshao qián", meaning: "bao nhiêu tiền", example: "这个多少钱？", exampleReading: "Zhège duōshao qián?", exampleMeaning: "Cái này bao nhiêu tiền?" },
      { term: "这个", reading: "zhège", meaning: "cái này" },
      { term: "贵", reading: "guì", meaning: "đắt" },
      { term: "便宜", reading: "piányi", meaning: "rẻ" },
      { term: "太…了", reading: "tài … le", meaning: "quá …", example: "太贵了！", exampleReading: "Tài guì le!", exampleMeaning: "Đắt quá!" },
      { term: "可以", reading: "kěyǐ", meaning: "được, có thể" },
      { term: "两", reading: "liǎng", meaning: "hai (trước lượng từ)" },
      { term: "个", reading: "ge", meaning: "cái, quả (lượng từ thông dụng)" },
    ],
    dialogue: {
      title: "Mua táo",
      turns: [
        { speaker: "A", text: "这个苹果多少钱？", reading: "Zhège píngguǒ duōshao qián?", translation: "Quả táo này bao nhiêu tiền?" },
        { speaker: "B", text: "五块钱。", reading: "Wǔ kuài qián.", translation: "Năm đồng." },
        { speaker: "A", text: "太贵了，四块钱可以吗？", reading: "Tài guì le, sì kuài qián kěyǐ ma?", translation: "Đắt quá, bốn đồng được không?" },
        { speaker: "B", text: "可以。", reading: "Kěyǐ.", translation: "Được." },
        { speaker: "A", text: "我买两个。", reading: "Wǒ mǎi liǎng ge.", translation: "Tôi mua hai quả." },
      ],
    },
    quiz: [
      { prompt: "Hỏi giá một món đồ, ta nói câu nào?", correct: "这个多少钱？", wrong: ["这个几岁？", "这个是谁？", "这个好吃吗？"], explanation: "多少钱 hỏi giá." },
      { prompt: "“太贵了” nghĩa là gì?", correct: "Đắt quá", wrong: ["Rẻ quá", "Ngon quá", "Hơi ít"], explanation: "太 … 了 là quá …; 贵 là đắt." },
      { prompt: "Trước lượng từ 个, “hai” nói là gì?", correct: "两", wrong: ["二", "三", "一"], explanation: "Trước lượng từ dùng 两 thay cho 二: 两个." },
      { prompt: "“便宜” là gì?", correct: "Rẻ", wrong: ["Đắt", "Tốt", "Mới"], explanation: "便宜 (piányi) là rẻ." },
    ],
    homework: {
      title: "Bài tập buổi 6: Đi chợ",
      description: "Viết một đoạn hội thoại 4 lượt giữa em và người bán hàng: hỏi giá một món, trả giá, và quyết định mua mấy cái. Dùng chữ Hán kèm phiên âm.",
      rubric: "Đủ 4 lượt (30 điểm); dùng đúng 多少钱/太…了/可以 (40 điểm); chữ Hán và phiên âm đúng (30 điểm).",
    },
    teacherNoteHtml: note(
      "Học viên hỏi giá, nhận xét đắt rẻ, trả giá đơn giản và nói số lượng muốn mua.",
      PLAN("15 phút: đóng vai chợ, mỗi nhóm có “hàng” và “tiền” bằng giấy."),
      ["这个多少钱？", "Đắt quá", "两", "Rẻ"],
    ),
  },
];
