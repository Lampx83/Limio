import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Circle,
  Ellipse,
  G,
  Line,
  Polygon,
  Path,
  Image,
} from "@react-pdf/renderer";
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
const CARD_W = PAGE_W - 2 * MARGIN;
const CARD_H = PAGE_H - 2 * MARGIN;

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
  // Lớp hoạ tiết nền — vẽ trước (dưới) outerFrame trong cùng `card`, nên
  // outerFrame/innerFrame phải để trong suốt (không set backgroundColor)
  // thì hoạ tiết mới lộ ra sau chữ.
  cardPattern: { position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H },
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
  kicker: { fontSize: 22.5, fontWeight: "bold", color: ACCENT, marginTop: 18 },
  title: {
    fontSize: 51,
    fontWeight: "bold",
    color: INK,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 1.15,
    maxWidth: 620,
  },
  // Tên học viên đứng 1 dòng riêng ngay dưới tên khoá, không kèm nhãn
  // "Hoàn thành bởi" — to hơn + đậm để đọc như một dòng tên, không phải màu
  // gradient (react-pdf fill chỉ nhận 1 màu đặc, và PDF vốn không theo
  // hướng gradient của web).
  sublineName: { fontSize: 26, fontWeight: "bold", color: INK, textAlign: "center", marginTop: 22 },
  dateLine: { fontSize: 15.75, color: "#9ca3af", textAlign: "center", marginTop: 4 },
  skillsLabel: {
    fontSize: 13.5,
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
    fontSize: 14.25,
    color: ACCENT,
    borderWidth: 0.75,
    borderColor: "#d9f99d",
    borderStyle: "solid",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  // Chỉ dùng khi có logo Organization (issuerLogoUrl != null) — top header
  // CHỈ gồm 2 logo (Limio + Organization) đứng cạnh nhau, căn giữa; KHÔNG
  // kèm tên chữ Organization ở đây nữa — tên đã có ở "issuerRow" cuối trang
  // (ô chữ ký, "Cấp bởi Limio × <tên trường>"). Trường có tên nhưng chưa
  // upload logo thì top vẫn chỉ hiện Limio một mình — không có ảnh thứ 2 để
  // ghép, tên vẫn hiện đủ ở ô chữ ký.
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  topRowDivider: { width: 1, height: 28, backgroundColor: "#d1d5db" },
  topRowOrgLogo: { width: 36, height: 36, objectFit: "contain" },
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
  // 2 chữ ký cạnh nhau (Limio bên trái, Organization bên phải) khi khoá
  // thuộc 1 Organization — mỗi bên là 1 signatureBlock độc lập, đầy đủ ảnh +
  // dòng kẻ + tên/chức danh riêng, không gộp chung 1 khối như bản cũ. Chỉ
  // Limio (không Organization) thì vẫn 1 signatureBlock đứng một mình.
  signatureColumnsRow: { flexDirection: "row", gap: 28 },
  signatureBlock: { alignItems: "flex-start" },
  signatureImage: { height: 24, maxWidth: 84, objectFit: "contain", marginBottom: 4 },
  signatureRule: { width: 110, height: 0.75, backgroundColor: "#a3a3a3", marginBottom: 6 },
  issuerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  issuerLogo: { width: 18, height: 18, objectFit: "contain" },
  issuerName: { fontSize: 14, fontWeight: "bold", color: INK },
  issuerCaption: { fontSize: 9.5, color: MUTED, marginTop: 2 },
  footerCenter: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 14,
  },
  footerLabel: { fontSize: 11.25, color: "#9ca3af" },
  footerMono: { fontSize: 12.75, color: MUTED, marginTop: 1 },
});

const STRINGS = {
  vi: {
    kicker: "CHỨNG NHẬN HOÀN THÀNH",
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
 * Một "lát chanh" trừu tượng cho hoạ tiết nền — vành tròn mảnh (vỏ) + 6 nan
 * CONG (thay vì 4 nan thẳng + hạt + highlight của LimeSliceShapes thật), toạ
 * độ cục bộ tâm (16,16) bán kính 13 cho khớp hệ 32×32 dùng chung trong file.
 * Cong thay vì thẳng để không đọc thành logo Limio thu nhỏ khi lặp lại dày
 * đặc — chỉ còn giữ "cấu trúc múi toả tâm" của một lát chanh, phần diễn giải
 * trừu tượng, không phải bản sao icon thương hiệu.
 */
function LimeSliceAbstractMotif() {
  const cx = 16;
  const cy = 16;
  const r = 12;
  const spokes = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i * 60 * Math.PI) / 180;
    const ex = cx + r * Math.cos(a0);
    const ey = cy + r * Math.sin(a0);
    const ca = a0 + (26 * Math.PI) / 180;
    const cr = r * 0.55;
    const cxp = cx + cr * Math.cos(ca);
    const cyp = cy + cr * Math.sin(ca);
    spokes.push(
      <Path
        key={i}
        d={`M ${cx} ${cy} Q ${cxp.toFixed(2)} ${cyp.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`}
        stroke={ACCENT}
        strokeWidth={0.9}
        strokeLinecap="round"
        fill="none"
      />,
    );
  }
  return (
    <>
      <Circle cx={cx} cy={cy} r={r + 1} stroke={ACCENT} strokeWidth={1} fill="none" />
      {spokes}
    </>
  );
}

