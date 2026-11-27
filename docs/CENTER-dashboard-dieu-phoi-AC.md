# CENTER · Dashboard quản trị trung tâm và Bảng điều phối lịch

> Acceptance criteria, viết trước khi code theo CLAUDE.md §6. Nối tiếp `docs/CENTER-schedule-attendance-AC.md` (C1–C6, G–K).
> Feature ID `CENTER.L` (dashboard) và `CENTER.M` (bảng điều phối) là **tạm**, đổi khi SPEC.docx được cập nhật.
> **Trạng thái (2026-11-27): đã chốt Q1–Q5 theo đề xuất. L0 và M đã code, chưa commit, đã xem trên dev (desktop và điện thoại). L (dashboard) chưa làm.**
>
> **Khác với bản nháp khi làm (đã thử và chốt tay):**
> - **M2.3 mức Tuần** vẽ dạng **ô chứa thẻ xếp dọc theo giờ** (7 cột ngày × hàng), không đặt khối theo trục giờ: mỗi ngày chỉ rộng ~190 px nên khối 1,5 giờ chỉ còn ~15 px, không đọc được. Trục giờ liên tục giữ cho mức Ngày; vạch "bây giờ" ở mức Tuần chạy trong cột của hôm nay.
> - **M2.5** ngăn chi tiết có nút **"Mở buổi (điểm danh, huỷ, đổi giờ)"** tới trang buổi đã có thay vì lặp lại các nút huỷ/dạy bù/đổi giờ ngay trong ngăn; nút ngay trong ngăn để P1.
> - **M1.4** hàng ghim "Chưa có giáo viên" chỉ có khi gom theo **Giáo viên**; ở gom theo Phòng và Lớp thì buổi đó mang cờ "Chưa có giáo viên".
> - **Q1** làm đúng: OrgAdmin/Platform Admin thấy cả trường (`/org-admin/dieu-phoi`); chủ khoá và đồng giảng viên thấy khoá của mình (`/instructor/dieu-phoi`); người chỉ dạy và người ngoài bị từ chối ở máy chủ.
> - Hàm bố cục (xếp làn, quy đổi vị trí) đặt ở `apps/web/src/lib/boardLayout.ts` (chỉ trình duyệt dùng, không kéo Prisma vào bundle); định nghĩa nghiệp vụ ở `core-lms/courses/centerBoardCalc.ts`.
> - **Hàng theo Trình độ** (thầy yêu cầu 27/11): mỗi dòng một trình độ (HSK 1, HSK 2…), **mặc định**. Khoá chưa có trường trình độ riêng nên rút theo thứ tự: trình độ đầu ra của giáo trình gốc (`CoursePack.outcomeLevel`) › "HSK n"/"Cấp n" trong tên khoá › mức CEFR (`Course.levelBand`) › "Chưa rõ trình độ" (hàng cuối). Hàng sắp theo số (HSK 2 trước HSK 10). Muốn chính xác hơn cần thêm trường trình độ cho khoá (chưa làm).
> - **Nhiều lớp song song buổi tối** (thầy nêu 27/11): có **dải "Lớp song song"** dưới tiêu đề mức Ngày (số lớp chạy cùng lúc theo ô 30 phút, đậm dần) và dòng "Cao điểm 19:30: 16 lớp song song"; mức Tuần ghi "đồng thời tối đa n lớp" ở đầu mỗi ngày. **Chế độ "Gọn"** (mỗi buổi một dòng) tự bật khi có hàng chồng quá 5 làn, đổi tay bằng nút "Đủ / Gọn". Có ô **"Tìm lớp…"**. Chưa làm: thu gọn từng hàng kiểu "+n lớp nữa" (hiện đã gọn bằng chế độ Gọn; cần thì làm sau).
> - **Rà soát logic (27/11):** (1) quản trị trường không có tên trong khoá **xem** được bảng nhưng không **mở** được trang buổi/lớp (các trang đó kiểm quyền theo khoá), nên `canManage` chỉ đúng với Platform Admin, chủ khoá, đồng giảng viên và giao diện không dẫn tới trang bị chuyển đi; (2) cờ "giáo viên chưa bắt đầu buổi" tính cả buổi đã dạy mà không ai bấm, khớp "Không check-in" của đối chiếu C5.4; (3) trang chủ khoá kiểm tổ chức đã bật tính năng trung tâm; (4) quản trị nhiều trường và Platform Admin chọn trường bằng `?truong=`; (5) ngày không phải hôm nay thì tự cuộn tới buổi đầu của ngày.
> - **Màu:** gom về họ màu thương hiệu: đang diễn ra lime đậm, sắp tới nền xanh thương hiệu nhạt, đã dạy xám ấm, quá giờ hổ phách, huỷ nét đứt; tiêu đề xanh đậm; vạch "bây giờ" màu hồng Limio.
> - Tên thứ dùng bảng cố định, **không** dùng `Intl` (ICU máy chủ viết "Th 6", trình duyệt viết "Thứ 6" làm vỡ hydration).
>
> **Mục tiêu:** người quản trị trung tâm (OrgAdmin) mở Limio và trả lời được trong vài giây: *hôm nay có buổi nào hỏng không, ai trễ, ai bỏ học, lớp nào sắp hết*, và *nhìn cả lịch như bảng phát sóng truyền hình*: vạch "bây giờ" chạy dọc, mỗi khối ngang là một buổi (hoặc cả vòng đời một lớp) từ lúc bắt đầu đến lúc kết thúc.
>
> **Không** làm: học phí, doanh thu, công nợ, lương, CRM tuyển sinh (đã loại ở "Ngoài phạm vi" của tài liệu CENTER). Không có dữ liệu mới nào bắt buộc ở bản đầu: mọi con số tính từ bảng đã có (`ClassMeeting`, `ClassSchedule(Slot)`, `StudentAttendance`, `TeacherCheckIn`, `Enrollment`, `CourseInstructor`, `LearningEvent`).

