# Thiết kế các dạng bài tập cho khoá tiếng Trung dành cho người Việt

Trạng thái: **đề xuất, chờ chốt**. Áp dụng cho khoá HSK 3.0 bản gốc Limio (cấp 3 đã thử một unit, cấp 4 đang lên khung). Nguồn cơ sở: các dạng câu Limio đang có (`mcq`, `multi`, `true_false_notgiven`, `gap_fill`, `short_answer`, `essay` có giọng nói/đóng vai/bạn ảo, `matching`, `ordering`, `numerical`, `drag_drop_fill`, khối audio và hình trong bài luyện, thẻ ghi nhớ, tập viết chữ Hán).

## 1. Nguyên tắc thiết kế
1. **Mỗi câu kiểm một việc**: nghe, hoặc từ, hoặc ngữ pháp; đề không trộn nhiều lỗi.
2. **Đánh vào lỗi người Việt hay mắc**, không chỉ chấm đúng/sai. Phương án sai (nhiễu) được chọn từ những lỗi có thật và có tên (mục 3), kèm lời giải nói rõ "bạn đang áp trật tự/cách nghĩ của tiếng Việt".
3. **Tận dụng Hán–Việt** như cầu nối (đoán nghĩa, đoán chữ) và cảnh báo chỗ nó gây nhầm (từ đồng nguồn nghĩa khác).
4. **Từ dễ đến khó trong cùng một mục kiến thức**: nhận biết → tái hiện → vận dụng tự do.
5. **Có hỗ trợ bật/tắt**: pinyin, bản dịch, tốc độ nghe 0,75×–1,25×; học viên tự giảm dần hỗ trợ.
6. **Ngắn, làm được trên điện thoại**, phản hồi tức thì, lời giải bằng tiếng Việt xưng "bạn".
7. **Có việc để nói và viết thật**: ít nhất một nhiệm vụ nói/viết cuối mỗi bài khoá và bài tổng hợp.

## 2. Khó khăn đặc thù của người Việt học tiếng Trung
| Nhóm | Điều thường gặp | Hệ quả cho bài tập |
|---|---|---|
| Thanh điệu | Tiếng Việt có thanh điệu nên quen khái niệm, nhưng đường nét thanh khác (thanh 3 hay đọc như một thanh Việt nào đó, thanh 2 và thanh 3 lẫn, thanh nhẹ không có) | nghe phân biệt thanh, cặp tối thiểu, biến điệu thanh 3, 不 và 一 |
| Phụ âm | cuốn lưỡi zh/ch/sh/r so với z/c/s; j/q/x; vần ü; an/ang, en/eng, in/ing | nghe chọn, đọc lặp lại có chấm |
| Chữ | Hán–Việt giúp đoán nghĩa nhưng giản thể lạ; nhầm chữ đồng âm (他/她/它, 在/再, 的/得/地) | nhận mặt chữ, chọn chữ đúng, tập viết nét |
| Từ vựng | từ Hán–Việt nghĩa khác tiếng Việt (ví dụ 爱人 là vợ hoặc chồng, 东西 là đồ vật, 先生 vừa là ông vừa là chồng); lượng từ khác nhau (con cá là 一条鱼, con mèo là 一只猫) | từ gần nghĩa, lượng từ, kết hợp từ |
| Ngữ pháp | trật tự trạng ngữ (ăn cơm ở nhà → 我在家吃饭); định ngữ đứng trước (cuốn sách mới của tôi → 我的新书); lạm dụng 了 cho "đã"; thiếu 很 trước tính từ; phủ định 不 và 没; vị trí 也、都 (也都); so sánh 比 | sắp xếp câu, sửa câu, điền cấu trúc |

## 3. Mã "lỗi người Việt" (gắn vào phương án nhiễu)
Mỗi phương án sai trong câu trắc nghiệm gắn một mã để lời giải và phản hồi nhắm đúng nguyên nhân, và để Feedback Engine tổng hợp điểm yếu theo mã.