/**
 * Hoạ tiết nền tô kín `card` ở opacity rất thấp — lưới lệch hàng (mỗi hàng
 * lệch nửa ô so với hàng trên, kiểu gạch xây) chứ không phải lưới vuông đều,
 * để tránh cảm giác "dán tem" của icon lặp lại đều tăm tắp.
 */
function BackgroundPattern({ width, height }: { width: number; height: number }) {
  const cell = 48;
  const scale = cell / 32;
  const rows = Math.ceil(height / cell) + 1;
  const cols = Math.ceil(width / cell) + 2;
  const marks = [];
  for (let r = 0; r <= rows; r++) {
    const offsetX = r % 2 === 1 ? cell / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = c * cell + offsetX;
      const y = r * cell;
      marks.push(
        <G key={`${r}-${c}`} transform={`translate(${x}, ${y}) scale(${scale})`}>
          <LimeSliceAbstractMotif />
        </G>,
      );
    }
  }
  return <G opacity={0.07}>{marks}</G>;
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
  /** Logo của Organization (URL tuyệt đối, react-pdf fetch phía server) — null nếu không có; quyết định có hiện logo 2 ở header hay không. */
  issuerLogoUrl: string | null;
  /** Tên riêng Organization (không tiền tố "Limio × ") — null nếu khoá không thuộc Organization nào; quyết định có tách 2 cột chữ ký hay không. */
  issuerOrgName: string | null;
  /** Ảnh chữ ký người đại diện Organization — null nếu khoá không thuộc Organization nào hoặc trường chưa cấu hình. */
  issuerSignatureUrl: string | null;
  /** Tên + chức danh người đại diện Organization, in dưới ảnh chữ ký — null nếu chưa cấu hình. */
  issuerSignatureName: string | null;
  issuerSignatureTitle: string | null;
  /** Ảnh chữ ký Limio (dùng chung toàn hệ thống) — null nếu chưa cấu hình ở /admin/settings. */
  platformSignatureUrl: string | null;
  /** Tên + chức danh người ký Limio — null nếu chưa cấu hình. */
  platformSignatureName: string | null;
  platformSignatureTitle: string | null;
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
    issuerOrgName,
    issuerSignatureUrl,
    issuerSignatureName,
    issuerSignatureTitle,
    platformSignatureUrl,
    platformSignatureName,
    platformSignatureTitle,
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
        <View style={styles.cardPattern}>
          <Svg width={CARD_W} height={CARD_H}>
            <BackgroundPattern width={CARD_W} height={CARD_H} />
          </Svg>
        </View>
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            {issuerLogoUrl ? (
              <View style={styles.topRow}>
                <LimioLearningLogo />
                <View style={styles.topRowDivider} />
                <Image src={issuerLogoUrl} style={styles.topRowOrgLogo} />
              </View>
            ) : (
              <LimioLearningLogo />
            )}
            <Text style={styles.kicker}>{tracked(t.kicker)}</Text>

            <Text style={styles.title}>{courseTitle}</Text>

            <Text style={styles.sublineName}>{userName}</Text>
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
              {issuerOrgName ? (
                <View style={styles.signatureColumnsRow}>
                  <View style={styles.signatureBlock}>
                    {platformSignatureUrl && (
                      <Image src={platformSignatureUrl} style={styles.signatureImage} />
                    )}
                    <View style={styles.signatureRule} />
                    <Text style={styles.issuerName}>{platformSignatureName || "Limio Learning"}</Text>
                    <Text style={styles.issuerCaption}>
                      {platformSignatureTitle || t.issuerCaption}
                    </Text>
                  </View>
                  <View style={styles.signatureBlock}>
                    {issuerSignatureUrl && (
                      <Image src={issuerSignatureUrl} style={styles.signatureImage} />
                    )}
                    <View style={styles.signatureRule} />
                    <View style={styles.issuerRow}>
                      {issuerLogoUrl && <Image src={issuerLogoUrl} style={styles.issuerLogo} />}
                      <Text style={styles.issuerName}>{issuerSignatureName || issuerOrgName}</Text>
                    </View>
                    {issuerSignatureTitle && (
                      <Text style={styles.issuerCaption}>{issuerSignatureTitle}</Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.signatureBlock}>
                  {platformSignatureUrl && (
                    <Image src={platformSignatureUrl} style={styles.signatureImage} />
                  )}
                  <View style={styles.signatureRule} />
                  <Text style={styles.issuerName}>{platformSignatureName || issuerName}</Text>
                  <Text style={styles.issuerCaption}>{platformSignatureTitle || t.issuerCaption}</Text>
                </View>
              )}
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
