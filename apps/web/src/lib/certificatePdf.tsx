import { Document, Page, Text, View, StyleSheet, Font, Svg, Circle, Ellipse, G, Line, Polygon, Image } from "@react-pdf/renderer";
import { slugify } from "@feedbackme/core-lms";
import {
  ROBOTO_REGULAR_VIETNAMESE_DATA_URL,
  ROBOTO_BOLD_VIETNAMESE_DATA_URL,
} from "@/assets/fonts/robotoFontData";

// A6 — Chứng nhận hoàn thành khoá học, xuất PDF thật. Song ngữ: trang 1
// tiếng Việt, trang 2 tiếng Anh, cùng 1 file. Bố cục học theo mẫu chứng nhận
// LinkedIn Learning — tiêu đề lớn là TÊN KHOÁ (không phải tên học viên), câu
// "hoàn thành bởi X · thời lượng", dải màu chéo 2 góc phía sau khung trắng,
// con dấu tròn kiểu huy hiệu góc dưới thay vì vòng tròn trơn — nhưng đổi màu
// theo brand Limio (watermelon: lime→pink) thay vì sao chép logo/màu LinkedIn.
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

const INK = "#1f2937";
const MUTED = "#6b7280";
const ACCENT = "#3f6212"; // deep olive-lime — restrained, reads as "official"
const ACCENT_LIGHT = "#84cc16";
const CORNER_LIME = "#ecfccb";
const CORNER_PINK = "#fce7f3";

// Kích thước trang A4 landscape ở pt (react-pdf/pdfkit dùng 72pt/inch).
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 46;

const styles = StyleSheet.create({
  // fontFeatureSettings tắt ligature (fi/fl/ff...) — font Roboto-Vietnamese
  // nhúng qua react-pdf/fontkit làm rớt ký tự khi ghép "fi" (vd "Certificate"
  // hiển thị thành "Certifcate"), một biến thể khác của lỗi subsetting đã ghi
  // ở styles.kicker bên dưới.
  page: { fontFamily: "Roboto", backgroundColor: "#ffffff", fontFeatureSettings: { liga: false } },
  // `Svg` không tự hiểu position:absolute như `View` — không bọc trong View
  // thì nó bị tính vào luồng nội dung bình thường ở chiều cao cả trang
  // (595pt), đẩy tràn nội dung thật sang trang 2 (mỗi ngôn ngữ ra 2 trang PDF
  // thay vì 1, dù JSX chỉ render đúng 2 <Page>).
  bg: { position: "absolute", top: 0, left: 0, width: PAGE_W, height: PAGE_H },
  card: {
    position: "absolute",
    top: MARGIN,
    left: MARGIN,
    right: MARGIN,
    bottom: MARGIN,
    backgroundColor: "#ffffff",
  },
  outerFrame: { flex: 1, borderWidth: 1.5, borderColor: ACCENT, borderStyle: "solid", padding: 5 },
  // justifyContent: "center" — toàn bộ nội dung là MỘT khối căn giữa theo
  // chiều dọc (kể cả hàng chữ ký/huy hiệu và dòng mã số), thay vì ghim phần
  // đầu lên trên + ghim chữ ký/mã số xuống đáy bằng position:absolute. Cách
  // ghim 2 đầu tạo ra một khoảng trắng lớn ở giữa khi chứng nhận không có
  // mục "Kỹ năng đã đạt" hay thời lượng học (khoá ngắn/demo) — trông như bị
  // hỏng bố cục dù kỹ thuật không sai.
  innerFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: ACCENT,
    borderStyle: "solid",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    paddingHorizontal: 64,
  },
  // Chữ cách tay (khoảng trắng thật giữa từng ký tự — xem hàm `tracked`),
  // KHÔNG dùng `letterSpacing` của react-pdf: kết hợp với font nhúng
  // Roboto-subset, letterSpacing làm sai lệch layer text ẩn của PDF (chữ "A"
  // và "D" bị đổi thành dấu phẩy/gạch ngang khi copy/paste hoặc đọc màn
  // hình) dù phần hiển thị vẫn đúng — một lỗi tương tác react-pdf/fontkit.
  kicker: { fontSize: 15, fontWeight: "bold", color: ACCENT, marginTop: 18 },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: INK,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 1.15,
    maxWidth: 620,
  },
  subline: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 22 },
  sublineName: { fontWeight: "bold", color: INK },
  dateLine: { fontSize: 10.5, color: "#9ca3af", textAlign: "center", marginTop: 4 },
  skillsLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 26,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 10,
    maxWidth: 560,
  },
  badge: {
    fontSize: 9.5,
    color: ACCENT,
    borderWidth: 0.75,
    borderColor: "#d9f99d",
    borderStyle: "solid",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  // Luồng bình thường (không absolute) + alignSelf: "stretch" để chiếm hết
  // bề ngang cột giữa (innerFrame alignItems:"center" co nhỏ theo nội dung
  // nếu không có stretch) — xem ghi chú ở innerFrame.
  bottomRow: {
    alignSelf: "stretch",
    marginTop: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  signatureBlock: { alignItems: "flex-start" },
  signatureRule: { width: 150, height: 0.75, backgroundColor: "#a3a3a3", marginBottom: 6 },
  issuerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  issuerLogo: { width: 22, height: 22, objectFit: "contain" },
  issuerName: { fontSize: 13, fontWeight: "bold", color: INK },
  issuerCaption: { fontSize: 8, color: MUTED, marginTop: 2 },
  footerCenter: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 14,
  },
  footerLabel: { fontSize: 7.5, color: "#9ca3af" },
  footerMono: { fontSize: 8.5, color: MUTED, marginTop: 1 },
});

