// Dựng file .pptx tối giản (đúng cấu trúc OOXML mà bộ đọc dùng) cho test và cho file thử E2E.
// Không nhằm mở được bằng PowerPoint với mọi chi tiết; chỉ đủ các phần: presentation, slide, layout, notes,
// media, bảng, biểu đồ, SmartArt.

import JSZip from "jszip";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// PNG 1×1 hợp lệ.
export const TINY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

export type FxPara = string | { text: string; lvl?: number; num?: boolean };

export interface FxChart {
  type: "bar" | "hbar" | "line" | "pie" | "doughnut";
  title?: string;
  labels: string[];
  series: Array<{ name: string; values: number[] }>;
  percent?: boolean;
}

/** Ô của bảng tính mẫu: chữ, số, số có định dạng (phần trăm, một chữ số thập phân), hoặc trống. */
export type FxCell = string | number | { v: number; fmt: "pct" | "0.0" } | null;

/**
 * Đối tượng nhúng (OLE) trên slide:
 * - `xlsxChart`: biểu đồ Excel dán dạng đối tượng nhúng (gói .xlsx có trang số liệu + biểu đồ). `noCache` = biểu đồ không lưu
 *   bộ đệm số (chỉ có công thức trỏ vào ô); `inSheet` = biểu đồ đặt trong trang số liệu thay vì trang biểu đồ riêng.
 * - `xlsxSheet`: vùng ô Excel dán dạng bảng tính nhúng; `oleSize` = vùng hiện trên slide.
 * - `bin`: đối tượng Excel 97–2003 (.bin); `broken`: gói .xlsx hỏng.
 * `direct` = `p:oleObj` đứng thẳng trong graphicData (không bọc mc:AlternateContent).
 */
export type FxOle = (
  | { kind: "xlsxChart"; chart: FxChart; noCache?: boolean; inSheet?: boolean }
  | { kind: "xlsxSheet"; rows: FxCell[][]; oleSize?: string; extraSheetFirst?: boolean }
  | { kind: "bin" }
  | { kind: "broken" }
) & { direct?: boolean };

export interface FxSlide {
  title?: string;
  titleType?: "title" | "ctrTitle";
  subtitle?: string[];
  body?: FxPara[];
  textBoxes?: Array<{ text: string; y: number; x?: number }>;
  notes?: string;
  hidden?: boolean;
  layout?: string;
  images?: Array<{ name: string; cx: number; cy: number; bytes?: Uint8Array }>;
  table?: string[][];
  /** `embeddedOnly`: biểu đồ PowerPoint mất bộ đệm số, số nằm trong gói Excel nhúng (c:externalData). */
  chart?: FxChart & { embeddedOnly?: boolean };
  ole?: FxOle;
  smartArt?: Array<{ text: string; children?: string[] }>;
  shapes?: string[];
  video?: boolean;
  animated?: boolean;
  equation?: string;
}

const W = 12192000;
const H = 6858000;

const para = (p: FxPara) => {
  const o = typeof p === "string" ? { text: p } : p;
  const pPr = o.lvl || o.num ? `<a:pPr${o.lvl ? ` lvl="${o.lvl}"` : ""}>${o.num ? '<a:buAutoNum type="arabicPeriod"/>' : ""}</a:pPr>` : "";
  return `<a:p>${pPr}<a:r><a:rPr lang="vi-VN"/><a:t>${esc(o.text)}</a:t></a:r></a:p>`;
};

