import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { slugify } from "@feedbackme/core-lms";
import {
  ROBOTO_REGULAR_VIETNAMESE_DATA_URL,
  ROBOTO_BOLD_VIETNAMESE_DATA_URL,
} from "@/assets/fonts/robotoFontData";

// A6.6 — Xuất PDF 1 phiên vấn đáp AI để lưu trữ. Font mặc định của
// @react-pdf/renderer (Helvetica) không có dấu tiếng Việt, nên phải đăng ký
// font riêng — nhúng base64 thay vì đọc file trên đĩa vì Next.js standalone
// output (next.config.js) không trace được đường dẫn fs tuỳ ý.
let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: ROBOTO_REGULAR_VIETNAMESE_DATA_URL, fontWeight: "normal" },
      { src: ROBOTO_BOLD_VIETNAMESE_DATA_URL, fontWeight: "bold" },
    ],
  });
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 40, fontFamily: "Roboto", fontSize: 10 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 8 },
  metaRow: { fontSize: 10, marginBottom: 2 },
  section: { marginTop: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  scoreBox: { padding: 8, backgroundColor: "#f4f4f5", borderRadius: 4, marginBottom: 4 },
  scoreText: { fontSize: 12, fontWeight: "bold" },
  notesText: { fontSize: 10, marginTop: 4, lineHeight: 1.4 },
  aiBox: { padding: 8, backgroundColor: "#f5f3ff", borderRadius: 4, marginBottom: 4 },
  aiLabel: { fontSize: 8, fontWeight: "bold", color: "#6d28d9", marginBottom: 3 },
  breakdownItem: { fontSize: 9, marginTop: 2, lineHeight: 1.3 },
  turn: { marginBottom: 6, padding: 6, borderRadius: 4 },
  turnExaminer: { backgroundColor: "#f4f4f5" },
  turnStudent: { backgroundColor: "#e0f2fe" },
  turnRole: { fontSize: 8, fontWeight: "bold", color: "#555", marginBottom: 2 },
  turnContent: { fontSize: 10, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

interface RubricBreakdownItem {
  topic: string;
  note: string;
}

export interface OralExamPdfTurn {
  role: "examiner" | "student";
  content: string;
}

export interface OralExamPdfProps {
  examTitle: string;
  courseTitle: string | null;
  studentName: string;
  studentEmail: string | null;
  submittedAtLabel: string | null;
  gradedAtLabel: string | null;
  graded: boolean;
  instructorScore: number | null;
  instructorNotes: string | null;
  aiSuggestedScore: number | null;
  aiSummary: string | null;
  aiRubricBreakdown: RubricBreakdownItem[] | null;
  turns: OralExamPdfTurn[];
  generatedAtLabel: string;
}

export function OralExamPdfDocument(props: OralExamPdfProps) {
  ensureFontRegistered();
  const {
    examTitle,
    courseTitle,
    studentName,
    studentEmail,
    submittedAtLabel,
    gradedAtLabel,
    graded,
    instructorScore,
    instructorNotes,
    aiSuggestedScore,
    aiSummary,
    aiRubricBreakdown,
    turns,
    generatedAtLabel,
  } = props;

  return (
    <Document
      title={`Vấn đáp - ${examTitle} - ${studentName}`}
      author="FeedBackMe"
      creator="FeedBackMe"
    >
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{examTitle}</Text>
        {courseTitle && <Text style={styles.subtitle}>{courseTitle}</Text>}
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.metaRow}>Học viên: {studentName}{studentEmail ? ` (${studentEmail})` : ""}</Text>
          {submittedAtLabel && <Text style={styles.metaRow}>Nộp bài lúc: {submittedAtLabel}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Điểm & nhận xét</Text>
          {graded ? (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreText}>Điểm chính thức: {instructorScore} / 100</Text>
              {gradedAtLabel && <Text style={styles.notesText}>Chấm lúc: {gradedAtLabel}</Text>}
              {instructorNotes && <Text style={styles.notesText}>Nhận xét: {instructorNotes}</Text>}
            </View>
          ) : (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreText}>Chưa chấm chính thức</Text>
            </View>
          )}
          {aiSuggestedScore !== null && (
            <View style={styles.aiBox}>
              <Text style={styles.aiLabel}>
                AI đề xuất (chỉ tham khảo nội bộ giảng viên — không phải điểm chính thức)
              </Text>
              <Text style={styles.notesText}>Điểm AI đề xuất: {aiSuggestedScore} / 100</Text>
              {aiSummary && <Text style={styles.notesText}>{aiSummary}</Text>}
              {aiRubricBreakdown && aiRubricBreakdown.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  {aiRubricBreakdown.map((b, i) => (
                    <Text key={i} style={styles.breakdownItem}>
                      • {b.topic}: {b.note}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toàn bộ hội thoại</Text>
          {turns.length === 0 ? (
            <Text style={styles.notesText}>Chưa có lượt hỏi-đáp nào.</Text>
          ) : (
            turns.map((t, i) => (
              <View
                key={i}
                style={[styles.turn, t.role === "examiner" ? styles.turnExaminer : styles.turnStudent]}
                wrap={false}
              >
                <Text style={styles.turnRole}>{t.role === "examiner" ? "AI giám khảo" : "Sinh viên"}</Text>
                <Text style={styles.turnContent}>{t.content}</Text>
              </View>
            ))
          )}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Xuất lúc ${generatedAtLabel} — Trang ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

/** Tên file có nghĩa: vandap_{de-thi}_{hoc-vien}_{ngay-nop}.pdf */
export function buildOralExamPdfFilename(
  examTitle: string,
  studentName: string,
  submittedAt: Date | null,
): string {
  const dateStr = (submittedAt ?? new Date()).toISOString().slice(0, 10);
  const examSlug = slugify(examTitle) || "de-thi";
  const studentSlug = slugify(studentName) || "hoc-vien";
  return `vandap_${examSlug}_${studentSlug}_${dateStr}.pdf`;
}
