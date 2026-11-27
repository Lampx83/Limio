import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, GraduationCap, UserRound, Users } from "lucide-react";
import type { OrgOverview } from "@feedbackme/core-lms";
import { formatDayKey } from "@/lib/datetime";
import { vnDayKey } from "./boardModel";

/**
 * Tổng quan trung tâm (CENTER L): hôm nay có ổn không, lớp, giáo viên, học viên cần liên hệ. Chỉ vẽ; số đã tính ở `getOrgOverview`
 * (dùng chung định nghĩa với bảng điều phối). Giọng "điều phối và hỗ trợ": không xếp hạng giáo viên, không tự gửi tin cho học viên.
 */
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
const dayLabel = (iso: string | null) => (iso ? formatDayKey(vnDayKey(new Date(iso))) : "—");

function Stat({ label, value, tone }: { label: string; value: number; tone?: "live" }) {
  return (
    <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] px-4 py-3">
      <p className={`text-3xl font-bold tabular-nums ${tone === "live" && value > 0 ? "text-lime-700 dark:text-lime-300" : ""}`}>{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

function Alert({ label, hint, value, href }: { label: string; hint: string; value: number; href: string }) {
  const bad = value > 0;
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border px-4 py-3 transition-colors ${bad ? "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30" : "border-token bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-muted))]"}`}
      title={hint}
    >
      <div className="flex items-center gap-2">
        {bad ? <AlertTriangle size={18} className="text-amber-600" aria-hidden /> : <CheckCircle2 size={18} className="text-lime-600" aria-hidden />}
        <span className={`text-3xl font-bold tabular-nums ${bad ? "text-amber-800 dark:text-amber-200" : "text-muted"}`}>{value}</span>
      </div>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
      <p className="text-xs text-muted">{bad ? "Bấm để xem các buổi này" : "Ổn"}</p>
    </Link>
  );
}

function SectionHead({ icon: Icon, title, hint, right }: { icon: typeof Users; title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon size={18} className="text-brand-600" aria-hidden /> {title}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-2 text-sm";

export default function OverviewView({ o, boardPath, reconPath }: { o: OrgOverview; boardPath: string; reconPath: string }) {
  const board = (q: string) => `${boardPath}${boardPath.includes("?") ? "&" : "?"}${q}`;
  const t = o.todayCounts;
  const th = o.thresholds;
  const endingSoon = o.classes.filter((c) => c.endingSoon);

  return (
    <div className="space-y-10">
      <section aria-labelledby="hom-nay">
        <SectionHead icon={CalendarDays} title="Hôm nay" hint={`${formatDayKey(o.today)}, giờ Việt Nam`} right={<Link href={board("che_do=ngay")} className="btn-pill">Mở bảng điều phối</Link>} />
        {t.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-token p-6 text-center text-sm text-muted">Hôm nay không có buổi học.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Đang diễn ra" value={t.live} tone="live" />
            <Stat label="Sắp tới" value={t.upcoming} />
            <Stat label="Đã dạy" value={t.held} />
            <Stat label="Quá giờ, chưa kết thúc" value={t.overdue} />
            <Stat label="Đã huỷ" value={t.cancelled} />
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Alert label="Buổi tới chưa có giáo viên" hint="Từ bây giờ tới 7 ngày tới, buổi chưa có giáo viên dự kiến và lớp cũng chưa có giáo viên phụ trách." value={o.alerts.noTeacher} href={board("che_do=tuan&chu_y=no_teacher")} />
          <Alert label="Giáo viên chưa bắt đầu buổi" hint="Buổi hôm nay đã quá giờ bắt đầu mà giáo viên dự kiến chưa bấm Bắt đầu buổi." value={o.alerts.noCheckIn} href={board("che_do=ngay&chu_y=no_checkin")} />
          <Alert label="Buổi đã dạy chưa điểm danh" hint="Buổi đã kết thúc trong 7 ngày qua mà chưa có dòng điểm danh nào." value={o.alerts.noAttendance} href={board("che_do=tuan&chu_y=no_attendance")} />
          <Alert label="Trùng phòng hoặc giáo viên" hint="Từ hôm nay tới 6 ngày tới: hai buổi cùng phòng hoặc cùng giáo viên chồng giờ nhau." value={o.alerts.clashes} href={board("che_do=tuan&chu_y=clash")} />
        </div>
      </section>

      <section aria-labelledby="lop">
        <SectionHead icon={GraduationCap} title="Lớp" hint={`Chuyên cần ${th.windowDays} ngày gần nhất, lớp thấp nhất đứng đầu. Dưới ${Math.round(th.lowAttendance * 100)}% là thấp.`} right={endingSoon.length > 0 ? <span className="chip-brand">{endingSoon.length} lớp sắp kết thúc</span> : undefined} />
        {o.classes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-token p-6 text-center text-sm text-muted">Chưa có lớp nào đang chạy hoặc sắp chạy.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-token">
            <table className="w-full min-w-[44rem]">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr>
                  <th className={TH}>Lớp</th>
                  <th className={TH}>Giáo viên</th>
                  <th className={`${TH} text-right`}>Sĩ số</th>
                  <th className={TH}>Tiến độ</th>
                  <th className={`${TH} text-right`}>Chuyên cần</th>
                  <th className={`${TH} text-right`}>Chưa điểm danh</th>
                  <th className={TH}>Kết thúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {o.classes.map((c) => (
                  <tr key={c.sectionId}>
                    <td className={TD}>
                      {c.canManage ? (
                        <Link href={`/instructor/courses/${c.courseId}/sections/${c.sectionId}`} className="font-medium hover:underline">{c.name}</Link>
                      ) : (
                        <span className="font-medium">{c.name}</span>
                      )}
                      <span className="block text-xs text-muted">{c.level ?? c.courseTitle}</span>
                    </td>
                    <td className={TD}>{c.teacher?.name ?? <span className="text-amber-700 dark:text-amber-400">Chưa có</span>}</td>
                    <td className={`${TD} text-right tabular-nums`}>{c.enrolled}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" aria-hidden>
                          <span className="block h-full bg-brand-500" style={{ width: `${c.total ? (c.held / c.total) * 100 : 0}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-muted">{c.held}/{c.total}</span>
                      </div>
                    </td>
                    <td className={`${TD} text-right tabular-nums ${c.attendanceLow ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`} title={c.attendanceRate === null ? "Chưa đủ lượt điểm danh để kết luận" : undefined}>
                      {pct(c.attendanceRate)}
                    </td>
                    <td className={`${TD} text-right tabular-nums ${c.unmarked > 0 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted"}`}>{c.unmarked}</td>
                    <td className={TD}>
                      {dayLabel(c.end)}
                      {c.endingSoon && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">Sắp kết thúc</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="giao-vien">
        <SectionHead
          icon={UserRound}
          title="Giáo viên"
          hint={`Để xếp lịch và dạy bù, không phải xếp hạng. Đối chiếu ${th.windowDays} ngày gần nhất; giờ đã xếp là 7 ngày tới.`}
          right={<Link href={reconPath} className="btn-pill">Đối chiếu lịch dạy</Link>}
        />
        {o.teachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-token p-6 text-center text-sm text-muted">Chưa có giáo viên nào trong các khoá của trường.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-token">
            <table className="w-full min-w-[44rem]">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr>
                  <th className={TH}>Giáo viên</th>
                  <th className={`${TH} text-right`}>Buổi đã dạy</th>
                  <th className={`${TH} text-right`}>Giờ đã dạy</th>
                  <th className={`${TH} text-right`}>Giờ đã xếp</th>
                  <th className={`${TH} text-right`}>Đúng giờ</th>
                  <th className={`${TH} text-right`}>Trễ</th>
                  <th className={`${TH} text-right`}>Dạy thay</th>
                  <th className={`${TH} text-right`}>Không bắt đầu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {o.teachers.map((g) => (
                  <tr key={g.teacherId}>
                    <td className={TD}>
                      <span className="font-medium">{g.name}</span>
                      {g.unassigned && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">Chưa có buổi nào</span>}
                      {g.overloaded && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">Nhiều việc</span>}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{g.meetings}</td>
                    <td className={`${TD} text-right tabular-nums`}>{g.hoursTaught}</td>
                    <td className={`${TD} text-right tabular-nums ${g.overloaded ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}>{g.hoursPlanned}</td>
                    <td className={`${TD} text-right tabular-nums`}>{g.onTime}</td>
                    <td className={`${TD} text-right tabular-nums`}>{g.late}</td>
                    <td className={`${TD} text-right tabular-nums`}>{g.substitute}</td>
                    <td className={`${TD} text-right tabular-nums`}>{g.noCheckIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="hoc-vien">
        <SectionHead
          icon={Users}
          title="Học viên cần liên hệ"
          hint={`Vắng liền ${th.consecutiveAbsences} buổi trở lên, hoặc chuyên cần dưới ${Math.round(th.lowAttendance * 100)}% trong ${th.windowDays} ngày. Chỉ quản trị trường thấy danh sách này; Limio không tự gửi tin.`}
          right={o.atRiskTotal > 0 ? <span className="chip">{o.atRiskTotal} học viên</span> : undefined}
        />
        {o.atRisk.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-token p-6 text-center text-sm text-muted">Hiện không có học viên nào cần liên hệ.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-token">
            <table className="w-full min-w-[40rem]">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr>
                  <th className={TH}>Học viên</th>
                  <th className={TH}>Lớp</th>
                  <th className={`${TH} text-right`}>Vắng liên tiếp</th>
                  <th className={`${TH} text-right`}>Chuyên cần</th>
                  <th className={TH}>Vắng gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {o.atRisk.map((s) => (
                  <tr key={`${s.userId}-${s.sectionId}`}>
                    <td className={`${TD} font-medium`}>{s.name}</td>
                    <td className={TD}>
                      <Link href={`/instructor/courses/${s.courseId}/sections/${s.sectionId}?tab=hoc-vien`} className="hover:underline">{s.sectionName}</Link>
                    </td>
                    <td className={`${TD} text-right tabular-nums ${s.reasons.includes("consecutive") ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted"}`}>{s.consecutive}</td>
                    <td className={`${TD} text-right tabular-nums ${s.reasons.includes("low_rate") ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}>{pct(s.attendanceRate)}</td>
                    <td className={TD}>{dayLabel(s.lastAbsentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {o.atRiskTotal > o.atRisk.length && <p className="mt-2 text-xs text-muted">Đang hiện {o.atRisk.length} trong {o.atRiskTotal} học viên, nặng nhất trước.</p>}
      </section>

      <details className="rounded-2xl border border-token p-4 text-sm">
        <summary className="cursor-pointer font-medium">Các số được tính thế nào</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li><strong>Chuyên cần</strong> = (có mặt + trễ) ÷ (có mặt + trễ + vắng). Vắng có phép không tính; buổi huỷ và buổi chưa điểm danh không tính. Cần ít nhất {th.minMarksForRate} lượt điểm danh mới hiện số.</li>
          <li><strong>Vắng liên tiếp</strong>: các buổi đã dạy gần nhất của học viên trong cùng một lớp đều vắng; vắng có phép và buổi huỷ bị bỏ qua, không làm đứt chuỗi.</li>
          <li><strong>Sắp kết thúc</strong>: lớp đang chạy còn không quá {th.endingSoonMeetings} buổi chưa dạy.</li>
          <li><strong>Nhiều việc</strong>: giờ đã xếp trong 7 ngày tới vượt {th.overloadHoursPerWeek} giờ. <strong>Chưa có buổi nào</strong>: chưa dạy buổi nào trong {th.windowDays} ngày và chưa được xếp buổi sắp tới.</li>
          <li>Các thẻ cảnh báo và số buổi hôm nay dùng cùng định nghĩa với Bảng điều phối, nên khớp từng buổi.</li>
        </ul>
      </details>
    </div>
  );
}