const sp = (id: number, ph: string | null, paras: FxPara[], opts: { y?: number; x?: number; txBox?: boolean; geom?: string } = {}) => {
  const phXml = ph ? `<p:nvPr><p:ph${ph === "body" ? ' idx="1"' : ` type="${ph}"`}/></p:nvPr>` : "<p:nvPr/>";
  const xfrm = opts.y !== undefined ? `<a:xfrm><a:off x="${opts.x ?? 457200}" y="${opts.y}"/><a:ext cx="8000000" cy="900000"/></a:xfrm>` : "";
  const geom = opts.geom ? `<a:prstGeom prst="${opts.geom}"><a:avLst/></a:prstGeom>` : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="S${id}"/><p:cNvSpPr${opts.txBox ? ' txBox="1"' : ""}/>${phXml}</p:nvSpPr><p:spPr>${xfrm}${geom}</p:spPr><p:txBody><a:bodyPr/>${paras.map(para).join("")}</p:txBody></p:sp>`;
};

export async function buildPptx(slides: FxSlide[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const layouts = [...new Set(slides.map((s) => s.layout ?? "obj"))];
  const presRels: string[] = [];
  const sldIds: string[] = [];
  let chartNo = 0;
  let dataNo = 0;
  let oleNo = 0;

  layouts.forEach((t, i) => {
    zip.file(`ppt/slideLayouts/slideLayout${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${NS} type="${t}"><p:cSld><p:spTree/></p:cSld></p:sldLayout>`);
  });

  for (const [i, s] of slides.entries()) {
    const n = i + 1;
    // Thứ tự trong presentation.xml đảo tên file để thử việc đọc theo sldIdLst chứ không theo tên.
    const file = `slide${slides.length - i}.xml`;
    const rels: string[] = [`<Relationship Id="rLayout" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${layouts.indexOf(s.layout ?? "obj") + 1}.xml"/>`];
    const tree: string[] = [];
    let id = 2;
    if (s.title !== undefined) tree.push(sp(id++, s.titleType ?? "title", [s.title]));
    if (s.subtitle?.length) tree.push(sp(id++, "subTitle", s.subtitle));
    if (s.body?.length) tree.push(sp(id++, "body", s.body));
    for (const tb of s.textBoxes ?? []) tree.push(sp(id++, null, [tb.text], { y: tb.y, x: tb.x, txBox: true }));
    for (const [k, t] of (s.shapes ?? []).entries()) tree.push(sp(id++, null, [t], { y: 2000000, x: 500000 + k * 2500000, geom: "roundRect" }));
    tree.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Num"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:p><a:fld id="{1}" type="slidenum"><a:t>${n}</a:t></a:fld></a:p></p:txBody></p:sp>`);
    if (s.equation) {
      tree.push(
        `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="a14">${sp(id++, null, [], { y: 4000000, txBox: true }).replace(
          "<a:bodyPr/>",
          `<a:bodyPr/><a:p><a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>${esc(s.equation)}</m:t></m:r></m:oMath></m:oMathPara></a14:m></a:p>`,
        )}</mc:Choice><mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="99" name="F"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>FALLBACK</a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback></mc:AlternateContent>`,
      );
    }
    for (const [k, im] of (s.images ?? []).entries()) {
      const rid = `rImg${k}`;
      rels.push(`<Relationship Id="${rid}" Type="${REL}/image" Target="../media/${im.name}"/>`);
      zip.file(`ppt/media/${im.name}`, im.bytes ?? TINY_PNG);
      tree.push(
        `<p:pic><p:nvPicPr><p:cNvPr id="${id++}" name="P${k}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${im.cx}" cy="${im.cy}"/></a:xfrm></p:spPr></p:pic>`,
      );
    }
    if (s.video) {
      tree.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id++}" name="V"/><p:cNvPicPr/><p:nvPr><a:videoFile r:link="rVid"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip/></p:blipFill><p:spPr/></p:pic>`);
    }
    if (s.table) {
      const rows = s.table.map((r) => `<a:tr h="370840">${r.map((c) => `<a:tc><a:txBody><a:bodyPr/>${para(c)}</a:txBody></a:tc>`).join("")}</a:tr>`).join("");
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="T"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="8000000" cy="3000000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid/>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
      );
    }
    if (s.chart) {
      chartNo += 1;
      rels.push(`<Relationship Id="rChart" Type="${REL}/chart" Target="../charts/chart${chartNo}.xml"/>`);
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="C"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rChart"/></a:graphicData></a:graphic></p:graphicFrame>`,
      );
      const c = s.chart;
      let external = "";
      if (c.embeddedOnly) {
        const pkg = `Microsoft_Excel_Worksheet${chartNo}.xlsx`;
        zip.file(`ppt/embeddings/${pkg}`, await buildXlsx({ kind: "data", chart: c }));
        zip.file(
          `ppt/charts/_rels/chart${chartNo}.xml.rels`,
          `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/package" Target="../embeddings/${pkg}"/></Relationships>`,
        );
        external = '<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>';
      }
      zip.file(`ppt/charts/chart${chartNo}.xml`, chartXml(c, { cache: !c.embeddedOnly, external }));
    }
    if (s.ole) {
      oleNo += 1;
      const o = s.ole;
      const isXlsx = o.kind !== "bin";
      const target = isXlsx ? `Microsoft_Excel_${o.kind === "xlsxChart" ? "Chart" : "Worksheet"}${oleNo}.xlsx` : `oleObject${oleNo}.bin`;
      const progId = o.kind === "xlsxChart" ? "Excel.Chart.8" : o.kind === "bin" ? "Excel.Sheet.8" : "Excel.Sheet.12";
      rels.push(`<Relationship Id="rOle" Type="${REL}/${isXlsx ? "package" : "oleObject"}" Target="../embeddings/${target}"/>`);
      rels.push(`<Relationship Id="rOleImg" Type="${REL}/image" Target="../media/ole${oleNo}.emf"/>`);
      zip.file(`ppt/media/ole${oleNo}.emf`, new Uint8Array([1, 0, 0, 0]));
      zip.file(
        `ppt/embeddings/${target}`,
        o.kind === "xlsxChart"
          ? await buildXlsx({ kind: "chart", chart: o.chart, noCache: o.noCache, inSheet: o.inSheet })
          : o.kind === "xlsxSheet"
            ? await buildXlsx({ kind: "sheet", rows: o.rows, oleSize: o.oleSize, extraSheetFirst: o.extraSheetFirst })
            : o.kind === "broken"
              ? new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9])
              : new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]),
      );
      const oleObj = (fallback: boolean) =>
        `<p:oleObj name="Object" r:id="rOle" imgW="5000" imgH="3000" progId="${progId}"><p:embed/>${
          fallback
            ? `<p:pic><p:nvPicPr><p:cNvPr id="0" name=""/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rOleImg"/></p:blipFill><p:spPr/></p:pic>`
            : ""
        }</p:oleObj>`;
      const inner = o.direct
        ? oleObj(true)
        : `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:v="urn:schemas-microsoft-com:vml" Requires="v">${oleObj(false)}</mc:Choice><mc:Fallback>${oleObj(true)}</mc:Fallback></mc:AlternateContent>`;
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="Object"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="8000000" cy="4000000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">${inner}</a:graphicData></a:graphic></p:graphicFrame>`,
      );
    }
    if (s.smartArt) {
      dataNo += 1;
      rels.push(`<Relationship Id="rDm" Type="${REL}/diagramData" Target="../diagrams/data${dataNo}.xml"/>`);
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="D"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rDm" r:lo="x" r:qs="y" r:cs="z"/></a:graphicData></a:graphic></p:graphicFrame>`,
      );
      const pts: string[] = ['<dgm:pt modelId="doc" type="doc"><dgm:t><a:bodyPr/><a:p><a:endParaRPr/></a:p></dgm:t></dgm:pt>'];
      const cxns: string[] = [];
      s.smartArt.forEach((node, k) => {
        pts.push(`<dgm:pt modelId="n${k}"><dgm:t><a:bodyPr/><a:p><a:r><a:t>${esc(node.text)}</a:t></a:r></a:p></dgm:t></dgm:pt>`);
        pts.push(`<dgm:pt modelId="t${k}" type="parTrans"/><dgm:pt modelId="s${k}" type="sibTrans"/><dgm:pt modelId="pres${k}" type="pres"><dgm:t><a:p><a:r><a:t>RÁC</a:t></a:r></a:p></dgm:t></dgm:pt>`);
        cxns.push(`<dgm:cxn modelId="c${k}" srcId="doc" destId="n${k}" srcOrd="${k}" destOrd="0"/>`);
        cxns.push(`<dgm:cxn modelId="p${k}" type="presOf" srcId="n${k}" destId="pres${k}" srcOrd="0" destOrd="0"/>`);
        (node.children ?? []).forEach((ch, j) => {
          pts.push(`<dgm:pt modelId="n${k}c${j}"><dgm:t><a:bodyPr/><a:p><a:r><a:t>${esc(ch)}</a:t></a:r></a:p></dgm:t></dgm:pt>`);
          cxns.push(`<dgm:cxn modelId="c${k}c${j}" srcId="n${k}" destId="n${k}c${j}" srcOrd="${j}" destOrd="0"/>`);
        });
      });
      zip.file(
        `ppt/diagrams/data${dataNo}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst>${pts.join("")}</dgm:ptLst><dgm:cxnLst>${cxns.join("")}</dgm:cxnLst></dgm:dataModel>`,
      );
    }
    if (s.notes !== undefined) {
      rels.push(`<Relationship Id="rNotes" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`);
      const nparas = s.notes.split("\n").map((l) => `<a:p>${l ? `<a:r><a:t>${esc(l)}</a:t></a:r>` : ""}</a:p>`).join("");
      zip.file(
        `ppt/notesSlides/notesSlide${n}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><p:notes ${NS}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Img"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${nparas}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`,
      );
    }
    const timing = s.animated ? '<p:timing><p:tnLst><p:par><p:cTn id="1"><p:childTnLst><p:par><p:cTn id="2" presetID="10" presetClass="entr"/></p:par></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>' : "";
    zip.file(
      `ppt/slides/${file}`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}${s.hidden ? ' show="0"' : ""}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${tree.join("")}</p:spTree></p:cSld>${timing}</p:sld>`,
    );
    zip.file(`ppt/slides/_rels/${file}.rels`, `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
    presRels.push(`<Relationship Id="rId${n + 10}" Type="${REL}/slide" Target="slides/${file}"/>`);
    sldIds.push(`<p:sldId id="${255 + n}" r:id="rId${n + 10}"/>`);
  }

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${NS}><p:sldIdLst>${sldIds.join("")}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/></p:presentation>`,
  );
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join("")}</Relationships>`);
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  return zip.generateAsync({ type: "uint8array" });
}