const STRINGS = {
  vi: {
    kicker: "CHỨNG NHẬN HOÀN THÀNH",
    completedBy: "Hoàn thành bởi",
    skillsLabel: "KỸ NĂNG ĐÃ ĐẠT",
    issuerCaption: "Nền tảng học tập cá nhân hoá",
    certId: "Mã chứng nhận",
    verifyAt: "Xác thực tại",
    dateLocale: "vi-VN",
    hours: "giờ",
    minutes: "phút",
  },
  en: {
    kicker: "CERTIFICATE OF COMPLETION",
    completedBy: "Completed by",
    skillsLabel: "SKILLS ACHIEVED",
    issuerCaption: "Personalized Learning Platform",
    certId: "Certificate ID",
    verifyAt: "Verify at",
    dateLocale: "en-US",
    hours: "hr",
    minutes: "min",
  },
} as const;

type Locale = keyof typeof STRINGS;

/** Chèn khoảng trắng thật giữa từng ký tự — xem ghi chú ở `styles.kicker`. */
function tracked(s: string): string {
  return s.split("").join(" ");
}

function formatDuration(totalSec: number, t: (typeof STRINGS)[Locale]): string | null {
  if (totalSec < 60) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${t.hours}`);
  if (m > 0) parts.push(`${m} ${t.minutes}`);
  return parts.join(" ") || null;
}

/**
 * Lát chanh — logo thật của Limio (xem apps/web/src/components/BrandIcons.tsx
 * LimeSliceIcon), viết lại bằng primitive của react-pdf. Toạ độ gốc trong hệ
 * 32×32; ghép vào chỗ khác bằng <G transform="translate(...) scale(...)">.
 */
function LimeSliceShapes() {
  return (
    <>
      <Circle cx={16} cy={16} r={15} fill="#3F6212" />
      <Circle cx={16} cy={16} r={14} fill="#65A30D" />
      <Circle cx={16} cy={16} r={12} fill="#ECFCCB" />
      <G stroke="#84CC16" strokeWidth={1.4} strokeLinecap="round">
        <Line x1={16} y1={4.5} x2={16} y2={27.5} />
        <Line x1={4.5} y1={16} x2={27.5} y2={16} />
        <Line x1={7.9} y1={7.9} x2={24.1} y2={24.1} />
        <Line x1={24.1} y1={7.9} x2={7.9} y2={24.1} />
      </G>
      <G fill="#D9F99D" opacity={0.6}>
        <Ellipse cx={16} cy={10.5} rx={2} ry={1} />
        <Ellipse cx={16} cy={21.5} rx={2} ry={1} />
        <Ellipse cx={10.5} cy={16} rx={1} ry={2} />
        <Ellipse cx={21.5} cy={16} rx={1} ry={2} />
      </G>
      <Circle cx={16} cy={16} r={1.6} fill="#84CC16" />
      <Ellipse cx={13} cy={13} rx={0.6} ry={1} fill="#365314" />
      <Ellipse cx={19} cy={19} rx={0.6} ry={1} fill="#365314" />
    </>
  );
}

/**
 * Logo "Limio Learning" — cùng thiết kế đã chốt với
 * apps/web/src/components/BrandIcons.tsx LimioLearningLogo (lát chanh + Lim
 * đen/io hồng đúng màu AppHeader + Learning cùng lề trái), viết lại bằng
 * primitive react-pdf. Hai "Text" cạnh nhau thay vì tspan lồng nhau vì tspan
 * lồng trong Text-trong-Svg chưa được xác nhận hoạt động đúng ở react-pdf.
 */
function LimioLearningLogo() {
  return (
    <Svg width={122} height={34}>
      <G transform="translate(0,1)">
        <LimeSliceShapes />
      </G>
      <Line x1={40} y1={4} x2={40} y2={30} stroke="#d1d5db" strokeWidth={1} />
      <Text x={48} y={21} style={{ fontSize: 20, fontWeight: "bold", fill: INK }}>
        Lim
      </Text>
      <Text x={84} y={21} style={{ fontSize: 20, fontWeight: "bold", fill: "#ec4899" }}>
        io
      </Text>
      <Text x={48} y={31} style={{ fontSize: 8, fontWeight: "normal", fill: MUTED }}>
        Learning
      </Text>
    </Svg>
  );
}

/** Huy hiệu tròn kiểu "con dấu" — lát chanh giữa vòng viền + 2 dải ruy băng. */
function SealBadge() {
  const cx = 34;
  const cy = 32;
  const r = 26;
  const scale = (r * 2) / 32;
  const tx = cx - 16 * scale;
  const ty = cy - 16 * scale;
  return (
    <Svg width={68} height={92}>
      <Polygon points="20,58 27,84 34,72" fill={ACCENT} />
      <Polygon points="48,58 41,84 34,72" fill={ACCENT_LIGHT} />
      <Circle cx={cx} cy={cy} r={r + 2} fill="#ffffff" stroke={ACCENT} strokeWidth={1.5} />
      <G transform={`translate(${tx}, ${ty}) scale(${scale})`}>
        <LimeSliceShapes />
      </G>
    </Svg>
  );
}

export interface CertificatePdfProps {
  userName: string;
  courseTitle: string;
  issuerName: string;
  /** Logo của Organization (URL tuyệt đối, react-pdf fetch phía server) — null nếu không có. */
  issuerLogoUrl: string | null;
  skillBadgeNames: string[];
  issuedAt: Date;
  totalStudySec: number;
  certNumber: string;
  verifyUrl: string;
}

function CertificatePageBody(props: CertificatePdfProps & { locale: Locale }) {
  const {
    locale,
    userName,
    courseTitle,
    issuerName,
    issuerLogoUrl,
    skillBadgeNames,
    issuedAt,
    totalStudySec,
    certNumber,
    verifyUrl,
  } = props;
  const t = STRINGS[locale];
  const dateLabel = new Intl.DateTimeFormat(t.dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(issuedAt);
  const durationLabel = formatDuration(totalStudySec, t);

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.bg}>
        <Svg width={PAGE_W} height={PAGE_H}>
          <Polygon points={`0,0 ${PAGE_W * 0.42},0 0,${PAGE_H * 0.58}`} fill={CORNER_LIME} />
          <Polygon
            points={`${PAGE_W},${PAGE_H} ${PAGE_W - PAGE_W * 0.42},${PAGE_H} ${PAGE_W},${PAGE_H - PAGE_H * 0.58}`}
            fill={CORNER_PINK}
          />
        </Svg>
      </View>

      <View style={styles.card}>
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            <LimioLearningLogo />
            <Text style={styles.kicker}>{tracked(t.kicker)}</Text>

            <Text style={styles.title}>{courseTitle}</Text>

            <Text style={styles.subline}>
              {t.completedBy} <Text style={styles.sublineName}>{userName}</Text>
            </Text>
            <Text style={styles.dateLine}>
              {dateLabel}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </Text>

            {skillBadgeNames.length > 0 && (
              <>
                <Text style={styles.skillsLabel}>{tracked(t.skillsLabel)}</Text>
                <View style={styles.badgesRow}>
                  {skillBadgeNames.map((name, i) => (
                    <Text key={i} style={styles.badge}>
                      {name}
                    </Text>
                  ))}
                </View>
              </>
            )}

            <View style={styles.bottomRow}>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureRule} />
                <View style={styles.issuerRow}>
                  {issuerLogoUrl && <Image src={issuerLogoUrl} style={styles.issuerLogo} />}
                  <View>
                    <Text style={styles.issuerName}>{issuerName}</Text>
                    <Text style={styles.issuerCaption}>{t.issuerCaption}</Text>
                  </View>
                </View>
              </View>
              <SealBadge />
            </View>

            <View style={styles.footerCenter}>
              <Text style={styles.footerLabel}>
                {t.certId}: <Text style={styles.footerMono}>{certNumber}</Text>
                {"   ·   "}
                {t.verifyAt}: <Text style={styles.footerMono}>{verifyUrl}</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Page>
  );
}

export function CertificatePdfDocument(props: CertificatePdfProps) {
  ensureFontRegistered();
  return (
    <Document title={`Certificate - ${props.courseTitle} - ${props.userName}`} author={props.issuerName} creator="Limio">
      <CertificatePageBody {...props} locale="vi" />
      <CertificatePageBody {...props} locale="en" />
    </Document>
  );
}

export function buildCertificatePdfFilename(courseTitle: string, userName: string): string {
  const courseSlug = slugify(courseTitle) || "khoa-hoc";
  const userSlug = slugify(userName) || "hoc-vien";
  return `chung-nhan_${courseSlug}_${userSlug}.pdf`;
}