## Quyết định đã chốt (2026-11-27)

1. Hai phần dùng **chung một nguồn dữ liệu và một bộ định nghĩa** (mục L0): con số trên dashboard bấm vào là nhảy tới đúng các khối trên bảng điều phối, không có hai cách đếm khác nhau.
2. Bản đầu **chỉ xem và bấm xem chi tiết**; sửa từng buổi dùng lại thao tác C1 có sẵn. **Kéo thả để sau** (P1).
3. Trình bày theo ngôn ngữ **"điều phối và hỗ trợ"**, không phải "giám sát nhân viên" (cùng tinh thần C5.9).

## Câu hỏi còn mở (cần chủ dự án chốt trước khi code)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Ai xem được? Chủ trung tâm nhỏ thường kiêm giáo viên và có thể **không phải OrgAdmin** | OrgAdmin và Platform Admin; chủ khoá (`manage`) xem được trong phạm vi các khoá của mình |
| Q2 | Phòng hiện là ô chữ tự do (`room`), chưa có danh mục phòng | Bản đầu gom theo tên đã chuẩn hoá (bỏ khoảng trắng thừa, không phân biệt hoa thường); bảng phòng riêng (sức chứa, cơ sở) để sau |
| Q3 | Ngưỡng cảnh báo | Mặc định: vắng liên tiếp **2** buổi; chuyên cần thấp **< 70%**; lớp sắp kết thúc **≤ 3** buổi; cấu hình theo tổ chức |
| Q4 | Kéo thả đổi giờ/giáo viên | P1, sau khi bản xem dùng ổn |
| Q5 | Vị trí trong menu | Thêm hai mục vào `OrgAdminSidebar`: "Tổng quan trung tâm", "Điều phối lịch"; chỉ hiện khi `Organization.centerEnabled` |

## Tiêu chí chung