export const SLIDE_W = W;
export const SLIDE_H = H;

// ── Biểu đồ và gói Excel nhúng ──────────────────────────────────────────────

const DATA_SHEET = "Số liệu";
const col = (i: number) => String.fromCharCode(65 + i);
const ref = (c: number, r1: number, r2?: number) => `'${DATA_SHEET}'!$${col(c)}$${r1}${r2 !== undefined ? `:$${col(c)}$${r2}` : ""}`;

/**
 * Chart XML (DrawingML) của một biểu đồ; công thức trỏ vào trang "Số liệu" (cột A nhãn, cột B, C… các chuỗi, hàng 1 tên chuỗi).
 * `cache: false` = không lưu bộ đệm (chỉ công thức), như biểu đồ Excel chưa từng được tính lại.
 */
export function chartXml(c: FxChart, opts: { cache: boolean; external?: string }): string {
  const tag = c.type === "hbar" ? "barChart" : `${c.type}Chart`;
  const dir = c.type === "bar" ? '<c:barDir val="col"/>' : c.type === "hbar" ? '<c:barDir val="bar"/>' : "";
  const fmt = c.percent ? "<c:formatCode>0%</c:formatCode>" : "<c:formatCode>General</c:formatCode>";
  const n = c.labels.length;
  const strCache = (xs: string[]) => (opts.cache ? `<c:strCache><c:ptCount val="${xs.length}"/>${xs.map((l, j) => `<c:pt idx="${j}"><c:v>${esc(l)}</c:v></c:pt>`).join("")}</c:strCache>` : "");
  const sers = c.series
    .map(
      (se, k) =>
        `<c:ser><c:idx val="${k}"/><c:tx><c:strRef><c:f>${esc(ref(k + 1, 1))}</c:f>${strCache([se.name])}</c:strRef></c:tx><c:cat><c:strRef><c:f>${esc(ref(0, 2, n + 1))}</c:f>${strCache(c.labels)}</c:strRef></c:cat><c:val><c:numRef><c:f>${esc(ref(k + 1, 2, n + 1))}</c:f>${
          opts.cache ? `<c:numCache>${fmt}<c:ptCount val="${se.values.length}"/>${se.values.map((v, j) => `<c:pt idx="${j}"><c:v>${v}</c:v></c:pt>`).join("")}</c:numCache>` : ""
        }</c:numRef></c:val></c:ser>`,
    )
    .join("");
  const title = c.title ? `<c:title><c:tx><c:rich><a:p><a:r><a:t>${esc(c.title)}</a:t></a:r></a:p></c:rich></c:tx></c:title>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}"><c:chart>${title}<c:plotArea><c:${tag}>${dir}${sers}</c:${tag}></c:plotArea></c:chart>${opts.external ?? ""}</c:chartSpace>`;
}