| Mã | Tên | Ví dụ lỗi → đúng |
|---|---|---|
| `vi.order.adverbial` | trạng ngữ đặt sau động từ | 我吃饭在家 → 我在家吃饭 |
| `vi.order.modifier` | định ngữ đặt sau danh từ | 书新我的 → 我的新书 |
| `vi.aspect.le-overuse` | dùng 了 cho mọi "đã/sẽ" | 我明天去了 → 我明天去 |
| `vi.aspect.le-position` | đặt 了 sai chỗ khi có số lượng | 我学汉语了两年 → 我学了两年汉语 |
| `vi.adj.hen-missing` | bỏ 很 trước tính từ | 她漂亮 → 她很漂亮 |
| `vi.neg.bu-mei` | nhầm 不 và 没 | 我不去昨天 / 我没明天去 → 我昨天没去 |
| `vi.comp.bi-order` | đặt 比 sai chỗ | 他高比我 → 他比我高 |
| `vi.adv.ye-dou` | đảo 也 và 都 | 我们都也喜欢 → 我们也都喜欢 |
| `vi.measure.classifier` | chọn lượng từ theo tiếng Việt | 一个鱼 → 一条鱼 |
| `vi.hanviet.falsefriend` | hiểu từ Hán–Việt theo nghĩa tiếng Việt | 爱人 = "người yêu" ✗ |
| `vi.particle.de-di-de` | nhầm 的/地/得 | 他跑的很快 → 他跑得很快 |
| `vi.homophone.zai` | nhầm 在/再 | 明天在见 → 明天再见 |
| `vi.tone.t2t3` | lẫn thanh 2 và 3 | 买 mǎi / 卖 mài |
| `vi.initial.retroflex` | lẫn zh/ch/sh với z/c/s | 是 shì / 四 sì |
Còn nhiều mã khác; danh sách sẽ mở rộng theo dữ liệu làm bài thật.

## 4. Danh mục dạng bài
Chú giải trạng thái trong Limio: ✔ làm được bằng dạng câu hiện có · ◐ cần chỉnh nhỏ · ✖ cần dựng mới.

### A. Âm và chữ
| # | Dạng | Học viên làm gì | Dạng câu Limio | TT |
|---|---|---|---|---|
| A1 | Nghe chọn thanh điệu | nghe một âm tiết, chọn thanh 1/2/3/4/nhẹ | `mcq` + audio | ✔ |
| A2 | Cặp tối thiểu | nghe, chọn từ đúng (买/卖, 四/十, 睡觉/水饺) | `mcq` + audio | ✔ |
| A3 | Gắn thanh vào pinyin | chọn hoặc gõ pinyin đúng cho một chữ; chấp nhận cả "ma3" lẫn "mǎ" | `mcq`, `short_answer` | ◐ chuẩn hoá cách gõ |
| A4 | Biến điệu | chọn cách đọc đúng của 你好, 一个, 不是 | `mcq` | ✔ |
| A5 | Phụ âm dễ nhầm | nghe chọn zh/z, ch/c, sh/s, j/q/x | `mcq` + audio | ✔ |
| A6 | Nghe – lặp lại | nghe câu, ghi âm lại, AI nhận xét | `essay` giọng nói | ◐ chưa chấm thanh điệu |
| A7 | Đọc to đoạn ngắn | đọc, so với văn bản | `essay` giọng nói | ◐ |
| A8 | Tập viết chữ | viết theo nét, báo nét sai | khung tập viết đã có ở thẻ từ | ✖ chưa thành dạng câu có chấm |
| A9 | Hán–Việt ↔ chữ | nghe âm Hán–Việt, chọn chữ/nghĩa; hoặc ngược lại | `mcq`, `matching` | ✔ |
| A10 | Chọn chữ đúng | 他/她/它, 在/再, 的/得/地 | `mcq`, `drag_drop_fill` | ✔ |

### B. Từ vựng
| # | Dạng | Học viên làm gì | Dạng câu | TT |
|---|---|---|---|---|
| B1 | Nối từ – nghĩa | nối chữ với nghĩa tiếng Việt | `matching` | ✔ |
| B2 | Nối từ – hình | nối từ với hình đánh số | `matching` (nay) / kéo lên hình (mới) | ◐ |
| B3 | Điền từ vào chỗ trống | kéo thẻ từ vào câu, có thẻ nhiễu | `drag_drop_fill` | ✔ |
| B4 | Đúng/sai về từ Hán–Việt | "爱人 là người yêu": đúng hay sai | `mcq` Đúng/Sai | ✔ |
| B5 | Chọn lượng từ | 一__鱼, 一__猫, 一__桌子 | `mcq`, `drag_drop_fill` | ✔ |
| B6 | Kết hợp từ | nối động từ với danh từ thường đi cùng | `matching` | ✔ |
| B7 | Từ gần nghĩa | 会/能/可以, 想/要, 知道/认识 | `mcq` + lời giải | ✔ |
| B8 | Thẻ ghi nhớ | ôn từ theo lịch giãn cách | thẻ ghi nhớ đã có | ✔ |
| B9 | Phân loại theo chủ đề | kéo từ vào nhóm (đồ ăn, thời tiết…) | ✖ cần dạng kéo vào nhóm | ✖ |