- [ ] Viết test từ checklist rồi mới code; hàm tính (định nghĩa chỉ số, xếp làn, quy đổi giờ → vị trí) là **hàm thuần** có test riêng, không phụ thuộc giao diện.
- [ ] Mọi giờ theo `Asia/Ho_Chi_Minh` qua `lib/datetime.ts`; "hôm nay", "tuần này" cắt theo giờ Việt Nam.
- [ ] Phạm vi dữ liệu = các khoá có `organizationId` của tổ chức đang xem. Platform Admin chọn tổ chức; người khác chỉ thấy tổ chức mình quản trị. Truy cập sai tổ chức trả 403/404 như các trang `/org-admin` khác.
- [ ] Chỉ **đọc** (bản đầu). Không UPDATE/DELETE `LearningEvent`; không thêm bảng nào ngoài cấu hình ngưỡng (L6).
- [ ] Danh sách nêu **tên học viên** (L4) chỉ hiện cho người có quyền ở mục trên, không vào export mặc định, không vào log; mở danh sách phát `center.risk_list.viewed` tối đa **một lần mỗi người mỗi ngày** (payload chỉ id tổ chức và số dòng, **không tên**). Namespace `center.*` **không** tính là hoạt động học (thêm vào `NON_LEARNER_ACTIVITY_PREFIXES`).
- [ ] Giao diện theo §4.6: responsive, sidebar thành drawer dưới `lg`; thuật ngữ §4.6.1; dùng `<EmptyState>`, `<StatusBadge>`, `<DateTime>`, `<Skeleton*>`.
- [ ] Mục menu/trang mới ⇒ cập nhật `GIAO-DIEN.md`, `teacherAssistantGuide.ts` (có `useCases`), `ASSISTANT_DESTINATIONS`; `teacherAssistantFreshness.test.ts` xanh (§4.9).
- [ ] Xem bằng mắt trên mobile và desktop trước khi báo xong; mỗi giai đoạn kết thúc bằng một điểm dừng để review.

Thứ tự làm: **L0 → M → L**. Bảng điều phối (M) trước vì có sẵn nhiều dữ liệu nhất và là thứ chủ dự án muốn thấy; dashboard (L) dựng trên cùng định nghĩa.

---

## L0 · Định nghĩa dùng chung (nền tảng, hàm thuần)

- [ ] **L0.1 Trạng thái hiển thị của một buổi** (một giá trị duy nhất, tính khi đọc, thứ tự ưu tiên): `cancelled` (huỷ) › `held` (đã dạy) › `live` (đang diễn ra: `startsAt ≤ now < endsAt`, chưa `held`) › `overdue` (đã qua `endsAt` mà chưa `held`: chưa kết thúc buổi) › `upcoming` (sắp tới).
- [ ] **L0.2 Cờ cần chú ý** (một buổi có thể có nhiều cờ): `no_teacher` (không có giáo viên dự kiến), `no_checkin` (đã qua `startsAt` + ngưỡng C5.4 mà giáo viên dự kiến chưa check-in), `late` / `substitute` (theo C5.4), `no_attendance` (buổi `held` nhưng chưa điểm danh, C5.5), `room_clash` / `teacher_clash` (trùng phòng / giáo viên, dùng lại phát hiện của C1.7).
- [ ] **L0.3 Chuyên cần** = (có + trễ) ÷ (có + trễ + vắng); **vắng có phép loại khỏi mẫu số** (đúng ghi chú `AttendanceStatus.excused`); buổi huỷ và buổi chưa điểm danh không tính.
- [ ] **L0.4 Vắng liên tiếp N** = N buổi `held` gần nhất của học viên **ở cùng một lớp** đều `absent`; `excused` và buổi huỷ **bị bỏ qua** (không cắt chuỗi, không cộng vào chuỗi).
- [ ] **L0.5 Vòng đời lớp**: `start` = `startsAt` buổi đầu (không huỷ); `end` = `endsAt` buổi cuối (không huỷ, tính cả buổi dạy bù); tiến độ = số buổi `held` ÷ tổng số buổi không huỷ; trạng thái lớp: `planned` (chưa có buổi nào bắt đầu), `running`, `finished` (mọi buổi `held` hoặc huỷ), `no_schedule` (chưa đặt lịch).
- [ ] **L0.6** Mỗi định nghĩa có test với dữ liệu biên: buổi đúng 0 giây qua `endsAt`, chuỗi vắng bị cắt bởi `present`, vắng có phép xen giữa, lớp có buổi dạy bù, lớp chỉ có buổi huỷ.