const RELS = (items: Array<[string, string, string]>) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`)
    .join("")}</Relationships>`;
const SML = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

export type FxXlsx =
  | { kind: "data"; chart: FxChart }
  | { kind: "chart"; chart: FxChart; noCache?: boolean; inSheet?: boolean }
  | { kind: "sheet"; rows: FxCell[][]; oleSize?: string; extraSheetFirst?: boolean };

/** Gói .xlsx tối giản: trang tính (chuỗi dùng chung, kiểu số), trang biểu đồ hoặc biểu đồ trong trang, `oleSize`. */
export async function buildXlsx(spec: FxXlsx): Promise<Uint8Array> {
  const zip = new JSZip();
  const strings: string[] = [];
  const sIdx = (t: string) => {
    const i = strings.indexOf(t);
    return i >= 0 ? i : strings.push(t) - 1;
  };
  const sheetXml = (rows: FxCell[][], drawing: boolean) => {
    const body = rows
      .map((r, ri) => {
        const cells = r
          .map((c, ci) => {
            const a = `${col(ci)}${ri + 1}`;
            if (c === null) return "";
            if (typeof c === "string") return `<c r="${a}" t="s"><v>${sIdx(c)}</v></c>`;
            if (typeof c === "number") return `<c r="${a}"><v>${c}</v></c>`;
            return `<c r="${a}" s="${c.fmt === "pct" ? 1 : 2}"><v>${c.v}</v></c>`;
          })
          .join("");
        return `<row r="${ri + 1}">${cells}</row>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet ${SML} xmlns:r="${REL}"><sheetData>${body}</sheetData>${drawing ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
  };
  const chartRows = (c: FxChart): FxCell[][] => [
    [null, ...c.series.map((s) => s.name)],
    ...c.labels.map((l, j) => [l, ...c.series.map((s): FxCell => (c.percent ? { v: s.values[j]!, fmt: "pct" } : s.values[j]!))]),
  ];
  const drawingXml =
    '<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:absoluteAnchor><xdr:graphicFrame><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="' +
    REL +
    '" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame></xdr:absoluteAnchor></xdr:wsDr>';

  // Danh sách trang theo thứ tự trong sổ; activeTab chỉ vào trang đang hiện.
  const sheets: Array<{ name: string; kind: "worksheet" | "chartsheet"; xml: string; drawing: boolean }> = [];
  let active = 0;
  let oleSize: string | undefined;
  let chart: { c: FxChart; cache: boolean } | null = null;
  if (spec.kind === "data") {
    sheets.push({ name: DATA_SHEET, kind: "worksheet", xml: sheetXml(chartRows(spec.chart), false), drawing: false });
  } else if (spec.kind === "chart") {
    chart = { c: spec.chart, cache: !spec.noCache };
    if (spec.inSheet) {
      sheets.push({ name: DATA_SHEET, kind: "worksheet", xml: sheetXml(chartRows(spec.chart), true), drawing: true });
    } else {
      sheets.push({ name: "Biểu đồ 1", kind: "chartsheet", xml: `<?xml version="1.0" encoding="UTF-8"?><chartsheet ${SML} xmlns:r="${REL}"><drawing r:id="rId1"/></chartsheet>`, drawing: true });
      sheets.push({ name: DATA_SHEET, kind: "worksheet", xml: sheetXml(chartRows(spec.chart), false), drawing: false });
    }
  } else {
    if (spec.extraSheetFirst) {
      sheets.push({ name: "Ghi chú", kind: "worksheet", xml: sheetXml([["không phải bảng trên slide"]], false), drawing: false });
      active = 1;
    }
    sheets.push({ name: "Bảng", kind: "worksheet", xml: sheetXml(spec.rows, false), drawing: false });
    oleSize = spec.oleSize;
  }

  const wbRels: Array<[string, string, string]> = [];
  sheets.forEach((sh, i) => {
    const dir = sh.kind === "chartsheet" ? "chartsheets" : "worksheets";
    zip.file(`xl/${dir}/sheet${i + 1}.xml`, sh.xml);
    wbRels.push([`rId${i + 1}`, sh.kind, `${dir}/sheet${i + 1}.xml`]);
    if (sh.drawing) {
      zip.file(`xl/${dir}/_rels/sheet${i + 1}.xml.rels`, RELS([["rId1", "drawing", "../drawings/drawing1.xml"]]));
      zip.file("xl/drawings/drawing1.xml", drawingXml);
      zip.file("xl/drawings/_rels/drawing1.xml.rels", RELS([["rId1", "chart", "../charts/chart1.xml"]]));
    }
  });
  if (chart) zip.file("xl/charts/chart1.xml", chartXml(chart.c, { cache: chart.cache }));
  wbRels.push(["rIdS", "sharedStrings", "sharedStrings.xml"], ["rIdT", "styles", "styles.xml"]);
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook ${SML} xmlns:r="${REL}"><bookViews><workbookView activeTab="${active}"/></bookViews><sheets>${sheets
      .map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets>${oleSize ? `<oleSize ref="${oleSize}"/>` : ""}</workbook>`,
  );
  zip.file("xl/_rels/workbook.xml.rels", RELS(wbRels));
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8"?><sst ${SML} count="${strings.length}">${strings.map((t) => `<si><t>${esc(t)}</t></si>`).join("")}</sst>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?><styleSheet ${SML}><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="9"/><xf numFmtId="164"/></cellXfs></styleSheet>`,
  );
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  return zip.generateAsync({ type: "uint8array" });
}