### C. Ngữ pháp
| # | Dạng | Học viên làm gì | Dạng câu | TT |
|---|---|---|---|---|
| C1 | Sắp xếp thành câu | xếp các từ thành câu đúng | `ordering` | ✔ |
| C2 | Chọn câu đúng | trong ba câu, chọn câu đúng trật tự (nhiễu theo mã `vi.*`) | `mcq` | ✔ |
| C3 | Bấm vào chỗ sai | trong một câu sai, bấm vào từ sai | ✖ | ✖ |
| C4 | Dịch Việt → Trung bằng thẻ | ghép thẻ từ thành câu dịch từ tiếng Việt | `drag_drop_fill`, `ordering` | ✔ |
| C5 | Điền cấu trúc | 虽然……但是……, 越来越…… | `gap_fill` | ✔ |
| C6 | Chọn 的/地/得, 了/过/着 | điền trợ từ đúng | `mcq`, `gap_fill` | ✔ |
| C7 | Viết lại câu | chuyển câu sang 把/被/是……的 | `short_answer` nhiều đáp án | ◐ |
| C8 | Hoàn thành hội thoại | chọn câu đáp tự nhiên | `mcq` | ✔ |

### D. Nghe
| # | Dạng | Dạng câu | TT |
|---|---|---|---|
| D1 | Nghe chọn tranh/đáp án (kiểu HSK) | `mcq` + audio + hình | ✔ |
| D2 | Nghe điền (chép chính tả pinyin/chữ) | `gap_fill` + audio | ✔ |
| D3 | Nghe số, giờ, giá | `numerical` + audio | ✔ |
| D4 | Nghe hội thoại trả lời câu hỏi | `mcq` + audio | ✔ |
| D5 | Nghe và xếp thứ tự sự việc | `ordering` + audio | ✔ |
| D6 | Nghe chậm rồi nghe thường | trình phát có tốc độ | ✔ |

### E. Đọc
| # | Dạng | Dạng câu | TT |
|---|---|---|---|
| E1 | Đọc hiểu đoạn ngắn | `mcq` | ✔ |
| E2 | Đúng/Sai/không có thông tin | `true_false_notgiven` (nhãn đang tiếng Anh, cần Việt hoá) | ◐ |
| E3 | Tìm thông tin trong đoạn | `short_answer` | ✔ |
| E4 | Điền từ vào đoạn (cloze) | `drag_drop_fill` | ✔ |
| E5 | Sắp xếp câu thành đoạn | `ordering` | ✔ |
| E6 | Đọc với pinyin ẩn/hiện | pinyin dưới chữ, làm mờ | ✔ |

### F. Nói
| # | Dạng | Dạng câu | TT |
|---|---|---|---|
| F1 | Đóng vai theo kịch bản | `essay` + `roleplay` | ✔ |
| F2 | Trò chuyện với bạn ảo | `essay` + `freechat`, ghi âm bấm bắt đầu/kết thúc | ✔ |
| F3 | Mô tả tranh | `essay` giọng nói | ✔ |
| F4 | Trả lời nhanh có giới hạn thời gian | `essay` giọng nói + đếm giờ | ◐ |

### G. Viết
| # | Dạng | Dạng câu | TT |
|---|---|---|---|
| G1 | Gõ pinyin thành chữ | `short_answer` (cần bộ gõ) | ✔ |
| G2 | Viết câu theo từ cho sẵn | `essay` + AI nhận xét | ✔ |
| G3 | Viết đoạn 80–100 chữ (kiểu HSK 4) | `essay` + tiêu chí + AI nhận xét | ✔ |
| G4 | Nhắn tin/email ngắn theo tình huống | `essay` | ✔ |

### H. Tích hợp
| # | Dạng | TT |
|---|---|---|
| H1 | Nhiệm vụ thực tế nối nghe–nói (đặt món, hỏi đường, đổi lịch) | ✔ bằng `roleplay`/`freechat` |
| H2 | Dự án nhỏ cuối unit (ghi âm 1 phút giới thiệu) | ✖ cần nộp bài audio |