---

## M · Bảng điều phối (kiểu lịch phát sóng)

**Thiết kế đề xuất:** một thành phần dùng ba mức thu phóng. Trục ngang là thời gian; **vạch dọc "bây giờ"** (đỏ, có nhãn giờ) chạy qua tất cả các hàng; mỗi **khối ngang** là một buổi (mức Ngày/Tuần) hoặc cả vòng đời một lớp (mức Kỳ), rộng đúng từ giờ bắt đầu tới giờ kết thúc. Trang `/org-admin/dieu-phoi`.

### M1 · Khung và vạch "bây giờ"
- [ ] **M1.1** Given mở trang vào ngày có buổi, when mức Ngày, then trục hiện **06:00–22:00** (mở rộng tự động nếu có buổi nằm ngoài khoảng), cuộn ngang tự đặt vạch "bây giờ" vào khoảng 1/3 chiều rộng nhìn thấy.
- [ ] **M1.2** Vạch "bây giờ" **tự dịch chuyển** mỗi 60 giây bằng đồng hồ phía trình duyệt, **không gọi máy chủ**; chỉ hiện khi "bây giờ" nằm trong khoảng đang xem; có nút "Về hiện tại".
- [ ] **M1.3** Dữ liệu tự làm mới khi mở lại tab/quay lại cửa sổ và tối đa mỗi 5 phút; có dòng "Cập nhật lúc HH:mm" và nút làm mới tay. Không dùng websocket ở bản đầu.
- [ ] **M1.4** Hàng được chọn bằng nút chuyển **Phòng · Giáo viên · Lớp** (mặc định Phòng, nhớ lựa chọn theo trình duyệt). Buổi chưa có phòng nằm ở hàng "Chưa xếp phòng"; chưa có giáo viên ở hàng "Chưa có giáo viên" (luôn hiện đầu bảng nếu có, nền cảnh báo).
- [ ] **M1.5** Hai khối chồng giờ trong cùng một hàng Phòng hoặc Giáo viên **không chồng lên nhau**: xếp thành hai làn con và gắn cờ `room_clash` / `teacher_clash` (L0.2). Hàng Lớp không có trùng.

### M2 · Khối buổi (mức Ngày và Tuần)
- [ ] **M2.1** Nội dung khối: tên lớp, số buổi ("Buổi 7"), giờ bắt đầu–kết thúc, tên giáo viên; chữ cắt gọn khi khối hẹp, đủ nội dung trong tooltip/ngăn chi tiết.
- [ ] **M2.2** Màu theo trạng thái L0.1 **và** có ký hiệu chữ/biểu tượng (không chỉ dựa vào màu): đang diễn ra (có dải tiến độ phần trăm đã trôi), sắp tới, đã dạy, quá giờ chưa kết thúc, huỷ (gạch ngang, mờ). Cờ L0.2 hiện bằng huy hiệu nhỏ ở góc khối.
- [ ] **M2.3** Mức Tuần: 7 cột ngày, mỗi ô là các khối của ngày đó theo hàng đang chọn; tuần bắt đầu **thứ hai**; có Trước/Sau/Tuần này.
- [ ] **M2.4** Bấm (hoặc Enter khi khối đang focus) mở **ngăn chi tiết** bên phải (drawer dưới `lg`): lớp, buổi số mấy, giờ, phòng, giáo viên dự kiến và thực tế, sĩ số, điểm danh đã/chưa, check-in, giáo án của buổi, liên kết tới trang lớp và trang buổi đã có.
- [ ] **M2.5** Người có quyền `manage` thấy trong ngăn chi tiết các nút **Huỷ buổi / Dạy bù / Đổi phòng, giờ, giáo viên** (gọi lại `cancelMeeting`, `addMakeupMeeting`, `updateMeeting` của C1, không viết lại luật); buổi `held` chỉ đọc. Người chỉ `teach` không thấy các nút này.
- [ ] **M2.6** Bộ lọc: theo lớp, theo giáo viên, theo khoá, ẩn buổi đã huỷ; "Chỉ buổi cần chú ý" (có cờ L0.2).

### M3 · Mức Kỳ (vòng đời lớp, kiểu Gantt dự án)
- [ ] **M3.1** Mỗi lớp là **một khối ngang** từ `start` đến `end` (L0.5), trên trục tuần/tháng; nhãn: tên lớp, giáo viên phụ trách, "đã dạy 7/24".
- [ ] **M3.2** Khối có **dải tiến độ** (phần đã `held` tô đậm, phần còn lại nhạt) và vạch "bây giờ" dọc; lớp `finished` mờ, lớp `planned` viền nét đứt, lớp `no_schedule` nằm riêng ở nhóm "Chưa đặt lịch" cuối bảng với nút "Đặt lịch" tới C1.
- [ ] **M3.3** Hàng = lớp (mặc định, sắp theo `start`); chuyển được sang gom theo **giáo viên phụ trách** hoặc **khoá**. Lọc theo trạng thái lớp (đang chạy mặc định).
- [ ] **M3.4** Khoảng xem mặc định = từ 2 tuần trước đến 3 tháng sau; kéo ngang để đi; tối đa **12 tháng** một lần tải.
- [ ] **M3.5** Bấm khối lớp mở ngăn chi tiết lớp: sĩ số, chuyên cần lớp, các buổi sắp tới (rút gọn), nút tới trang lớp. Không hiển thị tên học viên.

### M4 · Hiệu năng, truy cập, thiết bị
- [ ] **M4.1** Truy vấn theo khoảng thời gian (ngày/tuần/kỳ) và theo tổ chức, dùng các chỉ mục sẵn có `(sectionId, startsAt)`; tải **một lần cho cả khoảng**, tính vị trí và xếp làn ở trình duyệt. Chốt bằng đo: tổ chức 50 lớp × 3 buổi/tuần tải tuần trong **< 1 giây** trên dev (ghi số đo vào tài liệu này).
- [ ] **M4.2** Chạm được trên điện thoại: dưới `lg` mức Ngày đổi sang **danh sách dọc theo giờ** (agenda), nhãn hàng dính bên trái khi cuộn ngang ở mức Tuần/Kỳ; không có thao tác nào chỉ làm được bằng chuột (điều hướng bằng phím mũi tên giữa các khối, Esc đóng ngăn).
- [ ] **M4.3** Trạng thái rỗng và lỗi dùng `<EmptyState>` ("Chưa có buổi nào trong khoảng này", nút đặt lịch); tải bằng `<Skeleton*>`; lỗi tải không làm mất khung bảng.
- [ ] **M4.4** Quyền: người không quản trị tổ chức, hoặc tổ chức chưa bật `centerEnabled`, bị chuyển về trang `/org-admin` như G5; API trả 403.

**P1 của M:** kéo thả đổi giờ/giáo viên (có kiểm trùng trước khi thả, hoàn tác 1 bước); xuất ảnh/PDF bảng tuần để dán ở quầy; chia sẻ bản "chỉ xem" cho giáo viên. **P2:** bảng phòng (sức chứa, cơ sở) và gợi ý xếp phòng tránh trùng.

---

## L · Dashboard quản trị trung tâm

**Thiết kế đề xuất:** trang `/org-admin/tong-quan` gồm một dải thẻ số ở đầu, rồi bốn khối. Mỗi thẻ số bấm được: tới danh sách chi tiết (L4) hoặc tới bảng điều phối đã lọc đúng các buổi đó (M2.6). Có chọn khoảng thời gian: Hôm nay / Tuần này / 30 ngày / Tuỳ chọn.