## 5. Phân bổ trong một bài khoá (35 câu, khoảng 30–35 phút)
| Kỹ năng | Tỉ lệ | Gợi ý dạng |
|---|---|---|
| Nghe | ~20% | D1, D2/D3, D4; A1/A2 nếu bài có âm khó |
| Từ vựng | ~20% | B1, B3, B5/B7, một câu B4 nếu có từ Hán–Việt |
| Ngữ pháp | ~30% | C1 (trọng tâm), C2 (nhiễu `vi.*`), C5/C6 |
| Đọc | ~15% | E1, E4 |
| Nói/Viết | ~15% | F1 hoặc F2, G2 |
Bài Khởi động: B2, A1/A2, một phiếu F2. Bài tổng hợp: E1–E5, G3, F2, H1. Mỗi điểm ngữ pháp mới có ≥ 2 câu C và có ≥ 1 câu mang nhiễu gắn mã lỗi người Việt.

## 6. Việc kỹ thuật cần làm
**Ưu tiên 1 (nhỏ, nên làm trước):**
- Việt hoá nhãn Đúng/Sai/Không có thông tin của `true_false_notgiven`.
- Cho phép gắn **mã lỗi (`misconception`) vào phương án sai** của câu trong Bài luyện (importer hiện chỉ nhận ở câu quiz của LMS), để lời giải và Feedback Engine dùng được.
- Chuẩn hoá cách nhận đáp án pinyin có/không có thanh ("ma3", "mǎ").
**Ưu tiên 2 (vừa):** dạng "bấm vào chỗ sai" (C3), dạng kéo vào nhóm (B9), kéo thẻ từ lên hình (B2), đếm giờ cho câu nói nhanh (F4).
**Ưu tiên 3 (lớn):** chấm phát âm/thanh điệu (A6, A7), biến tập viết thành dạng câu có chấm (A8), nộp bài ghi âm cho dự án nhỏ (H2).

## 7. Văn hoá và ngữ cảnh Trung Quốc
Học ngôn ngữ là học cách dùng nó trong đời sống thật; mọi bài tập phải đặt trong ngữ cảnh Trung Quốc, không phải bản dịch từ tình huống Việt Nam.

**Nguyên tắc**
1. **Ngữ cảnh thật**: tình huống, tên riêng, địa danh, giá cả, ứng dụng, tập quán phải đúng với Trung Quốc hiện nay (thanh toán bằng mã QR, WeChat, đặt xe, tàu cao tốc, giao đồ ăn, tên người, kiểu xưng hô), và có thể kiểm chứng.
2. **Tài liệu thật (realia)**: dùng dạng thực tế mà học viên sẽ gặp: tin nhắn WeChat, nhóm chat lớp, thực đơn, biển báo, vé tàu, hoá đơn, thông báo của trường, tin nhắn giao hàng, bài đăng mạng xã hội. Soạn lại (tự viết), không chép nguyên bản có bản quyền.
3. **Sắc thái và phép lịch sự**: dạy cách nói đúng hoàn cảnh (xưng hô, mức trang trọng, nhờ vả, từ chối, khách sáo), vì người Việt dễ dịch thẳng từ cách nói tiếng Việt.
4. **Đối chiếu Việt – Trung** (tương đồng và khác biệt) thay vì chỉ "văn hoá Trung Quốc": 春节 và Tết, 红包 và lì xì, bánh trôi/sủi cảo, trung thu, cách ăn uống, nhà ở, giờ giấc.
5. **Đa dạng và không khuôn mẫu**: vùng miền (Bắc – Nam, thành phố lớn và nông thôn), thế hệ, giới; tránh định kiến và khái quát hoá; có chú thích "ở nhiều nơi/ở một số vùng" khi tập quán không chung.
6. **Có kiểm duyệt**: mọi chi tiết văn hoá và thời sự được người Trung Quốc bản ngữ hoặc giáo viên am hiểu duyệt; ghi nguồn khi nêu số liệu hay quy định.

**Góc nhìn người Việt (bắt buộc cho mọi nội dung văn hoá)**
- **Đặt từ điểm xuất phát của người Việt**: giải thích bằng cái học viên đã biết (Tết, lì xì, bánh chưng, Zalo, xe máy, chợ) rồi mới sang cái khác. Không giải thích dài những điều người Việt đã quen vì chung gốc văn hoá (Tết Nguyên đán, Trung thu, thờ cúng tổ tiên, lễ Thanh minh), chỉ nêu **chỗ khác** (ví dụ cách chúc, món ăn, cách gọi lễ).
- **Tận dụng vốn Hán–Việt và đồng văn**: nối chữ với âm Hán–Việt, thành ngữ Hán–Việt, địa danh quen (Bắc Kinh, Thượng Hải, Quảng Châu) nhưng nhắc rõ khi nghĩa lệch.
- **Tình huống gần với người học Việt**: du học ở Trung Quốc, làm việc ở công ty có đối tác Trung Quốc, bán hàng xuyên biên giới, du lịch Quảng Tây – Vân Nam, xem phim và nghe nhạc Trung, thi HSK để xin việc/học bổng; không dùng bối cảnh chỉ hợp với người nói tiếng Anh.
- **Ngôn ngữ giải thích là tiếng Việt tự nhiên**, ví dụ so sánh bằng cách nói Việt (vd. "trong tiếng Việt ta nói…, tiếng Trung lại nói…"), nêu lỗi dịch thẳng mà người Việt hay mắc.
- **Nhạy cảm**: tránh đề tài chính trị, lãnh thổ, lịch sử gây tranh cãi giữa hai nước; mọi chi tiết văn hoá nêu trung tính, kiểm chứng được và được duyệt trước.