### L1 · Hôm nay trung tâm có ổn không
- [ ] **L1.1** Thẻ số cho ngày hôm nay: số buổi **đang diễn ra / sắp tới / đã dạy / huỷ** (L0.1).
- [ ] **L1.2** Ba thẻ cảnh báo (số lớn, đỏ khi > 0): **buổi chưa có giáo viên**; **giáo viên chưa check-in** dù quá giờ; **buổi đã dạy chưa điểm danh**. Bấm = bảng điều phối lọc đúng các buổi đó.
- [ ] **L1.3** Thẻ "Trùng phòng / trùng giáo viên" trong 7 ngày tới (L0.2).
- [ ] **L1.4** Given hôm nay không có buổi nào, then hiện trạng thái rỗng rõ ràng ("Hôm nay không có buổi học"), không hiện các số 0 như lỗi.

### L2 · Giáo viên
- [ ] **L2.1** Bảng theo giáo viên trong khoảng chọn: số buổi đã dạy, đúng giờ / trễ / dạy thay / không check-in (cùng quy tắc C5.4, **tái dùng** `getOrgReconciliation`, không tính lại).
- [ ] **L2.2** **Tải dạy**: số giờ đã dạy trong khoảng và số giờ đã xếp trong 7 ngày tới, mỗi giáo viên; làm nổi bật người quá tải (vượt ngưỡng giờ/tuần cấu hình) và người chưa được xếp buổi nào.
- [ ] **L2.3** Giáo viên vừa được thêm nhưng chưa có buổi nào, và giáo viên vừa bị gỡ còn việc dang dở: nhóm "Cần xếp lại" (liên quan thao tác gỡ quyền kèm bàn giao ở `removeCoInstructor`).
- [ ] **L2.4** Cách trình bày là "đối chiếu để xếp dạy bù" (C5.9); không xếp hạng giáo viên, không có cột điểm.

### L3 · Lớp và học viên
- [ ] **L3.1** Bảng lớp: sĩ số, số buổi đã dạy/tổng, chuyên cần (L0.3), số buổi chưa điểm danh; sắp mặc định theo chuyên cần tăng dần; đánh dấu lớp dưới ngưỡng Q3.
- [ ] **L3.2** **Lớp sắp kết thúc** (còn ≤ ngưỡng buổi): danh sách kèm ngày buổi cuối, để trung tâm chốt tái đăng ký.
- [ ] **L3.3** Biểu đồ chuyên cần theo tuần (toàn trung tâm và từng lớp) trong khoảng chọn; trục tuần theo giờ Việt Nam.
- [ ] **L3.4** Tỉ lệ buổi đã **gửi tổng kết** và **gửi nhận xét** cho học viên (C4), toàn trung tâm và theo giáo viên.
- [ ] **L3.5** Mục tiêu học tập (C6): số học viên **đúng tiến độ / chậm / chưa đặt mục tiêu** theo lớp.

### L4 · Học viên cần liên hệ
- [ ] **L4.1** Danh sách học viên **vắng liên tiếp ≥ N** (L0.4): họ tên, lớp, số buổi vắng liên tiếp, buổi vắng gần nhất; bấm vào mở trang học viên đã có. Mở danh sách này phát `center.risk_list.viewed` (xem tiêu chí chung).
- [ ] **L4.2** Danh sách học viên có chuyên cần < ngưỡng trong khoảng chọn; không trùng dòng với L4.1 (gộp một dòng, ghi cả hai lý do).
- [ ] **L4.3** Không gửi tin nhắn tự động từ dashboard ở bản đầu; chỉ có liên kết tới nơi liên hệ đã có.