**Các dạng bài tập thêm cho mảng văn hoá**
| # | Dạng | Học viên làm gì | Dạng câu | TT |
|---|---|---|---|---|
| K1 | Chọn câu hợp ngữ cảnh | cùng ý nhưng chọn câu thân mật hay trang trọng cho đúng người nghe (bạn bè, thầy cô, người lớn tuổi) | `mcq` | ✔ |
| K2 | Xưng hô | chọn cách gọi đúng (老师, 师傅, 阿姨, 叔叔, 先生) theo hoàn cảnh | `mcq`, `matching` | ✔ |
| K3 | Đọc tài liệu thật | đọc một tin nhắn WeChat, thực đơn, vé tàu, thông báo, rồi trả lời | `mcq`, `short_answer` + hình | ✔ |
| K4 | Nhận biết khách sáo | tình huống mời/từ chối/cảm ơn: câu nào lịch sự tự nhiên, câu nào lạ | `mcq` | ✔ |
| K5 | Việt – Trung giống và khác | đúng/sai về tập quán (红包 và lì xì) | `mcq` Đúng/Sai | ✔ |
| K6 | Thành ngữ và tục ngữ | nối thành ngữ 成语 với nghĩa, hoặc với câu tục ngữ Việt gần nghĩa | `matching` | ✔ |
| K7 | Nhiệm vụ đời sống | đặt món ở quán, hỏi đường, mua vé, nhắn nhóm lớp, trả giá | `roleplay`, `freechat` | ✔ |
| K8 | Con số, ngày, lễ | đọc ngày âm lịch, số điện thoại, giá, thời gian lễ hội | `numerical`, `mcq` | ✔ |
| K9 | Hộp "Văn hoá" cuối bài | một đoạn ngắn tự soạn về bối cảnh văn hoá của bài, kèm 1–2 câu hỏi nhanh | khối chữ + `mcq` | ✔ |

**Cách gắn vào khoá**
- Mỗi unit có một **mạch văn hoá** (ví dụ phỏng vấn xin việc: cách nói chuyện với người phỏng vấn, đồ trang phục, phong bì tuyển dụng); mỗi bài khoá có một hộp "Văn hoá" (K9), mỗi bài tổng hợp có ít nhất một câu K1/K3/K4.
- Hình tự vẽ dùng chi tiết đúng Trung Quốc (biển hiệu chữ giản thể, mã QR, xe buýt, ga tàu cao tốc, ấm trà, bàn ăn xoay…), không dùng hình ảnh trung tính khó nhận biết.
- Mã lỗi thêm: `vi.pragmatic.register` (dịch thẳng làm sai sắc thái lịch sự), `vi.culture.assume` (áp tập quán Việt Nam lên tình huống Trung Quốc).

## 8. Đo và thích ứng
Theo dõi tỉ lệ đúng theo dạng bài và theo mã lỗi, đẩy các câu ôn đúng mã mà học viên hay sai vào thẻ ôn hằng ngày, và báo giảng viên các mã lỗi nổi bật của lớp.

## 9. Cần bạn chốt
1. Danh mục này có đủ và đúng thứ tự ưu tiên không (bỏ/thêm dạng nào)?
2. Mảng văn hoá (mục 7): ai là người Trung Quốc bản ngữ hoặc giáo viên am hiểu duyệt chi tiết văn hoá?
2. Có làm ngay các việc kỹ thuật ưu tiên 1 trước khi soạn bài hàng loạt không?
3. Bộ mã lỗi mẫu: nhờ giáo viên tiếng Trung người Việt rà để chắc đây là những lỗi thật của học viên.
4. Dạng nào cần chấm tự động tuyệt đối, dạng nào chấp nhận AI nhận xét?