### L5 · Học liệu giữa các buổi
- [ ] **L5.1** Hoạt động học trên Limio giữa các buổi theo lớp: số học viên đã vào làm bài / chưa vào trong 7 ngày qua (từ `LearningEvent`, loại namespace giáo viên bằng `learnerActivityWhere()`).
- [ ] **L5.2** **Lớp chậm so với giáo trình** (P1, cần ánh xạ buổi ↔ chương từ K): so buổi đã dạy với phân phối chương trình.

### L6 · Cấu hình ngưỡng
- [ ] **L6.1** Ngưỡng Q3 lưu theo tổ chức (một dòng cấu hình, OrgAdmin sửa; mặc định như bảng Q3); sửa ghi `AuditLog` `org.center_thresholds_changed` với giá trị cũ/mới.
- [ ] **L6.2** Đổi ngưỡng áp ngay cho mọi số liệu (tính khi đọc, không lưu cứng), kể cả dữ liệu cũ.

### L7 · Hiệu năng và độ đúng
- [ ] **L7.1** Mỗi khối dữ liệu là **một truy vấn tổng hợp** có chỉ mục (không N+1 theo lớp/học viên); trang tải được từng khối độc lập (khối lỗi không làm hỏng cả trang). Đo: tổ chức 50 lớp, 1.000 học viên, 30 ngày: toàn trang **< 3 giây** trên dev (ghi số đo).
- [ ] **L7.2** Số trên thẻ và số trên bảng điều phối **luôn khớp** vì dùng chung hàm L0 (có test đối chiếu cùng một bộ dữ liệu).
- [ ] **L7.3** Mọi con số có chú thích "tính thế nào" (tooltip ngắn), đặc biệt chuyên cần (vắng có phép không tính) và vắng liên tiếp.

**P1 của L:** xuất Excel từng bảng; thông báo email tóm tắt mỗi sáng thứ hai cho chủ trung tâm; so sánh với kỳ trước; ngưỡng theo từng lớp. **Ngoài phạm vi:** doanh thu, học phí, tuyển sinh, xếp hạng giáo viên theo điểm.

---

## Cách kiểm

1. **Hàm thuần** (L0, quy đổi giờ → vị trí, xếp làn, phát hiện trùng): test đơn vị trong `core-lms` và `apps/web/src/lib`, không cần DB.
2. **Dịch vụ** (truy vấn tổng hợp theo tổ chức): test với DB test, ít nhất: hai tổ chức không rò dữ liệu cho nhau; buổi huỷ/dạy bù/`held`; giáo viên bị gỡ; `centerEnabled = false` bị chặn.
3. **Giao diện**: kiểm trên dev bằng mắt, mobile và desktop: vạch "bây giờ" đúng giờ Việt Nam (đổi múi giờ máy thử), khối đang diễn ra có dải tiến độ, hai buổi trùng phòng tách làn và có cờ, mức Kỳ cuộn ngang mượt, đổi hàng Phòng/Giáo viên/Lớp.
4. **Quyền**: người ngoài tổ chức, giáo viên thường, học viên đều bị từ chối.
5. **Trợ lý Lily**: `teacherAssistantFreshness.test.ts` xanh sau khi thêm mục.

## Việc cần xác minh khi bắt đầu code

- Chỉ mục thực tế của `ClassMeeting` cho truy vấn "mọi buổi của tổ chức trong khoảng": hiện có `(sectionId, startsAt)` và `(plannedTeacherId, startsAt)`; truy vấn theo tổ chức đi qua `CourseSection → Course.organizationId` nên có thể cần chỉ mục hoặc truy vấn hai bước (lấy danh sách `sectionId` của tổ chức rồi lọc theo khoảng giờ). Đo bằng `EXPLAIN` trước khi chốt.
- Chuẩn hoá tên phòng (Q2): kiểm dữ liệu thật của một trung tâm đang dùng xem có bao nhiêu biến thể cùng một phòng.
- Quyền Q1: chủ trung tâm kiêm giáo viên có đang là OrgAdmin không; nếu không, cách cấp quyền hiện tại là gì.
